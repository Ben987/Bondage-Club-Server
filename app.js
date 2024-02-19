"use strict";
require('newrelic');
const base64id = require("base64id");

// Reads the SSL key and certificate, if there's no file available, we switch to regular http
/*var SyncRequest = require("sync-request");
var ServerKey = null;
if ((process.env.SERVER_KEY0 != null) && (process.env.SERVER_KEY0 != "")) { try { ServerKey = SyncRequest("GET", process.env.SERVER_KEY0).getBody(); } catch(err) {} }
if ((ServerKey == null) && (process.env.SERVER_KEY1 != null) && (process.env.SERVER_KEY1 != "")) { try { ServerKey = SyncRequest("GET", process.env.SERVER_KEY1).getBody(); } catch(err) {} }
if ((ServerKey == null) && (process.env.SERVER_KEY2 != null) && (process.env.SERVER_KEY2 != "")) { try { ServerKey = SyncRequest("GET", process.env.SERVER_KEY2).getBody(); } catch(err) {} }
var ServerCert = null;
if ((process.env.SERVER_CERT0 != null) && (process.env.SERVER_CERT0 != "")) { try { ServerCert = SyncRequest("GET", process.env.SERVER_CERT0).getBody(); } catch(err) {} }
if ((ServerCert == null) && (process.env.SERVER_CERT1 != null) && (process.env.SERVER_CERT1 != "")) { try { ServerCert = SyncRequest("GET", process.env.SERVER_CERT1).getBody(); } catch(err) {} }
if ((ServerCert == null) && (process.env.SERVER_CERT2 != null) && (process.env.SERVER_CERT2 != "")) { try { ServerCert = SyncRequest("GET", process.env.SERVER_CERT2).getBody(); } catch(err) {} }
console.log("Using Server Key: " + ServerKey);
console.log("Using Server Certificate: " + ServerCert);*/

// Enforce https with a certificate
var App;
var UseSecure;
UseSecure = false;
App = require("http").createServer();

/*if ((ServerKey == null) || (ServerCert == null)) {
	console.log("No key or certificate found, starting http server with origin " + process.env.CORS_ORIGIN0);
} else {
	console.log("Starting https server for certificate with origin " + process.env.CORS_ORIGIN0);
	UseSecure = true;
	App = require("https").createServer({ key: ServerKey, cert: ServerCert, requestCert: false, rejectUnauthorized: false });
}*/

// Starts socket.io to accept incoming connections on specified origins
const socketio = require("socket.io");
/** @type {Partial<import("socket.io").ServerOptions>} */
var Options = {
	maxHttpBufferSize: 180000,
	pingTimeout: 30000,
	pingInterval: 50000,
	upgradeTimeout: 30000,
	serveClient: false,
	httpCompression: true,
	perMessageDeflate: true,
	allowEIO3: false,
	secure: UseSecure
};
if ((process.env.CORS_ORIGIN0 != null) && (process.env.CORS_ORIGIN0 != ""))
	Options.cors = { origin: [process.env.CORS_ORIGIN0 || "", process.env.CORS_ORIGIN1 || "", process.env.CORS_ORIGIN2 || "", process.env.CORS_ORIGIN3 || "", process.env.CORS_ORIGIN4 || "", process.env.CORS_ORIGIN5 || ""] };
else
	Options.cors = { origin: '*' };

/** @type {import("socket.io").Server<ClientToServerEvents, ServerToClientEvents>} */
var IO = new socketio.Server(App, Options);

// Main game objects
var BCrypt = require("bcrypt");
var MaxHeapUsage = parseInt(process.env.MAX_HEAP_USAGE, 10) || 16_000_000_000; // 16 gigs allocated by default, can be altered server side
var AccountCollection = process.env.ACCOUNT_COLLECTION || "Accounts";
/** @type {Account[]} */
var Account = [];
/** @type {Chatroom[]} */
var ChatRoom = [];
var ChatRoomMessageType = ["Chat", "Action", "Activity", "Emote", "Whisper", "Hidden", "Status"];
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
	process.env.PRODUCTION9 || "",
	process.env.PRODUCTION10 || "",
	process.env.PRODUCTION11 || "",
	process.env.PRODUCTION12 || ""
];
var NextMemberNumber = 1;
var NextPasswordReset = 0;
var OwnershipDelay = 604800000; // 7 days delay for ownership events
var LovershipDelay = 604800000; // 7 days delay for lovership events
var DifficultyDelay = 604800000; // 7 days to activate the higher difficulty tiers
const IP_CONNECTION_LIMIT = parseInt(process.env.IP_CONNECTION_LIMIT, 10) || 64; // Limit of connections per IP address
const IP_CONNECTION_RATE_LIMIT = parseInt(process.env.IP_CONNECTION_RATE_LIMIT, 10) || 2; // Limit of newly established connections per IP address within a second
const CLIENT_MESSAGE_RATE_LIMIT = parseInt(process.env.CLIENT_MESSAGE_RATE_LIMIT, 10) || 20; // Limit the number of messages received from a client within a second
const IP_CONNECTION_PROXY_HEADER = "x-forwarded-for"; // Header with real IP, if set by trusted proxy (lowercase)
const ROOM_LIMIT_DEFAULT = 10; // The default number of players in an online chat room
const ROOM_LIMIT_MINIMUM = 2; // The minimum number of players in an online chat room
const ROOM_LIMIT_MAXIMUM = 20; // The maximum number of players in an online chat room

// Limits the number of accounts created on each hour & day
var AccountCreationIP = [];
const MAX_IP_ACCOUNT_PER_DAY = parseInt(process.env.MAX_IP_ACCOUNT_PER_DAY, 10) || 12;
const MAX_IP_ACCOUNT_PER_HOUR = parseInt(process.env.MAX_IP_ACCOUNT_PER_HOUR, 10) || 4;

// DB Access
/** @type { import("mongodb").Db } */
var Database;
var DatabaseClient = require('mongodb').MongoClient;
var DatabaseURL = process.env.DATABASE_URL || "mongodb://localhost:27017/BondageClubDatabase";
var ServerPort = process.env.PORT || 4288;
var DatabaseName = process.env.DATABASE_NAME || "BondageClubDatabase";

/**
 * Email password reset
 * @type { { AccountName: string; ResetNumber: string; }[] }
 */
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

// If the server received an unhandled error, we log it through console for future review, send an email and exit so the application can restart
Error.stackTraceLimit = 100;
process.on('uncaughtException', function(error) {
	console.log("*************************");
	console.log("Unhandled error occurred:");
	console.log(error.stack);
	console.log("*************************");
	var mailOptions = {
		from: "donotreply@bondageprojects.com",
		to: process.env.EMAIL_ADMIN || "",
		subject: "Bondage Club Server Crash",
		html: "Unhandled error occurred:<br />" + error.stack
	};
	MailTransporter.sendMail(mailOptions, function (err, info) {
		if (err) console.log("Error while sending error email: " + err);
		else console.log("Error email was sent");
		try {
			AccountDelayedUpdate();
		} catch (error) {
			console.log("Error while doing delayed updates");
		}
		process.exit(1);
	});
});

// When SIGTERM is received, we send a warning to all logged accounts
process.on('SIGTERM', function() {
	console.log("***********************");
	console.log("HEROKU SIGTERM DETECTED");
	console.log("***********************");
	try {
		AccountDelayedUpdate();
	} catch (error) {
		console.log("Error while doing delayed updates");
	}
	for (const Acc of Account)
		if ((Acc != null) && (Acc.Socket != null))
			Acc.Socket.emit("ServerMessage", "Server will reboot in 30 seconds." );
});

// When SIGKILL is received, we do the final updates
/*process.on('SIGKILL', function() {
	console.log("***********************");
	console.log("HEROKU SIGKILL DETECTED");
	console.log("***********************");
	try {
		AccountDelayedUpdate();
	} catch (error) {
		console.log("Error while doing delayed updates");
	}
	process.exit(2);
});*/

/** @type {Map<string, number[]>} */
const IPConnections = new Map();

