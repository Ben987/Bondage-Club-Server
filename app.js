"use strict";

// Main game objects
var App = require("http").createServer();
var DefaultOrigins = "http://www.bondageprojects.com:* https://www.bondageprojects.com:* http://bondageprojects.com:* https://bondageprojects.com:* http://www.bondageprojects.elementfx.com:* https://www.bondageprojects.elementfx.com:* http://bondageprojects.elementfx.com:* https://bondageprojects.elementfx.com:* http://127.0.0.1:* http://localhost:*";
var IO = require("socket.io")(App, { origins: process.env.ORIGINS || DefaultOrigins, maxHttpBufferSize: 200000 } );
var BCrypt = require("bcrypt");
var Account = [];
var ChatRoom = [];
var ChatRoomMessageType = ["Chat", "Action", "Emote", "Whisper", "Hidden"];
var ChatRoomProduction = [
	process.env.PRODUCTION0 || "",
	process.env.PRODUCTION1 || "",
	process.env.PRODUCTION2 || "",
	process.env.PRODUCTION3 || "",
	process.env.PRODUCTION4 || "",
	process.env.PRODUCTION5 || "",
	process.env.PRODUCTION6 || "",
	process.env.PRODUCTION7 || "",
	process.env.PRODUCTION8 || "",
	process.env.PRODUCTION9 || "" 
];
var NextMemberNumber = 1;
var OwnershipDelay = 259200000; // 3 days delay for ownership events
var LovershipDelay = 604800000; // 7 days delay for lovership events

// DB Access
var Database;
var DatabaseClient = require('mongodb').MongoClient;
var DatabaseURL = process.env.DATABASE_URL || "mongodb://localhost:27017/BondageClubDatabase";
var DatabasePort = process.env.PORT || 4288;
var DatabaseName = process.env.DATABASE_NAME || "BondageClubDatabase";

// Email password reset
var PasswordResetProgress = [];
var NodeMailer = require("nodemailer");
var MailTransporter = NodeMailer.createTransport({
	host: "mail.bondageprojects.com",
	Port: 465,
	secure: true,
	auth: {
		user: "donotreply@bondageprojects.com",
		pass: process.env.EMAIL_PASSWORD || ""
    }
});

// Connects to the Mongo Database
DatabaseClient.connect(DatabaseURL, { useUnifiedTopology: true, useNewUrlParser: true }, function(err, db) {
	
	// Keeps the database object
	if (err) throw err;
	Database = db.db(DatabaseName);
	console.log("****************************************");
	console.log("Database: " + DatabaseName + " connected");

	// Gets the next unique member number
	Database.collection("Accounts").find({ MemberNumber : { $exists: true, $ne: null }}).sort({MemberNumber: -1}).limit(1).toArray(function(err, result) {
	
		// Shows the next member number
		if ((result.length > 0) && (result[0].MemberNumber != null)) NextMemberNumber = result[0].MemberNumber + 1;
		console.log("Next Member Number: " + NextMemberNumber);
		
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
				socket.on("AccountQuery", function (data) { AccountQuery(data, socket) });
				socket.on("AccountBeep", function (data) { AccountBeep(data, socket) });
				socket.on("AccountOwnership", function(data) { AccountOwnership(data, socket) });
				socket.on("AccountLovership", function(data) { AccountLovership(data, socket) });
				socket.on("AccountDisconnect", function () { AccountRemove(socket.id) });
				socket.on("disconnect", function() { AccountRemove(socket.id) });
				socket.on("ChatRoomSearch", function(data) { ChatRoomSearch(data, socket) });
				socket.on("ChatRoomCreate", function(data) { ChatRoomCreate(data, socket) });
				socket.on("ChatRoomJoin", function(data) { ChatRoomJoin(data, socket) });
				socket.on("ChatRoomLeave", function() { ChatRoomLeave(socket) });
				socket.on("ChatRoomChat", function(data) { ChatRoomChat(data, socket) });
				socket.on("ChatRoomCharacterUpdate", function(data) { ChatRoomCharacterUpdate(data, socket) });
				socket.on("ChatRoomAdmin", function(data) { ChatRoomAdmin(data, socket) });
				socket.on("ChatRoomAllowItem", function(data) { ChatRoomAllowItem(data, socket) });
				socket.on("PasswordReset", function(data) { PasswordReset(data, socket) });
				socket.on("PasswordResetProcess", function(data) { PasswordResetProcess(data, socket) });
				AccountSendServerInfo(socket);
			});
			
			// Refreshes the server information to clients each 30 seconds
			setInterval(AccountSendServerInfo, 30000);
			
		});
	
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
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (data.AccountName != null) && (data.Password != null) && (data.Email != null)) {		
	
		// Makes sure the data is valid
		var LN = /^[a-zA-Z0-9 ]+$/;
		var LS = /^[a-zA-Z ]+$/;
		var E = /^[a-zA-Z0-9@.!#$%&'*+/=?^_`{|}~-]+$/;
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
						data.Password = hash;
						data.Money = 100;
						data.Creation = CommonTime();
						data.LastLogin = CommonTime();
						data.MemberNumber = NextMemberNumber;
						NextMemberNumber++;
						Database.collection("Accounts").insertOne(data, function(err, res) { if (err) throw err; });
						data.Environment = AccountGetEnvironment(socket);
						console.log("Creating new account: " + data.AccountName + " ID: " + socket.id.toString() + " " + data.Environment);
						data.ID = socket.id;
						data.Socket = socket;
						AccountValidData(data);
						Account.push(data);
						socket.emit("CreationResponse", { ServerAnswer: "AccountCreated", OnlineID: data.ID.toString(), MemberNumber: data.MemberNumber } );
						AccountSendServerInfo(socket);
						AccountPurgeInfo(data);
					});

				}

			});

		}

	} else socket.emit("CreationResponse", "Invalid account information");

}

// Gets the current environment for online play (www.bondageprojects.com is considered production)
function AccountGetEnvironment(socket) {
	if ((socket != null) && (socket.request != null) && (socket.request.headers != null) && (socket.request.headers.origin != null) && (socket.request.headers.origin != "")) {
		if (ChatRoomProduction.indexOf(socket.request.headers.origin.toLowerCase()) >= 0) return "PROD";
		else return "DEV";
	} else return (Math.round(Math.random() * 1000000000000)).toString();
}

// Makes sure the account data is valid, creates the missing fields if we need to
function AccountValidData(Account) {
	if (Account != null) {
		if ((Account.ItemPermission == null) || (typeof Account.ItemPermission !== "number")) Account.ItemPermission = 2;
		if ((Account.WhiteList == null) || !Array.isArray(Account.WhiteList)) Account.WhiteList = [];
		if ((Account.BlackList == null) || !Array.isArray(Account.BlackList)) Account.BlackList = [];
		if ((Account.FriendList == null) || !Array.isArray(Account.FriendList)) Account.FriendList = [];
	}
}

