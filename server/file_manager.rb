require 'singleton'

class FileManager
  include Singleton

  def fetch(file, sock)
    begin
      File.open(File.expand_path(sock.current_dir) + "/#{file}").each_line { |l|
        sock.sendClient("FETCH:"+l, sock.aesKey);
      }
      sock.sendClient("FETCH_DONE:", sock.aesKey);
    rescue
      sock.sendClient("FETCH_FAIL:", sock.aesKey);
    end
  end
end
