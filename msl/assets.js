//'use strict'

var LZString = require('lz-string');
var fs = require('fs');

eval(fs.readFileSync('../Bondage-College/BondageClub/Assets/Female3DCG/Female3DCG.js', 'utf8'));
eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssetsInventory.js', 'utf8'));
eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssets.js', 'utf8'));

F3dcgAssets.Init();

/*
exports.UpdateApearance = function(AppearanceGrouped, AppearanceUpdateList){
	for(var i = 0; i < AppearanceUpdateList.length; i++)
		if(AppearanceUpdateList[i].Name == "None")
			delete AppearanceGrouped[AppearanceUpdateList[i].Group];
		else
			AppearanceGrouped[AppearanceUpdateList[i].Group] = AppearanceUpdateList[i];
	
	return AppearanceUpdateList;
}
	*/
	
exports.ConvertPlayer = function(Player){
	var player = {id:Player.MemberNumber, name:Player.Name};
	
	ConvertPlayerAppearance(Player, player);
	ConvertPlayerWardrobe(Player, player);
	ConvertPlayerInventory(Player, player);
	ConvertPlayerClubRep(Player, player);
	ConvertPlayerSkills(Player, player);
	ConvertPlayerSettings(Player, player);

	return player;
}

function ConvertPlayerSettings(Player, player){
	var settings = Player.GameplaySettings;
	settings.chatLabelColor = Player.Label;
	settings.forceFullHeight = Player.ForceFullHeight;
	
	player.settings = {};
}

function ConvertPlayerSkills(Player, player){
	var skills = {}
	if(Player.Skill)
		for(var i = 0; i < Player.Skill.length; i ++)
			skills[Player.Skill[i].Type] = Player.Skill[i].Value;
	
	player.skills = skills;
}

function ConvertPlayerClubRep(Player, player){
	var clubRep = {jobs:{}, reputation:{}};
	
	if(Player.Log){
		for(var i = 0; i < Player.Log.length; i++){
			var LogEntry = Player.Log[i];
			if(LogEntry.Group == "Management" && LogEntry.Name == "ClubMistress"){
				clubRep.jobs.mistress = {active:true}
			}else if(LogEntry.Group == "Management" && LogEntry.Name == "MistressWasPaid"){
				clubRep.jobs.mistress.paid = LogEntry.Value;
			}
		}
	}
	
	if(Player.Reputation)
		for(var i = 0; i < Player.Reputation.length; i ++)
			clubRep.reputation[Player.Reputation[i].Type] = Player.Reputation[i].Value;
	
	if(Player.Ownership)
		clubRep.owner = {id:Player.Ownership.MemberNumber, name:Player.Ownership.Name};
	
	if(Player.Lovership)
		clubRep.lover = {id:Player.Lovership.MemberNumber, name:Player.Lovership.Name};
	
	player.clubRep = clubRep;
}


function ConvertPlayerInventory(Player, player){
	var Inventory = Array.isArray(Player.Inventory) ? Player.Inventory : JSON.parse(LZString.decompressFromUTF16(Player.Inventory));
	var inventory = {locksKeys:[], cloth:[], bondageToys:[], bondageToysBlocked:[]}
	
	for(var i = 0; i < Inventory.length; i++){
		var itemName = Inventory[i][0], groupName = Inventory[i][1];
		if(groupName == "ItemMisc" && itemName.includes("Padlock"))
			inventory.locksKeys.push(itemName);
		else if(F3dcgAssets.BondageToyGroups.includes(groupName))
			inventory.bondageToys.push(itemName)
		else if(F3dcgAssets.AccessoriesGroups.includes(groupName) || F3dcgAssets.ClothesGroups.includes(groupName))
			inventory.cloth.push(itemName);//assuming all cloth items are unique -- atm, the only collision is rope items
	}
	
	if(Player.BlockItems)
		for(var i = 0; i < Player.BlockItems.length; i++)
			inventory.bondageToysBlocked.push(Player.BlockItems[i].Name);
	
	player.inventory = inventory;
}

function ConvertPlayerWardrobe(Player, player){
	player.wardrobe = [];
	if(! Player.WardrobeCharacterNames) return;
	for(var i = 0; i < Player.WardrobeCharacterNames.length; i++){
		if(Player.Wardrobe[i]){
			var Suit = Player.Wardrobe[i];
			var suit = {name : Player.WardrobeCharacterNames[i], clothes:{}};
			player.wardrobe.push(suit);
			
			for(var j = 0; j < Suit.length; j++)
				if(! F3dcgAssets.ExpressionGroups.includes(Suit[j].Group)) //Wardrobe for some reason has expression type items
					suit.clothes[Suit[j].Group] = convertCloth(Suit[j]);
		}
	}
}


