"use strict";

var MainApp = require("../app.js");
var Util = require("./util.js"); 
var Serializer = require("./serializer.js"); 
var Locations = require("./locations.js");
var F3dcgAssets = require("./assets.js");
var Account = require("./account.js");

//session info by socket id
//session info by player id

var PlayerSessions = {} //key is player id, value is session data (player and socket)
var SocketsPlayers = {} //key is socket id, value is playerId
var CurrentLocations = {} // key is location id
var MainSessions = {} //key is session id, value is player id //TODO -- move main session management to app.js (but that requires refactoring)

var StartOrRenewSession = function(socket, player){
	if(! PlayerSessions[player.id]){
		PlayerSessions[player.id] = {player:player, socket:socket};
		SocketsPlayers[socket.id] = player.id;
		console.log("New session " + socket.id + " for " + player.id);
	}else{
		delete SocketsPlayers[PlayerSessions[player.id].socket.id]
		PlayerSessions[player.id].socket.disconnect();
		PlayerSessions[player.id].socket = socket;
		SocketsPlayers[socket.id] = player.id;
		console.log("Renewing " + socket.id + " for " + player.id);
	}
	return PlayerSessions[player.id].player;
}

var GetSession = function(socket){
	return PlayerSessions[SocketsPlayers[socket.id]];
}

var GetPlayer = function(playerId){
	var session = PlayerSessions[playerId];
	return session ? session.player : null;
}
exports.GetPlayer = GetPlayer;



//var CurrentAccounts = {};//key is the memberNumber