// These regex must be kept in sync with the client
const ServerAccountEmailRegex = /^[a-zA-Z0-9@.!#$%&'*+/=?^_`{|}~-]{5,100}$/;
const ServerAccountNameRegex = /^[a-zA-Z0-9]{1,20}$/;
const ServerAccountPasswordRegex = /^[a-zA-Z0-9]{1,20}$/;
const ServerAccountResetNumberRegex = /^[0-9]{1,20}$/;
const ServerCharacterNameRegex = /^[a-zA-Z ]{1,20}$/;
const ServerCharacterNicknameRegex = /^[\p{L}\p{Nd}\p{Z}'-]+$/u;
const ServerChatRoomNameRegex = /^[\x20-\x7E]{1,20}$/;

/**
 * Type guard which checks that a value is a simple object (i.e. a non-null object which is not an array)
 * @param {unknown} value - The value to test
 * @returns {value is Record<string, unknown>}
 */
function CommonIsObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Check that the passed string looks like an acceptable email address.
 *
 * @param {string} Email
 * @returns {boolean}
 */
function CommonEmailIsValid(Email) {
	if (!ServerAccountEmailRegex.test(Email)) return false;

	const parts = Email.split("@");
	if (parts.length !== 2) return false;
	if (parts[1].indexOf(".") === -1) return false;

	return true;
}

// Connects to the Mongo Database
DatabaseClient.connect(DatabaseURL, { useUnifiedTopology: true, useNewUrlParser: true, autoIndex: false }, function(err, db) {

	// Keeps the database object
	if (err) throw err;
	Database = db.db(DatabaseName);
	console.log("****************************************");
	console.log("Database: " + DatabaseName + " connected");

	// Gets the next unique member number
	Database.collection(AccountCollection).find({ MemberNumber : { $exists: true, $ne: null }}).sort({MemberNumber: -1}).limit(1).toArray(function(err, result) {

		// Shows the next member number
		if ((result.length > 0) && (result[0].MemberNumber != null)) NextMemberNumber = result[0].MemberNumber + 1;
		console.log("Next Member Number: " + NextMemberNumber);

		// Listens for clients on port 4288 if local or a random port if online
		App.listen(ServerPort, function () {

			// Sets up the Client/Server events
			console.log("Bondage Club server is listening on " + (ServerPort).toString());
			console.log("****************************************");
			IO.on("connection", function ( /** @type {ServerSocket} */ socket) {
				/** @type {string} */
				let address = socket.conn.remoteAddress;

				// If there is trusted forward header set by proxy, use that instead
				// But only trust the last hop!
				if (IP_CONNECTION_PROXY_HEADER && typeof socket.handshake.headers[IP_CONNECTION_PROXY_HEADER] === "string") {
					const hops = /** @type {string} */ (socket.handshake.headers[IP_CONNECTION_PROXY_HEADER]).split(",");
					address = hops[hops.length-1].trim();
				}

				const sameIPConnections = IPConnections.get(address) || [];

				// True, if there has already been IP_CONNECTION_RATE_LIMIT number of connections in the last second
				const ipOverRateLimit = sameIPConnections.length >= IP_CONNECTION_RATE_LIMIT && Date.now() - sameIPConnections[sameIPConnections.length - IP_CONNECTION_RATE_LIMIT] <= 1000;

				// Reject connection if over limits (rate & concurrency)
				if (sameIPConnections.length >= IP_CONNECTION_LIMIT || ipOverRateLimit) {
					console.log("Rejecting connection (IP connection limit reached) from", address);
					socket.emit("ForceDisconnect", "ErrorRateLimited");
					socket.disconnect(true);
					return;
				}

				// Connection accepted, count it
				sameIPConnections.push(Date.now());
				IPConnections.set(address, sameIPConnections);
				socket.once("disconnect", () => {
					const sameIPConnectionsDisconnect = IPConnections.get(address) || [];
					if (sameIPConnectionsDisconnect.length <= 1) {
						IPConnections.delete(address);
					} else {
						sameIPConnectionsDisconnect.shift(); // Delete first (oldest) from array
						IPConnections.set(address, sameIPConnectionsDisconnect);
					}
				});

				// Rate limit all messages and kill the connection, if limits exceeded.
				const messageBucket = [];
				for (let i = 0; i < CLIENT_MESSAGE_RATE_LIMIT; i++) {
					messageBucket.push(0);
				}
				socket.onAny(() => {
					const lastMessageTime = messageBucket.shift();
					messageBucket.push(Date.now());

					// More than CLIENT_MESSAGE_RATE_LIMIT number of messages in the last second
					if (Date.now() - lastMessageTime <= 1000) {
						// Disconnect and close connection
						socket.emit("ForceDisconnect", "ErrorRateLimited");
						socket.disconnect(true);
					}
				});

				socket.on("AccountCreate", function (data) { AccountCreate(data, socket); });
				socket.on("AccountLogin", function (data) { AccountLogin(data, socket); });
				socket.on("PasswordReset", function(data) { PasswordReset(data, socket); });
				socket.on("PasswordResetProcess", function(data) { PasswordResetProcess(data, socket); });
				AccountSendServerInfo(socket);
			});

			// Refreshes the server information to clients each 60 seconds
			setInterval(AccountSendServerInfo, 60000);

			// Updates the database appearance & skills every 300 seconds
			setInterval(AccountDelayedUpdate, 300000);

		});
	});
});

/**
 * Setups socket on successful login or account creation
 * @param {ServerSocket} socket
 */
function OnLogin(socket) {
	socket.removeAllListeners("AccountCreate");
	socket.removeAllListeners("AccountLogin");
	socket.removeAllListeners("PasswordReset");
	socket.removeAllListeners("PasswordResetProcess");
	socket.on("AccountUpdate", function(data) { AccountUpdate(data, socket); });
	socket.on("AccountUpdateEmail", function(data) { AccountUpdateEmail(data, socket); });
	socket.on("AccountQuery", function(data) { AccountQuery(data, socket); });
	socket.on("AccountBeep", function(data) { AccountBeep(data, socket); });
	socket.on("AccountOwnership", function(data) { AccountOwnership(data, socket); });
	socket.on("AccountLovership", function(data) { AccountLovership(data, socket); });
	socket.on("AccountDifficulty", function(data) { AccountDifficulty(data, socket); });
	socket.on("AccountDisconnect", function() { AccountRemove(socket.id); });
	socket.on("disconnect", function() { AccountRemove(socket.id); });
	socket.on("ChatRoomSearch", function(data) { ChatRoomSearch(data, socket); });
	socket.on("ChatRoomCreate", function(data) { ChatRoomCreate(data, socket); });
	socket.on("ChatRoomJoin", function(data) { ChatRoomJoin(data, socket); });
	socket.on("ChatRoomLeave", function() { ChatRoomLeave(socket); });
	socket.on("ChatRoomChat", function(data) { ChatRoomChat(data, socket); });
	socket.on("ChatRoomCharacterUpdate", function(data) { ChatRoomCharacterUpdate(data, socket); });
	socket.on("ChatRoomCharacterExpressionUpdate", function(data) { ChatRoomCharacterExpressionUpdate(data, socket); });
	socket.on("ChatRoomCharacterMapDataUpdate", function(data) { ChatRoomCharacterMapDataUpdate(data, socket); });
	socket.on("ChatRoomCharacterPoseUpdate", function(data) { ChatRoomCharacterPoseUpdate(data, socket); });
	socket.on("ChatRoomCharacterArousalUpdate", function(data) { ChatRoomCharacterArousalUpdate(data, socket); });
	socket.on("ChatRoomCharacterItemUpdate", function(data) { ChatRoomCharacterItemUpdate(data, socket); });
	socket.on("ChatRoomAdmin", function(data) { ChatRoomAdmin(data, socket); });
	socket.on("ChatRoomAllowItem", function(data) { ChatRoomAllowItem(data, socket); });
	socket.on("ChatRoomGame", function(data) { ChatRoomGame(data, socket); });
}

/**
 * Sends the server info to all players or one specific player (socket)
 * @param {ServerSocket} [socket]
 */
function AccountSendServerInfo(socket) {

	// Validates if the heap usage is too high and we should reboot, to prevent memory leaks
	const MemoryData = process.memoryUsage();
	if ((MemoryData != null) && (MemoryData.heapUsed > MaxHeapUsage)) {
		var mailOptions = {
			from: "donotreply@bondageprojects.com",
			to: process.env.EMAIL_ADMIN || "",
			subject: "Bondage Club Server Heap Usage Crash",
			html: "Heap usage error occured:<br />heapTotal: " + MemoryData.heapTotal.toString() + "<br />heapUsed: " + MemoryData.heapUsed.toString()
		};
		MailTransporter.sendMail(mailOptions, function (err, info) {
			if (err) console.log("Error while sending error email: " + err);
			else console.log("Error email was sent");
			try {
				AccountDelayedUpdate();
			} catch (error) {
				console.log("Error while doing delayed updates");
			}
			process.exit(2);
		});
		return;
	}

	// Sends the info to all players
	var SI = {
		Time: CommonTime(),
		OnlinePlayers: Account.length
	};
	if (socket != null) socket.emit("ServerInfo", SI);
	else IO.sockets.volatile.emit("ServerInfo", SI);

}

/**
 * Return the current time
 * @returns {number}
 */
function CommonTime() {
	return new Date().getTime();
}

/**
 * Type guard which checks that a value is a simple object (i.e. a non-null object which is not an array)
 * @param {unknown} value - The value to test
 * @returns {value is Record<string, unknown>}
 */
function CommonIsObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parses a integer out of something, with a default value
 * @param {unknown} thing
 * @param {number} defaultValue
 * @returns {number}
 */
function CommonParseInt(thing, defaultValue = 0, base = 10) {
	if (typeof thing !== "string" && typeof thing !== "number") return defaultValue;
	if (typeof thing === "number") {
		if (Number.isInteger(thing)) {
			return thing;
		} else {
			return defaultValue;
		}
	}
	let int = parseInt(thing, base);
	if (!Number.isInteger(int)) int = defaultValue;
	return int;
}

/**
 * Creates a new account by creating its file
 * @param {ServerAccountCreateRequest} data
 * @param {ServerSocket} socket
 */
function AccountCreate(data, socket) {

	// Makes sure the account comes with a name and a password
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (data.AccountName != null) && (data.Password != null) && (data.Email != null) && (typeof data.Name === "string") && (typeof data.AccountName === "string") && (typeof data.Password === "string") && (typeof data.Email === "string")) {

		// Makes sure the data is valid
		if (data.Name.match(ServerCharacterNameRegex) && data.AccountName.match(ServerAccountNameRegex) && data.Password.match(ServerAccountPasswordRegex) && (CommonEmailIsValid(data.Email) || data.Email == "") && (data.Email.length <= 100)) {

			// Gets the current IP Address that's creating the account
			/** @type {string} */
			let CurrentIP = socket.conn.remoteAddress;
			if (IP_CONNECTION_PROXY_HEADER && typeof socket.handshake.headers[IP_CONNECTION_PROXY_HEADER] === "string") {
				const hops = /** @type {string} */ (socket.handshake.headers[IP_CONNECTION_PROXY_HEADER]).split(",");
				CurrentIP = hops[hops.length-1].trim();
			}

			// If the IP is valid
			if ((CurrentIP != null) && (CurrentIP != "")) {

				// Checks the number of account created in total and in the last hour by this IP
				let CurrentTime = CommonTime();
				let TotalCount = 0;
				let HourCount = 0;
				for (let IP of AccountCreationIP)
					if (IP.Address === CurrentIP) {
						TotalCount++;
						if (IP.Time >= CurrentTime - 3600000) HourCount++;
					}

				/*var mailOptions = {
					from: "donotreply@bondageprojects.com",
					to: process.env.EMAIL_ADMIN || "",
					subject: "Bondage Club Server Info",
					html: "IP: " + CurrentIP + " is creating account: " + data.AccountName + " at time: " + CommonTime().toString() + "<br />TotalCount: " + TotalCount.toString() + "<br />MAX_IP_ACCOUNT_PER_DAY: " + MAX_IP_ACCOUNT_PER_DAY.toString() + "<br />HourCount: " + HourCount.toString() + "<br />MAX_IP_ACCOUNT_PER_HOUR: " + MAX_IP_ACCOUNT_PER_HOUR.toString()
				};
				MailTransporter.sendMail(mailOptions, function (err, info) {});*/

				// Exits if we reached the limit
				if ((TotalCount >= MAX_IP_ACCOUNT_PER_DAY) || (HourCount >= MAX_IP_ACCOUNT_PER_HOUR)) {
					socket.emit("CreationResponse", "New accounts per day exceeded");
					return;
				}

				// Keeps the IP in memory for the next run
				AccountCreationIP.push({ Address: CurrentIP, Time: CurrentTime });

			}

			// Checks if the account already exists
			data.AccountName = data.AccountName.toUpperCase();
			Database.collection(AccountCollection).findOne({ AccountName : data.AccountName }, function(err, result) {

				// Makes sure the result is null so the account doesn't already exists
				if (err) throw err;
				if (result != null) {
					socket.emit("CreationResponse", "Account already exists");
				} else {

					// Creates a hashed password and saves it with the account info
					BCrypt.hash(data.Password.toUpperCase(), 10, function( err, hash ) {
						if (err) throw err;
						let account = /** @type {Account} */ ({
							// ID and Socket are special; they're used at runtime but cannot be
							// persisted to the database so they're set after that happens.
							AccountName: data.AccountName,
							Email: data.Email,
							Password: hash,
							// Use the next member number and bump it
							MemberNumber: NextMemberNumber++,
							Name: data.Name,
							Money: 100,
							Creation: CommonTime(),
							LastLogin: CommonTime(),
							Environment: AccountGetEnvironment(socket),
							Lovership: [],
							ItemPermission: 2,
							FriendList: [],
							WhiteList: [],
							BlackList: [],
						});
						Database.collection(AccountCollection).insertOne(account, function(err, res) {
							if (err) throw err;
							account.ID = socket.id;
							account.Socket = socket;
							console.log("Creating new account: " + account.AccountName + " ID: " + socket.id + " " + account.Environment);
							AccountValidData(account);
							Account.push(account);
							OnLogin(socket);
							socket.emit("CreationResponse", { ServerAnswer: "AccountCreated", OnlineID: account.ID, MemberNumber: account.MemberNumber } );
							AccountSendServerInfo(socket);
							AccountPurgeInfo(data);
						});
					});

				}

			});

		}

	} else socket.emit("CreationResponse", "Invalid account information");

}

/**
 * Gets the current environment for online play (www.bondageprojects.com is considered production)
 * @param {ServerSocket} socket
 * @returns {"PROD"|"DEV"|string}
 */
function AccountGetEnvironment(socket) {
	if ((socket != null) && (socket.request != null) && (socket.request.headers != null) && (socket.request.headers.origin != null) && (socket.request.headers.origin != "")) {
		if (ChatRoomProduction.indexOf(socket.request.headers.origin.toLowerCase()) >= 0) return "PROD";
		else return "DEV";
	} else return (Math.round(Math.random() * 1000000000000)).toString();
}

/**
 * Makes sure the account data is valid, creates the missing fields if we need to
 * @param {Partial<Account>} Account
 */
function AccountValidData(Account) {
	if (Account != null) {
		if ((Account.ItemPermission == null) || (typeof Account.ItemPermission !== "number")) Account.ItemPermission = 2;
		if ((Account.WhiteList == null) || !Array.isArray(Account.WhiteList)) Account.WhiteList = [];
		if ((Account.BlackList == null) || !Array.isArray(Account.BlackList)) Account.BlackList = [];
		if ((Account.FriendList == null) || !Array.isArray(Account.FriendList)) Account.FriendList = [];
	}
}

/**
 * Purge some account info that's not required to be kept in memory on the server side
 * @param {Partial<Account>} A
 */
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
	delete A.GhostList;
	delete A.HiddenItems;
}

/**
 * Load a single account file
 * @param {ServerAccountLoginRequest} data
 * @param {ServerSocket} socket
 */
function AccountLogin(data, socket) {

	// Makes sure the login comes with a name and a password
	if (!data || typeof data !== "object" || typeof data.AccountName !== "string" || typeof data.Password !== "string") {
		socket.emit("LoginResponse", "InvalidNamePassword");
		return;
	}

	// If connection already has login queued, ignore it
	if (pendingLogins.has(socket)) return;

	const shouldRun = loginQueue.length === 0;
	loginQueue.push([socket, data.AccountName.toUpperCase(), data.Password]);
	pendingLogins.add(socket);

	if (loginQueue.length > 16) {
		socket.emit("LoginQueue", loginQueue.length);
	}

	// If there are no logins being processed, start the processing of the queue
	if (shouldRun) {
		AccountLoginRun();
	}
}

/**
 * The queue of logins
 * @type {[ServerSocket, string, string][]} - [socket, username, password]
 */
const loginQueue = [];

/**
 * List of sockets, for which there already is a pending login - to prevent duplicate logins during wait time
 * @type {WeakSet.<ServerSocket>}
 */
const pendingLogins = new WeakSet();

/**
 * Runs the next login in queue, waiting for it to finish before running next one
 */
function AccountLoginRun() {
	// Get next waiting login
	if (loginQueue.length === 0) return;
	let nx = loginQueue[0];

	// If client disconnected during wait, ignore it
	while (!nx[0].connected) {
		pendingLogins.delete(nx[0]);
		loginQueue.shift();
		if (loginQueue.length === 0) return;
		nx = loginQueue[0];
	}

	// Process the login and after it queue the next one
	AccountLoginProcess(...nx).then(() => {
		pendingLogins.delete(nx[0]);
		loginQueue.shift();
		if (loginQueue.length > 0) {
			setTimeout(AccountLoginRun, 50);
		}
	}, err => { throw err; });
}

// Removes all instances of that character from all chat rooms
function AccountRemoveFromChatRoom(MemberNumber) {
	if ((MemberNumber == null) || (Account == null) || (Account.length == 0) || (ChatRoom == null) || (ChatRoom.length == 0)) return;
	for (let C = 0; C < ChatRoom.length; C++) {
		if ((ChatRoom[C] != null) && (ChatRoom[C].Account != null) && (ChatRoom[C].Account.length > 0)) {
			for (let A = 0; A < ChatRoom[C].Account.length; A++)
				if ((ChatRoom[C].Account[A] != null) && (ChatRoom[C].Account[A].MemberNumber != null) && (ChatRoom[C].Account[A].MemberNumber == MemberNumber))
					ChatRoom[C].Account.splice(A, 1);
			if (ChatRoom[C].Account.length == 0)
				ChatRoom.splice(C, 1);
		}
	}
}

/**
 * Processes a single login request
 * @param {ServerSocket} socket
 * @param {string} AccountName The username the user is trying to log in with
 * @param {string} Password
 */
