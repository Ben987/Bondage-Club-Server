'use strict'

var Util = require("../util.js"); 
var BaseLocation = require("./base.js"); 


//Screens
var screens = [
	{name:"Front",spotPositions:{}, foreground:false}
	,{name:"Back",spotPositions:{}, foreground:false}
];
var screensGrouped = {};
screens.forEach(screen => screensGrouped[screen.name] = screen);

//Fixtures
screensGrouped.Front.fixtures = [		/*{scaleX:100, scaleY:100,zIndex:100,name:"fix1"}*/
	{name:"FrontChairLeft", image:"ChairLeft.png", left:15, top:50, scaleX:25, scaleY:50, zIndex:50}
	,{name:"FrontChairRight", image:"ChairRight.png", left:65, top:45, scaleX:25, scaleY:50, zIndex:50}
];


screensGrouped.Back.fixtures = [
	{name:"BackChairLeft", image:"ChairLeft.png", left:15, top:50, scaleX:25, scaleY:50, zIndex:50}
	,{name:"BackChairRight", image:"ChairRight.png", left:65, top:45, scaleX:25, scaleY:50, zIndex:50}
];

//Spots and their connections
var spots = [
	{name:"FrontMainLine0", screens:{Default:screensGrouped.Front.name}, connections:{}, entrance:true}
	,{name:"FrontMainLine1", screens:{Default:screensGrouped.Front.name}, connections:{}, entrance:true}
	,{name:"FrontMainLine2", screens:{Default:screensGrouped.Front.name}, connections:{}, entrance:true}
	,{name:"FrontMainLine3", screens:{Default:screensGrouped.Front.name}, connections:{}, entrance:true}
	,{name:"FrontMainLine4", screens:{Default:screensGrouped.Front.name}, connections:{}, entrance:true}

	,{name:"BackMainLine0", screens:{Default:screensGrouped.Back.name}, connections:{}, entrance:false}
	,{name:"BackMainLine1", screens:{Default:screensGrouped.Back.name}, connections:{}, entrance:false}
	,{name:"BackMainLine2", screens:{Default:screensGrouped.Back.name}, connections:{}, entrance:false}
	,{name:"BackMainLine3", screens:{Default:screensGrouped.Back.name}, connections:{}, entrance:false}
	,{name:"BackMainLine4", screens:{Default:screensGrouped.Back.name}, connections:{}, entrance:false}	
]


var spotsGrouped = {};
spots.forEach(spot => spotsGrouped[spot.name] = spot);


var frontSpots = [spotsGrouped.FrontMainLine0, spotsGrouped.FrontMainLine1, spotsGrouped.FrontMainLine2, spotsGrouped.FrontMainLine3, spotsGrouped.FrontMainLine4];
frontSpots.forEach(spot =>{	
	frontSpots.forEach(spot2 =>{
		spotsGrouped[spot.name].connections[spot2.name] = {};
	});
});

var backSpots = [spotsGrouped.BackMainLine0, spotsGrouped.BackMainLine1, spotsGrouped.BackMainLine2, spotsGrouped.BackMainLine3, spotsGrouped.BackMainLine4];
backSpots.forEach(spot =>{	
	backSpots.forEach(spot2 =>{
		spotsGrouped[spot.name].connections[spot2.name] = {};
	});
});

for(var i = 0; i < 5; i++){
	spotsGrouped["BackMainLine" + i].connections["FrontMainLine" + i] = {};
	spotsGrouped["FrontMainLine" + i].connections["BackMainLine" + i] = {};
	for(var k = 0; k < 5; k++){
		if(i == k) continue;
		
		spotsGrouped["BackMainLine" + i].connections["BackMainLine" + k] = {};
		spotsGrouped["FrontMainLine" + i].connections["FrontMainLine" + k] = {};
	}
}


[
	{name:spotsGrouped.FrontMainLine0.name,left:0, top:2.5, scale:25, zIndex:100}
	,{name:spotsGrouped.FrontMainLine1.name,left:20, top:2.5, scale:25, zIndex:100}
	,{name:spotsGrouped.FrontMainLine2.name,left:40, top:2.5, scale:25, zIndex:100}
	,{name:spotsGrouped.FrontMainLine3.name,left:60, top:2.5, scale:25, zIndex:100}
	,{name:spotsGrouped.FrontMainLine4.name,left:80, top:2.5, scale:25, zIndex:100}
	
	,{name:spotsGrouped.BackMainLine0.name,left:10, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.BackMainLine1.name,left:24, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.BackMainLine2.name,left:38, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.BackMainLine3.name,left:52, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.BackMainLine4.name,left:66, top:22, scale:15, zIndex:0}
].forEach(spotPosition => screensGrouped.Front.spotPositions[spotPosition.name] = spotPosition);

[
	{name:spotsGrouped.BackMainLine0.name,left:0, top:2.50, scale:25, zIndex:100}
	,{name:spotsGrouped.BackMainLine1.name,left:20, top:2.50, scale:25, zIndex:100}
	,{name:spotsGrouped.BackMainLine2.name,left:40, top:2.50, scale:25, zIndex:100}
	,{name:spotsGrouped.BackMainLine3.name,left:60, top:2.50, scale:25, zIndex:100}
	,{name:spotsGrouped.BackMainLine4.name,left:80, top:2.50, scale:25, zIndex:100}
	
	,{name:spotsGrouped.FrontMainLine0.name,left:10, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.FrontMainLine1.name,left:24, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.FrontMainLine2.name,left:38, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.FrontMainLine3.name,left:52, top:22, scale:15, zIndex:0}
	,{name:spotsGrouped.FrontMainLine4.name,left:66, top:22, scale:15, zIndex:0}
].forEach(spotPosition => screensGrouped.Back.spotPositions[spotPosition.name] = spotPosition);


var TypeDef = {name:"Library",entrances:spots.filter(spot => spot.entrance).map(spot => spot.name), settings:{}};

var LibraryLocation = function(settings) {
	BaseLocation.Location.call(this, Util.RandomId(), TypeDef.name, Util.InitAndFilter(TypeDef.settings, settings), spotsGrouped, screensGrouped);
};


LibraryLocation.prototype = Object.create(BaseLocation.Location.prototype);

exports.Instantiate = function(settings){return new LibraryLocation(settings);};
exports.TypeDef = TypeDef