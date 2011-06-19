require 'gibberish'
require 'pty'
require 'cgi'
require File.expand_path('file_manager', File.dirname(__FILE__))

class SocketManager
  attr_accessor :aesKey, :current_dir

  def initialize(sock, pass = nil)
    @escape = "|" #The prob of the pipe char coming up in a file name is small enough
    
    @gsocket = sock
    @state = "disconnected"

    @pass = pass || "default"
    @hashedPass = Gibberish::SHA256(@pass)
    @passCipher = Gibberish::AES.new(@pass)
    @aesKey = ""

    # Bit of paranoia here
    # Destroying pass so baddies can't even find it in memory
    @pass = nil
    # You can have the start server command hidden by putting a
    # space in front of it.
    @current_dir = ""
    @output_buffer = ""

    puts "Started new shell!"
    start_shell
   
    # This thread prints output from our virtual shell back into the socket
    Thread.new do 
      loop do
        case @state
        when "live"
          c = @shell[0].read(1)
          @output_buffer << c
      
          @output_buffer.match(/^\r\r\r(.*?)>/) do |m|
            old_dir = @current_dir
            @current_dir = m[1]
            if old_dir != @current_dir
              sendClient("TREE_NEW:#{tree_id(File.expand_path(@current_dir))}", @aesKey)
              send_tree(@current_dir)
            end
          end

          # Send the escaped character, with a random string appended
          # For security
          sendClient("TERM:"+prepare_output(c)+rand.to_s[2..7],@aesKey) if @state=="live"
          if @output_buffer.include? "\n"
            @output_buffer = ""
          end
        end
      end
    end.priority=1
  end

  def tree_id(s)
    return "root" if s.length == 1 # If s is empty
    "root#{@escape}" + s.gsub("//","/")[1..s.length-1].gsub('/',"#{@escape}")
  end

  def file_type(s)
    File.directory?(s) ? '"folder"' : '"file"'
  end

  def tree_json(s)
    '{ "attr": { "id": "'+tree_id(s)+'", "rel": '+file_type(s)+'}, 
       "data": "' + File.basename(s)+'" }'
  end

  def send_tree(root)
    Dir.glob("#{File.expand_path(root)}/*").each do |s|
      sendClient("TREE_INS:#{tree_id(File.dirname(s))}/#{tree_json(s)}", @aesKey)
    end
  end

  def set_state(state)
    @state = state
  end

  def start_shell
    @shell = PTY.spawn 'env PS1="\r\r\r\w>" TERM=dumb COLUMNS=63 LINES=21 sh -i'
  end

  # Encryption helper
  def aes(m, k, t, cipher = nil)
    cipher = Gibberish::AES.new(k) if cipher.nil?
    if(m == :encrypt)
      cipher.enc(t)
    else
      begin
        res = cipher.dec(t)
        return res
      rescue OpenSSL::Cipher::CipherError
        return ""
      end
    end
  end

  # Connection interfaces
  def sendClient(data, key = nil, cipher = nil)
    return if @gsocket.nil?
    if key.nil? and cipher.nil?
      @gsocket.send(data)
    else
      @gsocket.send(aes(:encrypt, key, data, cipher))
    end
  end

  def kill_shell_procs
    # Kill proc executing on virtual shell
    procs = %x[ps -t #{File.basename(@shell[1].path)}].split("\n")
    procs.each do |p|
      pid = p.split(' ')[0]
      unless pid.to_i == @shell[2] or p.include? "PID"
        system("kill #{pid}")
      end
    end
  end

  def handleClient(msg)
    case @state
    when "live"
      msg = aes(:decrypt, @aesKey, msg)
      com_type = msg.split(":", 2)[0]
      com = msg.split(":", 2)[1]
      case com_type
      when "EXEC"
        # Execute command
        @shell[1].write(com + "\n")
      when "BR"
        kill_shell_procs
      when "FETCH"
        FileManager.instance.fetch(com, self)
      when "FETCH_CHANGE"
        FileManager.instance.change(com, self)
      when "FETCH_WR"
        FileManager.instance.write(self)
      when "TREE_GET"
        send_tree(com.gsub("|","/").sub("root","/"))
      end
    when "authenticating"
      received_hash = aes(:decrypt, "", msg, @passCipher)
      if received_hash != @hashedPass
        @gsocket.close_websocket
        @gsocket = nil
      else
        sendClient("AUTHOK", "", @passCipher)
        @state = "sync_key"
      end
    when "sync_key"
      @aesKey = aes(:decrypt, "", msg, @passCipher)
      sendClient("TERM_FULL: Connection established. Type away!", @aesKey)
      @state = "live"
    end
  end

  def prepare_output(msg)
    CGI.escapeHTML(msg).gsub(" ", "&nbsp;")
  end

  def close_down
    @state = "disconnected"
    FileManager.instance.close_down(self)
    kill_shell_procs
    system("kill -9 #{@shell[2]}")
    Process.wait(@shell[2])
    puts "Closing shell"
  end
end

