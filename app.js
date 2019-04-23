"use strict";

// Main game objects
var App = require('http').createServer()
var IO = require('socket.io')(App);
var BCrypt = require('bcrypt');
var Account = [];
var ChatRoom = [];
var Database;
var DatabaseClient = require('mongodb').MongoClient;
var DatabaseURL = process.env.DATABASE_URL || "mongodb://localhost:27017/BondageClubDatabase";
var DatabasePort = process.env.PORT || 4288;
var DatabaseName = process.env.DATABASE_NAME || "BondageClubDatabase";

// Connects to the Mongo Database
DatabaseClient.connect(DatabaseURL, { useNewUrlParser: true }, function(err, db) {
	
	// Keeps the database object
	if (err) throw err;
	Database = db.db(DatabaseName);
	console.log("****************************************");
	console.log("Database: " + DatabaseName + " connected");
	//Database.collection("Accounts").findOne({}, function(err, result) { console.log(result); });
	//Database.collection("Accounts").deleteMany({}, function(err, result) { console.log("All accounts deleted"); });
	
	// Listens for clients on port 4288 if local or a random port if online
	App.listen(DatabasePort, function () {
		
		// Sets up the Client/Server events
		console.log("Bondage Club server is listening on " + (DatabasePort).toString());
		console.log("****************************************");
		IO.on("connection", function (socket) {
			socket.id = Math.round(Math.random() * 1000000000000);
			socket.emit("ServerMessage", "Connected to the Bondage Club Server");
			socket.on("AccountCreate", function (data) { AccountCreate(data, socket) });
			socket.on("AccountLogin", function (data) { AccountLogin(data, socket) });
			socket.on("AccountUpdate", function (data) { AccountUpdate(data, socket) });
			socket.on("AccountDisconnect", function () { AccountRemove(socket.id) });
			socket.on("disconnect", function() { AccountRemove(socket.id) });
			socket.on("ChatRoomSearch", function(data) { ChatRoomSearch(data, socket) });
			socket.on("ChatRoomCreate", function(data) { ChatRoomCreate(data, socket) });
			socket.on("ChatRoomJoin", function(data) { ChatRoomJoin(data, socket) });
			socket.on("ChatRoomLeave", function() { ChatRoomLeave(socket) });
			socket.on("ChatRoomChat", function(data) { ChatRoomChat(data, socket) });
			socket.on("ChatRoomCharacterUpdate", function(data) { ChatRoomCharacterUpdate(data, socket) });
			AccountSendServerInfo(socket);
		});
		
		// Refreshes the server information to clients each 30 seconds
		setInterval(AccountSendServerInfo, 30000);
		
	});
	
});

// Sends the server info to all players or one specific player (socket)
function AccountSendServerInfo(socket) {
	var SI = {
		Time: CommonTime(),
		OnlinePlayers: Account.length
	}
	if (socket != null) socket.emit("ServerInfo", SI);
	else IO.sockets.emit("ServerInfo", SI);
}

// Return the current time
function CommonTime() {
	return new Date().getTime();
}

// Creates a new account by creating its file
function AccountCreate(data, socket) {

	// Makes sure the account comes with a name and a password
	if ((typeof data === "object") && (data.Name != null) && (data.AccountName != null) && (data.Password != null) && (data.Email != null)) {		
	
		// Makes sure the data is valid
		var LN = /^[a-zA-Z0-9 ]+$/;
		var LS = /^[a-zA-Z ]+$/;
		var E = /^[a-zA-Z0-9@.]+$/;
		if (data.Name.match(LS) && data.AccountName.match(LN) && data.Password.match(LN) && (data.Email.match(E) || data.Email == "") && (data.Name.length > 0) && (data.Name.length <= 20) && (data.AccountName.length > 0) && (data.AccountName.length <= 20) && (data.Password.length > 0) && (data.Password.length <= 20) && (data.Email.length <= 100)) {
	
			// Checks if the account already exists
			data.AccountName = data.AccountName.toUpperCase();
			Database.collection("Accounts").findOne({ AccountName : data.AccountName }, function(err, result) {

				// Makes sure the result is null so the account doesn't already exists
				if (err) throw err;
				if (result != null) {
					socket.emit("CreationResponse", "Account already exists");			
				} else {
				
					// Creates a hashed password and saves it with the account info
					BCrypt.hash(data.Password.toUpperCase(), 10, function( err, hash ) {
						if (err) throw err;
						console.log("Creating new account: " + data.AccountName + " ID: " + socket.id.toString());
						data.Password = hash;
						data.Money = 100;
						data.Creation = CommonTime();
						Database.collection("Accounts").insertOne(data, function(err, res) { if (err) throw err; });
						data.ID = socket.id;
						data.Socket = socket;
						Account.push(data);
						socket.emit("CreationResponse", "AccountCreated" + data.ID.toString());
						AccountSendServerInfo(socket);
					});
					
				}
				
			});
			
		}

	} else socket.emit("CreationResponse", "Invalid account information");
	
}

