# server_work
a work in progress...

# Connecting to the Database
PREREQ: [mongodb must be installed!](https://docs.mongodb.org/manual/tutorial/install-mongodb-on-os-x/)

A connection to the database server must be established before connecting to the MIS server.

###open a connection to the database

**run:** _mongod --dbpath the/complete/path/to/the/directory/of/your/database_

if there is no database in this directory, this call will create the necessary files.
if the MIS database exists, it will be named MsgInSpace

###disconnect from the database
**press:** _control+C_
