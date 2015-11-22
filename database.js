/* database.js
 *
 * methods managing the MIS database
 */

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var deasync = require('deasync');
var dbConnection = null;
var swearjar = require('swearjar');				//for profanity detection
var url = 'mongodb://localhost:27017';			// Connection URL. This is where your mongodb server is running.

var done = false;

MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected correctly to database.");
	dbConnection = db;

	dbConnection.collection('msgInSpace').createIndex({"location":"2d"});
	dbConnection.collection('msgInSpace').createIndex({rand: 1});

	// this will cap the database at a given size [12GB for now]
	db.createCollection( "log", { capped: true, size: 1610612736 } );

	done = true;
});

// Make sure database is connected before continuing
deasync.loopWhile(function(){return !done;});


/* insertMessage
 * params:
 *      vid: the vendor_id of the user who sent the new message
 *      msg: the text of the new message
 *      longi: the approximate longitude of the user who sent the new message
 *      lati: the approximate latitude of the user who sent the new message
 *
 * adds a new message to the MIS database
 */
function insertMessage(vid, msg, longi, lati) {
	var isProfane = swearjar.profane(msg);
	dbConnection.collection('msgInSpace').insertOne({
		"vendorID" : vid,
		"message" : msg,
		"location" : {
			"lng" : longi,
			"lat" : lati
		},
		"rating" : 1,
		"votes" : new Array(),
		"date" : new Date(),
		"time" : new Date().getTime(),
		"nsfw": isProfane,
		"rand" : Math.random()
	});
}


/* insertMessageArray
 * params:
 *      msgArray: an array of message objects to be entered into the message database
 *
 * adds a the array of message to the MIS database
 */
function insertMessageArray(msgArr) {
	dbConnection.collection('msgInSpace').insert(msgArr);
}


/* getMessages
 * params:
 *      querySize: the number of messages requested from the user
 *      nw: the nw point on the bounding rectangle around the users position
 *      se: the se point on the bounding rectangle around the users position
 *
 * returns an array of messages in JSON
 */
function getMessages(querySize, nsfwStatus, nw, se) {
	var start = (new Date()).getTime();
	var msgs = new Array();
	var newMsgQuerySize = Math.ceil((querySize * 20) / 100);		// query 20% new messages
	var newTimeFact = start - 3600000;
	var searchThreshold = Math.random();

	var search = {
		time: {$gt: newTimeFact},
		rand: {$gte: searchThreshold},
		location: {$geoWithin: {$box:  [ [ nw.lng, nw.lat ], [ se.lng, se.lat ] ]}}
	};

	if(nsfwStatus) {
		search.nsfw = false;
	}

	/* determine searchThreshold
	 * generate a random number. if than number is even then searchThreshold is a ceiling and all returned messages
	 * must have a rand value less than searchThreshold. else searchThreshold is a floor and all returned messages
	 * must have a rand value greater than searchThreshold (set by default).
	 */
	 if(searchThreshold > 0.5) {
		 search.rand = {$lte: searchThreshold};
	 }

	/* determine sorting order: ascending or descending
	 * generate a random number. if that number is even, then use ascending else descending
	 */
	var sortOrder = (randomIntegerInRange(1, 2) % 2 == 0) ? 1 : -1;

	/* the fields to be returned by the query
	 */
	var returnFields = {message: 1, location: 1, rating: 1};

	msgs = query(search, returnFields, sortOrder, newMsgQuerySize);
	search.time = {$lt: newTimeFact};
	msgs = msgs.concat(query(search, returnFields, sortOrder, querySize - msgs.length));

	if(msgs.length == 0) {
		if(searchThreshold > 0.5) {
			search.rand = {$gte: searchThreshold};
		} else {
			search.rand = {$lte: searchThreshold};
		}
		msgs = query(search, returnFields, sortOrder, querySize);
	}

	msgs = normalize(msgs);

	return(msgs);
}


/* query
 * params:
 *      search: the query parameters
 *      returnFields: the fields to be returned
 *      sortOrder: the sort order of the output (ascending = 1 or descending = -1)
 *      querySize: the number of messages requested from the user
 *
 * returns an array of messages in JSON.
 */
