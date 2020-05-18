'use strict'

var Util = require("./util.js"); 
var Msl = require("./msl.js"); 
var Assets = require("./assets.js");

var InstantAction = function(player, type, targetSpot, targetPlayer, result){
	this.player = player;
	this.type = type;
	this.targetSpot = targetSpot;
	this.targetPlayer = targetPlayer;
	this.result = result;
}


var ProgressAction = function(location, player, type, originSpot, targetSpot, targetPlayer, challenges, maxTtl, progressCallback){
	this.id = Util.RandomId();
	this.finished = false;
	
	this.location = location;
	this.player = player;
	this.type = type;
	this.challenges = challenges;
	
	this.startTime = Date.now();
	this.updateTime = this.startTime;
	this.maxTtl = maxTtl;
	
	this.originSpotName = originSpot;
	this.targetSpotName = targetSpot;
	this.targetPlayer = targetPlayer;
	this.Progress = progressCallback
	
	location.actions[this.id] = this;
}


var Location = function(id, type, settings, spots, screens){
	this.id = id;
	this.type = type;
	this.settings = settings;	 //local, immutable
	this.spots = spots;			//shared, immutable
	this.screens = screens;		//shared, immutable
	
	this.spotContents = {};  
	for(var spotName in spots) this.spotContents[spotName] = {};
	
	this.actions = {};
}
exports.Location = Location;


Location.prototype.PlayerExit = function(player, spotName){
	console.log(player.id, spotName);
	this.ValidatePlayerInSpot(player, spotName);
	if(! this.spotContents[spotName].playerId == player.id) throw "PlayerNotInLocation " + player.id;
	
	delete this.spotContents[player.id];
	
	return {type:"ExitLocation",playerId:player.id};
}


Location.prototype.GetPlayerIdList = function(playerId){
	var ids = [];
	for(var spotName in this.spotContents) 
		if(this.spotContents[spotName].playerId)
			ids.push(this.spotContents[spotName].playerId);
	return ids;
}


Location.prototype.GetSpotNameForPlayer = function(playerId){
	for(var spotName in this.spotContents) if(this.spotContents[spotName].playerId == playerId) return spotName;
}


Location.prototype.PlayerEnter = function(player, requestedSpotName){
	if(! requestedSpotName) requestedSpotName = "random";
	if(requestedSpotName != "random" && this.spots[spotName]) throw "SpotNotFound " + spotName; 

	var freeEntrySpotNames = [];

	for(var spotName in this.spots){
		var spotContent = this.spotContents[spotName];
		
		//assemble list of entrance spots available
		if(! spotContent.playerId && this.spots[spotName].entrance) freeEntrySpotNames.push(spotName); 
		
		//case or reconnection, return immediately
		if(spotContent.playerId == player.id) return {type:"PlayerReconnect", playerId:player.id, targetSpotName:spotName};
		
		//if the requested spot is occupied, grab a random spot;
		if(spotName == requestedSpotName && spotContent.playerId) requestedSpotName = "random";
	}
	
	if(freeEntrySpotNames.length == 0) throw "FreeSpotNotFound";
	
	var resultSpotName = requestedSpotName == "random" ? Util.GetRandomElement(freeEntrySpotNames) : requestedSpotName;
	
	if(! freeEntrySpotNames.includes(resultSpotName)) throw "SpotNotFoundOrNotEntrance " + resultSpotName;
	
	//Validation succeded
	console.log("Player " + player.id + " entered " + this.id + " " + resultSpotName)
	this.spotContents[resultSpotName].playerId = player.id;
	return {type:"PlayerEnter", playerId:player.id, targetSpotName:resultSpotName};
}


Location.prototype.ActionStart = function(player, data){
	if(data.originSpotName)	this.ValidatePlayerInSpot(player, data.originSpotName);
	var action = this["ActionStart_" + data.type](player, data);
	return action;
}


Location.prototype.ActionProgress = function(player, data){
	var action = this.actions[data.id];
	if(! action) throw "ActionNotFound " + data.id;
	if(action.finished) throw "ActionIsFinished " + data.id;
	action.Progress(player, data);
	return action;
}


Location.prototype.ActionStart_ChatMessage = function(player, data){
	return new InstantAction(player, "ChatMessage", null, null, {content:data.content});
}


Location.prototype.ActionStart_AppearanceUpdateOther = function(player, data){
	var targetPlayer = Msl.GetPlayer(data.targetPlayerId);
	Assets.UpdateAppearance(data.appearanceUpdate, targetPlayer);
	return new InstantAction(player, "AppearanceUpdateOther", null, Msl.GetPlayer(data.targetPlayerId), data.appearanceUpdate);
}