// Purge some account info that's not required to be kept in memory on the server side
function AccountPurgeInfo(A) {
	delete A.Log;
	delete A.Skill;
	delete A.Wardrobe;
	delete A.WardrobeCharacterNames;
	delete A.ChatSettings;
	delete A.VisualSettings;
	delete A.AudioSettings;
	delete A.GameplaySettings;
	delete A.Email;
	delete A.Password;
	delete A.LastLogin;
}

// Load a single account file
function AccountLogin(data, socket) {

	// Makes sure the login comes with a name and a password
	if ((data != null) && (typeof data === "object") && (data.AccountName != null) && (typeof data.AccountName === "string") && (data.Password != null) && (typeof data.Password === "string")) {

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
							if (Account[A].AccountName == result.AccountName) {
								Account[A].Socket.emit("ForceDisconnect", "ErrorDuplicatedLogin");
								if (Account[A] != null) AccountRemove(Account[A].ID);
								break;
							}

						// Assigns a member number if there's none
						if (result.MemberNumber == null) {
							result.MemberNumber = NextMemberNumber;
							NextMemberNumber++;
							console.log("Assigning missing member number: " + result.MemberNumber + " for account: " + result.AccountName);
							Database.collection("Accounts").updateOne({ AccountName : result.AccountName }, { $set: { MemberNumber: result.MemberNumber } }, function(err, res) { if (err) throw err; });
						}

						// Sets the last login date
						result.LastLogin = CommonTime();
						Database.collection("Accounts").updateOne({ AccountName : result.AccountName }, { $set: { LastLogin: result.LastLogin } }, function(err, res) { if (err) throw err; });

						// Logs the account
						result.ID = socket.id;
						result.Environment = AccountGetEnvironment(socket);
						console.log("Login account: " + result.AccountName + " ID: " + socket.id.toString() + " " + result.Environment);
						AccountValidData(result);
						Account.push(result);
						result.Password = null;
						result.Email = null;
						socket.emit("LoginResponse", result);
						result.Socket = socket;
						AccountSendServerInfo(socket);
						AccountPurgeInfo(result);
					} else socket.emit("LoginResponse", "InvalidNamePassword");
				});

			}			
		});
		
	} else socket.emit("LoginResponse", "InvalidNamePassword");
}

// Returns TRUE if the object is empty
function ObjectEmpty(obj) {
    for(var key in obj)
        if (obj.hasOwnProperty(key))
            return false;
    return true;
}

// Updates any account data except the basic ones that cannot change
function AccountUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data))
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == socket.id) {

				// Some data is never saved or updated from the client
				delete data.Name;
				delete data.AccountName;
				delete data.Password;
				delete data.Email;
				delete data.Creation;
				delete data.LastLogin;
				delete data.Pose;
				delete data.ActivePose;
				delete data.ChatRoom;
				delete data.ID;
				delete data.MemberNumber;
				delete data.Environment;
				delete data.Ownership;
				delete data.Lovership;

				// Some data is kept for future use
				if ((data.Inventory != null) && Array.isArray(data.Inventory)) Account[P].Inventory = data.Inventory;
				if (data.ItemPermission != null) Account[P].ItemPermission = data.ItemPermission;
				if (data.LabelColor != null) Account[P].LabelColor = data.LabelColor;
				if (data.Appearance != null) Account[P].Appearance = data.Appearance;
				if (data.Reputation != null) Account[P].Reputation = data.Reputation;
				if (data.Description != null) Account[P].Description = data.Description;
				if ((data.BlockItems != null) && Array.isArray(data.BlockItems)) Account[P].BlockItems = data.BlockItems;
				if ((data.WhiteList != null) && Array.isArray(data.WhiteList)) Account[P].WhiteList = data.WhiteList;
				if ((data.BlackList != null) && Array.isArray(data.BlackList)) Account[P].BlackList = data.BlackList;
				if ((data.FriendList != null) && Array.isArray(data.FriendList)) Account[P].FriendList = data.FriendList;

				// If we have data to push
				if (!ObjectEmpty(data)) Database.collection("Accounts").updateOne({ AccountName : Account[P].AccountName }, { $set: data }, function(err, res) { if (err) throw err; });
				break;

			}
}

// When the client account sends a query to the server
function AccountQuery(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data) && (data.Query != null) && (typeof data.Query === "string")) {

		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// OnlineFriends query - returns all friends that are online and the room name they are in
			if ((data.Query == "OnlineFriends") && (Acc.FriendList != null)) {

				// Add all submissives owned by the player to the list
				var Friends = [];
				var Index = [];
				for (var A = 0; A < Account.length; A++)
					if ((Account[A].Environment == Acc.Environment) && (Account[A].Ownership != null) && (Account[A].Ownership.MemberNumber != null) && (Account[A].Ownership.MemberNumber == Acc.MemberNumber)) {
						Friends.push({ Type: "Submissive", MemberNumber: Account[A].MemberNumber, MemberName: Account[A].Name, ChatRoomSpace: (Account[A].ChatRoom == null) ? null : Account[A].ChatRoom.Space, ChatRoomName: (Account[A].ChatRoom == null) ? null : Account[A].ChatRoom.Name });
						Index.push(Account[A].MemberNumber);
					}

				// Builds the online friend list, both players must be friends to find each other
				for (var F = 0; F < Acc.FriendList.length; F++)
					if ((Acc.FriendList[F] != null) && (typeof Acc.FriendList[F] === "number"))
						if (Index.indexOf(Acc.FriendList[F]) < 0) // No need to search for the friend if she's owned
							for (var A = 0; A < Account.length; A++)
								if (Account[A].MemberNumber == Acc.FriendList[F]) {
									if ((Account[A].Environment == Acc.Environment) && (Account[A].FriendList != null) && (Account[A].FriendList.indexOf(Acc.MemberNumber) >= 0))
										Friends.push({ Type: "Friend", MemberNumber: Account[A].MemberNumber, MemberName: Account[A].Name, ChatRoomSpace: ((Account[A].ChatRoom != null) && !Account[A].ChatRoom.Private) ? Account[A].ChatRoom.Space : null, ChatRoomName: (Account[A].ChatRoom == null) ? null : (Account[A].ChatRoom.Private) ? "-Private-" : Account[A].ChatRoom.Name });
									A = Account.length;
								}

				// Sends the query result to the client
				socket.emit("AccountQueryResult", { Query: data.Query, Result: Friends });

			}

		}

	}
}

