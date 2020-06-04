"use strict";

var MainApp = require("../app.js");
var Util = require("./util.js"); 
var Serializer = require("./serializer.js"); 
var Locations = require("./locations.js");
var F3dcgAssets = require("./assets.js");
var Account = require("./account.js");
var Session = require("./session.js");

var CurrentLocations = {} // key is location id
var PlayersLocations = {} // key is playerId, value is location id


var GetPlayerOnlineMutualFriends = function(player){
	var mutualFriends = [];
	var friendIds = player.character.playerLists.friend;
	
	for(var i = 0; i < friendIds.length; i++){
		var friend = GetPlayer(friendIds[i]);
		if(friend && friend.character.playerLists.friend.includes(player.id))
			mutualFriends.push({id:friend.id, name:friend.character.name});
	}
	
	return mutualFriends;
}

var GetPlayer = function(playerId){
	var session = Session.GetSessionForPlayer(playerId);
	return session ? session.player : null;
}

var GetLocationForPlayer = function(playerId){
	return playerId ? CurrentLocations[PlayersLocations[playerId]] : null;
}
//called by locations module
exports.GetPlayer = GetPlayer;


//TODO sesion end means roome exit -- reimplement for rooms to control exit
var OnSessionEnd = function(session){
	if(! session.playerId) return;
	var location = GetLocationForPlayer(session.playerId);
	if(location){
		var action = location.PlayerSessionEnd(session.playerId);
		
		var roomPlayerIds = location.GetPlayerIdList();
		for(var i = 0; i < roomPlayerIds.length; i++){
			if(roomPlayerIds[i] == session.playerId) continue;
			var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
			roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,action));
		}
		
		delete PlayersLocations[session.playerId];
	}
}
//Called by the Session module
exports.OnSessionEnd = OnSessionEnd;

