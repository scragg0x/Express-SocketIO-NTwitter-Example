
/**
 * Module dependencies.
 */

var cluster = require('cluster'),
	express = require('express'),
	os = require('os'),
	_ = require('underscore'),
	routes = require('./routes');

var util = require('util'),
	http = require('http');

var config = require('./config');

var app = module.exports = express.createServer();

//var io = require('socket.io').listen(app);

var numCPUs = require('os').cpus().length;
var cluster = require('cluster');

var Site = require('./lib/Site');

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Socket IO
var clients = {};

/*
io.sockets.on('connection', function(socket){
  socket.emit('connected', socket.id + " connected");
  socket.on('disconnect', function() {
	  console.log(socket.id, "disconnected");
  });
  socket.on('msg', function(data) {
	  io.sockets.emit('new msg', data);
  });
});
*/


var ips = { };

function a(req, res, next){
	var ip = req.headers['x-real-ip'];
	if (ips[ip]){
		ips[ip]++;
		
	} else {
		ips[ip] = 1;
	}
	Site.set('ips', ips);
	req.site = Site;
	next();
};



Site.set('title', 'abandonedbase.com');

var count = 0;

// Routes
app.get("*", a);
app.get('/', routes.index);
app.get("/twitter", routes.twitter);
app.get("/nodejs", routes.nodejs);

app.listen(8000, function(){
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