// When a player wants to beep another player
function AccountBeep(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data) && (data.MemberNumber != null) && (typeof data.MemberNumber === "number")) {

		// Make sure both accounts are online, friends and sends the beep to the friend
		var Acc = AccountGet(socket.id);
		if (Acc != null)
			for (var A = 0; A < Account.length; A++)
				if (Account[A].MemberNumber == data.MemberNumber)
					if ((Account[A].Environment == Acc.Environment) && (((Account[A].FriendList != null) && (Account[A].FriendList.indexOf(Acc.MemberNumber) >= 0)) || ((Account[A].Ownership != null) && (Account[A].Ownership.MemberNumber != null) && (Account[A].Ownership.MemberNumber == Acc.MemberNumber))))
						Account[A].Socket.emit("AccountBeep", { MemberNumber: Acc.MemberNumber, MemberName: Acc.Name, ChatRoomSpace: (Acc.ChatRoom == null) ? null : Acc.ChatRoom.Space, ChatRoomName: (Acc.ChatRoom == null) ? null : Acc.ChatRoom.Name });

	}
}

// Removes the account from the buffer
function AccountRemove(ID) {
	if (ID != null)
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == ID) {
				ChatRoomRemove(Account[P], "ServerDisconnect", []);
				if (Account[P] != null) console.log("Disconnecting account: " + Account[P].AccountName + " ID: " + ID.toString());
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
	if ((data != null) && (typeof data === "object") && (data.Query != null) && (typeof data.Query === "string") && (data.Query.length <= 20)) {

		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Gets the space of the chat room (empty for public, asylum, etc.)
			var Space = "";
			if ((data.Space != null) && (typeof data.Space === "string") && (data.Space.length <= 100)) Space = data.Space;

			// Builds a list of up to 24 possible rooms, the last rooms created are shown first
			var CR = [];
			var C = 0;
			for (var C = ChatRoom.length - 1; ((C >= 0) && (CR.length <= 24)); C--)
				if ((ChatRoom[C] != null) && (ChatRoom[C].Account.length < ChatRoom[C].Limit))
					if ((Acc.Environment == ChatRoom[C].Environment) && (Space == ChatRoom[C].Space)) // Must be in same environment (prod/dev) and same space (hall/asylum)
						if (ChatRoom[C].Ban.indexOf(Acc.MemberNumber) < 0) // The player cannot be banned
							if ((data.Query == "") || (ChatRoom[C].Name.toUpperCase().indexOf(data.Query) >= 0)) // Room name must contain the searched name, if any
								if (!ChatRoom[C].Locked || (ChatRoom[C].Admin.indexOf(Acc.MemberNumber) >= 0)) // Must be unlocked, unless the player is an administrator
									if (!ChatRoom[C].Private || (ChatRoom[C].Name.toUpperCase() == data.Query)) { // If it's private, must know the exact name

										// Builds the searching account friend list in the current room
										var Friends = [];
										for (var A = 0; A < ChatRoom[C].Account.length; A++)
											if (ChatRoom[C].Account[A] != null)
												if ((ChatRoom[C].Account[A].Ownership != null) && (ChatRoom[C].Account[A].Ownership.MemberNumber != null) && (ChatRoom[C].Account[A].Ownership.MemberNumber == Acc.MemberNumber))
													Friends.push({ Type: "Submissive", MemberNumber: ChatRoom[C].Account[A].MemberNumber, MemberName: ChatRoom[C].Account[A].Name});
												else if ((Acc.FriendList != null) && (ChatRoom[C].Account[A].FriendList != null) && (Acc.FriendList.indexOf(ChatRoom[C].Account[A].MemberNumber) >= 0) && (ChatRoom[C].Account[A].FriendList.indexOf(Acc.MemberNumber) >= 0))
													Friends.push({ Type: "Friend", MemberNumber: ChatRoom[C].Account[A].MemberNumber, MemberName: ChatRoom[C].Account[A].Name});

										// Builds a room object with all data
										CR.push({
											Name: ChatRoom[C].Name,
											Creator: ChatRoom[C].Creator,
											MemberCount: ChatRoom[C].Account.length,
											MemberLimit: ChatRoom[C].Limit,
											Description: ChatRoom[C].Description,
											Friends: Friends
										});

									}

			// Sends the list to the client
			socket.emit("ChatRoomSearchResult", CR);

		}

	}
}

// Creates a new chat room 
function ChatRoomCreate(data, socket) {

	// Make sure we have everything to create it
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (data.Description != null) && (data.Background != null) && (data.Private != null) && (typeof data.Name === "string") && (typeof data.Description === "string") && (typeof data.Background === "string") && (typeof data.Private === "boolean")) {

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

			// Gets the space of the chat room (empty for public, asylum, etc.)
			var Space = "";
			if ((data.Space != null) && (typeof data.Space === "string") && (data.Space.length <= 100)) Space = data.Space;

			// Finds the account and links it to the new room
			var Acc = AccountGet(socket.id);
			if (Acc != null) {
				ChatRoomRemove(Acc, "ServerLeave", []);
				var NewRoom = {
					Name: data.Name,
					Description: data.Description,
					Background: data.Background,
					Limit: ((data.Limit == null) || (typeof data.Limit !== "string") || isNaN(parseInt(data.Limit)) || (parseInt(data.Limit) < 2) || (parseInt(data.Limit) > 10)) ? 10 : parseInt(data.Limit),
					Private: data.Private || false,
					Locked : data.Locked || false,
					Environment: Acc.Environment,
					Space: Space,
					Creator: Acc.Name,
					Creation: CommonTime(),
					Account: [],
					Ban: [],
					Admin: [Acc.MemberNumber]
				}
				ChatRoom.push(NewRoom);
				Acc.ChatRoom = NewRoom;
				NewRoom.Account.push(Acc);
				console.log("Chat room (" + ChatRoom.length.toString() + ") " + data.Name + " created by account " + Acc.AccountName + ", ID: " + socket.id.toString());
				socket.emit("ChatRoomCreateResponse", "ChatRoomCreated");
				ChatRoomSync(NewRoom, Acc.MemberNumber);
			} else socket.emit("ChatRoomCreateResponse", "AccountError");

		} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

	} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

}

