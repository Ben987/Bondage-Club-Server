//'use strict'

var LZString = require('lz-string');
var fs = require('fs');

eval(fs.readFileSync('../Bondage-College/BondageClub/Assets/Female3DCG/Female3DCG.js', 'utf8'));
eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssets/Assets.js', 'utf8'));
eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssets/Import.js', 'utf8'));
eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssets/Validation.js', 'utf8'));
//eval(fs.readFileSync('../Bondage-College/Msl/Scripts/F3dcgAssets/Inventory.js', 'utf8'));

F3dcgAssets.Init();

exports.ItemIsSupported = function(itemName){
	return !! F3dcgAssets.ItemNameToGroupNameMap[itemName];
}

exports.UpdatePose = function(player, pose){
	if(F3dcgAssets.POSE_NONE != pose && F3dcgAssets.POSE_KNEEL != pose) throw "IllegalPose " + pose;
	var error = F3dcgAssets.ValidateCanChangePose(F3dcgAssets.BuildPosesEffectsBlocks(player));
	if(error) throw error;
	player.activePose = pose;
}

exports.UpdateAppearance = function(appearanceUpdate, targetPlayer, player){
	F3dcgAssets.ValidateUpdateAppearanceOrThrow(appearanceUpdate, targetPlayer, player);
	F3dcgAssets.UpdateAppearance(appearanceUpdate, targetPlayer, player);
}


exports.ConvertPlayer = function(Player){
	var player = {id:Player.MemberNumber};
	
	ConvertPlayerAppearance(Player, player);
	ConvertPlayerWardrobe(Player, player);
	ConvertPlayerInventory(Player, player);
	ConvertPlayerClub(Player, player);
	ConvertPlayerSkills(Player, player);
	ConvertPlayerSettings(Player, player);
	ConvertPlayerCharacter(Player, player);
	ConvertPlayerAccount(Player, player);
	
	return player;
}


function ConvertPlayerAccount(Player, player){
	player.account = {
		name:Player.AccountName
	}
}

//Currently, Server publishes white lists -- why?
function ConvertPlayerCharacter(Player, player){
	var character = {
		number:Player.MemberNumber
		,name:Player.Name
		,title:Player.Title
		,created:Player.Creation
		,playerLists:{}
	}
	
	if(Player.Ownership)
		character.owner = {id:Player.Ownership.MemberNumber, name:Player.Ownership.Name, created: Player.Ownership.Start, stage: Player.Ownership.Stage};
	
	if(Player.Lovership)
		character.lover = {id:Player.Lovership.MemberNumber, name:Player.Lovership.Name, created: Player.Lovership.Start, stage: Player.Lovership.Stage};

	character.friends = Player.FriendList ? Player.FriendList : [];
	character.ghosts = Player.GhostList ? Player.GhostList : [];
	
	player.character = character;
	
}
function ConvertPlayerSettings(Player, player){
	var settings = {gui:{chat:{}, dialog:{}},permissions:{players:{}, items:{black:[]}, actions:{}}};

	//body and accessories are self only
	settings.permissions.actions.bondageToys = Player.ItemPermission;
	settings.permissions.actions.clothes = Player.ItemPermission;
	settings.permissions.actions.arousal = Player.ItemPermission;
	settings.permissions.actions.poses = Player.ItemPermission;
	
	if(Player.BlockItems)
		for(var i = 0; i < Player.BlockItems.length; i++)
			settings.permissions.items.black.push(convertItemName(Player.BlockItems[i].Name, Player.BlockItems[i].Group));
	
	settings.permissions.players.black = Player.BlackList ? Player.BlackList : [];
	settings.permissions.players.white = Player.WhiteList ? Player.WhiteList : [];
	
	settings.gui.chat.labelColor = Player.LabelColor;
	settings.gui.dialog.transparentBackground = true;
	settings.gui.dialog.fullScreen = true;
	
	//settings.forceFullHeight = Player.ForceFullHeight;
	
	player.settings = settings;
}

