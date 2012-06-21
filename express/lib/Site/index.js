// Global Registry
exports.reg = {};

exports.get = function(key) { 
	return this.reg[key];
};

exports.set = function(key, val){
	this.reg[key] = val;
};