// Join an existing chat room 
function ChatRoomJoin(data, socket) {

	// Make sure we have everything to join it
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (typeof data.Name === "string") && (data.Name != "")) {
		
		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Removes it from it's current room if needed
			ChatRoomRemove(Acc, "ServerLeave", []);

			// Finds the room and join it
			for (var C = 0; C < ChatRoom.length; C++)
				if (ChatRoom[C].Name.toUpperCase().trim() == data.Name.toUpperCase().trim())
					if (Acc.Environment == ChatRoom[C].Environment)
						if (ChatRoom[C].Account.length < ChatRoom[C].Limit) {
							if (ChatRoom[C].Ban.indexOf(Acc.MemberNumber) < 0) {
								
								// If the room is unlocked or the player is an admin, we allow her inside
								if (!ChatRoom[C].Locked || (ChatRoom[C].Admin.indexOf(Acc.MemberNumber) >= 0)) {
									Acc.ChatRoom = ChatRoom[C];
									ChatRoom[C].Account.push(Acc);
									socket.emit("ChatRoomSearchResponse", "JoinedRoom");
									ChatRoomSync(ChatRoom[C], Acc.MemberNumber);
									ChatRoomMessage(ChatRoom[C], Acc.MemberNumber, "ServerEnter", "Action", null, [{Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber}]);
									return;
								} else {
									socket.emit("ChatRoomSearchResponse", "RoomLocked");
									return;
								}

							} else {
								socket.emit("ChatRoomSearchResponse", "RoomBanned");
								return;
							}

						} else {
							socket.emit("ChatRoomSearchResponse", "RoomFull");
							return;
						}

			// Since we didn't found the room to join
			socket.emit("ChatRoomSearchResponse", "CannotFindRoom");

		} else socket.emit("ChatRoomSearchResponse", "AccountError");

	} else socket.emit("ChatRoomSearchResponse", "InvalidRoomData");

}

// Removes a player from a room
function ChatRoomRemove(Acc, Reason, Dictionary) {
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
			if (!Dictionary || (Dictionary.length == 0)) Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
			ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, Reason, "Action", null, Dictionary);
			ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
		}
		Acc.ChatRoom = null;

	}
}

// Finds the current account and removes it from it's chat room, nothing is returned to the client
function ChatRoomLeave(socket) {
	var Acc = AccountGet(socket.id);
	if (Acc != null) ChatRoomRemove(Acc, "ServerLeave", []);
}

// Sends a text message to everyone in the room
function ChatRoomMessage(CR, Sender, Content, Type, Target, Dictionary) {
	if (CR != null)
		for (var A = 0; A < CR.Account.length; A++)
			if (Target == null) {
				CR.Account[A].Socket.emit("ChatRoomMessage", { Sender: Sender, Content: Content, Type: Type, Dictionary: Dictionary } );
			} else {
				// A player cannot whisper to a another player if she's on her blacklist
				if (Target == CR.Account[A].MemberNumber) {
					if ((CR.Account[A].BlackList == null) || !Array.isArray(CR.Account[A].BlackList) || (CR.Account[A].BlackList.indexOf(Sender) < 0))
						CR.Account[A].Socket.emit("ChatRoomMessage", { Sender: Sender, Content: Content, Type: Type, Dictionary: Dictionary } );
					else
						for (var S = 0; S < CR.Account.length; S++)
							if (Sender == CR.Account[S].MemberNumber)
								CR.Account[S].Socket.emit("ChatRoomMessage", { Sender: Target, Content: "WhisperBlocked", Type: "ServerMessage", Dictionary: [{ Tag: "SourceCharacter", Text: CR.Account[S].Name, MemberNumber: CR.Account[S].MemberNumber }]} );
					return;
				}

			}
}

// When a user sends a chat message, we propagate it to everyone in the room
function ChatRoomChat(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.Content != null) && (data.Type != null) && (typeof data.Content === "string") && (typeof data.Type === "string") && (ChatRoomMessageType.indexOf(data.Type) >= 0) && (data.Content.length <= 1000)) {
		var Acc = AccountGet(socket.id);
		if (Acc != null) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, data.Content.trim(), data.Type, data.Target, data.Dictionary);
	}
}

// Syncs the room data with all of it's members
function ChatRoomSync(CR, SourceMemberNumber) {

	// Builds the room data
	var R = {};
	R.Name = CR.Name;
	R.Description = CR.Description;
	R.Admin = CR.Admin;
	R.Ban = CR.Ban;
	R.Background = CR.Background;
	R.Limit = CR.Limit;
	R.SourceMemberNumber = SourceMemberNumber;
	R.Locked = CR.Locked;
	R.Private = CR.Private;

	// Adds the characters from the room
	R.Character = [];
	for (var C = 0; C < CR.Account.length; C++) {
		var A = {};
		A.ID = CR.Account[C].ID;
		A.Name = CR.Account[C].Name;
		A.AssetFamily = CR.Account[C].AssetFamily;
		A.Title = CR.Account[C].Title;
		A.Appearance = CR.Account[C].Appearance;
		A.ActivePose = CR.Account[C].ActivePose;
		A.Reputation = CR.Account[C].Reputation;
		A.Creation = CR.Account[C].Creation;
		A.Lover = CR.Account[C].Lover;
		A.Lovership = CR.Account[C].Lovership;
		A.Description = CR.Account[C].Description;
		A.Owner = CR.Account[C].Owner;
		A.MemberNumber = CR.Account[C].MemberNumber;
		A.LabelColor = CR.Account[C].LabelColor;
		A.ItemPermission = CR.Account[C].ItemPermission;
		A.Inventory = CR.Account[C].Inventory;
		A.Ownership = CR.Account[C].Ownership;
		A.BlockItems = CR.Account[C].BlockItems;
		R.Character.push(A);
	}

	// Sends the full packet to everyone in the room
	for (var A = 0; A < CR.Account.length; A++)
		CR.Account[A].Socket.emit("ChatRoomSync", R);

}

// Updates a character from the chat room
function ChatRoomCharacterUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.ID != null) && (typeof data.ID === "string") && (data.ID != "") && (data.Appearance != null)) {
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null))
			if (Acc.ChatRoom.Ban.indexOf(Acc.MemberNumber) < 0)
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if ((Acc.ChatRoom.Account[A].ID == data.ID) && ChatRoomGetAllowItem(Acc, Acc.ChatRoom.Account[A]))
						if ((typeof data.Appearance === "object") && Array.isArray(data.Appearance) && (data.Appearance.length >= 5) && (JSON.stringify(data.Appearance).length < 180000)) {
							Database.collection("Accounts").updateOne({ AccountName : Acc.ChatRoom.Account[A].AccountName }, { $set: { Appearance: data.Appearance } }, function(err, res) { if (err) throw err; });
							Acc.ChatRoom.Account[A].Appearance = data.Appearance;
							Acc.ChatRoom.Account[A].ActivePose = data.ActivePose;
							ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
						}
	}
}

