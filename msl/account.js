'use strict'

var F3dcgAssets = require("./assets.js");

var FieldDefType = {
	INT:"int"
	,STRING:"string"
	,HEX_COLOR:"color"
	,BOOLEAN:"boolean"
	,LIST:"list"
}

var FieldDef = function(type, params){
	this.type = type;//primitive, arrayNum, arrayStr 
	this.params = params;
}
	
var Update = function(fieldDef, containingObject, fieldName, value, operation){
	switch(fieldDef.type){
		case FieldDefType.INT: 
			if(typeof(value) != "number")
				throw "ValueNotNumber";
			
			if((fieldDef.params.min && fieldDef.params.min > value) || (fieldDef.params.max && fieldDef.params.max < value))
				throw "ValueTooSmallOrLarge " + fieldDef.params.min + " " + fieldDef.params.max + " " + value;;
			
			containingObject[fieldName] = value;
			if(operation == "add" || operation == "push")
				containingObject[fieldName].push(value);
			else if(operation == "remove"){
				var index = containingObject[fieldName].indexOf(value);
				
				if (index > -1) 
					containingObject[fieldName].splice(index, 1);
				else
					throw "ValueNotFoundInList " + value;
			}
		break;
		
		case FieldDefType.BOOLEAN:
			if(typeof(value) != "boolean")
				throw "ValueNotBoolean";
				
			containingObject[fieldName] = value;
		break;
		
		case FieldDefType.HEX_COLOR:
			if(typeof(value) != "string")
				throw "ValueNotString";
			if((value.length != 3 && value.length != 6 && value.length != 7))
				throw "ValueTooShortOrLong";
			
			containingObject[fieldName] = !! value;
		break;
		
		case FieldDefType.STRING:
			if(typeof(value) != "string")
				throw "ValueNotString";
			if((fieldDef.params.minLength && fieldDef.params.minLength > value.length) || (fieldDef.params.maxLength && fieldDef.params.maxLength < value.length))
				throw "ValueTooShortOrLong " + fieldDef.params.minLength + " " + fieldDef.params.maxLength + " " + value.length;
			
			containingObject[fieldName] = value;
		break;
		
		
		case FieldDefType.LIST_PLAYERS:	
			if(typeof(value) != "number")
				throw "ValueNotNumber";
			
			if((fieldDef.params.min && fieldDef.params.min > value) || (fieldDef.params.max && fieldDef.params.max < value))
				throw "ValueTooSmallOrLarge " + fieldDef.params.min + " " + fieldDef.params.max + " " + value;
			
			AddToOrRemoveFromList(containingObject[fieldName], value, operation, fieldDef.params.maxLength);
			
		break;
		
		case FieldDefType.LIST_ITEMS:
			if(! F3dcgAssets.ItemNameToGroupNameMap[value]) throw "UnsupportedItem " + value;
			
			AddToOrRemoveFromList(containingObject[fieldName], value, operation, params.maxLength);			
		break;
		
		default:throw "MisconfiguredDefinition " + fieldDef.type;
	}
}
	
	
var AddToOrRemoveFromList = function(list, value, operation, maxLength){
	if(operation == "add" || operation == "push"){
		if(maxLength && maxLength <= list.length) 
			throw "ListTooLong " + maxLength;
		
		if(list.includes(value))
			return;
			
		list.push(value);
	}
	else if(operation == "remove"){
		var index = list.indexOf(value);
		if (index > -1) 
			list.splice(index, 1);
		else 
			throw "ValueNotFoundInList " + value;
	}
	else 
		throw "UnrecognizedOperation " + operation;
}


exports.UpdatePlayer = function(player, property, value, operation){
	var propertyPathStack = property.split(".");
	var objectToUpdate = player;
	var fieldDef = PlayerFieldDef;
	
	for(var i = 0; i < propertyPathStack.length; i++){
		var fieldDef = fieldDef[propertyPathStack[i]];
		
		if(fieldDef.constructor == FieldDef){
			Update(fieldDef, objectToUpdate, propertyPathStack[i], value, operation);
			break;
		}
		
		var objectToUpdate = objectToUpdate[propertyPathStack[i]];
	}
}

var PlayerFieldDef = {
	permissions:{
		actions:{
			bondageToys:new FieldDef(FieldDefType.INT, {min:0, max:5})
			,clothes:new FieldDef(FieldDefType.INT, {min:0, max:5})
			,arousal:new FieldDef(FieldDefType.INT, {min:0, max:5})
			,poses:new FieldDef(FieldDefType.INT, {min:0, max:5})
		}
		,itemLists:{
			black:new FieldDef(FieldDefType.LIST_ITEMS, {maxLength:3})
		}
	}
	,character:{
		playerLists:{
			black:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:3})
			,white:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:3})
			,friend:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:3})
			,ghost:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:3})
		}
	}	
	,gui:{
		chat:{
			labelColor:new FieldDef(FieldDefType.HEX_COLOR)
		},
		focus:{
			transparentBackground:new FieldDef(FieldDefType.BOOLEAN)
		}
	}
	,clubStanding:{
		description:new FieldDef(FieldDefType.STRING, {maxLength:10})
	}
}
/*
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
}*/