function query(search, returnFields, sortOrder, size) {
	var msgs = new Array();
	var done = false;
	dbConnection.collection('msgInSpace')
		.find(search, returnFields)
		.sort({time: sortOrder})
		.limit(size)
		.toArray(function(err, docs) {
			msgs = docs;
			done = true;
		});
	deasync.loopWhile(function(){return !done;});
	return(msgs);
}


/* voteFor
 * params:
 *      msgID: the message_id of the message being voted for
 *
 * votes for the message with messageID = msgID
 */
function voteFor(msgID, vid) {

	var done = false;
	var msg = new Array();
	dbConnection.collection('msgInSpace').find({_id : msgID}).limit(1).toArray(function(err, docs) {
		msg = docs;
		done = true;
	});
	deasync.loopWhile(function(){return !done;});

	if(msg.length > 0) {
		for (var i = 0; i < msg[0].votes.length; i++) {
			if (vid == msg[0].votes[i].vendorID) {
				// this person has already voted for this message and is not allowed to twice
				return;
			}
		}

		var vote = {
			vendorID: vid,
			time: new Date().getTime()
		};

		dbConnection.collection('msgInSpace').update({_id: msgID}, {$push: {votes: vote}});
	}
	return(true);
}


/* normalize
 * params: 
 * 		msgs: an array of documents from the message database in JSON
 *
 * determines the min and max ratings in the messages array. if the min = 1 and max = 10 then normalization is skipped
 * (because in this case all ratings would be normalized to the same value).
 */
function normalize(msgs) {
	var minMax = getMinMax(msgs);

	if(minMax.min != 1 || minMax.max != 10) {

		for(var i = 0; i < msgs.length; i++) {
			var x = msgs[i].rating;
			var normalX = ((x - minMax.min) / (minMax.max - minMax.min)) * 10;

			msgs[i].rating = normalX;
		}
	}

	return(msgs);
}


/* getMinMax
 * params:
 * 		msgs: an array of documents from the message database in JSON
 * 
 * detemines the minimum and maximum rating of the messages in the msgs array and returns an object containing these values
 */
function getMinMax(msgs) {

	if(msgs.length == 0) {
		return({min : 1, max : 10});
	}

	var low = 10;
	var high = 1;

	for(var i = 0; i < msgs.length; i++) {
		if(msgs[i].rating > high) {
			high = msgs[i].rating;
		}
		if(msgs[i].rating < low) {
			low = msgs[i].rating;
		}
	}

	var minMax = {
		min : low,
		max : high
	};

	return(minMax);
}


/* randomIntegerInRange
 * params:
 * 		min: the lower bound of the range
 *		max: the upper bound of the range
 *
 * returns a an integer in the range: min <= returnInt <= max
 */
function randomIntegerInRange(min, max) {
	return(Math.floor((Math.random() * (max - min + 1)) + min));
}


/* count
 * 
 * returns the total number of documents in the messages database
 */
function count() {
	return(dbConnection.collection('msgInSpace').count());
}


/* deleteDB
 * 
 * clears the contents of the messages database
 * for testing only
 */
function deleteDB() {
	dbConnection.dropDatabase();
}


/* printEntries
 * 
 * prints entries from the messages database
 * for testing only
 */ 
 function printEntries() {
	 var nw = {
		lng : 0,
		lat : 0
	 };
	 var se = {
		 lng : 200,
		 lat : 100
	 };

	 var msgs = getMessages(5, false, nw, se);

	 for(var i = 0; i < msgs.length; i++) {
		 console.log(msgs[i]);
	 }
 }


module.exports.MongoClient = MongoClient;
module.exports.url = url;
module.exports.insertMessage = insertMessage;
module.exports.insertMessageArray = insertMessageArray;
module.exports.getMessages = getMessages;
module.exports.voteFor = voteFor;
module.exports.normalize = normalize;
module.exports.count = count;
module.exports.deleteDB = deleteDB;
module.exports.printEntries = printEntries;