// When an administrator account wants to act on another account in the room
function ChatRoomAdmin(data, socket) {

	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number") && (data.Action != null) && (typeof data.Action === "string")) {

		// Validates that the current account is a room administrator
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.MemberNumber != data.MemberNumber) && (Acc.ChatRoom != null) && (Acc.ChatRoom.Admin.indexOf(Acc.MemberNumber) >= 0)) {

			// An administrator can update lots of room data.  The room values are sent back to the clients.
			if (data.Action == "Update")
				if ((data.Room != null) && (typeof data.Room === "object") && (data.Room.Name != null) && (data.Room.Description != null) && (data.Room.Background != null) && (typeof data.Room.Name === "string") && (typeof data.Room.Description === "string") && (typeof data.Room.Background === "string") && (!data.Room.Admin.some(i => !Number.isInteger(i))) && (!data.Room.Ban.some(i => !Number.isInteger(i)))) {
					data.Room.Name = data.Room.Name.trim();
					var LN = /^[a-zA-Z0-9 ]+$/;
					if (data.Room.Name.match(LN) && (data.Room.Name.length >= 1) && (data.Room.Name.length <= 20) && (data.Room.Description.length <= 100) && (data.Room.Background.length <= 100)) {
						for (var C = 0; C < ChatRoom.length; C++)
							if (Acc.ChatRoom.Name != data.Room.Name && ChatRoom[C].Name.toUpperCase().trim() == data.Room.Name.toUpperCase().trim()) {
								socket.emit("ChatRoomUpdateResponse", "RoomAlreadyExist");
								return;
							}
						Acc.ChatRoom.Name = data.Room.Name;
						Acc.ChatRoom.Background = data.Room.Background;
						Acc.ChatRoom.Description = data.Room.Description;
						Acc.ChatRoom.Ban = data.Room.Ban;
						Acc.ChatRoom.Admin = data.Room.Admin;
						Acc.ChatRoom.Limit = ((data.Room.Limit == null) || (typeof data.Room.Limit !== "string") || isNaN(parseInt(data.Room.Limit)) || (parseInt(data.Room.Limit) < 2) || (parseInt(data.Room.Limit) > 10)) ? 10 : parseInt(data.Room.Limit);
						if ((data.Room.Private != null) && (typeof data.Room.Private === "boolean")) Acc.ChatRoom.Private = data.Room.Private;
						if ((data.Room.Locked != null) && (typeof data.Room.Locked === "boolean")) Acc.ChatRoom.Locked = data.Room.Locked;
						socket.emit("ChatRoomUpdateResponse", "Updated");
						if ((Acc != null) && (Acc.ChatRoom != null)) {
							var Dictionary = [];
							Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber})
							Dictionary.push({Tag: "ChatRoomName", Text: Acc.ChatRoom.Name})
							Dictionary.push({Tag: "ChatRoomLimit", Text: Acc.ChatRoom.Limit})
							Dictionary.push({Tag: "ChatRoomPrivacy", TextToLookUp: (Acc.ChatRoom.Private ? "Private" : "Public")})
							Dictionary.push({Tag: "ChatRoomLocked", TextToLookUp: (Acc.ChatRoom.Locked ? "Locked" : "Unlocked")})
							ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerUpdateRoom", "Action", null, Dictionary);
						}
						if ((Acc != null) && (Acc.ChatRoom != null)) ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
						return;
					} else socket.emit("ChatRoomUpdateResponse", "InvalidRoomData");
				} else socket.emit("ChatRoomUpdateResponse", "InvalidRoomData");

			// An administrator can swap the position of two characters in a room
			if ((data.Action == "Swap") && (data.TargetMemberNumber != null) && (typeof data.TargetMemberNumber === "number") && (data.DestinationMemberNumber != null) && (typeof data.DestinationMemberNumber === "number") && (data.TargetMemberNumber != data.DestinationMemberNumber)) {
				var TargetAccountIndex = Acc.ChatRoom.Account.findIndex(x => x.MemberNumber == data.TargetMemberNumber);
				var DestinationAccountIndex = Acc.ChatRoom.Account.findIndex(x => x.MemberNumber == data.DestinationMemberNumber);
				if ((TargetAccountIndex < 0) || (DestinationAccountIndex < 0)) return;
				var TargetAccount = Acc.ChatRoom.Account[TargetAccountIndex];
				var DestinationAccount = Acc.ChatRoom.Account[DestinationAccountIndex];
				var Dictionary = [];
				Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
				Dictionary.push({ Tag: "TargetCharacterName", Text: TargetAccount.Name, MemberNumber: TargetAccount.MemberNumber });
				Dictionary.push({ Tag: "DestinationCharacterName", Text: DestinationAccount.Name, MemberNumber: DestinationAccount.MemberNumber });
				ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerSwap", "Action", null, Dictionary);
				Acc.ChatRoom.Account[TargetAccountIndex] = DestinationAccount;
				Acc.ChatRoom.Account[DestinationAccountIndex] = TargetAccount;
				ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
				return;
			}

			// If the account to act upon is in the room, an administrator can ban, kick, move, promote or demote him
			for (var A = 0; A < Acc.ChatRoom.Account.length; A++)
				if (Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) {
					var Dictionary = [];
					if (data.Action == "Ban") {
						Acc.ChatRoom.Ban.push(data.MemberNumber);
						Acc.ChatRoom.Account[A].Socket.emit("ChatRoomSearchResponse", "RoomBanned");
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						ChatRoomRemove(Acc.ChatRoom.Account[A], "ServerBan", Dictionary);
					}
					else if (data.Action == "Kick") {
						Acc.ChatRoom.Account[A].Socket.emit("ChatRoomSearchResponse", "RoomKicked");
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						ChatRoomRemove(Acc.ChatRoom.Account[A], "ServerKick", Dictionary);
					}
					else if ((data.Action == "MoveLeft") && (A != 0)) {
						var MovedAccount = Acc.ChatRoom.Account[A];
						Acc.ChatRoom.Account[A] = Acc.ChatRoom.Account[A - 1];
						Acc.ChatRoom.Account[A - 1] = MovedAccount;
						Dictionary.push({Tag: "TargetCharacterName", Text: MovedAccount.Name, MemberNumber: MovedAccount.MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						if ((data.Publish != null) && (typeof data.Publish === "boolean") && data.Publish) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerMoveLeft", "Action", null, Dictionary);
						ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "MoveRight") && (A < Acc.ChatRoom.Account.length - 1)) {
						var MovedAccount = Acc.ChatRoom.Account[A];
						Acc.ChatRoom.Account[A] = Acc.ChatRoom.Account[A + 1];
						Acc.ChatRoom.Account[A + 1] = MovedAccount;
						Dictionary.push({Tag: "TargetCharacterName", Text: MovedAccount.Name, MemberNumber: MovedAccount.MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						if ((data.Publish != null) && (typeof data.Publish === "boolean") && data.Publish) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerMoveRight", "Action", null, Dictionary);
						ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Promote") && (Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber) < 0)) {
						Acc.ChatRoom.Admin.push(Acc.ChatRoom.Account[A].MemberNumber);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerPromoteAdmin", "Action", null, Dictionary);
						ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Demote") && (Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber) >= 0)) {
						Acc.ChatRoom.Admin.splice(Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber), 1);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerDemoteAdmin", "Action", null, Dictionary);
						ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
					}
					return;
				}

			// Can also ban or unban without having the player in the room, there's no visible output
			if ((data.Action == "Ban") && (Acc.ChatRoom.Ban.indexOf(data.MemberNumber) < 0)) Acc.ChatRoom.Ban.push(data.MemberNumber);
			if ((data.Action == "Unban") && (Acc.ChatRoom.Ban.indexOf(data.MemberNumber) >= 0)) Acc.ChatRoom.Ban.splice(Acc.ChatRoom.Ban.indexOf(data.MemberNumber), 1);
		}

	}
}

