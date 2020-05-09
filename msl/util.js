'use strict'

exports.RandomId = function(){
	return Math.random().toString(36).replace('0.', '') 
}

exports.InitAndFilter = function(defaults, given){
	var obj = {};
	for(key in given) if(typeof(obj[key]) != "undefined") obj[key] = given[key];
	for(key in obj) if(typeof(obj[key]) == "undefined") obj[key] = defaults[key];
	return obj;
}

exports.GetRandomElement = function(arr){
	return arr[Math.floor(Math.random() * Math.floor(arr.length))];
}

