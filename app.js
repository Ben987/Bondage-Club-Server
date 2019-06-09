"use strict";

// Main game objects
var App = require("http").createServer()
var IO = require("socket.io")(App);
var BCrypt = require("bcrypt");
var Account = [];
var ChatRoom = [];
var ChatRoomMessageType = ["Chat", "Action", "Emote"];
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
DatabaseClient.connect(DatabaseURL, { useNewUrlParser: true }, function(err, db) {
	
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
				socket.on("AccountDisconnect", function () { AccountRemove(socket.id) });
				socket.on("disconnect", function() { AccountRemove(socket.id) });
				socket.on("ChatRoomSearch", function(data) { ChatRoomSearch(data, socket) });
				socket.on("ChatRoomCreate", function(data) { ChatRoomCreate(data, socket) });
				socket.on("ChatRoomJoin", function(data) { ChatRoomJoin(data, socket) });
				socket.on("ChatRoomLeave", function() { ChatRoomLeave(socket) });
				socket.on("ChatRoomChat", function(data) { ChatRoomChat(data, socket) });
				socket.on("ChatRoomCharacterUpdate", function(data) { ChatRoomCharacterUpdate(data, socket) });
				socket.on("ChatRoomBan", function(data) { ChatRoomBan(data, socket) });
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

// Load a single account file
function AccountLogin(data, socket) {

	// Makes sure the login comes with a name and a password
	if ((data != null) && (typeof data === "object") && (data.AccountName != null) && (data.Password != null)) {
	
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
							
						// Assigns a member number if there's none
						if (result.MemberNumber == null) {
							result.MemberNumber = NextMemberNumber;
							NextMemberNumber++;
							console.log("Assigning missing member number: " + result.MemberNumber + " for account: " + result.AccountName);
							Database.collection("Accounts").updateOne({ AccountName : result.AccountName }, { $set: { MemberNumber: result.MemberNumber } }, function(err, res) { if (err) throw err; });
						}

						// Logs the account
						result.ID = socket.id;
						result.Environment = AccountGetEnvironment(socket);
						console.log("Login account: " + result.AccountName + " ID: " + socket.id.toString() + " " + result.Environment);
						AccountValidData(result);
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

// Returns TRUE if the object is empty
function ObjectEmpty(obj) {
    for(var key in obj)
        if (obj.hasOwnProperty(key))
            return false;
    return true;
}

// Updates any account data except the basic ones that cannot change
function AccountUpdate(data, socket) {
	if ((data != null) && (typeof data === "object"))
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == socket.id) {
				
				// Some data is never saved or updated from the client
				delete data.Name;
				delete data.AccountName;
				delete data.Password;
				delete data.Email;
				delete data.Creation;
				delete data.Pose;
				delete data.ActivePose;
				delete data.ChatRoom;
				delete data.ID;
				delete data.MemberNumber;
				delete data.Environment;
				
				// Some data is kept for future use
				if (data.ItemPermission != null) Account[P].ItemPermission = data.ItemPermission;
				if (data.LabelColor != null) Account[P].LabelColor = data.LabelColor;
				if (data.Appearance != null) Account[P].Appearance = data.Appearance;
				if (data.Reputation != null) Account[P].Reputation = data.Reputation;
				if ((data.WhiteList != null) && Array.isArray(data.WhiteList)) Account[P].WhiteList = data.WhiteList;
				if ((data.BlackList != null) && Array.isArray(data.BlackList)) Account[P].BlackList = data.BlackList;
				if ((data.FriendList != null) && Array.isArray(data.FriendList)) Account[P].FriendList = data.FriendList;
				
				// If we have data to push
				if (!ObjectEmpty(data)) Database.collection("Accounts").updateOne({ AccountName : Account[P].AccountName }, { $set: data }, function(err, res) { if (err) throw err; });
				break;

			}
}

// Removes the account from the buffer
function AccountRemove(ID) {
	if (ID != null)
		for (var P = 0; P < Account.length; P++)
			if (Account[P].ID == ID) {
				ChatRoomRemove(Account[P], "disconnected");
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
	if ((data != null) && (typeof data === "object") && (data.Query != null) && (typeof data.Query === "string") && (data.Query.length <= 20)) {
		
		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Builds a list of up to 24 possible rooms, the last rooms created are shown first
			var CR = [];
			var C = 0;
			for (var C = ChatRoom.length - 1; ((C >= 0) && (CR.length <= 24)); C--)
				if (ChatRoom[C].Account.length < ChatRoom[C].Limit)
					if (Acc.Environment == ChatRoom[C].Environment)
						if (ChatRoom[C].Ban.indexOf(Acc.AccountName) < 0)
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
				
			// Finds the account and links it to the new room
			var Acc = AccountGet(socket.id);
			if (Acc != null) {
				ChatRoomRemove(Acc, "left");
				var NewRoom = {
					Name: data.Name,
					Description: data.Description,
					Background: data.Background,
					Limit: ((data.Limit == null) || (typeof data.Limit !== "string") || isNaN(parseInt(data.Limit)) || (parseInt(data.Limit) < 2) || (parseInt(data.Limit) > 10)) ? 10 : parseInt(data.Limit),
					Private: data.Private,
					Environment: Acc.Environment,
					Creator: Acc.Name,
					CreatorID: Acc.ID,
					CreatorAccount: Acc.AccountName,
					Creation: CommonTime(),
					Account: [],
					Ban: []
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
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (typeof data.Name === "string") && (data.Name != "")) {
		
		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Removes it from it's current room if needed
			ChatRoomRemove(Acc, "left");

			// Finds the room and join it
			for (var C = 0; C < ChatRoom.length; C++)
				if (ChatRoom[C].Name.toUpperCase().trim() == data.Name.toUpperCase().trim())
					if (Acc.Environment == ChatRoom[C].Environment)
						if (ChatRoom[C].Account.length < ChatRoom[C].Limit) {
							if (ChatRoom[C].Ban.indexOf(Acc.AccountName) < 0) {
								Acc.ChatRoom = ChatRoom[C];
								ChatRoom[C].Account.push(Acc);
								socket.emit("ChatRoomSearchResponse", "JoinedRoom");
								ChatRoomSync(ChatRoom[C]);
								ChatRoomMessage(ChatRoom[C], Acc.MemberNumber, Acc.Name + " entered.", "Action");
								return;
							} else {
								socket.emit("ChatRoomSearchResponse", "RoomBanned");
								return;
							}
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
function ChatRoomRemove(Acc, Reason) {
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
			ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, Acc.Name + " " + Reason + ".", "Action");
			ChatRoomSync(Acc.ChatRoom);
		}
		Acc.ChatRoom = null;

	}
}

// Finds the current account and removes it from it's chat room, nothing is returned to the client
function ChatRoomLeave(socket) {
	var Acc = AccountGet(socket.id);
	if (Acc != null) ChatRoomRemove(Acc, "left");
}

// Sends a text message to everyone in the room
function ChatRoomMessage(CR, Sender, Content, Type) {
	if (CR != null)
		for (var A = 0; A < CR.Account.length; A++)
			CR.Account[A].Socket.emit("ChatRoomMessage", { Sender: Sender, Content: Content, Type: Type } );
}

// When a user sends a chat message, we propagate it to everyone in the room
function ChatRoomChat(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.Content != null) && (data.Type != null) && (typeof data.Content === "string") && (typeof data.Type === "string") && (ChatRoomMessageType.indexOf(data.Type) >= 0) && (data.Content.length <= 1000)) {
		var Acc = AccountGet(socket.id);
		if (Acc != null) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, data.Content.trim(), data.Type);
	}
}

// Syncs the room data with all of it's members
function ChatRoomSync(CR) {

	// Builds the room data
	var R = {};
	R.Name = CR.Name;
	R.Background = CR.Background;
	R.CreatorID = CR.CreatorID;

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
		A.MemberNumber = CR.Account[C].MemberNumber;
		A.LabelColor = CR.Account[C].LabelColor;
		A.ItemPermission = CR.Account[C].ItemPermission;
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
			if (Acc.ChatRoom.Ban.indexOf(Acc.AccountName) < 0)
				for (var A = 0; ((Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length)); A++)
					if (Acc.ChatRoom.Account[A].ID == data.ID)
						if (ChatRoomGetAllowItem(Acc, Acc.ChatRoom.Account[A])) {
							Database.collection("Accounts").updateOne({ AccountName : Acc.ChatRoom.Account[A].AccountName }, { $set: { Appearance: data.Appearance } }, function(err, res) { if (err) throw err; });
							Acc.ChatRoom.Account[A].Appearance = data.Appearance;
							Acc.ChatRoom.Account[A].ActivePose = data.ActivePose;
							ChatRoomSync(Acc.ChatRoom);
						}
	}
}

// When the accounts that created the chatroom wants to ban another account from it
function ChatRoomBan(data, socket) {
	if ((data != null) && (typeof data === "string") && (data != "") && (data != socket.id.toString())) {

		// Validates that the account is the room creator and finds the account from the ID to ban
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null) && (Acc.ChatRoom.CreatorAccount == Acc.AccountName))
			for (var A = 0; A < Acc.ChatRoom.Account.length; A++)
				if (Acc.ChatRoom.Account[A].ID == data) {

					// Adds to the ban list and kicks out
					Acc.ChatRoom.Ban.push(Acc.ChatRoom.Account[A].AccountName);
					Acc.ChatRoom.Account[A].Socket.emit("ChatRoomSearchResponse", "RoomBanned");
					ChatRoomRemove(Acc.ChatRoom.Account[A], "was banned");
					break;

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
	if ((Target.ItemPermission <= 0) || (Source.MemberNumber == Target.MemberNumber) || ((Target.OwnerNumber != null) && (Target.OwnerNumber == Source.MemberNumber))) return true;

	// At one, we allow if the source isn't on the blacklist
	if ((Target.ItemPermission == 1) && (Target.BlackList.indexOf(Source.MemberNumber) < 0)) return true;

	// At two, we allow if the source is Dominant compared to the Target (25 points allowed) or on whitelist
	if ((Target.ItemPermission == 2) && (Target.BlackList.indexOf(Source.MemberNumber) < 0) && ((ChatRoomDominantValue(Source) + 25 >= ChatRoomDominantValue(Target)) || (Target.WhiteList.indexOf(Source.MemberNumber) >= 0))) return true;

	// At three, we allow if the source is Dominant compared to the Target (25 points allowed)
	if ((Target.ItemPermission == 3) && (Target.WhiteList.indexOf(Source.MemberNumber) >= 0)) return true;

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