async function AccountLoginProcess(socket, AccountName, Password) {
	// Checks if there's an account that matches the name
	/** @type {Account|null} */
	const result = await Database.collection(AccountCollection).findOne({ AccountName });

	if (!socket.connected) return;
	if (result === null) {
		socket.emit("LoginResponse", "InvalidNamePassword");
		return;
	}

	// Compare the password to its hashed version
	const res = await BCrypt.compare(Password.toUpperCase(), result.Password);

	if (!socket.connected) return;
	if (!res) {
		socket.emit("LoginResponse", "InvalidNamePassword");
		return;
	}

	// Disconnect duplicated logged accounts
	for (const Acc of Account) {
		if (Acc != null && Acc.AccountName === result.AccountName) {
			Acc.Socket.emit("ForceDisconnect", "ErrorDuplicatedLogin");
			Acc.Socket.disconnect(true);
			AccountRemove(Acc.ID);
			break;
		}
	}

	// Assigns a member number if there's none
	if (result.MemberNumber == null) {
		result.MemberNumber = NextMemberNumber;
		NextMemberNumber++;
		console.log("Assigning missing member number: " + result.MemberNumber + " for account: " + result.AccountName);
		Database.collection(AccountCollection).updateOne({ AccountName : result.AccountName }, { $set: { MemberNumber: result.MemberNumber } }, function(err, res) { if (err) throw err; });
	}

	// Updates lovership to an array if needed for conversion
	if (!Array.isArray(result.Lovership)) result.Lovership = (result.Lovership != undefined) ? [result.Lovership] : [];

	// Sets the last login date
	result.LastLogin = CommonTime();
	Database.collection(AccountCollection).updateOne({ AccountName : result.AccountName }, { $set: { LastLogin: result.LastLogin } }, function(err, res) { if (err) throw err; });

	// Logs the account
	result.ID = socket.id;
	result.Environment = AccountGetEnvironment(socket);
	//console.log("Login account: " + result.AccountName + " ID: " + socket.id + " " + result.Environment);
	AccountValidData(result);
	AccountRemoveFromChatRoom(result.MemberNumber);
	Account.push(result);
	OnLogin(socket);
	delete result.Password;
	delete result.Email;
	socket.compress(false).emit("LoginResponse", result);
	result.Socket = socket;
	AccountSendServerInfo(socket);
	AccountPurgeInfo(result);

}

/**
 * Returns TRUE if the object is empty
 * @param {Record<any, any>} obj Object to check
 * @returns {boolean}
 */
function ObjectEmpty(obj) {
	for(var key in obj)
		if (obj.hasOwnProperty(key))
			return false;
	return true;
}

/**
 * Updates any account data except the basic ones that cannot change
 * @param {Partial<Account>} data
 * @param {ServerSocket} socket
 */
function AccountUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data))
		for (const Acc of Account)
			if (Acc.ID == socket.id) {

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
				delete data.Socket;
				delete data.Inventory;
				// @ts-expect-error This is MongoDB's primary key
				delete data._id;
				delete data.MemberNumber;
				delete data.Environment;
				delete data.Ownership;
				delete data.Lovership;
				delete data.Difficulty;
				delete data.AssetFamily;
				delete data.DelayedAppearanceUpdate;
				delete data.DelayedSkillUpdate;
				delete data.DelayedGameUpdate;

				// Some data is kept for future use
				if (data.InventoryData != null) Acc.InventoryData = data.InventoryData;
				if (data.ItemPermission != null) Acc.ItemPermission = data.ItemPermission;
				if (data.ArousalSettings != null) Acc.ArousalSettings = data.ArousalSettings;
				if (data.OnlineSharedSettings != null) Acc.OnlineSharedSettings = data.OnlineSharedSettings;
				if (data.Game != null) Acc.Game = data.Game;
				if (data.MapData != null) Acc.MapData = data.MapData;
				if (data.LabelColor != null) Acc.LabelColor = data.LabelColor;
				if (data.Appearance != null) Acc.Appearance = data.Appearance;
				if (data.Reputation != null) Acc.Reputation = data.Reputation;
				if (data.Description != null) Acc.Description = data.Description;
				if (data.BlockItems != null) Acc.BlockItems = data.BlockItems;
				if (data.LimitedItems != null) Acc.LimitedItems = data.LimitedItems;
				if (data.FavoriteItems != null) Acc.FavoriteItems = data.FavoriteItems;
				if ((data.WhiteList != null) && Array.isArray(data.WhiteList)) Acc.WhiteList = data.WhiteList;
				if ((data.BlackList != null) && Array.isArray(data.BlackList)) Acc.BlackList = data.BlackList;
				if ((data.FriendList != null) && Array.isArray(data.FriendList)) Acc.FriendList = data.FriendList;
				if ((data.Lover != null) && (Array.isArray(Acc.Lovership)) && (Acc.Lovership.length < 5) && (typeof data.Lover === "string") && data.Lover.startsWith("NPC-")) {
					var isLoverPresent = false;
					for (var L = 0; L < Acc.Lovership.length; L++) {
						if ((Acc.Lovership[L].Name != null) && (Acc.Lovership[L].Name == data.Lover)) {
							isLoverPresent = true;
							break;
						}
					}
					if (!isLoverPresent) {
						Acc.Lovership.push({Name: data.Lover});
						data.Lovership = Acc.Lovership;
						for (var L = 0; L < data.Lovership.length; L++) {
							delete data.Lovership[L].BeginEngagementOfferedByMemberNumber;
							delete data.Lovership[L].BeginWeddingOfferedByMemberNumber;
							if (data.Lovership[L].BeginDatingOfferedByMemberNumber) {
								data.Lovership.splice(L, 1);
								L -= 1;
							}
						}
						socket.emit("AccountLovership", { Lovership: data.Lovership });
					}
					delete data.Lover;
				}
				if ((data.Title != null)) Acc.Title = data.Title;
				if ((data.Nickname != null)) Acc.Nickname = data.Nickname;
				if ((data.Crafting != null)) Acc.Crafting = data.Crafting;

				// Some changes should be synched to other players in chatroom
				if ((Acc != null) && Acc.ChatRoom && /** @type {(keyof Account)[]} */ (["MapData", "Title", "Nickname", "Crafting", "Reputation", "Description", "LabelColor", "ItemPermission", "InventoryData", "BlockItems", "LimitedItems", "FavoriteItems", "OnlineSharedSettings", "WhiteList", "BlackList"]).some(k => data[k] != null))
					ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);

				// If only the appearance is updated, we keep the change in memory and do not update the database right away
				if ((Acc != null) && !ObjectEmpty(data) && (Object.keys(data).length == 1) && (data.Appearance != null)) {
					Acc.DelayedAppearanceUpdate = data.Appearance;
					//console.log("TO REMOVE - Keeping Appearance in memory for account: " + Acc.AccountName);
					return;
				}

				// If only the skill is updated, we keep the change in memory and do not update the database right away
				if ((Acc != null) && !ObjectEmpty(data) && (Object.keys(data).length == 1) && (data.Skill != null)) {
					Acc.DelayedSkillUpdate = data.Skill;
					//console.log("TO REMOVE - Keeping Skill in memory for account: " + Acc.AccountName);
					return;
				}

				// If only the game is updated, we keep the change in memory and do not update the database right away
				if ((Acc != null) && !ObjectEmpty(data) && (Object.keys(data).length == 1) && (data.Game != null)) {
					Acc.DelayedGameUpdate = data.Game;
					//console.log("TO REMOVE - Keeping Game in memory for account: " + Acc.AccountName);
					return;
				}

				// Removes the delayed data to update if we update that property right now
				if ((Acc != null) && !ObjectEmpty(data) && (Object.keys(data).length > 1)) {
					if ((data.Appearance != null) && (Acc.DelayedAppearanceUpdate != null)) delete Acc.DelayedAppearanceUpdate;
					if ((data.Skill != null) && (Acc.DelayedSkillUpdate != null)) delete Acc.DelayedSkillUpdate;
					if ((data.Game != null) && (Acc.DelayedGameUpdate != null)) delete Acc.DelayedGameUpdate;
				}

				// Do not save the map in the database
				delete data.MapData;

				// If we have data to push
				if ((Acc != null) && !ObjectEmpty(data)) Database.collection(AccountCollection).updateOne({ AccountName : Acc.AccountName }, { $set: data }, function(err, res) { if (err) throw err; });
				break;

			}
}

/**
 * Updates email address
 * @param {ServerAccountUpdateEmailRequest} data
 * @param {ServerSocket} socket
 */
function AccountUpdateEmail(data, socket) {

	// If invalid data is received, we return an error to the client
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: false });
		return;
	}

	// Make sure the emails are strings
	if (typeof data.EmailOld !== "string" || typeof data.EmailNew !== "string") {
		socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: false });
		return;
	}

	// Finds the linked account
	const Acc = AccountGet(socket.id);
	if (!Acc) {
		socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: false });
		return;
	}

	// If we're given a new email, check that it is valid (removing the email from the account is allowed)
	if (data.EmailNew !== "" && !CommonEmailIsValid(data.EmailNew)) {
		socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: false });
		return;
	}

	// At that point we need to load up the account from the database; email is part of the keys we don't keep around
	Database.collection(AccountCollection).findOne(
		{ AccountName : Acc.AccountName },
		{ projection: { Email: 1, _id: 0 }},
		( err, result ) => {

			// If the account already had an email, we validate the old email supplied vs the current in the database
			if (err) throw err;
			if (result.Email && data.EmailOld.trim().toLowerCase() !== result.Email.trim().toLowerCase()) {
				socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: false });
				return;
			}

			// Updates the email in the database
			Database.collection(AccountCollection).updateOne(
				{ AccountName : Acc.AccountName },
				{ $set: { Email: data.EmailNew } },
				function(err, res) {
					if (err) throw err;
					console.log("Account " + Acc.AccountName + " updated email from " + data.EmailOld + " to " + data.EmailNew);
					socket.emit("AccountQueryResult", { Query: "EmailUpdate", Result: true });
				}
			);
		}
	);
}

/**
 * When the client account sends a query to the server
 * @param {ServerAccountQueryRequest} data
 * @param {ServerSocket} socket
 */
function AccountQuery(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data) && (data.Query != null) && (typeof data.Query === "string")) {

		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// OnlineFriends query - returns all friends that are online and the room name they are in
			if ((data.Query == "OnlineFriends") && (Acc.FriendList != null)) {

				// Add all submissives owned by the player and all lovers of the players to the list
				/** @type {ServerFriendInfo[]} */
				var Friends = [];
				var Index = [];
				for (const OtherAcc of Account) {
					var LoversNumbers = [];
					for (var L = 0; L < OtherAcc.Lovership.length; L++) {
						if (OtherAcc.Lovership[L].MemberNumber != null) { LoversNumbers.push(OtherAcc.Lovership[L].MemberNumber); }
					}
					if (OtherAcc.Environment == Acc.Environment) {
						var IsOwned = (OtherAcc.Ownership != null) && (OtherAcc.Ownership.MemberNumber != null) && (OtherAcc.Ownership.MemberNumber == Acc.MemberNumber);
						var IsLover = LoversNumbers.indexOf(Acc.MemberNumber) >= 0;
						if (IsOwned || IsLover) {
							Friends.push({ Type: IsOwned ? "Submissive" : "Lover", MemberNumber: OtherAcc.MemberNumber, MemberName: OtherAcc.Name, ChatRoomSpace: (OtherAcc.ChatRoom == null) ? null : OtherAcc.ChatRoom.Space, ChatRoomName: (OtherAcc.ChatRoom == null) ? null : OtherAcc.ChatRoom.Name, Private: (OtherAcc.ChatRoom && OtherAcc.ChatRoom.Private) ? true : undefined });
							Index.push(OtherAcc.MemberNumber);
						}
					}
				}

				// Builds the online friend list, both players must be friends to find each other
				for (var F = 0; F < Acc.FriendList.length; F++)
					if ((Acc.FriendList[F] != null) && (typeof Acc.FriendList[F] === "number"))
						if (Index.indexOf(Acc.FriendList[F]) < 0) // No need to search for the friend if she's owned
							for (const OtherAcc of Account)
								if (OtherAcc.MemberNumber == Acc.FriendList[F]) {
									if ((OtherAcc.Environment == Acc.Environment) && (OtherAcc.FriendList != null) && (OtherAcc.FriendList.indexOf(Acc.MemberNumber) >= 0))
										Friends.push({ Type: "Friend", MemberNumber: OtherAcc.MemberNumber, MemberName: OtherAcc.Name, ChatRoomSpace: ((OtherAcc.ChatRoom != null) && !OtherAcc.ChatRoom.Private) ? OtherAcc.ChatRoom.Space : null, ChatRoomName: (OtherAcc.ChatRoom == null) ? null : (OtherAcc.ChatRoom.Private) ? null : OtherAcc.ChatRoom.Name, Private: (OtherAcc.ChatRoom && OtherAcc.ChatRoom.Private) ? true : undefined });
									break;
								}

				// Sends the query result to the client
				socket.emit("AccountQueryResult", { Query: data.Query, Result: Friends });

			}

			// EmailStatus query - returns true if an email is linked to the account
			if (data.Query == "EmailStatus") {
				Database.collection(AccountCollection).find({ AccountName : Acc.AccountName }).toArray(function(err, result) {
					if (err) throw err;
					if ((result != null) && (typeof result === "object") && (result.length > 0)) {
						socket.emit("AccountQueryResult", /** @type {ServerAccountQueryEmailStatus} */ ({ Query: data.Query, Result: ((result[0].Email != null) && (result[0].Email != "")) }));
					}
				});
			}
		}

	}
}

/**
 * When a player wants to beep another player
 * @param {ServerAccountBeepRequest} data
 * @param {ServerSocket} socket
 */
