/* server.js
 *
 * establishes the MIS server and handles connections between the MIS server and the MIS application.
 *
 *
 * Arguments:
 *
 * --delete (deletes the existing database)
 * --print (prints the contents of database)
 * --seed (fills database with Alice in Wonderland from seeder.js)
 *
 */

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var user = require('./user.js');
var db = require('./database.js');
var seeder, twitter;
var argv = require('minimist')(process.argv.slice(2));


if(argv.delete) {
    db.deleteDB();
}


if(argv.print) {
    setInterval(function() {db.printEntries();}, 5000);
}


if(argv.seed) {
    seeder = require('./seeder.js')(db);
    seeder.fillDatabase();
}


io.on('connection', function(socket){

    /* initialize
     * listens for a 'initialize' to be emitted from user. when heard, adds the user to the connectedUser hash table
     * with [key] = current socket's id and [value] = msg = user's vendorID and increments the total conencted users
     * by one.
     */
    socket.on('initialize', function(msg){
        user.numberOfUsers++;
        user.addConnectedUser(msg, socket.id);
        console.log('user connected | total connected: ' + user.numberOfUsers);
        user.printConnectedUsers();
    });


    /* create
     * listens for a 'create' to be emitted from user. when heard, creates a new message and adds it to the MIS
     * database.
     */
    socket.on('create', function(msg){
        db.insertMessage(msg.venderID, msg.message, msg.location.lng, msg.location.lat);
        // temporary for testing
        console.log(msg);
    });


    /* upvote
     * listens for an 'upvote' to be emitted from user. when heard, votes for the messages in the database with
     * messageID = msg.messageID.
     */
    socket.on('upvote', function(msg){
        console.log("received upvote for " + msg.messageID);
        db.voteFor(msg.messageID, msg.vendorID);
    });


    /* update
     * listens for an 'update' to be emitted from user. when heard, queries the database for messages. the messages in
     * returned will be within the bounding rectangle with nw_point = msg.nwCord and se_point = msg.seCord. the queried
     * messages with be returned in an array of size = msg.numMessages.
     */
    socket.on("update", function(msg){
        // REMOVE NEGATION OF NSFW WHEN NOT TESTING OR WHEN FUNCTIONALITY ADDED TO FRONT END
        console.log("messages requested");
        var out = db.getMessages(msg.numMessages, !msg.nsfw, msg.nwCoord, msg.seCoord);
        var pkg = {
            messages: out,
            nwCoord: msg.nwCoord,
            seCoord: msg.seCoord
        }

        socket.emit('messages', pkg);

    });


    /* disconnect
     * listens for a 'disconnect' to be emitted from user. when heard, removes the user with [key] = socket.id from the
     * connectedUsers hash table and decrements the total connected users by one.
     */
    socket.on('disconnect', function(){
        user.numberOfUsers--;
        user.removeConnectedUser(socket.id);
        console.log('user disconnected | total connected: ' + user.numberOfUsers);
        user.printConnectedUsers();
    });

});


// established connection to the server
http.listen(3000, function(){
    console.log('listening on *:3000');
});