// Load a single account file
function AccountLogin(data, socket) {

	// Makes sure the login comes with a name and a password
	if ((typeof data === "object") && (data.AccountName != null) && (data.Password != null)) {

		// Checks if there's an account that matches the name 
		data.AccountName = data.AccountName.toUpperCase();
		Database.collection("Accounts").findOne({ AccountName : data.AccountName}, function(err, result) {	
			if (err) throw err;
			if (result === null) {
				socket.emit("LoginResponse", "InvalidNamePassword");
			}
			else {

				// Compare the password to its hashed version
				BCrypt.compare(data.Password.toUpperCase(), result.Password, function( err, res ) {
					if (res) {
						
						// Disconnect duplicated logged accounts
						for (var A = 0; A < Account.length; A++)
							if ((Account[A].AccountName == result.AccountName) && (Account[A].ID != socket.id)) {
								Account[A].Socket.emit("ForceDisconnect", "ErrorDuplicatedLogin");
								AccountRemove(Account[A].ID);
								break;
							}

						// Logs the account
						console.log("Login account: " + result.AccountName + " ID: " + socket.id.toString());
						result.ID = socket.id;
						Account.push(result);
						result.Password = null; 
						socket.emit("LoginResponse", result);
						result.Socket = socket;
						AccountSendServerInfo(socket);

					} else socket.emit("LoginResponse", "InvalidNamePassword");
				});
				
			}			
		});
		
	} else socket.emit("LoginResponse", "InvalidNamePassword");
}

// Updates any account data except the basic ones that cannot change
function AccountUpdate(data, socket) {
	if (typeof data === "object")
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == socket.id) {
				delete data.Name;
				delete data.AccountName;
				delete data.Password;
				delete data.Email;
				delete data.Creation;
				delete data.Pose;
				delete data.ActivePose;
				if (data.Appearance != null) Account[P].Appearance = data.Appearance;
				if (data.Reputation != null) Account[P].Reputation = data.Reputation;
				//console.log("Updating account: " + Account[P].AccountName + " ID: " + socket.id.toString());
				Database.collection("Accounts").updateOne({ AccountName : Account[P].AccountName }, { $set: data }, function(err, res) { if (err) throw err; });
			}
}

// Removes the account from the buffer
function AccountRemove(ID) {
	if (ID != null)
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == ID) {
				ChatRoomRemove(Account[P]);
				console.log("Disconnecting account: " + Account[P].AccountName + " ID: " + ID.toString());
				Account.splice(P, 1);
				break;
			}
}

// Returns the account object related to it's ID
function AccountGet(ID) {
	for (var P = 0; P < Account.length; P++)
		if (Account[P].ID == ID)
			return Account[P];
	return null;
}

