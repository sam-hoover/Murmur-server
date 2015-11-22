/* user.js
 *
 * methods for tracking user connections to the MIS server through the MIS application
 */

// the number of users currently connected to the MIS server
var numberOfUsers = 0;


/* connectedUsers
 * a hash table of users currently connected to the MIS.
 * [key] socket_id : [value] vendor_id
 */
var connectedUsers = {};


/* addConnectedUser
 * params:
 *      id: the user's vendor_id
 *      socket: the socket_id which the user is connected through
 *
 * adds a new user to the connectedUsers hash table with [key] = socket and [value] = id.
 */
function addConnectedUser(id, socket) {
    if(!(socket in connectedUsers)) {
        connectedUsers[socket] = id;
    }
}


/* removeConnectedUser
 * params:
 *      socket: the socket_id which the user is connected through
 *
 * removes the user with [key] = socket from the connectedUsers hash table.
 */
function removeConnectedUser(socket) {
	delete connectedUsers[socket];
}


/* getVID
 * params:
 *      socket: the socket_id which the user is connected through
 *
 * returns the vendor_id of the user connected through socket
 */
function getVID(socket) {
	return(connectedUsers[socket]);
}


/* printConnectedUsers
 * prints the [key] : [value] pair for every user currently connected to the MIS server
 */
function printConnectedUsers() {
    for(var key in connectedUsers) {
        console.log(key + ' : ' + connectedUsers[key].venderID);
    }
}


// variables made available for use
module.exports.connectedUsers = connectedUsers;
module.exports.numberOfUsers = numberOfUsers;

// functions made available for use
module.exports.addConnectedUser = addConnectedUser;
module.exports.removeConnectedUser = removeConnectedUser;
module.exports.getVID = getVID;
module.exports.printConnectedUsers = printConnectedUsers;

