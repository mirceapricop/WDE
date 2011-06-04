require 'em-websocket'
require File.expand_path('socket_manager', File.dirname(__FILE__))

@managers = Hash.new
@pass = ARGV[0]

puts "Started server!"
# Here we handle the socket
EventMachine.run {
  EventMachine::WebSocket.start(:host => "0.0.0.0", :port => 8080, :debug => false) do |ws|
    ws.onopen { 
      @managers[ws] = SocketManager.new(ws, @pass)
      @managers[ws].set_state("authenticating")
    }
    ws.onmessage { |msg| 
      @managers[ws].handleClient(msg)
    }
    ws.onclose { 
      @managers[ws].close_down
      @managers.delete(ws)
    }
  end
}