// Returns a specific reputation value for the player
function ChatRoomDominantValue(Account) {
	if ((Account.Reputation != null) && (Array.isArray(Account.Reputation)))
		for (var R = 0; R < Account.Reputation.length; R++)
			if ((Account.Reputation[R].Type != null) && (Account.Reputation[R].Value != null) && (typeof Account.Reputation[R].Type === "string") && (typeof Account.Reputation[R].Value === "number") && (Account.Reputation[R].Type == "Dominant"))
				return parseInt(Account.Reputation[R].Value);
	return 0;
}

// Compares the source account and target account to check if we allow using an item
function ChatRoomGetAllowItem(Source, Target) {

	// Make sure we have the required data
	if ((Source == null) || (Target == null)) return false;
	AccountValidData(Source);
	AccountValidData(Target);

	// At zero permission level or if target is source or if owner, we allow it
	if ((Target.ItemPermission <= 0) || (Source.MemberNumber == Target.MemberNumber) || ((Target.Ownership != null) && (Target.Ownership.MemberNumber != null) && (Target.Ownership.MemberNumber == Source.MemberNumber))) return true;

	// At one, we allow if the source isn't on the blacklist
	if ((Target.ItemPermission == 1) && (Target.BlackList.indexOf(Source.MemberNumber) < 0)) return true;

	// At two, we allow if the source is Dominant compared to the Target (25 points allowed) or on whitelist or a lover
	if ((Target.ItemPermission == 2) && (Target.BlackList.indexOf(Source.MemberNumber) < 0) && ((ChatRoomDominantValue(Source) + 25 >= ChatRoomDominantValue(Target)) || (Target.WhiteList.indexOf(Source.MemberNumber) >= 0) || (Target.Lovership && (Target.Lovership.MemberNumber == Source.MemberNumber)))) return true;

	// At three, we allow if the source is on the whitelist of the Target or a lover
	if ((Target.ItemPermission == 3) && ((Target.WhiteList.indexOf(Source.MemberNumber) >= 0) || (Target.Lovership && (Target.Lovership.MemberNumber == Source.MemberNumber)))) return true;

	// No valid combo, we don't allow the item
	return false;

}

// Returns TRUE if we allow applying an item from a character to another
function ChatRoomAllowItem(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number") && (data.MemberNumber > 0)) {
		
		// Gets the source account and target account to check if we allow or not
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null))
			for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
				if (Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber)
					socket.emit("ChatRoomAllowItem", { MemberNumber: data.MemberNumber, AllowItem: ChatRoomGetAllowItem(Acc, Acc.ChatRoom.Account[A]) });

	}
}

// Updates the reset password entry number or creates a new one, this number will have to be entered by the user later
function PasswordResetSetNumber(AccountName, ResetNumber) {
	for (var R = 0; R < PasswordResetProgress.length; R++)
		if (PasswordResetProgress[R].AccountName.trim() == AccountName.trim()) {
			PasswordResetProgress[R].ResetNumber = ResetNumber;
			return;
		}
	PasswordResetProgress.push({ AccountName: AccountName, ResetNumber: ResetNumber });
}

// Generates a password reset number and sends it to the user
function PasswordReset(data, socket) {
	if ((data != null) && (typeof data === "string") && (data != "") && data.match(/^[a-zA-Z0-9@.]+$/) && (data.length >= 5) && (data.length <= 100) && (data.indexOf("@") > 0) && (data.indexOf(".") > 0)) {

		// Gets all accounts that matches the email
		Database.collection("Accounts").find({ Email : data }).toArray(function(err, result) {

			// If we found accounts with that email
			if (err) throw err;
			if ((result != null) && (typeof result === "object") && (result.length > 0)) {
								
				// Builds a reset number for each account found and creates the email body
				var EmailBody = "To reset your account password, enter your account name and the reset number included in this email.  You need to put these in the Bondage Club password reset screen, with your new password.<br /><br />";
				for (var R = 0; R < result.length; R++) {
					var ResetNumber = (Math.round(Math.random() * 1000000000000)).toString();
					PasswordResetSetNumber(result[R].AccountName, ResetNumber);
					EmailBody = EmailBody + "Account Name: " + result[R].AccountName + "<br />";
					EmailBody = EmailBody + "Reset Number: " + ResetNumber + "<br /><br />";
				}

				// Prepares the email to be sent
				var mailOptions = {
					from: "donotreply@bondageprojects.com",
					to: result[0].Email,
					subject: "Bondage Club Password Reset",
					html: EmailBody
				};

				// Sends the email and logs the result
				MailTransporter.sendMail(mailOptions, function (err, info) {
					if (err) {
						console.log("Error while sending password reset email: " + err);
						socket.emit("PasswordResetResponse", "EmailSentError");
					}
					else {
						console.log("Password reset email send to: " + result[0].Email);
						socket.emit("PasswordResetResponse", "EmailSent");
					}
				});

			} else socket.emit("PasswordResetResponse", "NoAccountOnEmail");

		});

	}
}

// Generates a password reset number and sends it to the user
function PasswordResetProcess(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.AccountName != null) && (typeof data.AccountName === "string") && (data.ResetNumber != null) && (typeof data.ResetNumber === "string") && (data.NewPassword != null) && (typeof data.NewPassword === "string")) {
		
		// Makes sure the data is valid
		var LN = /^[a-zA-Z0-9 ]+$/;
		if (data.AccountName.match(LN) && data.NewPassword.match(LN) && (data.AccountName.length > 0) && (data.AccountName.length <= 20) && (data.NewPassword.length > 0) && (data.NewPassword.length <= 20)) {
			
			// Checks if the reset number matches
			for (var R = 0; R < PasswordResetProgress.length; R++)
				if ((PasswordResetProgress[R].AccountName == data.AccountName) && (PasswordResetProgress[R].ResetNumber == data.ResetNumber)) {					

					// Creates a hashed password and updates the account with it
					BCrypt.hash(data.NewPassword.toUpperCase(), 10, function( err, hash ) {
						if (err) throw err;
						console.log("Updating password for account: " + data.AccountName);
						Database.collection("Accounts").updateOne({ AccountName : data.AccountName }, { $set: { Password: hash } }, function(err, res) { if (err) throw err; });
						socket.emit("PasswordResetResponse", "PasswordResetSuccessful");
					});
					return;
				}

			// Sends a fail message to the client
			socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");

		} else socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");

	} else socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");
}

