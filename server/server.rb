require 'em-websocket'
require 'pty'
require 'cgi'
require 'gibberish'

@gsocket = nil
@num_connections = 0
@state = "disconnected"

@pass = ARGV[0] || "default"
@hashedPass = Gibberish::SHA256(@pass)
@passCipher = Gibberish::AES.new(@pass)
@aesKey = ""

# Bit of paranoia here
# Destroying pass so baddies can't even find it in memory
@pass = nil
# You can have the start server command hidden by putting a
# space in front of it.

def start_shell
  @shell = PTY.spawn 'env TERM=dumb COLUMNS=63 LINES=21 sh -i'
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
      # Kill proc executing on virtual shell
      procs = %x[ps -t #{File.basename(@shell[1].path)}].split("\n")
      procs.each do |p|
        unless p.include? "sh" or p.include? "PID"
          pid = p.split(' ')[0].to_i
          system("kill #{pid}")
        end
      end
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
    sendClient("Connection established. Type away!", @aesKey)
    @state = "live"
  end
end

puts "Started server!"
start_shell
# This thread prints output from our virtual shell back into the socket
Thread.new do 
  loop do
    if @state == "live" then
      c = @shell[0].readline
      sendClient(CGI.escapeHTML(c).gsub(" ", "&nbsp;"), @aesKey);
    end
  end
end.priority=1

# Here we handle the socket
EventMachine.run {
  EventMachine::WebSocket.start(:host => "0.0.0.0", :port => 8080, :debug => false) do |ws|
    ws.onopen { 
      @num_connections += 1
      if @state == "disconnected"
        @state = "authenticating"
        @gsocket = ws
      else
        ws.close_websocket
      end
    }
    ws.onmessage { |msg| 
      handleClient(msg)
    }
    ws.onclose { 
      @num_connections -= 1
      if @num_connections == 0
        @state = "disconnected"
        puts "WebSocket closed" 
      end
    }
  end
}