function ConvertPlayerSkills(Player, player){
	var skills = {}
	if(Player.Skill)
		for(var i = 0; i < Player.Skill.length; i ++)
			skills[Player.Skill[i].Type.toLowerCase()] = Player.Skill[i].Level * 1000 + Player.Skill[i].Progress;
	
	player.skills = skills;
}

function ConvertPlayerClub(Player, player){
	var club = {jobs:{}, reputation:{}};
	club.description = Player.Description ? Player.Description : "";
	
	if(Player.Log){
		for(var i = 0; i < Player.Log.length; i++){
			var LogEntry = Player.Log[i];
			if(LogEntry.Group == "Management" && LogEntry.Name == "ClubMistress"){
				club.jobs.mistress = {active:true}
			}else if(LogEntry.Group == "Management" && LogEntry.Name == "MistressWasPaid"){
				club.jobs.mistress.paid = LogEntry.Value;
			}
		}
	}
	
	if(Player.Reputation)
		for(var i = 0; i < Player.Reputation.length; i ++)
			club.reputation[Player.Reputation[i].Type.toLowerCase()] = Player.Reputation[i].Value;
	
	player.club = club;
}


function ConvertPlayerInventory(Player, player){
	if(! Player.Inventory) return;

	var Inventory = Array.isArray(Player.Inventory) ? Player.Inventory : JSON.parse(LZString.decompressFromUTF16(Player.Inventory));
	var inventory = {locksKeys:[], clothes:[], accessories:[], bondageToys:[]}
	
	for(var i = 0; i < Inventory.length; i++){
		var itemName = Inventory[i][0], groupName = Inventory[i][1];
		if(! itemName) {
			itemName = Inventory[i].Name;
			groupName = Inventory[i].Group;
		}
		
		if(F3dcgAssets.UNIMPLEMENTED_ITEMS.includes(itemName)) continue;
		
		if(groupName == "ItemMisc" && itemName.includes("Padlock")){
			inventory.locksKeys.push(itemName);
			continue;
		}
		
		itemName = convertItemName(itemName, groupName);
		
		if(F3dcgAssets.BondageToyGroups.includes(groupName))
			inventory[F3dcgAssets.BONDAGE_TOY].push(itemName)
		else if(F3dcgAssets.AccessoriesGroups.includes(groupName))
			inventory[F3dcgAssets.ACCESSORY].push(itemName);//assuming all cloth items are unique -- atm, the only collision is rope items
		else if(F3dcgAssets.ClothesGroups.includes(groupName))
			inventory[F3dcgAssets.CLOTH].push(itemName);
	}
	
	player.inventory = inventory;
}

function ConvertPlayerWardrobe(Player, player){
	player.wardrobe = [];
	if(! Player.WardrobeCharacterNames) return;
	for(var j = 0; j < Player.WardrobeCharacterNames.length; j++){
		if(Player.Wardrobe[j]){
			var Appearance = Player.Wardrobe[j];
			var appearance = {frame:{}};
			player.wardrobe.push({name : Player.WardrobeCharacterNames[j], appearance:appearance});
			
			var AppearanceGrouped = {};
			for(var i = 0; i < Appearance.length; i++)
				if(! F3dcgAssets.IgnoreGroups.includes(Appearance[i].Group))
					AppearanceGrouped[Appearance[i].Group] = Appearance[i];
			
			appearance.frame.height = AppearanceGrouped.Height.Name;
			appearance.frame.color = AppearanceGrouped.BodyUpper.Color;
			appearance.frame.upperSize = AppearanceGrouped.BodyUpper.Name;
			appearance.frame.lowerSize = AppearanceGrouped.BodyLower.Name;
			
			for(var groupTypeName in F3dcgAssets.SuitSelfTypeGroups){
				var groupNames = F3dcgAssets.SuitSelfTypeGroups[groupTypeName];
				appearance[groupTypeName] = {};
				for(var i = 0; i < groupNames.length; i++)
					appearance[groupTypeName][groupNames[i]] = convertItem(groupTypeName, AppearanceGrouped[groupNames[i]]);
			}		
		}
	}
}

