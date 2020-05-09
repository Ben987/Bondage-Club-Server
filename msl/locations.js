'use strict'

var SampleLocation = require("./sampleLocation.js"); 

var Factory = {
	Build(locationType, settings, player, entrySpotName){
		var location;
		switch(locationType){
			case "VacationHome":	location = SampleLocation.Instantiate(settings);	break;
			default: throw "invalid location type "  + locationType;
		}
		return location;
	}
}



exports.LocationTypes = [SampleLocation.TypeDef];
exports.Factory = Factory;