function ConvertPlayerAppearance(Player, player){
	var appearance = {body:{items:{}},clothes:{}, expressions:{}, bondageToys:{}, accessories:{}}
	
	var AppearanceGrouped = {};
	for(var i = 0; i < Player.Appearance.length; i++)
		if(! F3dcgAssets.IgnoreGroups.includes(Player.Appearance[i].Group))
			AppearanceGrouped[Player.Appearance[i].Group] = Player.Appearance[i];
	
	appearance.body.height = AppearanceGrouped.Height.Name;
	appearance.body.color = AppearanceGrouped.BodyUpper.Color;
	appearance.body.upperSize = AppearanceGrouped.BodyUpper.Name;
	appearance.body.lowerSize = AppearanceGrouped.BodyLower.Name;
	appearance.body.hands = null//hands are redundant
	
	delete AppearanceGrouped.Height;
	delete AppearanceGrouped.BodyUpper;
	delete AppearanceGrouped.BodyLower;
	delete AppearanceGrouped.Hands;
	
	for(var i = 0; i < F3dcgAssets.BodyItemsGroups.length; i++){
		appearance.body.items[F3dcgAssets.BodyItemsGroups[i]] = convertBodyItem(AppearanceGrouped[F3dcgAssets.BodyItemsGroups[i]]);
		delete AppearanceGrouped[F3dcgAssets.BodyItemsGroups[i]];
	}

	for(var i = 0; i < F3dcgAssets.ExpressionGroups.length; i++){
		appearance.expressions[F3dcgAssets.ExpressionGroups[i]] = convertExpression(AppearanceGrouped[F3dcgAssets.ExpressionGroups[i]]);
		delete AppearanceGrouped[F3dcgAssets.ExpressionGroups[i]];
	}
	
	for(var i = 0; i < F3dcgAssets.BondageToyGroups.length; i++){
		appearance.bondageToys[F3dcgAssets.BondageToyGroups[i]] = convertBondageToy(AppearanceGrouped[F3dcgAssets.BondageToyGroups[i]]);
		delete AppearanceGrouped[F3dcgAssets.BondageToyGroups[i]];
	}
	
	for(var i = 0; i < F3dcgAssets.AccessoriesGroups.length; i++){
		appearance.accessories[F3dcgAssets.AccessoriesGroups[i]] = convertAccessory(AppearanceGrouped[F3dcgAssets.AccessoriesGroups[i]]);
		delete AppearanceGrouped[F3dcgAssets.AccessoriesGroups[i]];
	}
	
	for(var i = 0; i < F3dcgAssets.ClothesGroups.length; i++){
		appearance.clothes[F3dcgAssets.ClothesGroups[i]] = convertCloth(AppearanceGrouped[F3dcgAssets.ClothesGroups[i]]);
		delete AppearanceGrouped[F3dcgAssets.ClothesGroups[i]];
	}
	
	player.appearance = appearance;
}


function convertBondageToy(AppItem){
	if(! AppItem) return null;
	
	var appearanceItem = {name:AppItem.Name, color:AppItem.Color};
	if(AppItem.Property && AppItem.Property.Type)	appearanceItem.variantName = AppItem.Property.Type;
	if(AppItem.Property && AppItem.Property.Restrain)	appearanceItem.variantName = AppItem.Property.Restrain;
	
	return appearanceItem;
}
function convertBodyItem(AppItem){//no null check as this type is always present
	var variantName = (AppItem.Group == "Mouth" || AppItem.Group == "Eyes") && AppItem.Property ? AppItem.Property.Expression : null;
	return {name:AppItem.Name, color:AppItem.Color, variantName:variantName};
}
function convertExpression(AppItem){
	return AppItem.Property && AppItem.Property.Expression ? AppItem.Property.Expression : AppItem.Group ;
}
function convertCloth(AppItem){
	return AppItem ? {name:AppItem.Name, color:AppItem.Color} : null;
}
function convertAccessory(AppItem){
	return AppItem ? {name:AppItem.Name, color:AppItem.Color} : null;
}





