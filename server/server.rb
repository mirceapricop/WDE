require 'em-websocket'
require 'pty'
require 'cgi'
require 'gibberish'

puts "Started server!"
@shell = PTY.spawn 'env TERM=ansi COLUMNS=63 LINES=21 sh -i'
@gsocket = nil
@num_connections = 0
@state = "disconnected"

@pass = ARGV[0] || "default"
@hashedPass = Gibberish::SHA256(@pass)
@passCipher = Gibberish::AES.new(@pass)
# Destroying it so baddies can't even find it in the 
# memory
@pass = nil
@aesKey = ""

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
    @shell[1].write(aes(:decrypt, @aesKey, msg) + "\n")
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