function AccountBeep(data, socket) {
	if ((data != null) && (typeof data === "object") && !Array.isArray(data) && (data.MemberNumber != null) && (typeof data.MemberNumber === "number")) {

		// Make sure both accounts are online, friends and sends the beep to the friend
		var Acc = AccountGet(socket.id);
		if (Acc != null)
			for (const OtherAcc of Account)
				if (OtherAcc.MemberNumber == data.MemberNumber)
					if ((OtherAcc.Environment == Acc.Environment) && (((OtherAcc.FriendList != null) && (OtherAcc.FriendList.indexOf(Acc.MemberNumber) >= 0)) || ((OtherAcc.Ownership != null) && (OtherAcc.Ownership.MemberNumber != null) && (OtherAcc.Ownership.MemberNumber == Acc.MemberNumber)) || ((data.BeepType != null) && (typeof data.BeepType === "string") && (data.BeepType == "Leash")))) {
						OtherAcc.Socket.emit("AccountBeep", {
							MemberNumber: Acc.MemberNumber,
							MemberName: Acc.Name,
							ChatRoomSpace: (Acc.ChatRoom == null || data.IsSecret) ? null : Acc.ChatRoom.Space,
							ChatRoomName: (Acc.ChatRoom == null || data.IsSecret) ? null : Acc.ChatRoom.Name,
							Private: (Acc.ChatRoom == null || data.IsSecret) ? null : Acc.ChatRoom.Private,
							BeepType: (data.BeepType) ? data.BeepType : null,
							Message: data.Message
						});
						break;
					}

	}
}

// Updates an account appearance if needed
function AccountDelayedUpdateOne(AccountName, NewAppearance, NewSkill, NewGame) {
	if ((AccountName == null) || ((NewAppearance == null) && (NewSkill == null) && (NewGame == null))) return;
	//console.log("TO REMOVE - Updating Appearance, Skill or Game in database for account: " + AccountName);
	let UpdateObj = {};
	if (NewAppearance != null) UpdateObj.Appearance = NewAppearance;
	if (NewSkill != null) UpdateObj.Skill = NewSkill;
	if (NewGame != null) UpdateObj.Game = NewGame;
	Database.collection(AccountCollection).updateOne({ AccountName: AccountName }, { $set: UpdateObj }, function(err, res) { if (err) throw err; });
}

// Called every X seconds to update the database with appearance updates
function AccountDelayedUpdate() {
	//console.log("TO REMOVE - Scanning for account delayed updates");
	for (const Acc of Account) {
		if (Acc != null) {
			AccountDelayedUpdateOne(Acc.AccountName, Acc.DelayedAppearanceUpdate, Acc.DelayedSkillUpdate, Acc.DelayedGameUpdate);
			delete Acc.DelayedAppearanceUpdate;
			delete Acc.DelayedSkillUpdate;
			delete Acc.DelayedGameUpdate;
		}
	}
}

// Removes the account from the buffer
/**
 * Removes the account from the buffer
 * @param {string} ID
 */
function AccountRemove(ID) {
	if (ID != null)
		for (const Acc of Account)
			if (Acc.ID == ID) {
				let AccName = Acc.AccountName;
				let AccDelayedAppearanceUpdate = Acc.DelayedAppearanceUpdate;
				let AccDelayedSkillUpdate = Acc.DelayedSkillUpdate;
				let AccDelayedGameUpdate = Acc.DelayedGameUpdate;
				//console.log("Disconnecting account: " + Acc.AccountName + " ID: " + ID);
				ChatRoomRemove(Acc, "ServerDisconnect", []);
				const index = Account.indexOf(Acc);
				if (index >= 0)
					Account.splice(index, 1);
				AccountDelayedUpdateOne(AccName, AccDelayedAppearanceUpdate, AccDelayedSkillUpdate, AccDelayedGameUpdate);
				break;
			}
}

/**
 * Returns the account object related to it's ID
 * @param {string} ID
 * @returns {Account|null}
 */
function AccountGet(ID) {
	for (const Acc of Account)
		if (Acc.ID == ID)
			return Acc;
	return null;
}

/**
 * The maximum number of search results to return at once
 */
const ChatRoomSearchMaxResults = 120;

/**
 * When a user searches for a chat room
 * @param {ServerChatRoomSearchRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomSearch(data, socket) {
	if (!CommonIsObject(data) || typeof data.Query !== "string" || data.Query.length > 20) {
		return;
	}

	// Finds the current account
	const Acc = AccountGet(socket.id);
	if (!Acc) return;

	// Our search query
	const Query = data.Query.trim();

	// Gets the chat room spaces to return (empty for public, asylum, etc.)
	let Spaces = [];
	if (typeof data.Space === "string" && data.Space.length <= 100) {
		Spaces = [data.Space];
	} else if (Array.isArray(data.Space)) {
		Spaces = data.Space.filter(space => typeof space === "string" && space.length <= 100);
	}

	// Gets the game name currently being played in the chat room (empty for all games and non-games rooms)
	const Game = typeof data.Game === "string" && data.Game.length <= 100 ? data.Game : "";

	// Checks if the user allows full rooms to show up
	const FullRooms = typeof data.FullRooms === "boolean" ? data.FullRooms : false;

	// Checks if the user opted to ignore certain rooms
	let IgnoredRooms = [];
	if (Array.isArray(data.Ignore)) {
		// Validate array, only strings are valid.
		IgnoredRooms = data.Ignore.filter(R => typeof R === "string" && R.match(ServerChatRoomNameRegex)).map(r => r.toUpperCase());
	}

	// Grab the search language
	const Language = typeof data.Language === "string" ? data.Language : "";

	// Builds a list of all public rooms, the last rooms created are shown first
	const CR = [];
	for (const room of ChatRoom) {
		if (!room) continue;

		const roomName = room.Name.toUpperCase();

		// Room is not in the correct environment, skip
		if (Acc.Environment !== room.Environment) continue;

		// We're looking for a specific game and the room's doesn't match, skip
		if (Game !== "" && room.Game !== Game) continue;

		// The room is full and we don't want those, skip
		if (room.Account.length >= room.Limit && !FullRooms) continue;

		// Room isn't in the correct space, skip
		if (!Spaces.includes(room.Space)) continue;

		// Player is banned from the room, skip
		if (room.Ban.includes(Acc.MemberNumber)) continue;

		// Room is for a different language than requested, skip
		if (Language !== "" && room.Language !== Language) continue;

		// We have a search query
		if (Query !== "") {
			// Query doesn't match the room, skip
			if (!roomName.includes(Query)) continue;
		}

		// Room is private, and query isn't an exact name match or player isn't in the whitelist, skip
		if (room.Private && !(roomName === Query || room.Whitelist.includes(Acc.MemberNumber))) continue;

		// Room is locked and player isn't an admin or in the whitelist, skip
		if (room.Locked && !(room.Admin.includes(Acc.MemberNumber) || room.Whitelist.includes(Acc.MemberNumber))) continue;

		// Room is in our ignore list, skip
		if (IgnoredRooms.includes(roomName)) continue;

		const result = ChatRoomSearchAddResult(Acc, room);
		if (!result) continue;

		CR.push(result);

		// We got enough results for one batch, return those
		if (CR.length >= ChatRoomSearchMaxResults) break;
	}

	// Sends the list to the client
	socket.emit("ChatRoomSearchResult", CR);
}

/**
 * Transform a chatroom into its search result form
 * @param {Account} Acc
 * @param {Chatroom} room
 * @returns {ServerChatRoomSearchData}
 */
function ChatRoomSearchAddResult(Acc, room) {

	// Builds the searching account's list of known individuals in the current room
	/** @type {ServerFriendInfo[]} */
	const Friends = [];
	for (const RoomAcc of room.Account) {
		if (!RoomAcc) continue;
		if (RoomAcc?.Ownership?.MemberNumber === Acc.MemberNumber) {
			Friends.push({ Type: "Submissive", MemberNumber: RoomAcc.MemberNumber, MemberName: RoomAcc.Name });
		} else if (Acc?.FriendList?.includes(RoomAcc.MemberNumber) && RoomAcc?.FriendList?.includes(Acc.MemberNumber)) {
			Friends.push({ Type: "Friend", MemberNumber: RoomAcc.MemberNumber, MemberName: RoomAcc.Name });
		}
	}

	const MapType = room?.MapData?.Type ? room.MapData.Type : "Never";

	// Builds a search result object with the room data
	return {
		Name: room.Name,
		Language: room.Language,
		Creator: room.Creator,
		CreatorMemberNumber: room.CreatorMemberNumber,
		MemberCount: room.Account.length,
		MemberLimit: room.Limit,
		Description: room.Description,
		BlockCategory: room.BlockCategory,
		Game: room.Game,
		Friends: Friends,
		Space: room.Space,
		MapType
	}
}

/**
 * Creates a new chat room
 * @param {ServerChatRoomCreateRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomCreate(data, socket) {

	// Make sure we have everything to create it
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (data.Description != null) && (data.Background != null) && (data.Private != null) && (typeof data.Name === "string") && (typeof data.Description === "string") && (typeof data.Background === "string") && (typeof data.Private === "boolean")) {

		// Validates the room name
		data.Name = data.Name.trim();
		if (data.Name.match(ServerChatRoomNameRegex) && (data.Description.length <= 100) && (data.Background.length <= 100)) {
			// Finds the account and links it to the new room
			var Acc = AccountGet(socket.id);
			if (Acc == null) {
				socket.emit("ChatRoomCreateResponse", "AccountError");
				return;
			}

			// Check if the same name already exists and quits if that's the case
			for (const Room of ChatRoom)
				if (Room.Name.toUpperCase().trim() == data.Name.toUpperCase().trim()) {
					socket.emit("ChatRoomCreateResponse", "RoomAlreadyExist");
					return;
				}

			// Gets the space (regular, asylum), game (none, LARP) and blocked categories of the chat room
			/** @type {ServerChatRoomSpace} */
			var Space = "";
			/** @type {ServerChatRoomGame} */
			var Game = "";
			if ((data.Space != null) && (typeof data.Space === "string") && (data.Space.length <= 100)) Space = data.Space;
			if ((data.Game != null) && (typeof data.Game === "string") && (data.Game.length <= 100)) Game = data.Game;
			if ((data.BlockCategory == null) || !Array.isArray(data.BlockCategory)) data.BlockCategory = [];
			if (!Array.isArray(data.Ban) || data.Ban.some(i => !Number.isInteger(i))) data.Ban = [];
			if (!Array.isArray(data.Whitelist) || data.Whitelist.some(i => !Number.isInteger(i))) data.Whitelist = [];
			if (!Array.isArray(data.Admin) || data.Admin.some(i => !Number.isInteger(i))) data.Admin = [Acc.MemberNumber];

			// Makes sure the limit is valid
			let Limit = CommonParseInt(data.Limit, ROOM_LIMIT_DEFAULT);
			if (Limit < ROOM_LIMIT_MINIMUM || Limit > ROOM_LIMIT_MAXIMUM) Limit = ROOM_LIMIT_DEFAULT;

			// Prepares the room object
			ChatRoomRemove(Acc, "ServerLeave", []);
			/** @type {Chatroom} */
			var NewRoom = {
				ID: base64id.generateId(),
				Name: data.Name,
				Language: data.Language,
				Description: data.Description,
				Background: data.Background,
				Custom: data.Custom,
				Limit: Limit,
				Private: data.Private || false,
				Locked : data.Locked || false,
				MapData : data.MapData,
				Environment: Acc.Environment,
				Space: Space,
				Game: Game,
				Creator: Acc.Name,
				CreatorMemberNumber: Acc.MemberNumber,
				Creation: CommonTime(),
				Account: [],
				Ban: data.Ban,
				BlockCategory: data.BlockCategory,
				Whitelist: data.Whitelist,
				Admin: data.Admin
			};
			ChatRoom.push(NewRoom);
			Acc.ChatRoom = NewRoom;
			NewRoom.Account.push(Acc);
			//console.log("Chat room (" + ChatRoom.length.toString() + ") " + data.Name + " created by account " + Acc.AccountName + ", ID: " + socket.id);
			socket.join("chatroom-" + NewRoom.ID);
			socket.emit("ChatRoomCreateResponse", "ChatRoomCreated");
			ChatRoomSync(NewRoom, Acc.MemberNumber);

		} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

	} else socket.emit("ChatRoomCreateResponse", "InvalidRoomData");

}

/**
 * Join an existing chat room
 * @param {ServerChatRoomJoinRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomJoin(data, socket) {

	// Make sure we have everything to join it
	if ((data != null) && (typeof data === "object") && (data.Name != null) && (typeof data.Name === "string") && (data.Name != "")) {

		// Finds the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Finds the room and join it
			for (const Room of ChatRoom)
				if (Room.Name.toUpperCase().trim() == data.Name.toUpperCase().trim())
					if (Acc.Environment == Room.Environment)
						if (Room.Account.length < Room.Limit) {
							if (Room.Ban.indexOf(Acc.MemberNumber) < 0) {

								// If the room is unlocked, the player is an admin, or the player is on the whitelist, we allow them inside
								if (!Room.Locked || (Room.Admin.indexOf(Acc.MemberNumber) >= 0) || (Room.Whitelist.indexOf(Acc.MemberNumber) >= 0)) {
									if (Acc.ChatRoom == null || Acc.ChatRoom.ID !== Room.ID) {
										ChatRoomRemove(Acc, "ServerLeave", []);
										Acc.ChatRoom = Room;
										if (Account.find(A => Acc.MemberNumber === A.MemberNumber)) {
											Room.Account.push(Acc);
											socket.join("chatroom-" + Room.ID);
											socket.emit("ChatRoomSearchResponse", "JoinedRoom");
											ChatRoomSyncMemberJoin(Room, Acc);
											ChatRoomMessage(Room, Acc.MemberNumber, "ServerEnter", "Action", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
										}
										return;
									} else {
										socket.emit("ChatRoomSearchResponse", "AlreadyInRoom");
										return;
									}
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

/**
 * Removes a player from a room
 * @param {Account} Acc
 * @param {string} Reason
 * @param {any[]} Dictionary
 */
