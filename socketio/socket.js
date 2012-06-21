var io = require('socket.io').listen(8001);
var util = require('util'),
  http = require('http'),
  _ = require('underscore'),
  querystring = require('querystring'),
  redis = require('redis'),
  mongoose = require('mongoose');

var Schema = mongoose.Schema
, ObjectId = Schema.ObjectId;


var config = require('./config');

var ntwitter = require('ntwitter');

var twitterAuth = config.twitter;
/*
 * Depends on Redis, Mongo, Socket.io, Underscore, ntwitter
 */
var CommentStream = { 
  
  // Connected clients
  clients: {},
  
  twitter: {
	track: '#avengers',
	keywords: {}
  },
  
  init: function(){
	this._init_redis();
	this._init_mongo();
	this._init_socketio();
	this._init_ntwitter();
  },
  
  _init_redis: function(){
	this.redis = redis.createClient();
  },
  
  _init_mongo: function(){

	this.mongo = mongoose.createConnection('mongodb://localhost/mydb');;
	
	this.models = { };
	
	this.models.comment =  this.mongo.model('Comment',
	  new Schema({
	    name: String,
	    username: String,
	    avatar: String,
	    text: String,
	    twit: Boolean,
	    room: String
	}));
	
    this.models.room = this.mongo.model('Room',
      new Schema({
		name: String,
		twitter: String
	})); 
  },
	 
  _init_socketio: function(){
	var self = this;
	
	// Pull from global space, can change if needed
	this.io = io;
	
	// Comment this for debug messages
	this.io.set('log level', 1);
	
	this.io.sockets.on('connection', function(socket){
	  self.clients[socket.id] = {};
	  
	  console.log(socket.id, 'connected');
	  
	  const sub = redis.createClient();
	  
	  sub.on("error", function (err) {
	      console.log("Error " + err);
	  });

	  socket.on('init comment stream', function(data){
	    self.create(data.room, data.twitter, function(comments){
	      socket.emit('init comment stream', self.strencode(comments));
	    });
	  });
	  
	  socket.on('subscribe', function(data){
	    if (!data.room) return;
	    sub.subscribe(data.room);
	  });
	  
	  socket.on('msg', function(data) {
	    self.add_comment(data.room, data);
	    self.redis.publish(data.room, JSON.stringify(data));
	  });
	  
	  sub.on("message", function(channel, data){
	   data = JSON.parse(data);
	   var message = { username: data.username, avatar: data.avatar, name: data.name, text: data.text };
	   socket.emit('new msg', self.strencode(message) );
	  });
	  
	  socket.on('disconnect', function(){
	   console.log(socket.id, 'disconnected');
	   delete self.clients[socket.id];
	  });
		  
	});
	
  },
  
  _init_ntwitter: function(){
	var self = this;
	console.log('Creating new Twitter stream', self.twitter.track);
    this.ntwitter = new ntwitter(twitterAuth);
    this.ntwitter.stream('statuses/filter', {'track': self.twitter.track }, function(stream){
	  stream.on('data', function (twdata) {
	    _.each(self.twitter.keywords, function(val, key){
	      if (twdata['text'].toLowerCase().indexOf(key) != -1){
	        var pick = _.pick(twdata, 'id', 'text');
	        pick.username = twdata.user.screen_name;
	        pick.avatar = twdata.user.profile_image_url;
	        pick.name = twdata.user.name;
	        pick.twit = 1;
	        try {
	          self.add_comment(val, pick);
	          self.redis.publish(val, JSON.stringify(pick));
	        } catch(err){
	          console.log(err);
	        }
	     }
	    });
	  });
    });
  },
  
  create: function(name, twitter, callback){
	var self = this;
    this.redis.hset(['comment.stream:' + name, 'name', name, 'twitter', twitter], function(err, replies){
      if (!(typeof twitter === 'undefined')){    
        self.twitter.keywords[twitter] = name;
      }
      self.init_stream(name, twitter, callback);
    });
    
    this.models.room.findOne({ name: name }, function(err, doc){
    	if (!doc){
    		var room = new self.models.room();
    		room.name = name;
    		room.twitter = twitter;
    		room.save();
    		delete room;
    	}
    	
    });
  },
  
  init_stream: function(name, twitter, callback){
	var self = this;
    var rkey = 'comment.stream.data:' + name;
    this.redis.llen(rkey, function (err, reply){
      if (reply == 0){
        // None in redis, check mongo
    	self.models.comment.where('room', name).limit(25).run(function(err, docs){
    	  callback(docs);
    	});
      } else {
        self.redis.lrange(rkey, 0, 24, function(err, reply) { callback(reply); });
      }
    });
  },
  
  delete_stream: function(name){
    this.redis.del('comment.stream:' + name, 'comment.stream.data:' + name);
  },
  
  add_comment: function(name, data){
    var rkey = 'comment.stream.data:' + name;
    this.redis.lpush(rkey, JSON.stringify(data));
    this.redis.ltrim(rkey, 0, 99);
    var comment = new this.models.comment();
    _.each(data, function(val, key){
    	comment[key] = val;
    });
    comment.room = name;
    comment.save();
    delete comment;
  },
  
  // Used to handle invalid UTF (https://gist.github.com/2024272)
  strencode: function(data) {
	return unescape( encodeURIComponent( JSON.stringify( data ) ) );
  },

  strdecode: function(data) {
    return JSON.parse( decodeURIComponent( escape ( data ) ) );
  }
};

CommentStream.init();