// When a user searches for a chat room
function ChatRoomSearch(data, socket) {
	if ((typeof data === "object") && (data.Query != null) && (typeof data.Query === "string") && (data.Query.length <= 20)) {
		
		// Builds a list of up to 24 possible rooms, the last rooms created are shown first
		var CR = [];
		var C = 0;
		for (var C = ChatRoom.length - 1; ((C >= 0) && (CR.length <= 24)); C--)
			if (ChatRoom[C].Account.length < ChatRoom[C].Limit)
				if ((data.Query == "") || (ChatRoom[C].Name.toUpperCase().indexOf(data.Query) >= 0))
					if (!ChatRoom[C].Private || (ChatRoom[C].Name.toUpperCase() == data.Query)) {
						CR.push({
							Name: ChatRoom[C].Name,
							Creator: ChatRoom[C].Creator,
							MemberCount: ChatRoom[C].Account.length,
							MemberLimit: ChatRoom[C].Limit,
							Description: ChatRoom[C].Description
						});
					}
			
		// Sends the list to the client
		socket.emit("ChatRoomSearchResult", CR);

	}
}

// Creates a new chat room 
function ChatRoomCreate(data, socket) {

	// Make sure we have everything to create it
	if ((typeof data === "object") && (data.Name != null) && (data.Description != null) && (data.Background != null) && (data.Private != null) && (typeof data.Name === "string") && (typeof data.Description === "string") && (typeof data.Background === "string") && (typeof data.Private === "boolean")) {

		// Validates the room name
		data.Name = data.Name.trim();
		var LN = /^[a-zA-Z0-9 ]+$/;
		if (data.Name.match(LN) && (data.Name.length >= 1) && (data.Name.length <= 20) && (data.Description.length <= 100) && (data.Background.length <= 100)) {
		
			// Check if the same name already exists and quits if that's the case
			for (var C = 0; C < ChatRoom.length; C++)
				if (ChatRoom[C].Name.toUpperCase().trim() == data.Name.toUpperCase().trim()) {
					socket.emit("ChatRoomCreateResponse", "RoomAlreadyExist");
					return;
				}
				
			// Finds the account and links it to the new room
			var Acc = AccountGet(socket.id);
			if (Acc != null) {
				ChatRoomRemove(Acc);
				var NewRoom = {
					Name: data.Name,
					Description: data.Description,
					Background: data.Background,
					Limit: ((data.Limit == null) || (typeof data.Limit !== "string") || Number.isNaN(data.Limit) || (parseInt(data.Limit) < 2) || (parseInt(data.Limit) > 10)) ? 10 : parseInt(data.Limit),
					Private: data.Private,
					Creator: Acc.Name,
					CreatorAccount: Acc.AccountName,
					Creation: CommonTime(),
					Account: []
				}
				ChatRoom.push(NewRoom);
				Acc.ChatRoom = NewRoom;
				NewRoom.Account.push(Acc);
				console.log("Chat room (" + ChatRoom.length.toString() + ") " + data.Name + " created by account " + Acc.AccountName + ", ID: " + socket.id.toString());
				socket.emit("ChatRoomCreateResponse", "ChatRoomCreated");
				ChatRoomSync(NewRoom);
			} else socket.emit("ChatRoomCreateResponse", "AccountError");

		} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

	} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

}

// Join an existing chat room 
function ChatRoomJoin(data, socket) {

	// Make sure we have everything to join it
	if ((typeof data === "object") && (data.Name != null) && (typeof data.Name === "string") && (data.Name != "")) {
		
		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {
			
			// Removes it from it's current room if needed
			ChatRoomRemove(Acc);

			// Finds the room and join it
			for (var C = 0; C < ChatRoom.length; C++)
				if (ChatRoom[C].Name.toUpperCase().trim() == data.Name.toUpperCase().trim())
					if (ChatRoom[C].Account.length < ChatRoom[C].Limit) {
						ChatRoomMessage(ChatRoom[C], "(" + Acc.Name + " entered.)");
						Acc.ChatRoom = ChatRoom[C];
						ChatRoom[C].Account.push(Acc);
						socket.emit("ChatRoomSearchResponse", "JoinedRoom");
						ChatRoomSync(ChatRoom[C]);
						return;
					} else {
						socket.emit("ChatRoomSearchResponse", "RoomFull");
						return;
					}

			// If we didn't found the room
			socket.emit("ChatRoomSearchResponse", "CannotFindRoom");

		} else socket.emit("ChatRoomSearchResponse", "AccountError");

	} else socket.emit("ChatRoomSearchResponse", "InvalidRoomData");

}

