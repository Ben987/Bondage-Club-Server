'use strict'

var SampleLocation = require("./locations/sample.js"); 
var LibraryLocation = require("./locations/library.js"); 

var Factory = {
	Build(locationType, settings, player, entrySpotName){
		var location;
		switch(locationType){
			case "VacationHome":	location = SampleLocation.Instantiate(settings);	break;
			case "Library":			location = LibraryLocation.Instantiate(settings);	break;
			default: throw "invalid location type "  + locationType;
		}
		return location;
	}
}



exports.LocationTypes = [SampleLocation.TypeDef, LibraryLocation.TypeDef];
exports.Factory = Factory;