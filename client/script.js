$(function() {
  // Resizing the fields
  function resize_terminal() {
    $("#input_field").width( $("#input").width() - 20 );
    $("#output").height( $("#terminal").height() - $("#input").height() );
    $("#output").width($("#terminal").width()-5);
    scrollOutput();
  }
  
  $(window).resize(resize_terminal);
  
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
    socketSend(hashvalue, pass_in_use);
  }
  
  function socketClose(e) {
    state = "disconnected"
    terminalOutput("Closed connection");
  }
  
  function socketMessage(e) {
    switch(state) {
    case "authenticating":
      if(GibberishAES.dec(e.data, pass_in_use) == "AUTHOK") {
        aesKey = randomString();
        terminalOutput("Syncing AES key...");
        socketSend(aesKey, pass_in_use);
        state = "live"
      } else {
        terminalOutput("Authentication failed.");
      }
      break;
    case "live":
      data = GibberishAES.dec(e.data, aesKey);
      split = data.indexOf(':');
      com_type = data.slice(0,split)
      com = data.slice(split+1);
      switch(com_type) {
      case "TERM":
        terminalChar(com);
        terminalChar('\n');
        break;
      case "FETCH":
        editor.insert(com);
        break;
      case "FETCH_DONE":
        main_layout.open("north");
        break;
      case "FETCH_FAIL":
        terminalOutput("Error at fetching. Use touch to create a new file.");
        break;  
      case "TREE_INS":
        split = com.indexOf('/');
        node_id = "#" + escape_id(com.slice(0, split));
        node_json = com.slice(split+1);
        tree = $.jstree._reference(node_id);
        tree.create_node(node_id, "inside", $.parseJSON(node_json));
        tree.open_node(node_id);
        break;
      case "TREE_NEW":
        $(tree_root + " ul").empty();
        $(tree_root).attr("id", com);
        tree_root = "#" + escape_id(com);
        $(tree_root + " a").text(com.slice(com.lastIndexOf('|')+1));
        break;
      }
      break;
    }
  }
  
  function socketSend(data, key) {
    ws.send(GibberishAES.enc(data, key));
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
        main_layout.close("north");
        break;
      case ":break":
        socketSend("BR:", aesKey);
        break;
      case ":fetch":
        editor.getSession().setValue("");
        socketSend("FETCH:" + com.split(" ")[1], aesKey);
        break;
      default:
        terminalOutput("Don't know that one. Use \\ to escape leading :")
      }
    } else {
        if(state == "live") {
          if(com[0] == '\\') com = com.substring(1);
          socketSend("EXEC:" + com, aesKey);
        }
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
  
  terminalOutput("Welcome, type :open <host> <password> to connect");
  
  // Layouting
  function resize_UI() {
    resize_terminal();
    editor.resize();
  }
  
  var main_layout = $('body').layout({
    onresize: resize_UI,
    north__initClosed: false,
    north__size: $(window).height()*(2/3)
  });
  var north_layout = $('body > .ui-layout-north').layout({
    onresize: resize_UI,
    west__size: $(window).width()*(1/6)
  });
  resize_terminal();
  
  // Firing up the editor
  editor = ace.edit("editor");
  editor.setTheme("ace/theme/twilight");
  editor.setShowPrintMargin(false);
  editor.getSession().setTabSize(2);
  editor.getSession().setUseWrapMode(true);
  
  // Firing up the Project panel
  function escape_id(id) {
    return id.replace(/\|/g, '\\|');
  }
  
  function file_id_to_path(s) {
    return s.replace($(tree_root)[0].id,"").replace(/\|/g, "/");
  }
  
  $("#project").jstree({ 
		"json_data" : {
			"data" : [
				{ 
					"data" : "/", 
					"attr": { "id": "root", "rel": "folder" }
				}
			]
		},
    "types": {
      "types": {      
        "folder": {
          "icon": { "image": "jstree/themes/dark_apple/folder.png" },
          "select_node": function(e) {
            node_id = "#" + escape_id(e[0].id);
            tree = $.jstree._reference(tree_root);
            if(tree.is_open(node_id))
              tree.close_node(node_id);
            else {
              $(node_id + " ul").empty();
              socketSend("TREE_GET:" + e[0].id, aesKey);
            }
          }
        },
        "default": {
          "icon": { "image": "jstree/themes/dark_apple/file.png" },
          "select_node": function(e) {
            editor.getSession().setValue("");
            socketSend("FETCH:" + file_id_to_path(e[0].id), aesKey);
          }
        }
      }
    },
    "themes" : {
      "theme": "dark_apple",
      "dots": false
    },
    "plugins" : [ "themes", "json_data", "ui", "types" ]
	});
  var tree_root = "#root"
  
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