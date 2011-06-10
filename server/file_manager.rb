require 'singleton'

class FileManager
  include Singleton

  def initialize
    @file_sockets = Hash.new
    @socket_file = Hash.new
  end

  def fetch(file, sock)
    full_path = File.expand_path(sock.current_dir) + "/#{file}"
    begin
      # Try to send the file
      File.open(full_path).each_line { |l|
        sock.sendClient("FETCH:"+l, sock.aesKey);
      }

      # If we got here IO was ok, time to do bookkeeping
      # First unsubscribe from old file
      close_down(sock)

      # Subscribe to the new one
      @socket_file[sock] = full_path
      @file_sockets[full_path] = Array.new unless @file_sockets.has_key? full_path
      @file_sockets[full_path] << sock

      sock.sendClient("FETCH_DONE:", sock.aesKey);
    rescue Exception => e
      puts e.message
      @file_sockets[full_path].delete(sock)
      sock.sendClient("FETCH_FAIL:", sock.aesKey);
    end
  end

  def change(delta, sock)
    file = @socket_file[sock]
    @file_sockets[file].each do |s|
      if s != sock
        puts sock.to_s + " sends to: " + s.to_s
        s.sendClient("FETCH_CHANGE:"+delta, s.aesKey)
      end
    end
  end

  def close_down(sock)
    if @socket_file[sock]
      @file_sockets[@socket_file[sock]].delete(sock)
      @socket_file.delete(sock)
    end
  end

end