// Removes a player from a room
function ChatRoomRemove(Acc) {
	if (Acc.ChatRoom != null) {

		// Removes it from the chat room array
		for (var A = 0; A < Acc.ChatRoom.Account.length; A++)
			if (Acc.ChatRoom.Account[A].ID == Acc.ID) {
				Acc.ChatRoom.Account.splice(A, 1);
				break;
			}

		// Destroys the room if it's empty, warn other players if not
		if (Acc.ChatRoom.Account.length == 0) {
			for (var C = 0; C < ChatRoom.length; C++)
				if (Acc.ChatRoom.Name == ChatRoom[C].Name) {
					console.log("Chat room " + Acc.ChatRoom.Name + " was destroyed. Rooms left: " + (ChatRoom.length - 1).toString());
					ChatRoom.splice(C, 1);
					break;
				}
		} else {
			ChatRoomMessage(Acc.ChatRoom, "(" + Acc.Name + " left.)");
			ChatRoomSync(Acc.ChatRoom);
		}
		Acc.ChatRoom = null;

	}
}

// Finds the current account and removes it from it's chat room, nothing is returned to the client
function ChatRoomLeave(socket) {
	var Acc = AccountGet(socket.id);
	if (Acc != null) ChatRoomRemove(Acc);
}

// Sends a text message to everyone in the room
function ChatRoomMessage(CR, Msg) {
	if (CR != null)
		for (var A = 0; A < CR.Account.length; A++)
			CR.Account[A].Socket.emit("ChatRoomMessage", Msg);
}

// When a user sends a chat message, we propagate it to everyone in the room
function ChatRoomChat(data, socket) {
	if ((typeof data === "object") && (data.Content != null) && (data.Type != null) && (typeof data.Content === "string") && (typeof data.Type === "string") && (data.Content.length <= 1000)) {
		var Acc = AccountGet(socket.id);
		if (Acc != null) {
			if (data.Type == "Chat") ChatRoomMessage(Acc.ChatRoom, Acc.Name + ": " + data.Content.trim());
			if (data.Type == "Action") ChatRoomMessage(Acc.ChatRoom, "(" + data.Content.trim() + ")");
			if (data.Type == "Emote") ChatRoomMessage(Acc.ChatRoom, "*" + data.Content.trim() + "*");
		}
	}
}

// Syncs the room data with all of it's members
function ChatRoomSync(CR) {

	// Builds the room data
	var R = {};
	R.Name = CR.Name;
	R.Background = CR.Background;

	// Adds the characters from the room
	R.Character = [];
	for (var C = 0; C < CR.Account.length; C++) {
		var A = {};
		A.ID = CR.Account[C].ID;
		A.Name = CR.Account[C].Name;
		A.Appearance = CR.Account[C].Appearance;
		A.ActivePose = CR.Account[C].ActivePose;
		A.Reputation = CR.Account[C].Reputation;
		A.Lover = CR.Account[C].Lover;
		A.Owner = CR.Account[C].Owner;
		R.Character.push(A);
	}

	// Sends the full packet to everyone in the room
	for (var A = 0; A < CR.Account.length; A++)
		CR.Account[A].Socket.emit("ChatRoomSync", R);

}

// Updates a character from the chat room
function ChatRoomCharacterUpdate(data, socket) {
	if ((typeof data === "object") && (data.ID != null) && (typeof data.ID === "string") && (data.ID != "") && (data.Appearance != null)) {
		var Acc = AccountGet(socket.id);
		if (Acc != null)
			for (var A = 0; A < Acc.ChatRoom.Account.length; A++)
				if (Acc.ChatRoom.Account[A].ID == data.ID) {
					Database.collection("Accounts").updateOne({ AccountName : Acc.ChatRoom.Account[A].AccountName }, { $set: { Appearance: data.Appearance } }, function(err, res) { if (err) throw err; });
					//console.log("Updating account: " + Acc.ChatRoom.Account[A].AccountName + " from ID: " + socket.id.toString());
					Acc.ChatRoom.Account[A].Appearance = data.Appearance;
					Acc.ChatRoom.Account[A].ActivePose = data.ActivePose;
					ChatRoomSync(Acc.ChatRoom);
				}
	}
}