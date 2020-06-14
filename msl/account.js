'use strict'

var Assets = require("./assets.js");

var FieldDefType = {
	INT:"int"
	,STRING:"string"
	,HEX_COLOR:"color"
	,BOOLEAN:"boolean"
	,LIST_PLAYERS:"list_players"
	,LIST_ITEMS:"list_items"
}

var FieldDef = function(type, params){
	this.type = type;//primitive, arrayNum, arrayStr 
	this.params = params;
}

	
var Update = function(fieldDef, containingObject, fieldName, value, operation){
	switch(fieldDef.type){
		case FieldDefType.INT:
			if(typeof(value) != "number")
				throw "ValueNotNumber " + fieldName;
			
			if(! (value >= 0))
				throw "ValueNotPositive " + fieldName;
			
			if((fieldDef.params.min && fieldDef.params.min > value) || (fieldDef.params.max && fieldDef.params.max < value))
				throw "ValueTooSmallOrLarge " + fieldName + " " + fieldDef.params.min + " " + fieldDef.params.max + " " + value;;
			
			containingObject[fieldName] = value;
		break;
		
		case FieldDefType.BOOLEAN:
			if(typeof(value) != "boolean")
				throw "ValueNotBoolean " + fieldName;
				
			containingObject[fieldName] = value;
		break;
		
		case FieldDefType.HEX_COLOR:
			console.log(value);
			console.log(typeof(value));
			if(typeof(value) != "string")
				throw "ValueNotString "  + fieldName;
			if((value.length != 3 && value.length != 4  && value.length != 6 && value.length != 7))
				throw "ValueTooShortOrLong " + fieldName;
			
			containingObject[fieldName] = value;
		break;
		
		case FieldDefType.STRING:
			if(typeof(value) != "string")
				throw "ValueNotString " + fieldName;
			if((fieldDef.params.minLength && fieldDef.params.minLength > value.length) || (fieldDef.params.maxLength && fieldDef.params.maxLength < value.length))
				throw "ValueTooShortOrLong "  + fieldName + " " + fieldDef.params.minLength + " " + fieldDef.params.maxLength + " " + value.length;
			
			containingObject[fieldName] = value;
		break;
		
		
		case FieldDefType.LIST_PLAYERS:	
			if(typeof(value) != "number")
				throw "ValueNotNumber " + fieldName;
			
			if((fieldDef.params.min && fieldDef.params.min > value) || (fieldDef.params.max && fieldDef.params.max < value))
				throw "ValueTooSmallOrLarge " + fieldName + " "+ fieldDef.params.min + " " + fieldDef.params.max + " " + value;
			
			AddToOrRemoveFromList(containingObject[fieldName], value, operation, fieldDef.params.maxLength);
			
		break;
		
		case FieldDefType.LIST_ITEMS:
			if(! Assets.ItemIsSupported(value)) throw "UnsupportedItem " + value;
			
			AddToOrRemoveFromList(containingObject[fieldName], value, operation, fieldDef.params.maxLength);			
		break;
		
		default:throw "MisconfiguredDefinition "  + fieldName + " " + fieldDef.type;
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
			throw "ValueNotFoundInList " + fieldName + " " + value;
	}
	else 
		throw "UnrecognizedOperation " + fieldName + " " + operation;
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
		
		objectToUpdate = objectToUpdate[propertyPathStack[i]];
	}
}

var PlayerFieldDef = {
	settings:{
		permissions:{
			actions:{
				bondageToys:new FieldDef(FieldDefType.INT, {min:0, max:5})
				,clothes:new FieldDef(FieldDefType.INT, {min:0, max:5})
				,arousal:new FieldDef(FieldDefType.INT, {min:0, max:5})
				,poses:new FieldDef(FieldDefType.INT, {min:0, max:5})
			}
			,items:{
				black:new FieldDef(FieldDefType.LIST_ITEMS, {maxLength:16})
			}
			,players:{
				black:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:8})
				,white:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:4})
			}
		}
		,gui:{
			chat:{
				labelColor:new FieldDef(FieldDefType.HEX_COLOR)
			},
			dialog:{
				transparentBackground:new FieldDef(FieldDefType.BOOLEAN)
				,fullScreen:new FieldDef(FieldDefType.BOOLEAN)
			}
		}
	}
	,club:{
		description:new FieldDef(FieldDefType.STRING, {maxLength:10})
	}
	,character:{
		friends:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:8})
		,ghosts:new FieldDef(FieldDefType.LIST_PLAYERS, {maxLength:4})
		
	}		
}
