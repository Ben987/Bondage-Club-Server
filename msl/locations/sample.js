'use strict'

var Util = require("../util.js"); 
var BaseLocation = require("./base.js"); 


//Screens
var screensGrouped = {};
[
	{name:"HouseSide",spotPositions:{}, foreground:true}
	,{name:"HouseFront",spotPositions:{}, fixtures:[
		{scaleX:100, scaleY:100,zIndex:100,name:"fix1"}
	]}
].forEach(screen => screensGrouped[screen.name] = screen);


//Spots and their connections

var spotsGrouped = {};
var spots = [
	{name:"SideMainLine0", screens:{Default:screensGrouped.HouseSide.name}, connections:{}, entrance:true}
	,{name:"SideMainLine1", screens:{Default:screensGrouped.HouseSide.name}, connections:{}, entrance:true}
	,{name:"SideMainLine2", screens:{Default:screensGrouped.HouseSide.name}, connections:{}, entrance:true}
	,{name:"SideMainLine3", screens:{Default:screensGrouped.HouseSide.name}, connections:{}, entrance:true}
	,{name:"SideMainLine4", screens:{Default:screensGrouped.HouseSide.name}, connections:{}, entrance:true}
	,{name:"HouseFrontLeft", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
	,{name:"HouseFrontCenter", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
	,{name:"HouseFrontLine0", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
	,{name:"HouseFrontLine1", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
	,{name:"HouseFrontLine2", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
	,{name:"HouseFrontLine3", screens:{Default:screensGrouped.HouseFront.name}, connections:{}, entrance:true}
]
spots.forEach(spot => spotsGrouped[spot.name] = spot);


var sideLineSpots = [spotsGrouped.SideMainLine0, spotsGrouped.SideMainLine1, spotsGrouped.SideMainLine2, spotsGrouped.SideMainLine3, spotsGrouped.SideMainLine4];
sideLineSpots.forEach(spot => {
	sideLineSpots.forEach(spot2 => {
		spot.connections[spot2.name] = {};
	});
});

spotsGrouped.SideMainLine4.connections.HouseFrontLeft = {};
spotsGrouped.SideMainLine4.connections.HouseFrontCenter = {};//Todo -- HouseFrontCenter is not visible from HouseSide, how do we render the move icon?
spotsGrouped.HouseFrontLeft.connections.SideMainLine4 = {};
spotsGrouped.HouseFrontLeft.connections.HouseFrontCenter = {};

spotsGrouped.HouseFrontCenter.connections.SideMainLine4 = {}
spotsGrouped.HouseFrontCenter.connections.HouseFrontLeft = {}

var frontLineSpots = [spotsGrouped.HouseFrontLine0, spotsGrouped.HouseFrontLine1, spotsGrouped.HouseFrontLine2, spotsGrouped.HouseFrontLine3];

frontLineSpots.forEach(spot =>{
	spotsGrouped.HouseFrontCenter.connections[spot.name] = {};
	spotsGrouped[spot.name].connections.HouseFrontCenter = {};
	
	frontLineSpots.forEach(spot2 =>{
		spotsGrouped[spot.name].connections[spot2.name] = {};
	});
});

//Spot positions inside screens
[
	//{name:spotsGrouped.SideMainLine0.name,left:24.5, top:30, scale:10.2, zIndex:0}
	//,{name:spotsGrouped.SideMainLine1.name,left:25, top:32, scale:10.4, zIndex:0}
	//,{name:spotsGrouped.SideMainLine2.name,left:25.5, top:34, scale:10.6, zIndex:0}
	//{name:spotsGrouped.SideMainLine3.name,left:30, top:43, scale:12.8, zIndex:0}
	{name:spotsGrouped.SideMainLine4.name,left:29, top:25, scale:10.5, zIndex:0}
	,{name:spotsGrouped.HouseFrontLeft.name,left:42, top:25, scale:11, zIndex:50}
	,{name:spotsGrouped.HouseFrontCenter.name,left:56.5, top:24.5, scale:11, zIndex:50}
	
	,{name:spotsGrouped.HouseFrontLine0.name,left:20, top:35, scale:15, zIndex:150}
	,{name:spotsGrouped.HouseFrontLine1.name,left:40, top:35, scale:15, zIndex:150}
	,{name:spotsGrouped.HouseFrontLine2.name,left:60, top:35, scale:15, zIndex:150}
	,{name:spotsGrouped.HouseFrontLine3.name,left:80, top:35, scale:15, zIndex:150}
	
	
].forEach(spotPosition => screensGrouped.HouseFront.spotPositions[spotPosition.name] = spotPosition);

[
	{name:spotsGrouped.SideMainLine0.name,left:0, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.SideMainLine1.name,left:20, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.SideMainLine2.name,left:40, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.SideMainLine3.name,left:60, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.SideMainLine4.name,left:80, top:32.5, scale:15, zIndex:0}
	,{name:spotsGrouped.HouseFrontLeft.name,left:88.5, top:38, scale:10.5, zIndex:0}
].forEach(spotPosition => screensGrouped.HouseSide.spotPositions[spotPosition.name] = spotPosition);//no fixtures in screen 2


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