// Gets the current ownership status between two players in the same chatroom
function AccountOwnership(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number") && (data.MemberNumber > 0)) {
	
		// The submissive can flush it's owner at any time in the trial, or after a delay if collared
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.Ownership != null) && (Acc.Ownership.Stage != null) && (Acc.Ownership.Start != null) && ((Acc.Ownership.Stage == 0) || (Acc.Ownership.Start + OwnershipDelay <= CommonTime())) && (data.Action != null) && (typeof data.Action === "string") && (data.Action == "Break")) {
			Acc.Owner = "";
			Acc.Ownership = null;
			var O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
			Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
			socket.emit("AccountOwnership", { ClearOwnership: true });
			return;
		}

		// In a chatroom, the dominant and submissive can enter in a BDSM relationship (4 steps to complete)
		if ((Acc != null) && (Acc.ChatRoom != null)) {

			// The dominant player proposes to the submissive player
			if ((Acc.Ownership == null) || (Acc.Ownership.MemberNumber == null) || (Acc.Ownership.MemberNumber != data.MemberNumber)) // Cannot propose if target player is already owner
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if ((Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) && (Acc.ChatRoom.Account[A].BlackList.indexOf(Acc.MemberNumber) < 0)) // Cannot propose if on blacklist
						if ((Acc.ChatRoom.Account[A].Owner == null) || (Acc.ChatRoom.Account[A].Owner == "")) { // Cannot propose if owned by a NPC

							// If there's no ownership, the dominant can propose to start a trial (Step 1 / 4)
							if ((Acc.ChatRoom.Account[A].Ownership == null) || (Acc.ChatRoom.Account[A].Ownership.MemberNumber == null)) {
								if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Propose")) {
									Acc.ChatRoom.Account[A].Owner = "";
									Acc.ChatRoom.Account[A].Ownership = { StartTrialOfferedByMemberNumber: Acc.MemberNumber };
									ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferStartTrial", "ServerMessage", Acc.ChatRoom.Account[A].MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanOfferStartTrial" });
							}

							// If trial has started, the dominant can offer to end it after the delay (Step 3 / 4)
							if ((Acc.ChatRoom != null) && (Acc.ChatRoom.Account[A].Ownership != null) && (Acc.ChatRoom.Account[A].Ownership.MemberNumber == Acc.MemberNumber) && (Acc.ChatRoom.Account[A].Ownership.EndTrialOfferedByMemberNumber == null) && (Acc.ChatRoom.Account[A].Ownership.Stage != null) && (Acc.ChatRoom.Account[A].Ownership.Start != null) && (Acc.ChatRoom.Account[A].Ownership.Stage == 0) && (Acc.ChatRoom.Account[A].Ownership.Start + OwnershipDelay <= CommonTime())) {
								if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Propose")) {
									Acc.ChatRoom.Account[A].Ownership.EndTrialOfferedByMemberNumber = Acc.MemberNumber;
									ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferEndTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanOfferEndTrial" });
							}

						}

			// The submissive player can accept a proposal from the dominant
			if ((Acc.Ownership != null) && ((Acc.Ownership.MemberNumber == null) || (Acc.Ownership.MemberNumber == data.MemberNumber))) // No possible interaction if the player is owned by someone else
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if ((Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) && (Acc.ChatRoom.Account[A].BlackList.indexOf(Acc.MemberNumber) < 0)) { // Cannot accept if on blacklist
				
						// If the submissive wants to accept to start the trial period (Step 2 / 4)
						if ((Acc.Ownership.StartTrialOfferedByMemberNumber != null) && (Acc.Ownership.StartTrialOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Accept")) {
								Acc.Owner = "";
								Acc.Ownership = { MemberNumber: data.MemberNumber, Name: Acc.ChatRoom.Account[A].Name, Start: CommonTime(), Stage: 0 };
								var O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
								Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
								socket.emit("AccountOwnership", O);
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "StartTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
							} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanStartTrial" });
						}

						// If the submissive wants to accept the full collar (Step 4 /4)
						if ((Acc.Ownership.Stage != null) && (Acc.Ownership.Stage == 0) && (Acc.Ownership.EndTrialOfferedByMemberNumber != null) && (Acc.Ownership.EndTrialOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Accept")) {
								Acc.Owner = Acc.ChatRoom.Account[A].Name;
								Acc.Ownership = { MemberNumber: data.MemberNumber, Name: Acc.ChatRoom.Account[A].Name, Start: CommonTime(), Stage: 1 };
								var O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
								Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
								socket.emit("AccountOwnership", O);
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "EndTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
							} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanEndTrial" });
						}

					}

		}

	}
}

