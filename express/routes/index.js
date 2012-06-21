
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: req.site.get('title'), ips: req.site.get('ips') });
};

exports.items = function(req, res){
	res.render('items', { title: req.site.get('title') });
};

exports.twitter = function(req, res){
	res.render('twitter', {title: 'Twitter'});
};

exports.nodejs = function(req, res){
	res.render('nodejs', {title: 'NodeJS'});
};