function ChatRoomRemove(Acc, Reason, Dictionary) {
	if (Acc.ChatRoom != null) {
		Acc.Socket.leave("chatroom-" + Acc.ChatRoom.ID);

		// Removes it from the chat room array
		for (const RoomAcc of Acc.ChatRoom.Account)
			if (RoomAcc.ID == Acc.ID) {
				Acc.ChatRoom.Account.splice(Acc.ChatRoom.Account.indexOf(RoomAcc), 1);
				break;
			}

		// Destroys the room if it's empty, warn other players if not
		if (Acc.ChatRoom.Account.length == 0) {
			for (var C = 0; C < ChatRoom.length; C++)
				if (Acc.ChatRoom.Name == ChatRoom[C].Name) {
					//console.log("Chat room " + Acc.ChatRoom.Name + " was destroyed. Rooms left: " + (ChatRoom.length - 1).toString());
					ChatRoom.splice(C, 1);
					break;
				}
		} else {
			if (!Dictionary || (Dictionary.length == 0)) Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
			ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, Reason, "Action", null, Dictionary);
			ChatRoomSyncMemberLeave(Acc.ChatRoom, Acc.MemberNumber);
		}
		Acc.ChatRoom = null;

	}
}

/**
 * Finds the current account and removes it from it's chat room, nothing is returned to the client
 * @param {ServerSocket} socket
 */
function ChatRoomLeave(socket) {
	var Acc = AccountGet(socket.id);
	if (Acc != null) ChatRoomRemove(Acc, "ServerLeave", []);
}

/**
 * Sends a text message to everyone in the room or a specific target
 * @param {Chatroom|null|undefined} CR
 * @param {number} Sender Sender's MemberNumber
 * @param {string} Content
 * @param {ServerChatRoomMessageType} Type
 * @param {number|null} Target Target's MemberNumber or null if broadcast
 * @param {any[]} [Dictionary]
 */
function ChatRoomMessage(CR, Sender, Content, Type, Target, Dictionary) {
	if (CR == null) return;
	if (Target == null) {
		IO.to("chatroom-" + CR.ID).emit("ChatRoomMessage", { Sender: Sender, Content: Content, Type: Type, Dictionary: Dictionary } );
	} else {
		for (const Acc of CR.Account) {
			if (Acc != null && Target === Acc.MemberNumber) {
				Acc.Socket.emit("ChatRoomMessage", { Sender: Sender, Content: Content, Type: Type, Dictionary: Dictionary } );
				return;
			}
		}
	}
}

/**
 * When a user sends a chat message, we propagate it to everyone in the room
 * @param {ServerChatRoomMessage} data
 * @param {ServerSocket} socket
 */
function ChatRoomChat(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.Content != null) && (data.Type != null) && (typeof data.Content === "string") && (typeof data.Type === "string") && (ChatRoomMessageType.indexOf(data.Type) >= 0) && (data.Content.length <= 1000)) {
		var Acc = AccountGet(socket.id);
		if (Acc != null) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, data.Content.trim(), data.Type, data.Target, data.Dictionary);
	}
}

/**
 * When a user sends a game packet (for LARP or other games), we propagate it to everyone in the room
 * @param {ServerChatRoomGameUpdateRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomGame(data, socket) {
	if ((data != null) && (typeof data === "object")) {
		var R = Math.random();
		var Acc = AccountGet(socket.id);
		if (Acc && Acc.ChatRoom) {
			IO.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomGameResponse", /** @type {ServerChatRoomGameResponse} */ ({ Sender: Acc.MemberNumber, Data: data, RNG: R }) );
		}
	}
}

/**
 * Builds the character packet to send over to the clients
 * @param {Account} Acc
 * @returns {ServerChatRoomSyncCharacterResponse["Character"]}
 */
function ChatRoomSyncGetCharSharedData(Acc) {
	const WhiteList = [];
	const BlackList = [];
	const sendBlacklist = AccountShouldSendBlackList(Acc);
	// We filter whitelist&blacklist based on people in room
	if (Acc.ChatRoom && Acc.ChatRoom.Account) {
		for (const B of Acc.ChatRoom.Account) {
			if (Acc.WhiteList.includes(B.MemberNumber)) {
				WhiteList.push(B.MemberNumber);
			}
			if (sendBlacklist && Acc.BlackList.includes(B.MemberNumber)) {
				BlackList.push(B.MemberNumber);
			}
		}
	}

	return {
		ID: Acc.ID,
		Name: Acc.Name,
		AssetFamily: Acc.AssetFamily,
		Title: Acc.Title,
		Nickname: Acc.Nickname,
		Appearance: Acc.Appearance,
		ActivePose: Acc.ActivePose,
		Reputation: Acc.Reputation,
		Creation: Acc.Creation,
		Lovership: Acc.Lovership,
		Description: Acc.Description,
		Owner: Acc.Owner,
		MemberNumber: Acc.MemberNumber,
		LabelColor: Acc.LabelColor,
		ItemPermission: Acc.ItemPermission,
		InventoryData: Acc.InventoryData,
		Ownership: Acc.Ownership,
		BlockItems: Acc.BlockItems,
		LimitedItems: Acc.LimitedItems,
		FavoriteItems: Acc.FavoriteItems,
		ArousalSettings: Acc.ArousalSettings,
		OnlineSharedSettings: Acc.OnlineSharedSettings,
		WhiteList,
		BlackList,
		Game: Acc.Game,
		MapData: Acc.MapData,
		Crafting: Acc.Crafting,
		Difficulty: Acc.Difficulty
	};
}

/**
 * Returns a ChatRoom data that can be synced to clients
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 */
function ChatRoomGetData(CR, SourceMemberNumber)
{
	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	// Builds the room data
	/** @type {ServerChatRoomSyncMessage} */
	const R = {
		Name: CR.Name,
		Language: CR.Language,
		Description: CR.Description,
		Admin: CR.Admin,
		Whitelist: CR.Whitelist,
		Ban: CR.Ban,
		Background: CR.Background,
		Custom: CR.Custom,
		Limit: CR.Limit,
		Game: CR.Game,
		SourceMemberNumber,
		Private: CR.Private,
		Locked: CR.Locked,
		MapData: CR.MapData,
		BlockCategory: CR.BlockCategory,
		Space: CR.Space,
		Character: CR.Account.map(ChatRoomSyncGetCharSharedData),
	};

	return R;
}

/**
 * Returns property data for a chatroom
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 */
function ChatRoomGetProperties(CR, SourceMemberNumber)
{
	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	// Builds the room data
	/** @type {ServerChatRoomSyncPropertiesMessage} */
	const R = {
		Name: CR.Name,
		Language: CR.Language,
		Description: CR.Description,
		Admin: CR.Admin,
		Whitelist: CR.Whitelist,
		Ban: CR.Ban,
		Background: CR.Background,
		Custom: CR.Custom,
		Limit: CR.Limit,
		Game: CR.Game,
		SourceMemberNumber,
		Private: CR.Private,
		Locked: CR.Locked,
		MapData: CR.MapData,
		BlockCategory: CR.BlockCategory,
		Space: CR.Space,
	};

	return R;
}

/**
 * Syncs the room data with all of it's members
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 */
function ChatRoomSync(CR, SourceMemberNumber) {

	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	// Sends the full packet to everyone in the room
	IO.to("chatroom-" + CR.ID).emit("ChatRoomSync", ChatRoomGetData(CR, SourceMemberNumber));
}

/**
 * Syncs the room data only to target
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber MemberNumber of account causing change
 * @param {number} TargetMemberNumber The account to which the sync should be sent
 */
function ChatRoomSyncToMember(CR, SourceMemberNumber, TargetMemberNumber) {
	// Exits right away if the chat room was destroyed
	if (CR == null) { return; }

	// Sends the full packet to everyone in the room
	for (const RoomAcc of CR.Account) // For each player in the chat room...
	{
		if(RoomAcc.MemberNumber == TargetMemberNumber) // If the player is the one who gets synced...
		{
			// Send room data and break loop
			RoomAcc.Socket.emit("ChatRoomSync", ChatRoomGetData(CR, SourceMemberNumber));
			break;
		}
	}
}

/**
 * Syncs the room data with all of it's members
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 * @param {number} TargetMemberNumber The character to sync
 */
function ChatRoomSyncCharacter(CR, SourceMemberNumber, TargetMemberNumber) {
	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	const Target = CR.Account.find(Acc => Acc.MemberNumber === TargetMemberNumber);
	if (!Target) return;
	const Source = CR.Account.find(Acc => Acc.MemberNumber === SourceMemberNumber);
	if (!Source) return;

	let characterData = { };
	characterData.SourceMemberNumber = SourceMemberNumber;
	characterData.Character = ChatRoomSyncGetCharSharedData(Target);

	Source.Socket.to("chatroom-" + CR.ID).emit("ChatRoomSyncCharacter", characterData);
}

/**
 * Sends the newly joined player to all chat room members
 * @param {Chatroom} CR
 * @param {Account} Character
 */
function ChatRoomSyncMemberJoin(CR, Character) {
	// Exits right away if the chat room was destroyed
	if (CR == null) return;
	let joinData = {
		SourceMemberNumber: Character.MemberNumber,
		Character: ChatRoomSyncGetCharSharedData(Character),
		WhiteListedBy: [],
		BlackListedBy: []
	};

	for (const B of CR.Account) {
		if (B.WhiteList.includes(Character.MemberNumber)) {
			joinData.WhiteListedBy.push(B.MemberNumber);
		}
		if (AccountShouldSendBlackList(B) && B.BlackList.includes(Character.MemberNumber)) {
			joinData.BlackListedBy.push(B.MemberNumber);
		}
	}

	Character.Socket.to("chatroom-" + CR.ID).emit("ChatRoomSyncMemberJoin", joinData);
	ChatRoomSyncToMember(CR, Character.MemberNumber, Character.MemberNumber);
}

/**
 * Sends the left player to all chat room members
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber The leaving player
 */
function ChatRoomSyncMemberLeave(CR, SourceMemberNumber) {
	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	let leaveData = { };
	leaveData.SourceMemberNumber = SourceMemberNumber;

	IO.to("chatroom-" + CR.ID).emit("ChatRoomSyncMemberLeave", leaveData);
}

/**
 * Syncs the room data with all of it's members
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 */
function ChatRoomSyncRoomProperties(CR, SourceMemberNumber) {

	// Exits right away if the chat room was destroyed
	if (CR == null) return;
	IO.to("chatroom-" + CR.ID).emit("ChatRoomSyncRoomProperties", ChatRoomGetProperties(CR, SourceMemberNumber));

}

/**
 * Syncs the room data with all of it's members
 * @param {Chatroom} CR
 * @param {number} SourceMemberNumber
 */
function ChatRoomSyncReorderPlayers(CR, SourceMemberNumber) {

	// Exits right away if the chat room was destroyed
	if (CR == null) return;

	// Builds the room data
	const newPlayerOrder = [];
	for (const RoomAcc of CR.Account) {
		newPlayerOrder.push(RoomAcc.MemberNumber);
	}

	IO.to("chatroom-" + CR.ID).emit("ChatRoomSyncReorderPlayers", { PlayerOrder: newPlayerOrder });

}

/**
 * Syncs a single character data with all room members
 * @param {Account} Acc
 * @param {number} SourceMemberNumber
 */
function ChatRoomSyncSingle(Acc, SourceMemberNumber) {
	const R = {
		SourceMemberNumber,
		Character: ChatRoomSyncGetCharSharedData(Acc)
	};
	if (Acc.ChatRoom)
		IO.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncSingle", R);
}

/**
 * Updates a character from the chat room
 * @param {ServerCharacterUpdate} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.ID != null) && (typeof data.ID === "string") && (data.ID != "") && (data.Appearance != null)) {
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null))
			if (Acc.ChatRoom.Ban.indexOf(Acc.MemberNumber) < 0)
				for (const RoomAcc of Acc.ChatRoom.Account)
					if ((RoomAcc.ID == data.ID) && ChatRoomGetAllowItem(Acc, RoomAcc))
						if ((typeof data.Appearance === "object") && Array.isArray(data.Appearance)) {
							// Database.collection(AccountCollection).updateOne({ AccountName: RoomAcc.AccountName }, { $set: { Appearance: data.Appearance } }, function(err, res) { if (err) throw err; });
							//console.log("TO REMOVE - Keeping Appearance in memory for account: " + Acc.AccountName);
							if (data.Appearance != null) RoomAcc.DelayedAppearanceUpdate = data.Appearance;
							RoomAcc.Appearance = data.Appearance;
							RoomAcc.ActivePose = data.ActivePose;
							ChatRoomSyncSingle(RoomAcc, Acc.MemberNumber);
						}
	}
}

/**
 * Updates a character expression for a chat room
 *
 * *This does not update the database*
 * @param {ServerCharacterExpressionUpdate} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterExpressionUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && (typeof data.Group === "string") && (data.Group != "")) {
		const Acc = AccountGet(socket.id);
		if (Acc && Array.isArray(data.Appearance) && data.Appearance.length >= 5)
			Acc.Appearance = data.Appearance;
		if (Acc && Acc.ChatRoom) {
			socket.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncExpression", { MemberNumber: Acc.MemberNumber, Name: data.Name, Group: data.Group });
		}
	}
}

/**
 * Updates a character MapData for a chat room
 *
 * This does not update the database
 * @param {ServerChatRoomMapData} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterMapDataUpdate(data, socket) {
	if ((data != null) && (typeof data === "object")) {
		const Acc = AccountGet(socket.id);
		if (Acc && Acc.ChatRoom) {
			Acc.MapData = data;
			socket.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncMapData", { MemberNumber: Acc.MemberNumber, MapData: data });
		}
	}
}

/**
 * Updates a character pose for a chat room
 *
 * This does not update the database
 * @param {ServerCharacterPoseUpdate} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterPoseUpdate(data, socket) {
	if (!data || typeof data !== "object" || Array.isArray(data)) return;

	const Acc = AccountGet(socket.id);
	if (!Acc) return;

	/** @type {readonly string[]} */
	let Pose;
	if (typeof data.Pose !== "string" && !Array.isArray(data.Pose)) {
		Pose = [];
	} else if (Array.isArray(data.Pose)) {
		Pose = data.Pose.filter(P => typeof P === "string");
	} else {
		Pose = [data.Pose];
	}

	Acc.ActivePose = Pose;
	if (Acc.ChatRoom) {
		socket.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncPose", { MemberNumber: Acc.MemberNumber, Pose: Pose });
	}
}