function AccountLovership(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number") && (data.MemberNumber > 0)) {

        // A Lover can break her relationship any time in the trial, or after a delay if official
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.Lovership != null) && (Acc.Lovership.Stage != null) && (Acc.Lovership.Start != null) && ((Acc.Lovership.Stage == 0) || (Acc.Lovership.Start + LovershipDelay <= CommonTime())) && (data.Action != null) && (typeof data.Action === "string") && (data.Action == "Break")) {

			// Update the other account if online
			for (var A = 0; A < Account.length; A++)
                if (Account[A].MemberNumber == Acc.Lovership.MemberNumber) {
                    Account[A].Lover = "";
                    Account[A].Lovership = null;
                    Account[A].Socket.emit("AccountLovership", { ClearLovership: true });
					if (Account[A].ChatRoom != null) ChatRoomSync(Account[A].ChatRoom, Account[A].MemberNumber);
				}
            Database.collection("Accounts").updateOne({ MemberNumber : Acc.Lovership.MemberNumber}, { $set: { Lovership: null, Lover: ""}}, function(err, res) { if (err) throw err; });
		    Acc.Lover = "";
			Acc.Lovership = null;
			var O = { Lovership: Acc.Lovership, Lover: Acc.Lover };
			Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
			socket.emit("AccountLovership", { ClearLovership: true });
			return;
		}

        // In a chatroom, two players can enter in a lover relationship (4 steps to complete)
		if ((Acc != null) && (Acc.ChatRoom != null)) {

			// One player propose to another
			if ((Acc.Lovership == null) || (Acc.Lovership.MemberNumber == null) || (Acc.Lover == "")) // Cannot propose if target player is already a Lover
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if ((Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) && (Acc.ChatRoom.Account[A].BlackList.indexOf(Acc.MemberNumber) < 0)) // Cannot propose if on blacklist
						if (((Acc.ChatRoom.Account[A].Lover == null) || (Acc.ChatRoom.Account[A].Lover == "")) && ((Acc.Lover == null) || (Acc.Lover == ""))) { // Cannot propose if in love with a NPC

							// If there's no Lovership, one player can propose to start dating (Step 1 / 6)
							if ((Acc.Lovership == null) && ((Acc.ChatRoom.Account[A].Lovership == null) || (Acc.ChatRoom.Account[A].Lovership.MemberNumber == null))) {
								if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Propose")) {
									Acc.ChatRoom.Account[A].Lover = "";
									Acc.ChatRoom.Account[A].Lovership = { BeginDatingOfferedByMemberNumber: Acc.MemberNumber };
									ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginDating", "ServerMessage", Acc.ChatRoom.Account[A].MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginDating" });
							}

							// If dating has started, a player can propose to engage after a delay (Step 3 / 6)
							if ((Acc.ChatRoom != null) && (Acc.ChatRoom.Account[A].Lovership != null) && (Acc.ChatRoom.Account[A].Lovership.MemberNumber == Acc.MemberNumber) && (Acc.ChatRoom.Account[A].Lovership.BeginEngagementOfferedByMemberNumber == null) && (Acc.ChatRoom.Account[A].Lovership.Stage != null) && (Acc.ChatRoom.Account[A].Lovership.Start != null) && (Acc.ChatRoom.Account[A].Lovership.Stage == 0) && (Acc.ChatRoom.Account[A].Lovership.Start + LovershipDelay <= CommonTime())) {
								if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Propose")) {
									Acc.ChatRoom.Account[A].Lovership.BeginEngagementOfferedByMemberNumber = Acc.MemberNumber;
									ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginEngagement", "ServerMessage", Acc.ChatRoom.Account[A].MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginEngagement" });
							}

							// If engaged, a player can propose to marry after a delay (Step 5 / 6)
							if ((Acc.ChatRoom != null) && (Acc.ChatRoom.Account[A].Lovership != null) && (Acc.ChatRoom.Account[A].Lovership.MemberNumber == Acc.MemberNumber) && (Acc.ChatRoom.Account[A].Lovership.BeginWeddingOfferedByMemberNumber == null) && (Acc.ChatRoom.Account[A].Lovership.Stage != null) && (Acc.ChatRoom.Account[A].Lovership.Start != null) && (Acc.ChatRoom.Account[A].Lovership.Stage == 1) && (Acc.ChatRoom.Account[A].Lovership.Start + LovershipDelay <= CommonTime())) {
								if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Propose")) {
									Acc.ChatRoom.Account[A].Lovership.BeginWeddingOfferedByMemberNumber = Acc.MemberNumber;
									ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginWedding", "ServerMessage", Acc.ChatRoom.Account[A].MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
								} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginWedding" });
							}

						}

			// A player can accept a proposal from another one
			if ((Acc.Lovership != null) && ((Acc.Lovership.MemberNumber == null) || (Acc.Lovership.MemberNumber == data.MemberNumber))) // No possible interaction if the player is in love with someone else
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if ((Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) && (Acc.ChatRoom.Account[A].BlackList.indexOf(Acc.MemberNumber) < 0)) { // Cannot accept if on blacklist

						// If a player wants to accept to start dating (Step 2 / 6)
						if ((Acc.Lovership.BeginDatingOfferedByMemberNumber != null) && (Acc.Lovership.BeginDatingOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Accept")) {
								Acc.Lover = "";
								Acc.Lovership = { MemberNumber: data.MemberNumber, Name: Acc.ChatRoom.Account[A].Name, Start: CommonTime(), Stage: 0 };
								Acc.ChatRoom.Account[A].Lover = "";
								Acc.ChatRoom.Account[A].Lovership = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 0 };
								var O = { Lovership: Acc.Lovership, Lover: Acc.Lover };
								var P = { Lovership: Acc.ChatRoom.Account[A].Lovership, Lover: Acc.ChatRoom.Account[A].Lover };
                                Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
                                Database.collection("Accounts").updateOne({ MemberNumber : Acc.Lovership.MemberNumber}, { $set: P }, function(err, res) { if (err) throw err; });
                                socket.emit("AccountLovership", O);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership.Name, MemberNumber: Acc.Lovership.MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginDating", "ServerMessage", null, Dictionary);
								ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginDating" });
						}

						// If the player wants to become one's fiancée (Step 4 / 6)
						if ((Acc.Lovership.Stage != null) && (Acc.Lovership.Stage == 0) && (Acc.Lovership.BeginEngagementOfferedByMemberNumber != null) && (Acc.Lovership.BeginEngagementOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Accept")) {
								Acc.Lover = "";
								Acc.Lovership = { MemberNumber: data.MemberNumber, Name: Acc.ChatRoom.Account[A].Name, Start: CommonTime(), Stage: 1 };
								Acc.ChatRoom.Account[A].Lover = "";
								Acc.ChatRoom.Account[A].Lovership = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 1 };
								var O = { Lovership: Acc.Lovership, Lover: Acc.Lover };
								var P = { Lovership: Acc.ChatRoom.Account[A].Lovership, Lover: Acc.ChatRoom.Account[A].Lover };
								Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
								Database.collection("Accounts").updateOne({ MemberNumber : Acc.Lovership.MemberNumber }, { $set: P }, function(err, res) { if (err) throw err; });
								socket.emit("AccountLovership", O);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership.Name, MemberNumber: Acc.Lovership.MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginEngagement", "ServerMessage", null, Dictionary);
								ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginEngagement" });
						}

						// If the player wants to become one's wife (Step 6 / 6)
						if ((Acc.Lovership.Stage != null) && (Acc.Lovership.Stage == 1) && (Acc.Lovership.BeginWeddingOfferedByMemberNumber != null) && (Acc.Lovership.BeginWeddingOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (typeof data.Action === "string") && (data.Action == "Accept")) {
								Acc.Lover = Acc.ChatRoom.Account[A].Name;
								Acc.Lovership = { MemberNumber: data.MemberNumber, Name: Acc.ChatRoom.Account[A].Name, Start: CommonTime(), Stage: 2 };
								Acc.ChatRoom.Account[A].Lover = Acc.Name;
								Acc.ChatRoom.Account[A].Lovership = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 2 };
								var O = { Lovership: Acc.Lovership, Lover: Acc.Lover };
								var P = { Lovership: Acc.ChatRoom.Account[A].Lovership, Lover: Acc.ChatRoom.Account[A].Lover };
								Database.collection("Accounts").updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
								Database.collection("Accounts").updateOne({ MemberNumber : Acc.Lovership.MemberNumber }, { $set: P }, function(err, res) { if (err) throw err; });
								socket.emit("AccountLovership", O);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership.Name, MemberNumber: Acc.Lovership.MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginWedding", "ServerMessage", null, Dictionary);
								ChatRoomSync(Acc.ChatRoom, Acc.MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginWedding" });
						}

					}

		}

	}
}