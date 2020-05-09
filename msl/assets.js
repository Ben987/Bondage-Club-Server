//'use strict'

var fs = require('fs');

eval(fs.readFileSync('../Bondage-College/BondageClub/Assets/Female3DCG/Female3DCG.js', 'utf8'));

//console.log(AssetSpankingToys);
//console.log(AssetFemale3DCG);
//console.log(PoseFemale3DCG);
//console.log(ActivityFemale3DCG);

var Assets = {};
var ItemGroups = {};

for(var i = 0; i < AssetFemale3DCG.length; i++){
	var assetGroup = AssetFemale3DCG[i];
	Assets[assetGroup.Group] = assetGroup;
	for(var j = 0; j < assetGroup.Asset.length; j++){
		ItemGroups[assetGroup.Asset[j].Name] = assetGroup.Group;
	}
}

/*
exports.AppBondCloth = Assets;
exports.SpankingToys = AssetSpankingToys;
exports.Poses = PoseFemale3DCG;
//exports.Activities = ActivityFemale3DCG;
exports.ItemGroups = ItemGroups;*/


exports.UpdateApearance = function(AppearanceGrouped, AppearanceUpdateList){
	for(var i = 0; i < AppearanceUpdateList.length; i++)
		if(AppearanceUpdateList[i].Name == "None")
			delete AppearanceGrouped[AppearanceUpdateList[i].Group];
		else
			AppearanceGrouped[AppearanceUpdateList[i].Group] = AppearanceUpdateList[i];
	
	return AppearanceUpdateList;
}
	