var MainServer = {
	databaseHandle:null
	,socketIo:null
	
	,Init(databaseHandle, socketIo){
		MainServer.databaseHandle = databaseHandle;
		MainServer.socketIo = socketIo;
		
		var mslNamespace = socketIo.of('/msl');
		mslNamespace.on('connection', function(socket) {
			socket.on("GetAllUserNames", 			data => {MainServer.Request(MainServer.GetAllUserNames, data, socket)});//TODO:  remove this before going to prod.
			socket.on("GetPlayerCharacter", 		data => {MainServer.Request(MainServer.GetPlayerCharacter, data, socket)});//TODO: remove this before going to prod
			socket.on("StartMainSession", 			data => {MainServer.StartMainSession(data, socket)});// Starts main session, TODO: should be moved one level up
			socket.on("LoginWithSessionToken",		data => {MainServer.Request(MainServer.LoginWithSessionToken, data, socket)});
			socket.on("GetOnlineFriendList", 		data => {MainServer.Request(MainServer.GetOnlineFriendList, data, socket)});
			socket.on("UpdatePlayerProperty",		data => {MainServer.Request(MainServer.UpdatePlayerProperty, data, socket)});
			socket.on("GetAvailableLocations",		data => {MainServer.Request(MainServer.GetAvailableLocations, data, socket)});
			socket.on("GetAvailableLocationTypes",	data => {MainServer.Request(MainServer.GetAvailableLocationTypes, data, socket)});
			socket.on("CreateLocation",				data => {MainServer.Request(MainServer.CreateLocation, data, socket)});
			socket.on("EnterLocation", 				data => {MainServer.Request(MainServer.EnterLocation, data, socket)});
			socket.on("ExitLocation", 				data => {MainServer.Request(MainServer.ExitLocation, data, socket)});
			socket.on("ActionStart", 				data => {MainServer.Request(MainServer.ActionStart, data, socket)});
			socket.on("ActionProgress", 			data => {MainServer.Request(MainServer.ActionProgress, data, socket)});
		});
	}
	
	,Request(serverFunction, data, socket){
		//var start = Date.now();
		try{serverFunction(data.data, socket, data.meta.messageId);}catch(e){socket.emit("GeneralResponse", MainServer.Error(e, data.meta.messageId));}
		//console.log(serverFunction.name + " took " + (Date.now() - start) + "ms");
	}
	,Error(e, messageId){if(e.name && e.message) console.log(e); return {meta:{success:false,error:e.toString(),messageId:messageId}};}
	,Success(messageId, data){return {meta:{success:true, messageId:messageId},data:data};}
	
	//TODO remove before going into prod
	,GetAllUserNames(data, socket, messageId){
		MainServer.databaseHandle.collection("Accounts").find({}).project({ _id : 1, MemberNumber : 1, Name : 1 }).toArray().then((players) => {
			var d = {}
			for(var i = 0; i < players.length; i++) d[players[i].MemberNumber] = players[i].Name;
			socket.emit("GeneralResponse", MainServer.Success(messageId,d));
		});
	}
	
	
	//TODO remove before going into prod
	,GetPlayerCharacter(data, socket,  messageId){
		MainServer.databaseHandle.collection("Accounts").findOne({MemberNumber : data.playerId}, function(err, Player) {
			if (err) throw err;
			if (Player === null)
				socket.emit("GeneralResponse", MainServer.Error("InvalidNamePassword", messageId));
			else{
				var player = F3dcgAssets.ConvertPlayer(Player);				
				player = StartOrRenewSession(socket, player);
				socket.emit("GeneralResponse", MainServer.Success(messageId,{player:Serializer.PlayerGeneralInfo(player)}));
			}
		});
	}
	
	,StartMainSession(data, socket){
		MainSessions[data.mainSessionId] = data.playerId;
	}

	,LoginWithSessionToken(data, socket,  messageId){	
		if(MainSessions[data.mainSessionId] == data.playerId){
			MainServer.databaseHandle.collection("Accounts").findOne({MemberNumber : data.playerId}, function(err, Player) {
				if (err) throw err;
				if (Player === null)
					socket.emit("GeneralResponse", MainServer.Error("InvalidNamePassword", messageId));
				else{
					var player = F3dcgAssets.ConvertPlayer(Player);
					player = StartOrRenewSession(socket, player);
					socket.emit("GeneralResponse", MainServer.Success(messageId, {player:Serializer.PlayerGeneralInfo(player)}));
				}
			});	
		}
		else
			socket.emit("GeneralResponse", MainServer.Error("InvalidNamePassword", messageId));		
	}
	
	,GetOnlineFriendList(data, socket,  messageId){
		var session = GetSession(socket);
		var friends = [];
		var friendIds = session.player.character.playerLists.friend;
		for(var i = 0; i < friendIds.length; i++){
			var friend = GetPlayer(friendIds[i]);
			if(friend && friend.character.playerLists.friend.includes(session.player.id)){
				var location = CurrentLocations[session.locationId];	
				friends.push({id:friend.id, name:friend.character.name, locationId: (location ?  location.id : null)});
			}
		}
		
		socket.emit("GeneralResponse", MainServer.Success(messageId,{friends:friends}));
	}
	
	
	,UpdatePlayerProperty(data, socket,  messageId){
		var session = GetSession(socket);
		//TODO update other players
		//TODO serialize for self and other players
		Account.UpdatePlayer(session.player, data.property, data.value, data.operation);
		socket.emit("GeneralResponse", MainServer.Success(messageId,data));
	}
	
	
	,GetAvailableLocationTypes(data, socket, messageId){
		socket.emit("GeneralResponse", MainServer.Success(messageId,{locationTypes:Locations.LocationTypes}));
	}
	
	
	,GetAvailableLocations(data, socket,  messageId){
		var locations = [];
		for(var key in CurrentLocations) locations.push(Serializer.Location(CurrentLocations[key]));
		socket.emit("GeneralResponse", MainServer.Success(messageId,{locations:locations})); 
	}
	
	
	,CreateLocation(data, socket,  messageId){
		var session = GetSession(socket);
		var location = Locations.Factory.Build(data.locationType, data.settings, session.player);
		CurrentLocations[location.id] = location;
		
		var action = location.PlayerEnter(session.player, data.entrySpotName);
		session.locationId = location.id;
		
		socket.emit("GeneralResponse", MainServer.Success(messageId,Serializer.LocationAtSpot(location, action.targetSpotName)));
	}
	
	
	,EnterLocation(data, socket,  messageId){
		var session = GetSession(socket);
		var location = CurrentLocations[data.locationId];
		
		var action = location.PlayerEnter(session.player);
		session.locationId = location.id;
		
		socket.emit("GeneralResponse", MainServer.Success(messageId,Serializer.LocationAtSpot(location, action.targetSpotName)));
		location.GetPlayerIdList().forEach(existingPlayerId => {
			if(existingPlayerId != session.player.id)
				PlayerSessions[existingPlayerId].socket.emit("PlayerEnterLocation", MainServer.Success(messageId,{spotName:action.targetSpotName, player:Serializer.PlayerLocationOther(session.player)}));
		});
	}
	
	
	,ExitLocation(data, socket,  messageId){
		var session = GetSession(socket);
		var location = CurrentLocations[session.locationId];
		var action = location.PlayerExit(session.player, data.originSpotName);
		session.locationId = null;
		
		socket.emit("GeneralResponse", MainServer.Success(messageId,{}));
		location.GetPlayerIdList().forEach(existingPlayerId => {
			if(existingPlayerId != session.player.id)
				PlayerSessions[existingPlayerId].socket.emit("PlayerExitLocation", MainServer.Success(messageId,{playerId:session.player.id}));
		});				
	}
	
	
	,ActionStart(data, socket,  messageId){
		var session = GetSession(socket);
		var location = CurrentLocations[session.locationId];		
		var action = location.ActionStart(session.player, data);
		
		location.GetPlayerIdList().forEach(existingPlayerId => {
			PlayerSessions[existingPlayerId].socket.emit("LocationAction", MainServer.Success(messageId,Serializer.LocationAction(session.player.id, action)));
		});
	}
	
	
	,ActionProgress(data, socket,  messageId){
		var session = GetSession(socket);
		var location = CurrentLocations[session.locationId];
		var action = location.ActionProgress(session.player, data);
		
		location.GetPlayerIdList().forEach(existingPlayerId => {
			PlayerSessions[existingPlayerId].socket.emit("LocationAction", MainServer.Success(messageId,Serializer.LocationAction(session.player.id, action)));
		});
	}
}

exports.Init = MainServer.Init;