var MainServer = {
	databaseHandle:null
	,socketIo:null
	
	,Init(databaseHandle, socketIo){
		MainServer.databaseHandle = databaseHandle;
		MainServer.socketIo = socketIo;
		
		var mslNamespace = socketIo.of('/msl');
		mslNamespace.on('connection', function(socket) {
			socket.on("GetAllUserNames", 			data => {MainServer.Request(MainServer.GetAllUserNames, data, socket)});//TODO:  remove this before going to prod.
			socket.on("PreCreateSession", 			data => {MainServer.PreCreateSession(data, socket)});// Starts main session, TODO: should be moved one level up to app.js
			
			socket.on("Login",						data => {MainServer.Request(MainServer.Login, data, socket)});
			socket.on("LoginWithSessionId",			data => {MainServer.Request(MainServer.LoginWithSessionId, data, socket)});
			
			socket.on("GetPlayerAccount", 			data => {MainServer.Request(MainServer.GetPlayerAccount, data, socket)});
			socket.on("GetOnlineFriendList", 		data => {MainServer.Request(MainServer.GetOnlineFriendList, data, socket)});
			socket.on("UpdatePlayerProperty",		data => {MainServer.Request(MainServer.UpdatePlayerProperty, data, socket)});
			socket.on("GetAvailableLocations",		data => {MainServer.Request(MainServer.GetAvailableLocations, data, socket)});
			socket.on("GetAvailableLocationTypes",	data => {MainServer.Request(MainServer.GetAvailableLocationTypes, data, socket)});
			socket.on("CreateLocation",				data => {MainServer.Request(MainServer.CreateLocation, data, socket)});
			socket.on("EnterLocation", 				data => {MainServer.Request(MainServer.EnterLocation, data, socket)});
			socket.on("ExitLocation", 				data => {MainServer.Request(MainServer.ExitLocation, data, socket)});
			socket.on("ActionStart", 				data => {MainServer.Request(MainServer.ActionStart, data, socket)});
			socket.on("ActionProgress", 			data => {MainServer.Request(MainServer.ActionProgress, data, socket)});
			
			socket.on("disconnect",					() => MainServer.Disconnect(socket));
			
			var session = Session.StartSession(socket);
			console.log("started new session " + session.id);
			//console.log(socket.request.connection.remoteAddress);
		});
	}
	
	,Request(handlerFunction, data, socket){
		//var start = Date.now();
		try{
			var session = Session.GetSessionForSocket(socket.id);
			if(! session) throw "session not found for " + socket.id;
			Session.UpdateSession(session);
			
			handlerFunction(data.data, session, data.meta.messageId);
		}catch(e){
			socket.emit("GeneralResponse", MainServer.Error(e, data.meta.messageId));
		}
		//console.log(serverFunction.name + " took " + (Date.now() - start) + "ms");
	}
	,Error(e, messageId){if(e.name && e.message) console.log(e); return {meta:{success:false,error:e.toString(),messageId:messageId}};}
	,Success(messageId, data){return {meta:{success:true, messageId:messageId},data:data};}
	
	//TODO remove before going into prod
	,GetAllUserNames(data, session, messageId){
		MainServer.databaseHandle.collection("Accounts").find({}, {projection:{MemberNumber:1, Name:1}}).toArray().then((players) => {
			var d = {}
			for(var i = 0; i < players.length; i++) d[players[i].MemberNumber] = players[i].Name;
			session.socket.emit("GeneralResponse", MainServer.Success(messageId,d));
		});
	}
	
	//TODO reimplement one level higher, cache player
	,PreCreateSession(data, socket){
		console.log("Precreating session, ", data);
		Session.StartSessionWithoutSocket(data.sessionId, data.playerId);
	}
	
	,Disconnect(socket){
		var session = Session.GetSessionForSocket(socket.id);
		session.disconnected = Date.now();
		console.log("Disconnected " + session.id);
		
		var location = GetLocationForPlayer(session.playerId);
		if(location){
			var action = location.PlayerDisconnect(session.player);
			
			var roomPlayerIds = location.GetPlayerIdList();
			for(var i = 0; i < roomPlayerIds.length; i++){
				if(roomPlayerIds[i] == session.player.id) continue;
				var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
				roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,action));
			}
		}
		//Update the room, set the per session disconnect time 
	}
	
	,LoginWithSessionId(data, session, messageId){		
		var prevSession = Session.GetSession(data.sessionId); 
		var prevPlayerId = prevSession ? prevSession.playerId : null;	
		if(prevPlayerId == data.playerId){
			Session.ReplaceSessionAndDiscardPrevious(session, prevSession);
			var prevLocationId = PlayersLocations[session.playerId];
			console.log("player " + session.playerId + " reconnected, " + prevSession.id + " => " + session.id + ", location " + prevLocationId);
			session.socket.emit("GeneralResponse", MainServer.Success(messageId, {sessionId:session.id, locationId:prevLocationId}));
		}else{
			session.socket.emit("GeneralResponse", MainServer.Error("MissingMainSessionId", messageId));		
		}
	}
	
	//Rewrite to use login credentials	
	,Login(data, session, messageId){
		MainServer.databaseHandle.collection("Accounts").findOne({MemberNumber : data.playerId}, {projection:{MemberNumber:1}}).then((PlayerHeader) => {	
			var playerId = PlayerHeader.MemberNumber;
			
			if(Session.IsPlayerInSession(playerId)){
				var prevSession = Session.GetSessionForPlayer(playerId);
				if((prevSession.playerId != data.playerId)){
					console.error("ERROR " + data.sessionId + " " + prevSession.playerId + " " + playerId);
				}else{
					var prevLocationId = PlayersLocations[playerId];				
					console.log("player " + playerId + " reconnected, " + prevSession.id + " => " + session.id + ", location " + prevLocationId);
					Session.ReplaceSessionAndDiscardPrevious(session, prevSession);
					session.socket.emit("GeneralResponse", MainServer.Success(messageId, {sessionId:session.id, playerId:playerId, locationId:prevLocationId}));
				}
			}else{
				Session.OnLogin(session, playerId);
				
				var prevLocationId = PlayersLocations[session.playerId];
				session.socket.emit("GeneralResponse", MainServer.Success(messageId, {sessionId:session.id, playerId:playerId, locationId:prevLocationId}));
			}
		}).catch((error) => {
			console.log(error);
			session.socket.emit("GeneralResponse", MainServer.Error("InvalidNamePassword", messageId));	
		});	
		
	}
	
	
	,GetPlayerAccount(data, session, messageId){
		if(session.player){
			session.socket.emit("GeneralResponse", MainServer.Success(messageId,{player:Serializer.PlayerGeneralInfo(session.player)}));
		}
		else{
			MainServer.databaseHandle.collection("Accounts").findOne({MemberNumber : session.playerId}).then((Player) => {		
				var player = F3dcgAssets.ConvertPlayer(Player);
				
				Session.OnPlayerLoad(session, player);
				
				session.socket.emit("GeneralResponse", MainServer.Success(messageId,{player:Serializer.PlayerGeneralInfo(session.player)}));
			}).catch((error) => {
				session.socket.emit("GeneralResponse", MainServer.Error(error, messageId));	
			});	
		}
	}
	
	
	,GetOnlineFriendList(data, session, messageId){
		var friends = GetPlayerOnlineMutualFriends(session.player);
		for(var i = 0; i < friends.length; i++){
			var friend = friends[i];
			var location = GetLocationForPlayer(friend.id);
			if(location){
				friend.locationId = location.id;
				friend.locationType = location.type;
			}
		}
		
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,{friends:friends}));
	}
	
	
	,UpdatePlayerProperty(data, session, messageId){
		//TODO update other players
		//TODO serialize for self and other players
		Account.UpdatePlayer(session.player, data.property, data.value, data.operation);
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,data));
	}
	
	
	,GetAvailableLocationTypes(data, session, messageId){
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,{locationTypes:Locations.LocationTypes}));
	}
	
	
	,GetAvailableLocations(data, session, messageId){
		var locations = [];
		
		var friends = GetPlayerOnlineMutualFriends(session.player);
		var locationsToFriends = {};
		
		for(var i = 0; i < friends.length; i++){
			var friend = friends[i];
			var locationId = PlayersLocations[friend.id];
			if(locationId){
				if(! locationsToFriends[locationId]) 
					locationsToFriends[locationId] = [];
				locationsToFriends[locationId].push(friend);
			}
		}
		
		for(var locationId in CurrentLocations){
			var locationData = Serializer.Location(CurrentLocations[locationId]);
			locationData.friends = locationsToFriends[locationId];
			locations.push(locationData);
		}
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,{locations:locations})); 
	}
	
	
	,CreateLocation(data, session, messageId){
		var location = Locations.Factory.Build(data.locationType, data.settings, session.player);
		CurrentLocations[location.id] = location;
		
		var action = location.PlayerEnter(session.player, data.entrySpotName);
		PlayersLocations[session.player.id] = location.id; 
		
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,Serializer.LocationAtSpot(location, action.targetSpotName)));
	}
	
	//TODO move logic to rooms, expose methods to broadcast messagse to people in rooms
	,EnterLocation(data, session, messageId){
		var prevLocationId = PlayersLocations[session.playerId];
		if(prevLocationId && data.locationId != prevLocationId) throw "PlayerAlreadyInLocation " + prevLocationId;
		
		var location = CurrentLocations[data.locationId];
		
		var action = location.PlayerEnter(session.player);
		PlayersLocations[session.playerId] = location.id; 
		
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,Serializer.LocationAtSpot(location, action.targetSpotName)));
		
		var roomPlayerIds = location.GetPlayerIdList();
		
		//TODO this check for reconnect and duplicates logic in rooms, refactor
		var data = prevLocationId ? action : {type:"PlayerEnter", spotName:action.targetSpotName, player:Serializer.PlayerLocationOther(session.player)};
		for(var i = 0; i < roomPlayerIds.length; i++){
			if(roomPlayerIds[i] == session.player.id) continue;
			var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
			if(! roomPlayerSession) continue;
			roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,data));
		}
	}
	
	
	,ExitLocation(data, session, messageId){
		var location = GetLocationForPlayer(session.playerId);
		var action = location.PlayerExit(session.player, data.originSpotName);
		delete PlayersLocations[session.playerId]
		
		session.socket.emit("GeneralResponse", MainServer.Success(messageId,{}));
		
		var roomPlayerIds = location.GetPlayerIdList();
		for(var i = 0; i < roomPlayerIds.length; i++){
			if(roomPlayerIds[i] == session.player.id) continue;
			var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
			if(! roomPlayerSession) continue;
			roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,{type:"PlayerExit",playerId:session.player.id}));
		}
	}
	
	
	,ActionStart(data, session, messageId){
		var location = GetLocationForPlayer(session.playerId);	
		var action = location.ActionStart(session.player, data);
		
		var roomPlayerIds = location.GetPlayerIdList();
		for(var i = 0; i < roomPlayerIds.length; i++){
			var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
			if(! roomPlayerSession) continue;
			roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,Serializer.LocationAction(session.player.id, action)));
		}
	}
	
	
	,ActionProgress(data, session, messageId){
		var location = GetLocationForPlayer(session.playerId);
		var action = location.ActionProgress(session.player, data);
		
		var roomPlayerIds = location.GetPlayerIdList();		
		for(var i = 0; i < roomPlayerIds.length; i++){
			var roomPlayerSession = Session.GetSessionForPlayer(roomPlayerIds[i]);
			if(! roomPlayerSession) continue;
			roomPlayerSession.socket.emit("LocationAction", MainServer.Success(null,Serializer.LocationAction(session.player.id, action)));
		};
	}
}

exports.Init = MainServer.Init;
