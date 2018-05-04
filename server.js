var session = require('express-session');
var express = require("express");
var path = require("path");
var app = express();

app.use(session({
  secret: "The busy chicken crossed the river to get off the other side",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60000, secure: false }
}))

const server = app.listen(1337);
const io = require('socket.io')(server);
var bodyParser = require('body-parser');
var chatters = {};
var chatlog = [];
var game_string = null;
var num_users = 0;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "./static")));

app.set('views', path.join(__dirname, './views'));
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
 var name = "";
 if(chatters[req.session.id])
 {
 	name = chatters[req.session.id].name;
 }
 res.render("index",{ id: req.session.id, name: name, chatlog: chatlog });
})

io.on('connection', onConnect);

function onConnect(socket) {

  console.log("** CONNECTED **");

  socket.on('retreive_id', function(data) {
  	console.log("socket id is "+socket.id);
  	console.log("chatters log ",chatters);
    	var verified = false;
    	if(socket.id in chatters && chatters[socket.id].name == data.name)
    	{
  			verified = true;
    	}
    	console.log("verified is "+verified);
    	socket.emit('id_checked',{ id: socket.id, name: data.name, verified: verified, chatlog: chatlog })
  })

  socket.on('logon', function (data) {
    console.log("** LOGON **",chatters);
  	var entry = { name: "&lt;System&gt;", message: data.name + " has entered the room." };
  	chatlog.push(entry);
    num_users++;
    chatters[socket.id] = { name: data.name, score: 0 }
  	io.of('/').emit('post', entry );
  	socket.emit('logon_confirmed');
  });
  
  socket.on('send_message', function (data) {
    var entry;
    console.log("** SEND MESSAGE **",data.id,data.message,data.message.length);
    if(data.message.length == 1 && game_string != null)
    {
      console.log("single character")
      if(data.message == game_string[0])
      {
        chatters[data.id].score++;
        console.log(chatters[data.id]);
        game_string = game_string.substr(1);
        if(game_string == "")
        {
          game_string = null;
          chatters[data.id].score+=2;
          entry = { name: "&lt;System&gt;", message: data.name + " completed the string!" };
        }
        else
        {
          entry = { name: "&lt;System&gt;", message: game_string };
        }
        console.log(game_string);
      }
    }
    else if(data.message && data.message=='/stats')
    {
      var chatters_string = ``;
      var entry;
      console.log("** CHATTERS **");
      console.log(chatters);
      for(chatter in chatters)
      {
        chatters_string += chatters[chatter].name + " - " + chatters[chatter].score + "<br>";
      }
      entry = { name: "&lt;System&gt;", message: chatters_string };
    }
    else if(data.message && data.message=='/game')
    {
      game_string = "";
      for(var i=0;i<num_users;i++)
      {
        game_string += Math.random().toString(36).substr(2);
      }
      entry = { name: "&lt;System&gt;", message: game_string };
    }
  	else
    {
      entry = { name: "["+data.name+"]", message: data.message };
    }
  	chatlog.push(entry);
	io.of('/').emit('post', entry );
	console.log(chatlog);
  });

  socket.on('disconnect', function () {
    console.log("The socket is ",socket);
  	var entry;
    if(chatters[socket.id])
    {
      entry = { name: "&lt;System&gt;", message: chatters[socket.id].name + " has left the room." }
    }
    else
    {
      entry = { name: "&lt;System&gt;", message: "Player has left the room." }
    }
    delete chatters[socket.id];
  	chatlog.push(entry);
    num_users--;
  	io.of('/').emit('post', entry );
  });

};