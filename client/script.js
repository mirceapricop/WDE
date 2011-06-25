$(function() {
  // Loading all the editor modes
  var JavaScriptMode = require("ace/mode/javascript").Mode;
  var CssMode = require("ace/mode/css").Mode;
  var HtmlMode = require("ace/mode/html").Mode;
  var XmlMode = require("ace/mode/xml").Mode;
  var PythonMode = require("ace/mode/python").Mode;
  var PhpMode = require("ace/mode/php").Mode;
  var JavaMode = require("ace/mode/java").Mode;
  var RubyMode = require("ace/mode/ruby").Mode;
  var CCPPMode = require("ace/mode/c_cpp").Mode;
  var CoffeeMode = require("ace/mode/coffee").Mode;
  var TextMode = require("ace/mode/text").Mode;
  
  var modes = {
        text: new TextMode(),
        xml: new XmlMode(),
        html: new HtmlMode(),
        css: new CssMode(),
        javascript: new JavaScriptMode(),
        python: new PythonMode(),
        php: new PhpMode(),
        java: new JavaMode(),
        ruby: new RubyMode(),
        c_cpp: new CCPPMode(),
        coffee: new CoffeeMode()
    };
  
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
  
  // Handling the WebSocket connection
  var ws;
  var state = "disconnected";
  var pass_in_use;
  var aesKey;
  
  // Let the library know where WebSocketMain.swf is:
  WEB_SOCKET_SWF_LOCATION = "WebSocketMain.swf";
  
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
    send_changes = false;
    // Commented to see last state
    //editor.getSession().setValue("");
    terminalOutput("Closed connection");
  }
  
  function sendChange(e) {
    if(!send_changes) return;
    buffering = true;
    editor.setReadOnly(true);
    e.data["version"] = file_version;
    buffered_delta = e.data;
    socketSend("FETCH_CHANGE:"+JSON.stringify(e.data), aesKey);
  }
  
  function socketMessage(e) {
    switch(state) {
    case "authenticating":
      if(GibberishAES.dec(e.data, pass_in_use) == "AUTHOK") {
        aesKey = randomString(64);
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
        break;
      case "TERM_FULL":
        terminalOutput(com);
        break;
      case "FETCH":
        editor.insert(com);
        break;
      case "FETCH_DONE":
        main_layout.open("north");
        editor.gotoLine(1);
        send_changes = true;
        buffering = false;
        editor.setReadOnly(false);
        file_version = parseInt(com);
        break;
      case "FETCH_FAIL":
        terminalOutput("Error at fetching. Use touch to create a new file.");
        break;
      case "FETCH_CHANGE":
        // Temp turn off sending changes to prevent ping-pong
        send_changes = false;
        delta = $.parseJSON(com)
        if (buffering) {
          // OT conflict
          delta = xform(delta, buffered_delta)[1]; // b'
        }
        editor.getSession().doc.applyDeltas([delta]);
        file_version += 1;
        send_changes = true;
        break;
      case "FETCH_ACK":
        buffering = false;
        editor.setReadOnly(false);
        file_version = parseInt(com);
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
  $("#input").keyup(function(e) {
    if(e.which == "13") { // Pressed Enter
      parseCommand();
      e.preventDefault();
    }
  });
  
  $(window).keyup(function(e) {
    if(e.which == "27") { // Pressed Escape
      $("#input_field").focus()
    }
  });
  
  function setEditorMode(file_name) {
    var mode = "text";
    if (/^.*\.js$/i.test(file_name)) {
        mode = "javascript";
    } else if (/^.*\.xml$/i.test(file_name)) {
        mode = "xml";
    } else if (/^.*\.html$/i.test(file_name)) {
        mode = "html";
    } else if (/^.*\.css$/i.test(file_name)) {
        mode = "css";
    } else if (/^.*\.py$/i.test(file_name)) {
        mode = "python";
    } else if (/^.*\.php$/i.test(file_name)) {
        mode = "php";
    } else if (/^.*\.java$/i.test(file_name)) {
        mode = "java";
    } else if (/^.*\.rb$/i.test(file_name)) {
        mode = "ruby";
    } else if (/^.*\.(c|cpp|h|hpp|cxx)$/i.test(file_name)) {
        mode = "c_cpp";
    } else if (/^.*\.coffee$/i.test(file_name)) {
        mode = "coffee";
    } 
    editor.getSession().setMode(modes[mode]);
  }
  
  function fetch_file(name) {
    send_changes = false;
    setEditorMode(name);
    editor.getSession().setValue("");
    socketSend("FETCH:" + name, aesKey);
  }
  
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
        fetch_file(com.split(" ")[1]);
        break;
      case ":w":
      case ":write":
        socketSend("FETCH_WR:", aesKey);
        break;
      // Used for concurrent editing dev-ing
      case ":drone":
        // Start typing random characters
        drone = setInterval(function() {
          editor.insert(randomString(1));
        }, 1000);
        break;
      case ":stop":
        clearInterval(drone);
        break;
      case ":v":
        terminalOutput(file_version);
        break;
      // Dev tools end
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
    // Check for normal or escaped
    split = c.indexOf(';')
    if(split == -1)
      c = c[0]
    else
      c = c.slice(0, split+1)
      
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
  editor.getSession().on('change', sendChange);
  
  $("#input_field").focus()
  
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
            fetch_file(file_id_to_path(e[0].id));
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
  
  // OT starts here
  // OT variables
  var send_changes = false;
  var file_version = 0;
  var buffering = false;
  var buffered_delta;
  
  // OT primitive
  // Returns [a', b'], representing the actions
  // Needed to bring client and server to same state
  function xform(a, b) {
  }
  
  // Helpers
  
  function randomString(len) {
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
    var string_length = len;
    var randomstring = '';
    for (var i=0; i<string_length; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum,rnum+1);
    }
    return randomstring
  }
});