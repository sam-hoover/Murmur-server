/* voter.js
 *
 * rates the messages in the database and clears messages from the database which do not meet survival requirments
 */

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var deasync = require('deasync');
var dbConnection = null;
var url = 'mongodb://localhost:27017';      // Connection URL. This is where your mongodb server is running.
var ONE_HOUR_MSEC = 3600000;


/* connectToDatabase
 * connects to the database at the location of url
 */
var done = false;
MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to database.");
    dbConnection = db;
    done = true;
});

// Make sure database is connected before continuing
deasync.loopWhile(function(){return !done;});

// runs the database cleaner on a given time interval
setInterval(function() {cleanDatabase();}, 15000);


/* Database Cleaning Algorithm
 *
 * Steps:
 * 1. query entire database into JSON array
 *
 * 2. loop through all entries in database
 *
 *      2.1. if the number of votes required for message survival is less than zero the message is new and thus the
 *           message survives
 *
 *      2.2. if the number of votes required for the message survival is greater than zero, then loop through all the
 *           votes in the current message's votes array
 *
 *           2.2.1. if a vote is outside the allowed voting window then it is removed from the current message's votes
 *                  array, otherwise the votes within window tally is increased by one
 *
 *      2.3. if the votes within window tally is greater than the number of votes required for survival, the message
 *           survives and a rating is set [see: Setting Rating]
 *
 *      2.4. if the votes within window tally is less than the number of votes required for survival, the message is
 *           removed from the database because it did not receive enough votes for survival
 *
 *  Setting Rating:
 *  The rating is set according to the number of votes above the voting threshold.
 *
 *  percentage over threshold   |   rating given
 *  0-10%                       |   1
 *  11-20%                      |   2
 *  21-30%                      |   3
 *  31-40%                      |   4
 *  41-50%                      |   5
 *  51-60%                      |   6
 *  61-70%                      |   7
 *  71-80%                      |   8
 *  81-90%                      |   9
 *  91+%                        |   10
 */
function cleanDatabase() {

    /* query entire database into JSON array msgs
     */
    done = false;
    var msgs=[];
    dbConnection.collection('msgInSpace').find().toArray(function(err, docs) {
        assert.equal(null, err);
        assert.equal(docs.length, docs.length);

        msgs = docs;
        done = true;
    });

    deasync.loopWhile(function(){return !done;});

    console.log("msgs length: " + msgs.length);

    /* loop through all entries in the database
     */
    for(var i = 0; i < msgs.length; i++) {
        var voteReq = getVoteReq(msgs[i].time);
        if(voteReq > 0) {
            var votesWithinWindow = 0;

            // the current time minus the time frame of the voting window
            var threshold = new Date().getTime() - getWindow(msgs[i].time);

            for(var j = 0; j < msgs[i].votes.length; j++) {
                if(msgs[i].votes[j].time < threshold) {
                    // remove vote from array
                    msgs[i].votes.splice(j, 1);
                } else {
                    // add to total votes tally
                    votesWithinWindow++;
                }
            }

            if(votesWithinWindow < voteReq) {
                // remove from db
                console.log("Deleteing: " + msgs[i]._id + " | " + msgs[i].message);
                dbConnection.collection('msgInSpace').remove({_id : msgs[i]._id});
            } else {
                // set rating
                msgs[i].rating = 1;

                for(var k = 9; k > 0; k--) {
                    if(votesWithinWindow > (voteReq + (voteReq / k))) {
                        msgs[i].rating = k + 1;
                        break;
                    }
                }
            }

        }
    }
}


/* getVoteReq
 * params: 
 *      timestamp: the creation time of a message
 *
 * returns the number of votes required for message survival
 */
function getVoteReq(timestamp) {
    var time = new Date().getTime();
    var lifespan = time - timestamp;

    if(lifespan < ONE_HOUR_MSEC) {
        return(0);
    } else {
        return((lifespan / ONE_HOUR_MSEC) * 5);
    }
}

/* getWindow
 * params:
 *      timestamp: the creation time of a message
 * 
 * returns the survival window size in milliseconds
 */
function getWindow(timestamp) {
    var time = new Date().getTime();
    var lifespan = time - timestamp;

    if(lifespan < ONE_HOUR_MSEC) {
        return(lifespan);
    } else {
        return(ONE_HOUR_MSEC);
    }
}