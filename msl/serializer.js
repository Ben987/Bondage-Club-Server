'use strict'

var MSl = require("./msl.js"); 

//Name AccountName Password Email Money Creation LastLogin MemberNumber AssetFamily Log 
//Reputation Skill Lover Owner AudioSettings ChatSettings GameplaySettings ItemPermission 
//LabelColor VisualSettings Description WardrobeCharacterNames Wardrobe PrivateCharacter
//Appearance Inventory Lovership

var playerAccountDataFields = ["Name", "Log", "Inventory", "profileSettings", "Wardrobe", "WardrobeCharacterNames"];
var playerLocationDataFieldsOther = ["AppearanceGrouped", "Inventory", "Lovership", "Ownership", "Lover", "Owner", "ItemPermission", "Reputation", "Skill", "Description"];
var playerLocationDataFieldsSelf = playerLocationDataFieldsOther.slice();
playerLocationDataFieldsSelf.push("AudioSettings", "ChatSettings", "GameplaySettings");

exports.PlayerGeneralInfo = function(player){
	var data = {id:player.id};
	playerAccountDataFields.forEach(fieldName => data[fieldName] = player[fieldName]);
	return data;
}

var PlayerLocationSelf = function(player){
	var data = {id:player.id};
	playerLocationDataFieldsSelf.forEach(fieldName => data[fieldName] = player[fieldName]);
	return data;
}
exports.PlayerLocationSelf = PlayerLocationSelf;

var PlayerLocationOther = function(player){
	var data = {id:player.id};
	playerLocationDataFieldsOther.forEach(fieldName => data[fieldName] = player[fieldName]);
	return data;
}
exports.PlayerLocationOther = PlayerLocationOther;


exports.LocationAction = function(recipientPlayerId, action){
	var data = {}
	data.type = action.type;
	data.originPlayerId = action.player.id;
	data.targetPlayerId = action.targetPlayer ? action.targetPlayer.id : this.undef
	data.originSpotName = action.originSpotName ? action.originSpotName : this.undef
	data.targetSpotName = action.targetSpotName ? action.targetSpotName : this.undef
	
	data.result = action.result;
	
	if(action.id){
		data.id = action.id;
		data.finished = action.finished;
		data.success = action.success;
		data.startTime = action.startTime;
		data.updateTime = action.updateTime;
		data.challenge = action.challenges[recipientPlayerId] ? action.challenges[recipientPlayerId] : this.undef
	}
	
	return data;
}


exports.LocationAtSpot = function(location, atSpotName){
	var data = {
		locationId:location.id
		,type:location.type
		,spots:location.spots
		,screens:location.screens
		,players:{}
	}
	
	for(var spotName in location.spots){
		var spotContents = location.spotContents[spotName];
		if(spotContents.playerId) {
			var player = MSl.GetPlayer(spotContents.playerId);
			data.players[spotName] = atSpotName == spotName ? PlayerLocationSelf(player) : PlayerLocationOther(player);
		}
	}
	
	return data;
}


exports.Location = function(location){
	return{
		id:location.id
		,type:location.type
	};
}