Location.prototype.ActionStart_AppearanceUpdateSelf = function(player, data){
	Assets.UpdateAppearance(data.appearanceUpdate, player);
	return new InstantAction(player, "AppearanceUpdateSelf", null, null, data.appearanceUpdate);
}
/*
Location.prototype.ActionStart_Restrain = function(player, data){
	this.ValidatePlayerInactive(player);
	
	var targetPlayer = this.players[data.targetPlayerId].player;
	this.ValidatePlayerInSpot(targetPlayer, data.targetSpotName);
	var connection = this.FindConnection(player, data.originSpotName, data.targetSpotName);
	
	if(connection.Restrain) return connection.Restrain(player, targetPlayer);
	
	var challenges = {[targetPlayer.id]:{type:"ComplyRefuse",autoProgress:1}};
	return new ProgressAction(this, player, "Restrain", connection.origin, connection.target, targetPlayer, challenges, 20000
			,function(senderPlayer, data){
				if(data.result){
					if(! targetPlayer.appClothBond.ItemNeck)
						targetPlayer.appClothBond.ItemNeck = {name:"ShockCollar",color:""};
					else
						targetPlayer.appClothBond.ItemNeck = null;
					
					this.result = [
						{playerId:targetPlayer.id, type:"AppClothBond", group:"ItemNeck", item:targetPlayer.appClothBond.ItemNeck}
					]
				}
				
				this.success = data.result;
				this.finished = true;
				this.location.players[player.id].action = null;
				delete this.location.currentActions[this.id];
			}
	);
		
	return new ProgressAction(this, player, "Restrain", "ExplicitConsent", 10000, null, targetPlayer, null);
}
*/

Location.prototype.ActionStart_SpotInfo = function(player, data){
	var targetSpot = this.spots[data.targetSpotName];
	if(targetSpot.SpotInfo) return targetSpot.SpotInfo(player, targetSpot)
	return new InstantAction(player, "SpotInfo", targetSpot, null, {description:"Spot info"});
}


Location.prototype.ActionStart_MoveToSpot = function(player, data){
	this.ValidateSpotOccupiable(data.targetSpotName);
	var connection = this.FindConnection(player, data.originSpotName, data.targetSpotName);
	
	//if(connection.MoveToSpot) return connection.MoveToSpot(player);  Implement later

	var challenges = {[player.id]:{type:"AbCancel",autoProgress:.5,mashProgress:10}};
	return new ProgressAction(this, player, "MoveToSpot", data.originSpotName, data.targetSpotName, null, challenges, 20000
			,function(senderPlayer, data){
				if(senderPlayer != player) throw "SenderPlayerIsNotOrigin";
				this.location.ValidateSpotOccupiable(this.targetSpotName);
				this.location.ValidatePlayerInSpot(this.player, this.originSpotName);
				this.success = true;
				this.finished = true;
				this.location.spotContents[this.targetSpotName].playerId = player.id;
				this.location.spotContents[this.originSpotName].playerId = null;
				delete this.location.actions[this.id];
			}
	)
}


Location.prototype.ValidatePlayerInactive = function(player){
	//var currentAction = this.players[player.id].action;
	//if(currentAction && ! currentAction.finished) throw "MustFinishPrevAction " + currentAction.id + " " +  currentAction.type
}


Location.prototype.ValidateSpotOccupiable = function(spotName){
	if(this.spotContents[spotName].playerId) throw "SpotOccupied";
}
Location.prototype.ValidatePlayerInSpot = function(player, spotName){
	if(! this.spotContents[spotName].playerId == player.id) throw "PlayerNotInLocation";
}


Location.prototype.FindConnection = function(player, originSpotName, targetSpotName){
	var originSpot = this.spots[originSpotName], targetSpot = this.spots[targetSpotName];
	
	if(! originSpot) throw "SpotNotFound " + originSpotName;
	if(! targetSpot) throw "SpotNotFound " + targetSpotName;
	
	var connection = originSpot.connections[targetSpotName];
	
	if(! connection) throw "SpotsNotConnected " + player.id + " " + targetSpotName;
	
	return connection;
}

/*
var Furnishings = {
	EmptySpace: {allowedPoseGroups : ["Stand", "SitGround", "LieDown"]}
	,BasicChair: {allowedPoseGroups : ["SitChair"]}
	,BasicSofa: {allowedPoseGroups : ["SitChair", "LieDown"]}
	,BasicBed: {allowedPoseGroups : ["SitGround", "LieDown"]}
}
*/