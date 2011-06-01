$(function() {
  // Resizing the fields
  $(window).resize(function() {
    $("#input_field").width( $("#input").width() - 20 );
    $("#output").height( $(window).height() - $("#input").height() );
  });
  
  $("#input_field").width( $("#input").width() - 20 );
  $("#output").height( $(window).height() - $("#input").height() );
  $("#input_field").focus()
  
  // Handling the WebSocket connection
  var ws;
  var state = "disconnected";
  var pass_in_use;
  var aesKey;
  
  function openConnection(addr, pass) {
    state = "connecting"
    pass_in_use = pass;
    terminalOutput("Opening connection...");
    if (ws) 
      ws.close();
    ws = new WebSocket("ws://" + addr + ":8080/");
    ws.onopen = function(evt) { socketOpen(evt); }
    ws.onclose = function(evt) { socketClose(evt); }
    ws.onmessage = function(evt) { socketMessage(evt); }
    ws.onerror = function(evt) { socketError(evt); }
  }
  
  function socketError(e) {
    terminalOutput('<span style="color: red;">ERROR:</span> ' + e.data);
  }
  
  function socketOpen(e) {
    state = "authenticating"
    terminalOutput("Authenticating...");
    
    var shaObj = new jsSHA(pass_in_use);
    var hashvalue = shaObj.getHash("SHA-256", "HEX");
    encoded = GibberishAES.enc(hashvalue , pass_in_use);
    ws.send(encoded);
  }
  
  function socketClose(e) {
    state = "disconnected"
    terminalOutput("Closed connection");
  }
  
  function socketMessage(e) {
    switch(state) {
    case "authenticating":
      if(e.data == "AUTHOK") {
        aesKey = randomString();
        terminalOutput("Syncing AES key...");
        ws.send(GibberishAES.enc(aesKey, pass_in_use));
        state = "live"
        break;
      } else {
        terminalOutput("Authentication failed.");
        ws.close();
      }
    case "live":
      terminalChar(GibberishAES.dec(e.data, aesKey));
      terminalChar('\n');
      break;
    }
  }
  
  function socketSend(data) {
    if(state != "live") return;
    ws.send(GibberishAES.enc(data, aesKey));
  }
  
  // Handling the input commands
  $("#input").keypress(function(e) {
    if(e.which == "13") { // Pressed Enter
      parseCommand();
      e.preventDefault();
    }
  });
  
  function parseCommand() {
    com = $("#input_field").val();
    if(com[0] == ':') {
      switch($.trim(com.split(" ")[0])) {
      case ":open":
        addr = $.trim(com.split(" ")[1])
        pass = $.trim(com.split(" ")[2])
        openConnection(addr, pass);
        break;
      case ":close":
        ws.close();
        ws = null;
        break;
      }
    } else {
      socketSend(com);
    }
    $("#input_field").val("");
  }
  
  // Displaying output
  function terminalOutput(message) {
    $(".last").text(message);
    $(".last").removeClass("last");
    $("#output_lines").append("<li class='last' ></li>");
    scrollOutput();
  }
  
  function terminalChar(c) {
    if(c == '\n') {
      $(".last").removeClass("last");
      $("#output_lines").append("<li class='last' ></li>");
    } else {
      $(".last").append(c);
    }
    scrollOutput();
  }
  
  function scrollOutput() {
    $("#output").scrollTop($("#output")[0].scrollHeight);
  }
  
  terminalOutput("Welcome, type :open host to connect");
  
  // Helpers
  
  function randomString() {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = 64;
    var randomstring = '';
    for (var i=0; i<string_length; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring
  }
  
});