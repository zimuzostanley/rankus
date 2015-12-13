var https = require('https');
var qs = require('querystring');
var body_parser = require('body-parser');
var fs = require('fs');

var express = require('express');

var app = express();
app.use(body_parser.urlencoded({extended: false}));

var make_req = function(options, data, cb) {
	var req = https.request(options, function(res) {
		var body = '';
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			cb({'success': body});
		});
	});

	req.on('error', function(e) {
		console.log(e);
		cb({'error': e});
	});
	if (data) {
		req.write(data);
	}
	req.end();
}

// Twitter consumer key and secret
var twitter_key = 'BNiQTDLle0lRT4XvXpayshIlx';
var twitter_secret = 'AMHam5SKL1uBuFTbNuxHpNuHbrHNTXzyAGo7VrTN1PcdKG4cG5';
var enc_uri = encodeURIComponent(twitter_key) + ':' + encodeURIComponent(twitter_secret);
var enc_b64 = (new Buffer(enc_uri)).toString('base64');
var token = "";

// Twitter, get access token
var data = {
	grant_type: 'client_credentials'
};
var data_str = qs.stringify(data);

make_req({
	hostname: 'api.twitter.com',
	path: '/oauth2/token',
	method: 'POST',
	headers: {
		'Authorization': 'Basic ' + enc_b64,
		'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
		'Content-Length': data_str.length.toString()
	}
}, data_str, function(result) {
	token = result.success ? JSON.parse(result.success).access_token : "";
});

var logistic_function = function(L, k, x0, x) {
	return L / (1 + Math.pow(Math.E, (-k * (x - x0))));
}

// Follower to following ratio
var s_ffr = function(s) {
	var L = 1;
	var k = 0.1;
	var x0 = 1;
	return logistic_function(L, k, x0, s);
}

// Followers
var s_fo = function(s) {
	var L = 1;
	var k = 0.001;
	var x0 = 800;
	return logistic_function(L, k, x0, s);
}

// Friends
var s_fr = function(s) {
	var L = 1;
	var k = 0.001;
	var x0 = 800;
	return logistic_function(L, k, x0, s);
}

// Favourites
var s_fa = function(s) {
	var L = 1;
	var k = 0.001;
	var x0 = 100;
	return logistic_function(L, k, x0, s);
}

// Statuses
var s_st = function(s) {
	var L = 1;
	var k = 0.0001;
	var x0 = 2000;
	return logistic_function(L, k, x0, s);
}

var total_score = function(score) {
	var ffr = s_ffr(score.fo/score.fr);
	var fo = s_fo(score.fo);
	var fr = s_fr(score.fr);
	var fa = s_fa(score.fa);
	var st = s_st(score.st);

	var sum = ffr + fo + fr + fa + st;
	var avg = sum / 5;

	var percent = avg * 100;
	console.log(ffr);
	console.log(fo);
	console.log(fr);
	console.log(fa);
	console.log(st);
	return percent;
}


var get_user = function(name, cb) {
	make_req({
		hostname: 'api.twitter.com',
		path: '/1.1/users/show.json?screen_name=' + name,
		method: 'GET',
		headers: {
			'Authorization': 'Bearer ' + token,
		}
	}, null, function(result) {
		var score = {};
		var r = JSON.parse(result.success);
		score.fo = r.followers_count;
		score.fr = r.friends_count;
		score.st = r.statuses_count;
		score.fa = r.favourites_count;
		cb(total_score(score));
	});
}


app.get('/', function(request,response){
	response.sendfile("index.html");
});
app.get('/rank', function(request,response){
	response.redirect("/");
});

app.post('/rank', function(request,response){
	if (!token) return res.json({error: "No Twitter token"});
	
	get_user(request.body.first, function(sa) {
		get_user(request.body.second, function(sb) {
			fs.readFile('rank.html', function(err, data) {
				var replaced = data.toString()
					.replace('@first', '@' + request.body.first)
					.replace('@second', '@' + request.body.second)
					.replace('%first', sa + '%')
					.replace('%second', sb + '%');
				response.send(replaced);
			});
		});
	});

});

var server = app.listen(4000, function() {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Twitter ranking app listen at http://%s:%s', host, port);
});
