# What is it?

If you ever felt the need to code on the go, from your chromebook, iPad,
your friend's computer, then you will love this!

When finished, WebDE will be a fully featured and functional in-browser 
development environment. Complete with a terminal, editor and project 
browser.

# Current state

Working on bringing the terminal module close to full funcionality, while also
enchancing the communication protocol when needed.

# TODO:

These are in no particular order, and have wildly differing difficulty.

* Abstract receive / send to work with any connection layer
* Delete server start command from history on startup
* Ensure single-connection
* Completion with tab
* Client command history
* Fix the ncurses issue (starting anything like vim totally bricks the server)
* Fallback to -> Flash -> Long polling when WebSockets aren't there
* Out-of-shell commands
    * :break
    * :restart [password]
* Editor panel
    * :edit
    * :w / :push / :autopush (maybe)
* Project tree panel
* Multiple shell tabs
* Pack server into a gem

# Usage

1. You need some sort of server with ruby and linux/cygwin
2. ssh in it, install gem dependencies
3. ruby server.rb \[password\] (If you don't specify a password, it will be "default"
4. Now open a client in Chrome, Safari or iOs
5. Connect with :open host password
