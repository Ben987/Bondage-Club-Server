'use strict'

var FieldDefType = {
	INT:"int"
	,STRING:"string"
	,HEX_COLOR:"color"
	,BOOLEAN:"boolean"
	,LIST:"list"
}

var FieldDef = function(type, addParams){
	this.type = type;//primitive, arrayNum, arrayStr 
	this.addParams = addParams;
	
	this.Validate = function(data){
		if(! data) return data;
		switch(this.type){
			case FieldDefType.INT: 			return parseInt(data);
			case FieldDefType.BOOLEAN: 		return !! data;//let the client get the type right
			case FieldDefType.HEX_COLOR: 	return data.length > 7 ? "" : data;
			case FieldDefType.STRING: 		return typeof(data) == "string" ? data : "";
			case FieldDefType.LIST_PLAYERS:	return Array.isArray(data) ? data : [];//TODO validate array contents
			case FieldDefType.LIST_ITEMS:	return Array.isArray(data) ? data : [];//TODO validate array contents
			
			default:throw "MisconfiguredDefinition " + this.type;
		
		}
		return data;
	}
}

//TODO redo as partial updates
exports.UpdateAccountSettings = function(account, data){
	UpdateRecursive(account.settings, data, AccountSettingsStructure);
}

var AccountSettingsStructure = {
	permissions:{
		actions:{
			bondageToys:new FieldDef(FieldDefType.INT)
			,clothes:new FieldDef(FieldDefType.INT)
			,arousal:new FieldDef(FieldDefType.INT)
			,poses:new FieldDef(FieldDefType.INT)
		}
		,playerLists:{
			black:new FieldDef(FieldDefType.LIST_INTS)
			,white:new FieldDef(FieldDefType.LIST_INTS)
			,friend:new FieldDef(FieldDefType.LIST_INTS)
			,ghost:new FieldDef(FieldDefType.LIST_INTS)
		}
		,itemLists:{
			black:new FieldDef(FieldDefType.LIST_ITEMS)
		}
	},	
	gui:{
		chat:{
			labelColor:new FieldDef(FieldDefType.HEX_COLOR)
		},
		focus:{
			transparentBackground:new FieldDef(FieldDefType.BOOLEAN)
		}
	}
}

function UpdateRecursive(target, source, fieldDefs){
	for(var key in source){
		var fieldDef = fieldDefs[key]
		
		if(!fieldDef) continue;
		if(Array.isArray(fieldDef))
			throw "MisconfiguredFieldDef " + key;
		else if(fieldDef.constructor === FieldDef)
			target[key] = fieldDef.Validate(source[key]);		
		else if(typeof(fieldDef) == "object")
			UpdateRecursive(target[key], source[key], fieldDef);
		else 
			throw "MisconfiguredFieldDef " + key;
	}
}