/**
 * Updates a character arousal meter for a chat room
 *
 * *This does not update the database*
 * @param {ServerCharacterArousalUpdate} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterArousalUpdate(data, socket) {
	if ((data != null) && (typeof data === "object")) {
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ArousalSettings != null) && (typeof Acc.ArousalSettings === "object")) {
			Acc.ArousalSettings.OrgasmTimer = data.OrgasmTimer;
			Acc.ArousalSettings.OrgasmCount = data.OrgasmCount;
			Acc.ArousalSettings.Progress = data.Progress;
			Acc.ArousalSettings.ProgressTimer = data.ProgressTimer;
			if (Acc && Acc.ChatRoom) {
				socket.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncArousal", { MemberNumber: Acc.MemberNumber, OrgasmTimer: data.OrgasmTimer, OrgasmCount: data.OrgasmCount, Progress: data.Progress, ProgressTimer: data.ProgressTimer });
			}
		}
	}
}

/**
 * Updates a character arousal meter for a chat room
 *
 * *This does not update the database*
 * @param {ServerCharacterItemUpdate} data
 * @param {ServerSocket} socket
 */
function ChatRoomCharacterItemUpdate(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.Target != null) && (typeof data.Target === "number") && (data.Group != null) && (typeof data.Group === "string")) {

		// Make sure the source account isn't banned from the chat room and has access to use items on the target
		var Acc = AccountGet(socket.id);
		if ((Acc == null) || (Acc.ChatRoom == null) || (Acc.ChatRoom.Ban.indexOf(Acc.MemberNumber) >= 0)) return;
		for (const RoomAcc of Acc.ChatRoom.Account)
			if (RoomAcc.MemberNumber == data.Target && !ChatRoomGetAllowItem(Acc, RoomAcc))
				return;

		// Sends the item to use to everyone but the source
		if (Acc && Acc.ChatRoom) {
			socket.to("chatroom-" + Acc.ChatRoom.ID).emit("ChatRoomSyncItem", { Source: Acc.MemberNumber, Item: data });
		}
	}
}

/**
 * When an administrator account wants to act on another account in the room
 * @param {ServerChatRoomAdminRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomAdmin(data, socket) {

	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number") && (data.Action != null) && (typeof data.Action === "string")) {

		// Validates that the current account is a room administrator
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null) && (Acc.ChatRoom.Admin.indexOf(Acc.MemberNumber) >= 0)) {

			// Only certain actions can be performed by the administrator on themselves
			if (Acc.MemberNumber == data.MemberNumber && data.Action != "Swap" && data.Action != "MoveLeft" && data.Action != "MoveRight") return;

			// An administrator can update lots of room data.  The room values are sent back to the clients.
			if (data.Action == "Update")
				if ((data.Room != null) && (typeof data.Room === "object") && (data.Room.Name != null) && (data.Room.Description != null) && (data.Room.Background != null) && (typeof data.Room.Name === "string") && (typeof data.Room.Description === "string") && (typeof data.Room.Background === "string") && (data.Room.Admin != null) && (Array.isArray(data.Room.Admin)) && (!data.Room.Admin.some(i => !Number.isInteger(i))) && (data.Room.Ban != null) && (Array.isArray(data.Room.Ban)) && (!data.Room.Ban.some(i => !Number.isInteger(i)))) {
					data.Room.Name = data.Room.Name.trim();
					if (data.Room.Name.match(ServerChatRoomNameRegex) && (data.Room.Description.length <= 100) && (data.Room.Background.length <= 100)) {
						for (const Room of ChatRoom)
							if (Acc.ChatRoom && Acc.ChatRoom.Name != data.Room.Name && Room.Name.toUpperCase().trim() == data.Room.Name.toUpperCase().trim()) {
								socket.emit("ChatRoomUpdateResponse", "RoomAlreadyExist");
								return;
							}
						Acc.ChatRoom.Name = data.Room.Name;
						Acc.ChatRoom.Language = data.Room.Language;
						Acc.ChatRoom.Background = data.Room.Background;
						Acc.ChatRoom.Custom = data.Room.Custom;
						Acc.ChatRoom.Description = data.Room.Description;
						if ((data.Room.BlockCategory == null) || !Array.isArray(data.Room.BlockCategory)) data.Room.BlockCategory = [];
						Acc.ChatRoom.BlockCategory = data.Room.BlockCategory;
						Acc.ChatRoom.Ban = data.Room.Ban;
						Acc.ChatRoom.Whitelist = data.Room.Whitelist;
						Acc.ChatRoom.Admin = data.Room.Admin;
						Acc.ChatRoom.Game = ((data.Room.Game == null) || (typeof data.Room.Game !== "string") || (data.Room.Game.length > 100)) ? "" : data.Room.Game;
						let Limit = CommonParseInt(data.Room.Limit, ROOM_LIMIT_DEFAULT);
						if (Limit < ROOM_LIMIT_MINIMUM || Limit > ROOM_LIMIT_MAXIMUM) Limit = ROOM_LIMIT_DEFAULT;
						Acc.ChatRoom.Limit = Limit;
						if ((data.Room.Private != null) && (typeof data.Room.Private === "boolean")) Acc.ChatRoom.Private = data.Room.Private;
						if ((data.Room.Locked != null) && (typeof data.Room.Locked === "boolean")) Acc.ChatRoom.Locked = data.Room.Locked;
						Acc.ChatRoom.MapData = data.Room.MapData;
						socket.emit("ChatRoomUpdateResponse", "Updated");
						if ((Acc != null) && (Acc.ChatRoom != null)) {
							var Dictionary = [];
							Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
							Dictionary.push({Tag: "ChatRoomName", Text: Acc.ChatRoom.Name});
							Dictionary.push({Tag: "ChatRoomLimit", Text: Acc.ChatRoom.Limit.toString()});
							Dictionary.push({Tag: "ChatRoomPrivacy", TextToLookUp: (Acc.ChatRoom.Private ? "Private" : "Public")});
							Dictionary.push({Tag: "ChatRoomLocked", TextToLookUp: (Acc.ChatRoom.Locked ? "Locked" : "Unlocked")});
							ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerUpdateRoom", "Action", null, Dictionary);
						}
						if ((Acc != null) && (Acc.ChatRoom != null)) ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
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
				const Dictionary = [
					{SourceCharacter: Acc.MemberNumber},
					{TargetCharacter: TargetAccount.MemberNumber},
					{TargetCharacter: DestinationAccount.MemberNumber, Index: 1},
				];
				Acc.ChatRoom.Account[TargetAccountIndex] = DestinationAccount;
				Acc.ChatRoom.Account[DestinationAccountIndex] = TargetAccount;
				ChatRoomSyncReorderPlayers(Acc.ChatRoom, Acc.MemberNumber);
				if ((Acc != null) && (Acc.ChatRoom != null))
					ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerSwap", "Action", null, Dictionary);
				return;
			}

			// If the account to act upon is in the room, an administrator can ban, kick, move, promote or demote him
			for (var A = 0; (Acc.ChatRoom != null) && (A < Acc.ChatRoom.Account.length); A++)
				if (Acc.ChatRoom.Account[A].MemberNumber == data.MemberNumber) {
					var Dictionary = [];
					if (data.Action == "Ban") {
						Acc.ChatRoom.Ban.push(data.MemberNumber);
						Acc.ChatRoom.Account[A].Socket.emit("ChatRoomSearchResponse", "RoomBanned");
						if ((Acc != null) && (Acc.ChatRoom != null) && (Acc.ChatRoom.Account[A] != null)) {
							Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
							Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
							ChatRoomRemove(Acc.ChatRoom.Account[A], "ServerBan", Dictionary);
						}
						ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if (data.Action == "Kick") {
						const kickedAccount = Acc.ChatRoom.Account[A];
						kickedAccount.Socket.emit("ChatRoomSearchResponse", "RoomKicked");
						if ((Acc != null) && (Acc.ChatRoom != null) && (Acc.ChatRoom.Account[A] != null)) {
							Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
							Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
							ChatRoomRemove(kickedAccount, "ServerKick", Dictionary);
						}
					}
					else if ((data.Action == "MoveLeft") && (A != 0)) {
						let MovedAccount = Acc.ChatRoom.Account[A];
						Acc.ChatRoom.Account[A] = Acc.ChatRoom.Account[A - 1];
						Acc.ChatRoom.Account[A - 1] = MovedAccount;
						Dictionary.push({Tag: "TargetCharacterName", Text: MovedAccount.Name, MemberNumber: MovedAccount.MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						if ((data.Publish != null) && (typeof data.Publish === "boolean") && data.Publish) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerMoveLeft", "Action", null, Dictionary);
						ChatRoomSyncReorderPlayers(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "MoveRight") && (A < Acc.ChatRoom.Account.length - 1)) {
						let MovedAccount = Acc.ChatRoom.Account[A];
						Acc.ChatRoom.Account[A] = Acc.ChatRoom.Account[A + 1];
						Acc.ChatRoom.Account[A + 1] = MovedAccount;
						Dictionary.push({Tag: "TargetCharacterName", Text: MovedAccount.Name, MemberNumber: MovedAccount.MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						if ((data.Publish != null) && (typeof data.Publish === "boolean") && data.Publish) ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerMoveRight", "Action", null, Dictionary);
						ChatRoomSyncReorderPlayers(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if (data.Action == "Shuffle") {
						Acc.ChatRoom.Account.sort(() => Math.random() - 0.5);
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerShuffle", "Action", null, Dictionary);
						ChatRoomSyncReorderPlayers(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Promote") && (Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber) < 0)) {
						Acc.ChatRoom.Admin.push(Acc.ChatRoom.Account[A].MemberNumber);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerPromoteAdmin", "Action", null, Dictionary);
						ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Demote") && (Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber) >= 0)) {
						Acc.ChatRoom.Admin.splice(Acc.ChatRoom.Admin.indexOf(Acc.ChatRoom.Account[A].MemberNumber), 1);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerDemoteAdmin", "Action", null, Dictionary);
						ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Whitelist") && (Acc.ChatRoom.Whitelist.indexOf(data.MemberNumber) < 0))
					{
						Acc.ChatRoom.Whitelist.push(data.MemberNumber);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerRoomWhitelist", "Action", null, Dictionary);
						ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
					}
					else if ((data.Action == "Unwhitelist") && (Acc.ChatRoom.Whitelist.indexOf(Acc.ChatRoom.Account[A].MemberNumber) >= 0)) {
						Acc.ChatRoom.Whitelist.splice(Acc.ChatRoom.Whitelist.indexOf(Acc.ChatRoom.Account[A].MemberNumber), 1);
						Dictionary.push({Tag: "TargetCharacterName", Text: Acc.ChatRoom.Account[A].Name, MemberNumber: Acc.ChatRoom.Account[A].MemberNumber});
						Dictionary.push({Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber});
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ServerRoomUnwhitelist", "Action", null, Dictionary);
						ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
					}
					return;
				}

			// Can also ban, unban, whitelist, and unwhitelist without having the player in the room, there's no visible output
			if ((data.Action == "Ban") && (Acc.ChatRoom != null) && (Acc.ChatRoom.Ban.indexOf(data.MemberNumber) < 0))
			{
				Acc.ChatRoom.Ban.push(data.MemberNumber);
				ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
			}
			if ((data.Action == "Unban") && (Acc.ChatRoom != null) && (Acc.ChatRoom.Ban.indexOf(data.MemberNumber) >= 0))
			{
				Acc.ChatRoom.Ban.splice(Acc.ChatRoom.Ban.indexOf(data.MemberNumber), 1);
				ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
			}
			if ((data.Action == "Whitelist") && (Acc.ChatRoom != null) && (Acc.ChatRoom.Whitelist.indexOf(data.MemberNumber) < 0))
			{
				Acc.ChatRoom.Whitelist.push(data.MemberNumber);
				ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
			}
			if ((data.Action == "Unwhitelist") && (Acc.ChatRoom != null) && (Acc.ChatRoom.Whitelist.indexOf(data.MemberNumber) >= 0))
			{
				Acc.ChatRoom.Whitelist.splice(Acc.ChatRoom.Whitelist.indexOf(data.MemberNumber), 1);
				ChatRoomSyncRoomProperties(Acc.ChatRoom, Acc.MemberNumber);
			}
		}

	}
}

/**
 * Returns a specific reputation value for the player
 * @param {ServerAccountData} Account
 */
function ChatRoomDominantValue(Account) {
	if ((Account.Reputation != null) && (Array.isArray(Account.Reputation)))
		for (const Rep of Account.Reputation)
			if ((Rep.Type != null) && (Rep.Value != null) && (typeof Rep.Type === "string") && (typeof Rep.Value === "number") && (Rep.Type == "Dominant"))
				return CommonParseInt(Rep.Value, 0);
	return 0;
}

/**
 * Checks if account's blacklist should be sent.
 * It should only be sent if it is easily visible a person in blacklisted without this info.
 * This means if the player is on permission that blocks depending on blacklist
 * @see ChatRoomGetAllowItem
 * @param {ServerAccountData} Acc The account to check
 * @returns {boolean}
 */
function AccountShouldSendBlackList(Acc) {
	return Acc.ItemPermission === 1 || Acc.ItemPermission === 2;
}

/**
 * Compares the source account and target account to check if we allow using an item
 * @param {Account} Source
 * @param {Account} Target
 */
