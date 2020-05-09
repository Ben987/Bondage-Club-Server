'use strict'

var Util = require("./util.js"); 
var BaseLocation = require("./baseLocation.js"); 


//Screens
var screensGrouped = {};
[
	{name:"Screen2",spotPositions:{}, foreground:true}
	,{name:"Screen1",spotPositions:{}, fixtures:[
		{scaleX:100, scaleY:100,zIndex:100,name:"fix1"}
	]}
].forEach(screen => screensGrouped[screen.name] = screen);


//Spots and their connections

var spotsGrouped = {};
var spots = [
	{name:"MainSeq0", screens:{Default:screensGrouped.Screen2.name}, connections:{}, entrance:true}
	,{name:"MainSeq1", screens:{Default:screensGrouped.Screen2.name}, connections:{}, entrance:true}
	,{name:"MainSeq2", screens:{Default:screensGrouped.Screen2.name}, connections:{}, entrance:true}
	,{name:"MainSeq3", screens:{Default:screensGrouped.Screen2.name}, connections:{}, entrance:true}
	,{name:"MainSeq4", screens:{Default:screensGrouped.Screen2.name}, connections:{}, entrance:true}
	,{name:"HouseDoorLeft", screens:{Default:screensGrouped.Screen1.name}, connections:{}, entrance:true}
	,{name:"HouseDoorCenter", screens:{Default:screensGrouped.Screen1.name}, connections:{}, entrance:true}
]
spots.forEach(spot => {
	spotsGrouped[spot.name] = spot;
	
	spots.forEach(spot2 => {
		if(spot2.name.startsWith("MainSeq") && spot.name.startsWith("MainSeq"))
			spot.connections[spot2.name] = {};
	});
});

spotsGrouped.MainSeq4.connections.HouseDoorLeft = {};
spotsGrouped.MainSeq4.connections.HouseDoorCenter = {};
spotsGrouped.HouseDoorLeft.connections.MainSeq4 = {};
spotsGrouped.HouseDoorLeft.connections.HouseDoorCenter = {};
spotsGrouped.HouseDoorCenter.connections.MainSeq4 = {};
spotsGrouped.HouseDoorCenter.connections.HouseDoorLeft = {};

//Spot positions inside screens
[
	//{name:spotsGrouped.MainSeq0.name,left:24.5, top:30, scale:10.2, zIndex:0}
	//,{name:spotsGrouped.MainSeq1.name,left:25, top:32, scale:10.4, zIndex:0}
	//,{name:spotsGrouped.MainSeq2.name,left:25.5, top:34, scale:10.6, zIndex:0}
	//{name:spotsGrouped.MainSeq3.name,left:30, top:43, scale:12.8, zIndex:0}
	{name:spotsGrouped.MainSeq4.name,left:29, top:25, scale:10.5, zIndex:0}
	,{name:spotsGrouped.HouseDoorLeft.name,left:42, top:25, scale:11, zIndex:50}
	,{name:spotsGrouped.HouseDoorCenter.name,left:56.5, top:24.5, scale:11, zIndex:50}
].forEach(spotPosition => screensGrouped.Screen1.spotPositions[spotPosition.name] = spotPosition);

[
	{name:spotsGrouped.MainSeq0.name,left:0, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.MainSeq1.name,left:20, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.MainSeq2.name,left:40, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.MainSeq3.name,left:60, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.MainSeq4.name,left:80, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.HouseDoorLeft.name,left:88.5, top:38, scale:10.5, zIndex:0}
].forEach(spotPosition => screensGrouped.Screen2.spotPositions[spotPosition.name] = spotPosition);//no fixtures in screen 2


/*
Screens.MainScreen.fixtures = [
	{name:"Dresser1", image:"Dresser.png", left:10, top:65, scale:25, zIndex:zIndexBotFixtures}
	,{name:"Dresser2", image:"Dresser.png", left:50, top:75, scale:25, zIndex:zIndexMidFixtures}
	,{name:"Dresser3", image:"Dresser.png", left:80, top:55, scale:25, zIndex:zIndexTopFixtures}
]*/


var TypeDef = {name:"VacationHome",entrances:spots.filter(spot => spot.entrance).map(spot => spot.name), settings:{}};

var SampleLocation = function(settings) {
	BaseLocation.Location.call(this, Util.RandomId(), TypeDef.name, Util.InitAndFilter(TypeDef.settings, settings), spotsGrouped, screensGrouped);
};


SampleLocation.prototype = Object.create(BaseLocation.Location.prototype);

exports.Instantiate = function(settings){return new SampleLocation(settings);};
exports.TypeDef = TypeDef