require 'singleton'
require 'json'
require File.expand_path('virtual_file', File.dirname(__FILE__))

class FileManager
  include Singleton

  def initialize
    @file_sockets = Hash.new
    @socket_file = Hash.new
    @virtual_files = Hash.new
  end

  def load_file(fp, np)
    @virtual_files[np] = VirtualFile.new
    # Try to load the file
    File.open(fp).each_line { |l|
      @virtual_files[np].insertLine(l)
    }
  end
  
  def send_file(np, sock)
    @virtual_files[np].each_line { |l|
      sock.sendClient("FETCH:"+l, sock.aesKey);
    }
  end

  def fetch(file, sock)
    file_path = File.expand_path(sock.current_dir)+"/#{file}"
    norm_path = file_path.gsub(/\/+/, "/")
    begin
      if @virtual_files[norm_path].nil?
        load_file(file_path, norm_path)
      end
    rescue Exception => e
      unless @file_sockets[norm_path].nil?
        @file_sockets[norm_path].delete(sock)
      end
      sock.sendClient("FETCH_FAIL:", sock.aesKey);
      return;
    end
    # If we got here IO was ok, time to do bookkeeping
    send_file(norm_path, sock)
    # First unsubscribe from old file
    close_down(sock)
    # Subscribe to the new one
    @socket_file[sock] = norm_path
    @file_sockets[norm_path] = Array.new unless @file_sockets.has_key? norm_path
    @file_sockets[norm_path] << sock
    sock.sendClient("FETCH_DONE:", sock.aesKey);
  end

  def change(delta, sock)
    file = @socket_file[sock]
    @virtual_files[file].apply_delta(JSON.parse(delta))
    @file_sockets[file].each do |s|
      if s != sock
        s.sendClient("FETCH_CHANGE:"+delta, s.aesKey)
      end
    end
  end

  def close_down(sock)
    f = @socket_file[sock]
    if f
      @file_sockets[f].delete(sock)
      if @file_sockets[f].size == 0
        @virtual_files.delete(f)
      end
      @socket_file.delete(sock)
    end
  end

end
