'use strict';

//dependencies
var config = require('./config'),
    express = require('express'),
    mongoose = require('mongoose'),
		async = require('async');

//create express app
var app = express();

//keep reference to config
app.config = config;

//setup mongoose
app.db = mongoose.createConnection(config.mongodb.uri);
app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
app.db.once('open', function () {
  //and... we have a data store
});

//config data models
require('./models')(app, mongoose);

// check for admin user
async.parallel({
	group: function(cb) {
		app.db.models.AdminGroup.count({ _id: 'root' }, cb);
	},
	admin: function(cb) {
		app.db.models.Admin.count({ groups: 'root' }, cb);
	},
	user: function(cb) {
		app.db.models.User.count({ username: 'root' }, cb);
	},
}, function(err, res) {
	if (err) return console.error(err);
	// only initialize db if missing all records.
	if (res.group == 0 && res.admin == 0 && res.user == 0) {
		console.log("Initialize DB");
		async.waterfall([
			function(cb) {
				console.log("Create 'root' admingroup");
				// create 'root' admingroup
				app.db.models.AdminGroup.create({ _id: 'root', name: 'Root' }, cb);
			},
			function(rootGroup, cb) {
				console.log("Create 'root' admin");
				// create 'root' admin
				app.db.models.Admin.create({
				  name: {first: 'Root', last: 'Admin', full: 'Root Admin'}, groups: ['root'] }, cb);
			},
			function(rootAdmin, cb) {
				console.log("Create 'root' user");
				// create 'root' user
				app.db.models.User.create({
					username: 'root', isActive: 'yes', email: config.systemEmail, roles: {admin: rootAdmin._id} },
				function(err, rootUser) {
					console.log("Link 'root' admin to 'root' user");
					rootAdmin.user = { id: rootUser._id, name: rootUser.username }
					rootAdmin.save(cb)
				});
			},
		], function(err, res) {
			if (err) return console.error(err);
			console.log("Finished initializing MongoDB.");
			process.exit();
		})
	} else {
		process.exit();
	}
});