function ConvertPlayerAppearance(Player, player){
	var appearance = {frame:{}};
	
	var AppearanceGrouped = {};
	for(var i = 0; i < Player.Appearance.length; i++)
		if(! F3dcgAssets.IgnoreGroups.includes(Player.Appearance[i].Group))
			AppearanceGrouped[Player.Appearance[i].Group] = Player.Appearance[i];
	
	appearance.frame.height = AppearanceGrouped.Height.Name;
	appearance.frame.color = AppearanceGrouped.BodyUpper.Color;
	appearance.frame.upperSize = AppearanceGrouped.BodyUpper.Name;
	appearance.frame.lowerSize = AppearanceGrouped.BodyLower.Name;
	appearance.frame.hands = null//hands are redundant
	
	delete AppearanceGrouped.Height;
	delete AppearanceGrouped.BodyUpper;
	delete AppearanceGrouped.BodyLower;
	delete AppearanceGrouped.Hands;
	
	for(var groupTypeName in F3dcgAssets.FullCharacterTypeGroups){
		var groupNames = F3dcgAssets.FullCharacterTypeGroups[groupTypeName];
		appearance[groupTypeName] = {};
		for(var i = 0; i < groupNames.length; i++)
			appearance[groupTypeName][groupNames[i]] = convertItem(groupTypeName, AppearanceGrouped[groupNames[i]]);
	}
	
	player.appearance = appearance;
}


function convertItem(groupTypeName, AppItem){
	switch(groupTypeName){
		case F3dcgAssets.BODY:  		return convertBodyItem(AppItem);
		case F3dcgAssets.CLOTH:  		return convertCloth(AppItem);
		case F3dcgAssets.ACCESSORY:		return convertAccessory(AppItem);
		case F3dcgAssets.BONDAGE_TOY:  	return convertBondageToy(AppItem);
		case F3dcgAssets.EXPRESSION:  	return convertExpression(AppItem);
	}
}

function convertBondageToy(AppItem){
	if(! AppItem) return null;
	AppItem.Name = convertItemName(AppItem.Name, AppItem.Group);
	var AssetItem = F3dcgAssets.AssetGroups[AppItem.Group].Items[AppItem.Name];
	
	var variant;
	if(AssetItem.Variant) variant = Object.values(AssetItem.Variant)[0].Name;
	if(AppItem.Property && AppItem.Property.Type)		variant = AppItem.Property.Type;
	if(AppItem.Property && AppItem.Property.Restrain)	variant = AppItem.Property.Restrain;
	
	return F3dcgAssets.BuildBondageToyAppearanceItem(AppItem.Name, AppItem.Color, variant);
}

function convertItemName(AppItemName, AppItemGroup){
	var AssetItem = F3dcgAssets.AssetGroups[AppItemGroup].Items[AppItemName];
	
	if(! AssetItem){
		AppItemName = AppItemName + "_" + AppItemGroup;
		AssetItem = F3dcgAssets.AssetGroups[AppItemGroup].Items[AppItemName];
		if(! AssetItem) throw new Error(AppItemGroup + " " + AppItemName);
	}
	return AppItemName;
}

function convertBodyItem(AppItem){
	if(! AppItem) return null;  //Wardrobe comes without certain items
	var variantName = (AppItem.Group == "Mouth" || AppItem.Group == "Eyes") && AppItem.Property ? AppItem.Property.Expression : null;
	return F3dcgAssets.BuildBodyAppearanceItem(AppItem.Name, AppItem.Color);
}
function convertExpression(AppItem){
	var itemName = AppItem.Property && AppItem.Property.Expression ? AppItem.Property.Expression : AppItem.Group ;
	return F3dcgAssets.BuildExpressionAppearanceItem(itemName);
}
function convertCloth(AppItem){
	return AppItem ? F3dcgAssets.BuildClothAppearanceItem(AppItem.Name, AppItem.Color) : null;
}
function convertAccessory(AppItem){
	return AppItem ? F3dcgAssets.BuildAccessoryAppearanceItem(AppItem.Name, AppItem.Color) : null;
}

