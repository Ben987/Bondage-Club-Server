'use strict'

var Util = require("./util.js"); 
var Msl = require("./msl.js"); 

var CurrentSessions = {};
var SocketsSessions = {} //key is socket id, value is sessionId
var PlayersSessions = {} //key is player id, value is sessionId

//var MainSessions = {} //key player id, value is session id 

exports.GetSession = function(sessionId){
	return CurrentSessions[sessionId];
}


exports.GetSessionForPlayer = function(playerId){
	return CurrentSessions[PlayersSessions[playerId]];
}


exports.GetSessionForSocket = function(socketId){
	return CurrentSessions[SocketsSessions[socketId]];
}


exports.IsPlayerInSession = function(playerId){
	return !! PlayersSessions[playerId];
}


exports.OnLogin = function(session, playerId){
	session.playerId = playerId;
	
	PlayersSessions[playerId] = session.id;
}


exports.OnPlayerLoad = function(session, player){
	if(! session.playerId == player.id) {
		console.error("MISMATCHED PLAYER ID FOR " + session.id);
	}
	session.player = player;
}


exports.ReplaceSessionAndDiscardPrevious = function(next, previous){
	next.playerId = previous.playerId;
	next.player = previous.player;
	
	delete CurrentSessions[previous.id];	
	delete SocketsSessions[previous.socket.id];
	
	if(next.playerId) 
		PlayersSessions[next.playerId] = next.id;
}

	
exports.UpdateSession = function(){
	this.updated = Date.now();
	this.disconnected = null;
}


var Session = function(id){
	this.id = id,
	this.socket = null;
	this.playerId = null;
	this.player = null;
	
	this.created = Date.now();
	this.updated = Date.now();
	this.disconnected = null;
}


exports.StartSession = function(socket){
	var session = new Session(Util.RandomId());
	session.socket = socket;
	CurrentSessions[session.id] = session;
	SocketsSessions[socket.id] = session.id;
	return session;
}

var EndSession = function(session){
	console.log("Ending session " + session.id);
	if(session.socket){
		delete SocketsSessions[session.socket.id];
		session.socket.disconnect();		
	}
	
	if(session.player)
		delete PlayersSessions[session.player.id];
	
	delete CurrentSessions[session.id];
	
	Msl.OnSessionEnd(session);
}
//exports.EndSession = EndSession;

exports.StartSessionWithoutSocket = function(sessionId, playerId){
	console.log("Precreated " + sessionId + " " + playerId);

	var session = new Session(sessionId);
	session.playerId = playerId;
	CurrentSessions[session.id] = session;
	session.disconnected = Date.now();
}

var disconnectedSessionTtl = 1000*15;
var halfMinMaintenance = function(){
	//console.log("half min main running, session gc");
	var now = Date.now();
	for(var sessionId in CurrentSessions){
		var session = CurrentSessions[sessionId];
		if(session.disconnected && now - session.disconnected > disconnectedSessionTtl)
			EndSession(session);
	}
	console.log("session counts: total " + Object.keys(CurrentSessions).length + ", sockets " + Object.keys(SocketsSessions).length + ", players " + Object.keys(PlayersSessions).length);
}

var halfMinMaintenanceInterval = setInterval(halfMinMaintenance,  1000*10);


/*exports.CurrentSessions = CurrentSessions;
exports.SocketsSessions = SocketsSessions;
exports.PlayersSessions = PlayersSessions;
exports.MainSessions = MainSessions;*/