function ChatRoomGetAllowItem(Source, Target) {

	// Make sure we have the required data
	if ((Source == null) || (Target == null)) return false;
	AccountValidData(Source);
	AccountValidData(Target);

	// At zero permission level or if target is source or if owner, we allow it
	if ((Target.ItemPermission <= 0) || (Source.MemberNumber == Target.MemberNumber) || ((Target.Ownership != null) && (Target.Ownership.MemberNumber != null) && (Target.Ownership.MemberNumber == Source.MemberNumber))) return true;

	// At one, we allow if the source isn't on the blacklist
	if ((Target.ItemPermission == 1) && (Target.BlackList.indexOf(Source.MemberNumber) < 0)) return true;

	var LoversNumbers = [];
	for (const Lover of Target.Lovership) {
		if (Lover.MemberNumber != null) { LoversNumbers.push(Lover.MemberNumber); }
	}
	// At two, we allow if the source is Dominant compared to the Target (25 points allowed) or on whitelist or a lover
	if ((Target.ItemPermission == 2) && (Target.BlackList.indexOf(Source.MemberNumber) < 0) && ((ChatRoomDominantValue(Source) + 25 >= ChatRoomDominantValue(Target)) || (Target.WhiteList.indexOf(Source.MemberNumber) >= 0) || (LoversNumbers.indexOf(Source.MemberNumber) >= 0))) return true;

	// At three, we allow if the source is on the whitelist of the Target or a lover
	if ((Target.ItemPermission == 3) && ((Target.WhiteList.indexOf(Source.MemberNumber) >= 0) || (LoversNumbers.indexOf(Source.MemberNumber) >= 0))) return true;

	// At four, we allow if the source is a lover
	if ((Target.ItemPermission == 4) && (LoversNumbers.indexOf(Source.MemberNumber) >= 0)) return true;

	// No valid combo, we don't allow the item
	return false;

}

/**
 * Returns TRUE if we allow applying an item from a character to another
 * @param {ServerChatRoomAllowItemRequest} data
 * @param {ServerSocket} socket
 */
function ChatRoomAllowItem(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number")) {

		// Gets the source account and target account to check if we allow or not
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (Acc.ChatRoom != null))
			for (const RoomAcc of Acc.ChatRoom.Account)
				if (RoomAcc.MemberNumber == data.MemberNumber)
					socket.emit("ChatRoomAllowItem", { MemberNumber: data.MemberNumber, AllowItem: ChatRoomGetAllowItem(Acc, RoomAcc) });

	}
}

/**
 * Updates the reset password entry number or creates a new one
 *
 * This number will have to be entered by the user later
 * @param {string} AccountName
 * @param {string} ResetNumber
 */
function PasswordResetSetNumber(AccountName, ResetNumber) {
	for (const PasswordReset of PasswordResetProgress)
		if (PasswordReset.AccountName.trim() == AccountName.trim()) {
			PasswordReset.ResetNumber = ResetNumber;
			return;
		}
	PasswordResetProgress.push({ AccountName: AccountName, ResetNumber: ResetNumber });
}

/**
 * Generates a password reset number and sends it to the user
 * @param {ServerPasswordResetRequest} data
 * @param {ServerSocket} socket
 */
