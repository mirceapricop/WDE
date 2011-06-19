## What is it?

If you ever felt the need to code on the go, from your chromebook, iPad,
your friend's computer, then you will love this!

When finished, WebDE will be a fully featured and functional in-browser 
development environment. Complete with a terminal, editor and project 
browser.

####Current state:

Terminal and tree panel are completely functional. Concurrent editing also seems to work, but 
only as long as people take turns. Concurrent sessions work perfectly.

## TODO:

These are in no particular order, and have wildly differing difficulty.

* Implement basic operational transformation
* Implement compound operational transformation
* Multiple shell tabs
* Pack server into a gem
* Completion with tab
* Client command history
* Handle binary files. (show images, videos even?)

## Usage

1. You need some sort of server with ruby and linux/cygwn
2. ssh in it, install gem dependencies
3. ruby server.rb \[password\] (If you don't specify a password, it will be "default")
4. Now open a client in Chrome, Safari or iOs
5. Connect with :open host password
6. Edit your files. To write to disk press ESC to go to the command line, then ":write"

## Thanks

Throughout the project I will use many open-source projects. I will try to keep a list
here, but if you find out I am using something of yours without credit, please tell 
me. That being said:

* [em-websocket](http://github.com/igrigorik/em-websocket)
* [gibberish](http://github.com/mdp/gibberish)
* [gibberish-aes](http://github.com/mdp/gibberish-aes)
* [js sha-256 implementation](http://etherhack.co.uk/main.html)
* [jQuery UI Layout plugin](http://layout.jquery-dev.net/index.cfm)
* [the amazing Ace HTML5 Editor](http://ace.ajax.org/)
* [jsTree plugin](http://jstree.com)