function PasswordReset(data, socket) {
	if ((data != null) && (typeof data === "string") && (data != "") && CommonEmailIsValid(data)) {

		// One email reset password per 5 seconds to prevent flooding
		if (NextPasswordReset > CommonTime()) return socket.emit("PasswordResetResponse", "RetryLater");
		NextPasswordReset = CommonTime() + 5000;

		// Gets all accounts that matches the email
		Database.collection(AccountCollection).find({ Email : data }).toArray(function(err, result) {

			// If we found accounts with that email
			if (err) throw err;
			if ((result != null) && (typeof result === "object") && (result.length > 0)) {

				// Builds a reset number for each account found and creates the email body
				var EmailBody = "To reset your account password, enter your account name and the reset number included in this email.  You need to put these in the Bondage Club password reset screen, with your new password.<br /><br />";
				for (const res of result) {
					var ResetNumber = (Math.round(Math.random() * 1000000000000)).toString();
					PasswordResetSetNumber(res.AccountName, ResetNumber);
					EmailBody = EmailBody + "Account Name: " + res.AccountName + "<br />";
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

/**
 * Generates a password reset number and sends it to the user
 * @param {ServerPasswordResetProcessRequest} data
 * @param {ServerSocket} socket
 */
function PasswordResetProcess(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.AccountName != null) && (typeof data.AccountName === "string") && (data.ResetNumber != null) && (typeof data.ResetNumber === "string") && (data.NewPassword != null) && (typeof data.NewPassword === "string")) {

		// Makes sure the data is valid
		if (data.AccountName.match(ServerAccountNameRegex) && data.NewPassword.match(ServerAccountPasswordRegex)) {

			// Checks if the reset number matches
			for (const PasswordReset of PasswordResetProgress)
				if ((PasswordReset.AccountName == data.AccountName) && (PasswordReset.ResetNumber == data.ResetNumber)) {

					// Creates a hashed password and updates the account with it
					BCrypt.hash(data.NewPassword.toUpperCase(), 10, function( err, hash ) {
						if (err) throw err;
						console.log("Updating password for account: " + data.AccountName);
						Database.collection(AccountCollection).updateOne({ AccountName : data.AccountName }, { $set: { Password: hash } }, function(err, res) { if (err) throw err; });
						socket.emit("PasswordResetResponse", "PasswordResetSuccessful");
					});
					return;
				}

			// Sends a fail message to the client
			socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");

		} else socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");

	} else socket.emit("PasswordResetResponse", "InvalidPasswordResetInfo");
}

/**
 * Gets the current ownership status between two players in the same chatroom
 *
 * Can also trigger the progress in the relationship
 * @param {ServerAccountOwnershipRequest} data
 * @param {ServerSocket} socket
 */
function AccountOwnership(data, socket) {
	if (data != null && typeof data === "object" && typeof data.MemberNumber === "number") {

		// The submissive can flush it's owner at any time in the trial, or after a delay if collared.  Players on Extreme mode cannot break the full ownership.
		const Acc = AccountGet(socket.id);
		if (Acc == null) return;
		if (Acc.Ownership != null && Acc.Ownership.Stage != null && Acc.Ownership.Start != null && (Acc.Ownership.Stage == 0 || Acc.Ownership.Start + OwnershipDelay <= CommonTime()) && data.Action === "Break") {
			if (Acc.Difficulty == null || Acc.Difficulty.Level == null || typeof Acc.Difficulty.Level !== "number" || Acc.Difficulty.Level <= 2 || Acc.Ownership == null || Acc.Ownership.Stage == null || typeof Acc.Ownership.Stage !== "number" || Acc.Ownership.Stage == 0) {
				Acc.Owner = "";
				Acc.Ownership = null;
				let O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
				Database.collection(AccountCollection).updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
				socket.emit("AccountOwnership", { ClearOwnership: true });
				return;
			}
		}

		// Get the target within the chatroom
		if (Acc.ChatRoom == null) return;
		const TargetAcc = Acc.ChatRoom.Account.find(A => A.MemberNumber === data.MemberNumber);

		// Can release a target that's not in the chatroom
		if (!TargetAcc && (data.Action === "Release") && (Acc.MemberNumber != null) && (data.MemberNumber != null)) {

			// Gets the account linked to that member number, make sure
			Database.collection(AccountCollection).findOne({ MemberNumber : data.MemberNumber }, function(err, result) {
				if (err) throw err;
				if ((result != null) && (result.MemberNumber != null) && (result.MemberNumber === data.MemberNumber) && (result.Ownership != null) && (result.Ownership.MemberNumber === Acc.MemberNumber)) {
					Database.collection(AccountCollection).updateOne({ AccountName : result.AccountName }, { $set: { Owner: "", Ownership: null } }, function(err, res) { if (err) throw err; });
					ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ReleaseSuccess", "ServerMessage", Acc.MemberNumber);
					let Target = Account.find(A => A.MemberNumber === data.MemberNumber);
					if (!Target) return;
					Target.Owner = "";
					Target.Ownership = null;
					Target.Socket.emit("AccountOwnership", { ClearOwnership: true });
					if (Target.ChatRoom != null) {
						ChatRoomSyncCharacter(Target.ChatRoom, Target.MemberNumber, Target.MemberNumber);
						ChatRoomMessage(Target.ChatRoom, Target.MemberNumber, "ReleaseByOwner", "ServerMessage", Target.MemberNumber);
					}
				} else ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "ReleaseFail", "ServerMessage", Acc.MemberNumber);
			});

		}

		// Exit if there's no target
		if (!TargetAcc) return;

		// The dominant can release the submissive player at any time
		if (data.Action === "Release" && TargetAcc.Ownership != null && TargetAcc.Ownership.MemberNumber === Acc.MemberNumber) {
			const isTrial = typeof TargetAcc.Ownership.Stage !== "number" || TargetAcc.Ownership.Stage == 0;
			TargetAcc.Owner = "";
			TargetAcc.Ownership = null;
			let O = { Ownership: TargetAcc.Ownership, Owner: TargetAcc.Owner };
			Database.collection(AccountCollection).updateOne({ AccountName : TargetAcc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
			TargetAcc.Socket.emit("AccountOwnership", { ClearOwnership: true });
			ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, isTrial ? "EndOwnershipTrial" : "EndOwnership", "ServerMessage", null, [
				{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber },
				{ Tag: "TargetCharacter", Text: TargetAcc.Name, MemberNumber: TargetAcc.MemberNumber },
			]);
			ChatRoomSyncCharacter(Acc.ChatRoom, TargetAcc.MemberNumber, TargetAcc.MemberNumber);
			return;
		}

		// In a chatroom, the dominant and submissive can enter in a BDSM relationship (4 steps to complete)
		// The dominant player proposes to the submissive player, cannot propose if target player is already owner
		if (Acc.Ownership == null ||
			Acc.Ownership.MemberNumber == null ||
			Acc.Ownership.MemberNumber != data.MemberNumber
		) {
			// Cannot propose if on blacklist
			if (TargetAcc.BlackList.indexOf(Acc.MemberNumber) < 0) {
				// Cannot propose if owned by a NPC
				if (TargetAcc.Owner == null || TargetAcc.Owner == "") {

					// If there's no ownership, the dominant can propose to start a trial (Step 1 / 4)
					if (TargetAcc.Ownership == null || TargetAcc.Ownership.MemberNumber == null) {
						// Ignore requests for self-owners
						if (Acc.MemberNumber === data.MemberNumber) return;

						if (data.Action === "Propose") {
							TargetAcc.Owner = "";
							TargetAcc.Ownership = { StartTrialOfferedByMemberNumber: Acc.MemberNumber };
							ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferStartTrial", "ServerMessage", TargetAcc.MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
						} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanOfferStartTrial" });
					}

					// If trial has started, the dominant can offer to end it after the delay (Step 3 / 4)
					if (TargetAcc.Ownership != null &&
						TargetAcc.Ownership.MemberNumber == Acc.MemberNumber &&
						TargetAcc.Ownership.EndTrialOfferedByMemberNumber == null &&
						TargetAcc.Ownership.Stage === 0 &&
						TargetAcc.Ownership.Start != null &&
						TargetAcc.Ownership.Start + OwnershipDelay <= CommonTime()
					) {
						if (data.Action === "Propose") {
							TargetAcc.Ownership.EndTrialOfferedByMemberNumber = Acc.MemberNumber;
							ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferEndTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
						} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanOfferEndTrial" });
					}
				}
			}
		}

		// The submissive player can accept a proposal from the dominant
		// No possible interaction if the player is owned by someone else
		if (Acc.Ownership != null &&
			(Acc.Ownership.MemberNumber == null || Acc.Ownership.MemberNumber == data.MemberNumber)
		) {
			// Cannot accept if on blacklist
			if (TargetAcc.BlackList.indexOf(Acc.MemberNumber) < 0) {

				// If the submissive wants to accept to start the trial period (Step 2 / 4)
				if (Acc.Ownership.StartTrialOfferedByMemberNumber != null && Acc.Ownership.StartTrialOfferedByMemberNumber == data.MemberNumber) {
					if (data.Action === "Accept") {
						Acc.Owner = "";
						Acc.Ownership = { MemberNumber: data.MemberNumber, Name: TargetAcc.Name, Start: CommonTime(), Stage: 0 };
						let O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
						Database.collection(AccountCollection).updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
						socket.emit("AccountOwnership", O);
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "StartTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
						ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);
					} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanStartTrial" });
				}

				// If the submissive wants to accept the full collar (Step 4 /4)
				if (Acc.Ownership.Stage != null &&
					Acc.Ownership.Stage == 0 &&
					Acc.Ownership.EndTrialOfferedByMemberNumber != null &&
					Acc.Ownership.EndTrialOfferedByMemberNumber == data.MemberNumber
				) {
					if (data.Action === "Accept") {
						Acc.Owner = TargetAcc.Name;
						Acc.Ownership = { MemberNumber: data.MemberNumber, Name: TargetAcc.Name, Start: CommonTime(), Stage: 1 };
						let O = { Ownership: Acc.Ownership, Owner: Acc.Owner };
						Database.collection(AccountCollection).updateOne({ AccountName : Acc.AccountName }, { $set: O }, function(err, res) { if (err) throw err; });
						socket.emit("AccountOwnership", O);
						ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "EndTrial", "ServerMessage", null, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
						ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);
					} else socket.emit("AccountOwnership", { MemberNumber: data.MemberNumber, Result: "CanEndTrial" });
				}

			}
		}
	}
}

/**
 * Gets the current lovership status between two players in the same chatroom
 *
 * Can also trigger the progress in the relationship
 * @param {ServerAccountLovershipRequest} data
 * @param {ServerSocket} socket
 */
function AccountLovership(data, socket) {
	if ((data != null) && (typeof data === "object") && (data.MemberNumber != null) && (typeof data.MemberNumber === "number")) {

		/**
		 * Update the lovership and delete all unnecessary information
		 * @param {Lovership[]} Lovership
		 * @param {number} MemberNumber
		 * @param {ServerSocket} [CurrentSocket]
		 * @param {boolean} [Emit]
		 */
		function AccountUpdateLovership(Lovership, MemberNumber, CurrentSocket = socket, Emit = true) {
			var newLovership = Lovership.slice();
			for (let L = newLovership.length - 1; L >= 0; L--) {
				delete newLovership[L].BeginEngagementOfferedByMemberNumber;
				delete newLovership[L].BeginWeddingOfferedByMemberNumber;
				if (newLovership[L].BeginDatingOfferedByMemberNumber) {
					newLovership.splice(L, 1);
					L -= 1;
				}
			}
			const L = { Lovership: newLovership };
			Database.collection(AccountCollection).updateOne({ MemberNumber : MemberNumber}, { $set: L }, function(err, res) { if (err) throw err; });
			if (Emit) CurrentSocket.emit("AccountLovership", L);
		}

		// A Lover can break her relationship any time if not wed, or after a delay if official
		var Acc = AccountGet(socket.id);
		if ((Acc != null) && (data.Action != null) && (data.Action === "Break")) {

			var AccLoversNumbers = [];
			for (const Lover of Acc.Lovership) {
				if (Lover.MemberNumber != null) { AccLoversNumbers.push(Lover.MemberNumber); }
				else if (Lover.Name != null) { AccLoversNumbers.push(Lover.Name); }
				else { AccLoversNumbers.push(-1); }
			}
			var AL = AccLoversNumbers.indexOf(data.MemberNumber);

			// breaking with other players
			if ((Acc.Lovership != null) && (AL >= 0) && (Acc.Lovership[AL].Stage != null)
				&& (Acc.Lovership[AL].Start != null) && ((Acc.Lovership[AL].Stage != 2) || (Acc.Lovership[AL].Start + LovershipDelay <= CommonTime()))) {

				// Update the other account if she's online, then update the database
				var P = [];
				Database.collection(AccountCollection).find({ MemberNumber : data.MemberNumber }).sort({MemberNumber: -1}).limit(1).toArray(function(err, result) {
					if (err) throw err;
					if ((result != null) && (typeof result === "object") && (result.length > 0)) {
						P = result[0].Lovership;

						var TargetLoversNumbers = [];
						if ((P != null) && Array.isArray(P))
							for (const Lover of P)
								TargetLoversNumbers.push(Lover.MemberNumber ? Lover.MemberNumber : -1);

						var TL = TargetLoversNumbers.indexOf(Acc.MemberNumber);
						// Don't try to remove an already removed lover
						if (TL >= 0) {
							if (Array.isArray(P)) P.splice(TL, 1);
							else P = [];

							for (const OtherAcc of Account)
								if (OtherAcc.MemberNumber == data.MemberNumber) {
									OtherAcc.Lovership = P;
									OtherAcc.Socket.emit("AccountLovership", { Lovership: OtherAcc.Lovership });
									if (OtherAcc.ChatRoom != null)
										ChatRoomSyncCharacter(OtherAcc.ChatRoom, OtherAcc.MemberNumber, OtherAcc.MemberNumber);
								}

							AccountUpdateLovership(P, data.MemberNumber, null, false);
						}
					}

					// Make sure we don't do a double-delete in the odd case where we're breaking up with ourselves
					if (data.MemberNumber === Acc.MemberNumber) return;

					// Updates the account that triggered the break up
					if (!Array.isArray(Acc.Lovership)) Acc.Lovership = [];
					else if (Acc.Lovership[AL].MemberNumber === data.MemberNumber) Acc.Lovership.splice(AL, 1);
					AccountUpdateLovership(Acc.Lovership, Acc.MemberNumber);
				});
				return;
			}
			// breaking with NPC
			else if ((Acc.Lovership != null) && (data.MemberNumber < 0) && (data.Name != null)) {
				Acc.Lovership.splice(AccLoversNumbers.indexOf(data.Name), 1);
				AccountUpdateLovership(Acc.Lovership, Acc.MemberNumber);
				return;
			}
		}

		// In a chatroom, two players can enter in a lover relationship (6 steps to complete)
		if ((Acc != null) && (Acc.ChatRoom != null)) {

			var AccLoversNumbers = [];
			for (const Lover of Acc.Lovership) {
				if (Lover.MemberNumber != null) { AccLoversNumbers.push(Lover.MemberNumber); }
				else if (Lover.BeginDatingOfferedByMemberNumber) { AccLoversNumbers.push(Lover.BeginDatingOfferedByMemberNumber); }
				else { AccLoversNumbers.push(-1); }
			}
			var AL = AccLoversNumbers.indexOf(data.MemberNumber);

			// One player propose to another
			if (((Acc.Lovership.length < 5) && (AL < 0)) || (AL >= 0)) // Cannot propose if target player is already a lover, up to 5 loverships
				for (const RoomAcc of Acc.ChatRoom.Account)
					if ((RoomAcc.MemberNumber == data.MemberNumber) && (RoomAcc.BlackList.indexOf(Acc.MemberNumber) < 0)) { // Cannot propose if on blacklist

						var TargetLoversNumbers = [];
						for (const RoomAccLover of RoomAcc.Lovership) {
							if (RoomAccLover.MemberNumber != null) {
								TargetLoversNumbers.push(RoomAccLover.MemberNumber);
							}
							else if (RoomAccLover.BeginDatingOfferedByMemberNumber) {
								TargetLoversNumbers.push(RoomAccLover.BeginDatingOfferedByMemberNumber);
							}
							else { TargetLoversNumbers.push(-1); }
						}
						var TL = TargetLoversNumbers.indexOf(Acc.MemberNumber);

						// Ignore requests for self-lovers
						if (Acc.MemberNumber === RoomAcc.MemberNumber) return;

						// If the target account is not a lover of player yet, can accept up to 5 loverships, one player can propose to start dating (Step 1 / 6)
						if ((RoomAcc.Lovership.length < 5) && (TL < 0)) {
							if ((data.Action != null) && (data.Action === "Propose")) {
								RoomAcc.Lovership.push({ BeginDatingOfferedByMemberNumber: Acc.MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginDating", "ServerMessage", RoomAcc.MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginDating" });
						}

						// If dating has started, a player can propose to engage after a delay (Step 3 / 6)
						if ((TL >= 0) && (RoomAcc.Lovership[TL].BeginEngagementOfferedByMemberNumber == null)
							&& (RoomAcc.Lovership[TL].Stage != null) && (RoomAcc.Lovership[TL].Start != null)
							&& (RoomAcc.Lovership[TL].Stage == 0) && (RoomAcc.Lovership[TL].Start + LovershipDelay <= CommonTime())) {
							if ((data.Action != null) && (data.Action === "Propose")) {
								RoomAcc.Lovership[TL].BeginEngagementOfferedByMemberNumber = Acc.MemberNumber;
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginEngagement", "ServerMessage", RoomAcc.MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginEngagement" });
						}

						// If engaged, a player can propose to marry after a delay (Step 5 / 6)
						if ((TL >= 0) && (RoomAcc.Lovership[TL].BeginWeddingOfferedByMemberNumber == null)
							&& (RoomAcc.Lovership[TL].Stage != null) && (RoomAcc.Lovership[TL].Start != null)
							&& (RoomAcc.Lovership[TL].Stage == 1) && (RoomAcc.Lovership[TL].Start + LovershipDelay <= CommonTime())) {
							if ((data.Action != null) && (data.Action === "Propose")) {
								RoomAcc.Lovership[TL].BeginWeddingOfferedByMemberNumber = Acc.MemberNumber;
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "OfferBeginWedding", "ServerMessage", RoomAcc.MemberNumber, [{ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber }]);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanOfferBeginWedding" });
						}

					}

			// A player can accept a proposal from another one
			if (((Acc.Lovership.length <= 5)) && (AL >= 0)) // No possible interaction if the player has reached the number of possible lovership or if isn't already a lover
				for (const AccRoom of Acc.ChatRoom.Account)
					if ((AccRoom.MemberNumber == data.MemberNumber) && (AccRoom.BlackList.indexOf(Acc.MemberNumber) < 0)) { // Cannot accept if on blacklist

						var TargetLoversNumbers = [];
						for (const AccRoomLover of AccRoom.Lovership) {
							if (AccRoomLover.MemberNumber) {
								TargetLoversNumbers.push(AccRoomLover.MemberNumber);
							}
							else if (AccRoomLover.BeginDatingOfferedByMemberNumber) {
								TargetLoversNumbers.push(AccRoomLover.BeginDatingOfferedByMemberNumber);
							}
							else {
								TargetLoversNumbers.push(-1);
							}
						}
						var TL = TargetLoversNumbers.indexOf(Acc.MemberNumber);

						// If a player wants to accept to start dating (Step 2 / 6)
						if ((Acc.Lovership[AL].BeginDatingOfferedByMemberNumber != null) && (Acc.Lovership[AL].BeginDatingOfferedByMemberNumber == data.MemberNumber)
							&& ((AccRoom.Lovership.length < 5) || (TL >= 0))) {
							if ((data.Action != null) && (data.Action === "Accept")) {
								Acc.Lovership[AL] = { MemberNumber: data.MemberNumber, Name: AccRoom.Name, Start: CommonTime(), Stage: 0 };
								if (TL >= 0) { AccRoom.Lovership[TL] = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 0 }; }
								else { AccRoom.Lovership.push({ MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 0 }); }
								AccountUpdateLovership( Acc.Lovership, Acc.MemberNumber);
								AccountUpdateLovership( AccRoom.Lovership, Acc.Lovership[AL].MemberNumber, AccRoom.Socket);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership[AL].Name, MemberNumber: Acc.Lovership[AL].MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginDating", "ServerMessage", null, Dictionary);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.Lovership[AL].MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginDating" });
						}

						// If the player wants to become one's fiancée (Step 4 / 6)
						if ((Acc.Lovership[AL].Stage != null) && (Acc.Lovership[AL].Stage == 0)
							&& (Acc.Lovership[AL].BeginEngagementOfferedByMemberNumber != null) && (Acc.Lovership[AL].BeginEngagementOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (data.Action === "Accept")) {
								Acc.Lovership[AL] = { MemberNumber: data.MemberNumber, Name: AccRoom.Name, Start: CommonTime(), Stage: 1 };
								AccRoom.Lovership[TL] = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 1 };
								AccountUpdateLovership( Acc.Lovership, Acc.MemberNumber);
								AccountUpdateLovership( AccRoom.Lovership, Acc.Lovership[AL].MemberNumber, AccRoom.Socket);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership[AL].Name, MemberNumber: Acc.Lovership[AL].MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginEngagement", "ServerMessage", null, Dictionary);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.Lovership[AL].MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginEngagement" });
						}

						// If the player wants to become one's wife (Step 6 / 6)
						if ((Acc.Lovership[AL].Stage != null) && (Acc.Lovership[AL].Stage == 1)
							&& (Acc.Lovership[AL].BeginWeddingOfferedByMemberNumber != null) && (Acc.Lovership[AL].BeginWeddingOfferedByMemberNumber == data.MemberNumber)) {
							if ((data.Action != null) && (data.Action === "Accept")) {
								Acc.Lovership[AL] = { MemberNumber: data.MemberNumber, Name: AccRoom.Name, Start: CommonTime(), Stage: 2 };
								AccRoom.Lovership[TL] = { MemberNumber: Acc.MemberNumber, Name: Acc.Name, Start: CommonTime(), Stage: 2 };
								AccountUpdateLovership( Acc.Lovership, Acc.MemberNumber);
								AccountUpdateLovership( AccRoom.Lovership, Acc.Lovership[AL].MemberNumber, AccRoom.Socket);
								var Dictionary = [];
								Dictionary.push({ Tag: "SourceCharacter", Text: Acc.Name, MemberNumber: Acc.MemberNumber });
								Dictionary.push({ Tag: "TargetCharacter", Text: Acc.Lovership[AL].Name, MemberNumber: Acc.Lovership[AL].MemberNumber });
								ChatRoomMessage(Acc.ChatRoom, Acc.MemberNumber, "BeginWedding", "ServerMessage", null, Dictionary);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.MemberNumber);
								ChatRoomSyncCharacter(Acc.ChatRoom, Acc.MemberNumber, Acc.Lovership[AL].MemberNumber);
							} else socket.emit("AccountLovership", { MemberNumber: data.MemberNumber, Result: "CanBeginWedding" });
						}
					}

		}

	}
}

/**
 * Sets a new account difficulty (0 is easy/roleplay, 1 is normal/regular, 2 is hard/hardcore, 3 is very hard/extreme)
 * @param {number} data
 * @param {ServerSocket} socket
 */
function AccountDifficulty(data, socket) {
	if ((data != null) && (typeof data === "number") && (data >= 0) && (data <= 3)) {

		// Gets the current account
		var Acc = AccountGet(socket.id);
		if (Acc != null) {

			// Can only set to 2 or 3 if no change was done for 1 week
			var LastChange = ((Acc.Difficulty == null) || (Acc.Difficulty.LastChange == null) || (typeof Acc.Difficulty.LastChange !== "number")) ? Acc.Creation : Acc.Difficulty.LastChange;
			if ((data <= 1) || (LastChange + DifficultyDelay < CommonTime())) {

				// Updates the account and the database
				var NewDifficulty = { Difficulty: { Level: data, LastChange: CommonTime() } };
				Acc.Difficulty = NewDifficulty.Difficulty;
				//console.log("Updating account " + Acc.AccountName + " difficulty to " + NewDifficulty.Difficulty.Level);
				Database.collection(AccountCollection).updateOne({ AccountName : Acc.AccountName }, { $set: NewDifficulty }, function(err, res) { if (err) throw err; });

			}

		}

	}
}
