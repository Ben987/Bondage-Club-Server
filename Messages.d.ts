//#region Main data exchange types

type MemberNumber = number;

interface ServerAccountImmutableData {
	/** Socket ID */
	ID: string;
	MemberNumber: MemberNumber;
	Name: string;
	AccountName: string;
	Creation: number;
	Ownership?: ServerOwnership;
	Lovership?: ServerLovership[];
	ActivePose?: readonly AssetPoseName[];
	Pose?: readonly AssetPoseName[];
}

interface ServerAccountData extends ServerAccountImmutableData {
	Owner?: string;
	/**
	 * @deprecated
	 */
	Lover?: string;
	Money: number;
	Log?: LogRecord[];
	GhostList?: MemberNumber[];
	BlackList: MemberNumber[];
	FriendList: MemberNumber[];
	WhiteList: MemberNumber[];
	ItemPermission: 0 | 1 | 2 | 3 | 4 | 5;
	Skill?: Skill[];
	Reputation?: { Type: ReputationType, Value: number }[];
	Wardrobe?: string;
	WardrobeCharacterNames?: string[];
	ChatSettings?: ChatSettingsType;
	VisualSettings?: VisualSettingsType;
	AudioSettings?: AudioSettingsType;
	GameplaySettings?: GameplaySettingsType;
	ArousalSettings?: ArousalSettingsType;
	OnlineSharedSettings?: CharacterOnlineSharedSettings;
	Game?: CharacterGameParameters;
	LabelColor?: string;
	Appearance?: ServerAppearanceBundle;
	Description?: string;
	BlockItems?: ServerItemPermissionsPacked | ServerItemPermissions[];
	LimitedItems?: ServerItemPermissionsPacked | ServerItemPermissions[];
	FavoriteItems?: ServerItemPermissionsPacked | ServerItemPermissions[];
	HiddenItems?: ServerItemPermissions[];
	Title?: TitleName;
	Nickname?: string;
	Crafting?: string;
	/** String-based values have been deprecated as of BondageProjects/Bondage-College#2138 */
	Inventory?: string | Partial<Record<AssetGroupName, string[]>>;
	InventoryData?: string;
	AssetFamily?: "Female3DCG";
	Infiltration?: InfiltrationType;
	SavedColors?: HSVColor[];
	ChatSearchFilterTerms?: string;
	Difficulty?: { Level: number; LastChange: number };
	MapData?: ChatRoomMapData;
	PrivateCharacter?: ServerPrivateCharacterData[];
	SavedExpressions?: ({ Group: ExpressionGroupName, CurrentExpression?: ExpressionName }[] | null)[];
	ConfiscatedItems?: { Group: AssetGroupName, Name: string }[];
	RoomCreateLanguage?: ServerChatRoomLanguage;
	RoomSearchLanguage?: "" | ServerChatRoomLanguage;
	LastMapData?: null | ChatRoomMapData;
	// Unfortunately can't @deprecated individual union members
	/** String-based values have been deprecated and are superseded by {@link ServerChatRoomSettings} objects */
	LastChatRoom?: null | ServerChatRoomSettings | string;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomDesc?: string;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomAdmin?: string;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomBan?: string;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomBG?: string;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomSize?: number;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomPrivate?: boolean;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomBlockCategory?: ServerChatRoomBlockCategory[];
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomSpace?: ServerChatRoomSpace;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomLanguage?: ServerChatRoomLanguage;
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomCustom?: ServerChatRoomData["Custom"];
	/** @deprecated superseded by the {@link ServerAccountData.LastChatRoom} object */
	LastChatRoomMapData?: ServerChatRoomMapData;
	ControllerSettings?: ControllerSettingsType;
	ImmersionSettings?: ImmersionSettingsType;
	RestrictionSettings?: RestrictionSettingsType;
	OnlineSettings?: PlayerOnlineSettings;
	GraphicsSettings?: GraphicsSettingsType;
	NotificationSettings?: NotificationSettingsType;
	GenderSettings?: GenderSettingsType;
	ExtensionSettings?: ExtensionSettings;
	FriendNames?: string;
	SubmissivesList?: string;
	KinkyDungeonExploredLore?: unknown[];
}

// TODO: Add `Lover` after figuring out why {@link ServerPlayerSync} still passes this field to the server
/** A union of all deprecated {@link ServerAccountData} fields */
type ServerAccountDataDeprecations = (
	"LastChatRoomDesc"
	| "LastChatRoomAdmin"
	| "LastChatRoomBan"
	| "LastChatRoomBG"
	| "LastChatRoomSize"
	| "LastChatRoomPrivate"
	| "LastChatRoomBlockCategory"
	| "LastChatRoomSpace"
	| "LastChatRoomLanguage"
	| "LastChatRoomCustom"
	| "LastChatRoomMapData"
);

/**
 * A {@link ServerAccountData} variant with all deprecated members set to `never`.
 *
 * Use of this type over {@link ServerAccountData} is recommended when sending data *to* the server.
 */
type ServerAccountDataNoDeprecated = ServerAccountData & { [k in ServerAccountDataDeprecations]?: never } & {
	// Fields with one or more deprecated union members removed
	LastChatRoom?: null | ServerChatRoomSettings;
	Inventory?: Partial<Record<AssetGroupName, string[]>>;
};

/**
 * A struct for representing an item with special permissions (limited, favorited, etc) in the server.
 * @see {@link ServerItemPermissionsPacked}
 */
interface ServerItemPermissions {
	/** The {@link Asset.Name} of the item */
	Name: string;
	/** The {@link AssetGroup.Name} of the item */
	Group: AssetGroupName;
	/**
	 * Either the item's {@link ItemProperties.Type} or, in the case of modular items,
	 * a substring thereof denoting the type of a single module
	 */
	Type?: string | null;
}

/** A packed record-based version of {@link ServerItemPermissions}. */
type ServerItemPermissionsPacked = Partial<Record<AssetGroupName, Record<string, (undefined | null | string)[]>>>;

interface ServerMapDataResponse {
	MemberNumber: number;
	MapData: ChatRoomMapPos;
}

type ServerAccountDataSynced = Omit<ServerAccountData, "Money" | "FriendList" | "AccountName">;

interface ServerOwnership {
	MemberNumber?: number;
	Name?: string;
	Stage?: number;
	Start?: number;
	StartTrialOfferedByMemberNumber?: number;
	EndTrialOfferedByMemberNumber?: number;
}

interface ServerLovership {
	MemberNumber?: number;
	Name?: string;
	Stage?: number;
	Start?: number;
	BeginDatingOfferedByMemberNumber?: number;
	BeginEngagementOfferedByMemberNumber?: number;
	BeginWeddingOfferedByMemberNumber?: number;
}

/** An ItemBundle is a minified version of the normal Item */
interface ServerItemBundle {
	Group: AssetGroupName;
	Name: string;
	Difficulty?: number;
	Color?: ItemColor;
	Property?: ItemProperties;
	Craft?: CraftingItem;
}

interface ServerPrivateCharacterData {
	Name: string;
	Love: number;
	Title: TitleName;
	Trait: NPCTrait[];
	Cage: boolean;
	Owner: string;
	Lover: string;
	AssetFamily: "Female3DCG";
	Appearance: ServerAppearanceBundle;
	AppearanceFull: ServerAppearanceBundle;
	ArousalSettings: ArousalSettingsType;
	Event: NPCTrait[];
	FromPandora?: boolean;
}

/** An AppearanceBundle is whole minified appearance of a character */
type ServerAppearanceBundle = ServerItemBundle[];

type ServerChatRoomSpace = "X" | "" | "M" | "Asylum";
type ServerChatRoomLanguage = "EN" | "DE" | "FR" | "ES" | "CN" | "RU" | "UA";
type ServerChatRoomGame = "" | "ClubCard" | "LARP" | "MagicBattle" | "GGTS";
type ServerChatRoomBlockCategory =
	/** Those are known as AssetCategory to the client */
	"Medical" | "Extreme" | "Pony" | "SciFi" | "ABDL" | "Fantasy" |
	/** Those are room features */
	"Leashing" | "Photos" | "Arousal";



/**
 * The chatroom data received from the server
 */
type ServerChatRoomData = {
	Name: string;
	Description: string;
	Admin: number[];
	Whitelist: number[];
	Ban: number[];
	Background: string;
	/* FIXME: server actually expects a string there, but we cheat to make the typing simpler */
	Limit: number;
	Game: ServerChatRoomGame;
	Locked: boolean;
	Private: boolean;
	BlockCategory: ServerChatRoomBlockCategory[];
	Language: ServerChatRoomLanguage;
	Space: ServerChatRoomSpace;
	MapData?: ServerChatRoomMapData;
	Custom: ServerChatRoomCustomData;
	Character: ServerAccountDataSynced[];
}

interface ServerChatRoomMapData {
	Type: string;
	Fog?: boolean;
	Tiles: string;
	Objects: string;
}

interface ServerChatRoomCustomData {
	ImageURL?: string;
	ImageFilter?: string;
	MusicURL?: string;
	SizeMode?: number
}

/**
 * A chatroom's settings
 *
 * Define to `never` any property of {@link ServerChatRoomData} that
 * shouldn't be sent back to the server.
 */
type ServerChatRoomSettings = Partial<ServerChatRoomData> & {
	Character?: never;
}

//#endregion

//#region Requests & Responses

type ServerLoginResponse = "InvalidNamePassword" | Partial<ServerAccountData>;

type ServerLoginQueueResponse = number;

interface ServerAccountLoginRequest {
	AccountName: string;
	Password: string;
}

interface ServerAccountCreateRequest {
    Name: string;
    AccountName: string;
    Password: string;
    Email: string;
}

interface ServerAccountCreateResponseSuccess {
    ServerAnswer: "AccountCreated";
    OnlineID: string;
    MemberNumber: number;
}

type ServerAccountCreateResponse = ServerAccountCreateResponseSuccess | "Account already exists" | "Invalid account information" | "New accounts per day exceeded";

type ServerPasswordResetRequest = string;

interface ServerPasswordResetProcessRequest {
	AccountName: string;
	ResetNumber: string;
	NewPassword: string;
}

type ServerPasswordResetResponse = "RetryLater" | "EmailSentError" | "EmailSent" | "NoAccountOnEmail" | "PasswordResetSuccessful" | "InvalidPasswordResetInfo";

interface ServerInfoMessage {
    Time: number;
    OnlinePlayers: number;
}

type ServerForceDisconnectMessage = "ErrorRateLimited" | "ErrorDuplicatedLogin";

interface ServerAccountUpdateRequest extends Partial<ServerAccountDataNoDeprecated> {}

interface ServerAccountUpdateEmailRequest {
	EmailOld: string;
	EmailNew: string;
}

interface ServerFriendInfo {
    Type: "Friend" | "Submissive" | "Lover";
    MemberNumber: number;
    MemberName: string;
    ChatRoomSpace?: ServerChatRoomSpace | null;
    ChatRoomName?: string | null;
    Private?: true | undefined;
}

interface ServerAccountQueryRequest {
	Query: "EmailStatus" | "EmailUpdate" | "OnlineFriends";
}

interface ServerAccountQueryEmailStatus {
    Query: "EmailUpdate" | "EmailStatus";
    Result: boolean;
}

interface ServerAccountQueryOnlineFriends {
    Query: "OnlineFriends";
    Result: ServerFriendInfo[];
}

type ServerAccountQueryResponse = ServerAccountQueryEmailStatus | ServerAccountQueryOnlineFriends;


interface ServerAccountLovershipRefreshRequest {
	MemberNumber: number;
	Action?: never;
	Name?: never;
}

interface ServerAccountLovershipUpdateRequest {
	MemberNumber: number;
	Action: "Propose" | "Accept" | "Release";
	Name?: never;
}

interface ServerAccountLovershipBreakupRequest {
	MemberNumber: number;
	Action: "Break";
	Name?: never;
}

interface ServerAccountLovershipBreakupNPCRequest {
	MemberNumber: -1;
	Action: "Break";
	Name: string;
}

type ServerAccountLovershipRequest = ServerAccountLovershipRefreshRequest | ServerAccountLovershipUpdateRequest | ServerAccountLovershipBreakupRequest | ServerAccountLovershipBreakupNPCRequest;

interface ServerAccountLovershipStatus {
    MemberNumber: number;
    Result: "CanOfferBeginDating" | "CanBeginDating" | "CanOfferBeginEngagement" | "CanBeginEngagement" | "CanOfferBeginWedding" | "CanBeginWedding";
}

interface ServerAccountLovershipInfo {
    Lovership: ServerLovership[];
}

interface ServerAccountLovershipComplete {
    Lovership: ServerLovership;
}

type ServerAccountLovershipResponse = ServerAccountLovershipStatus | ServerAccountLovershipInfo | ServerAccountLovershipComplete;

interface ServerAccountOwnershipRequest {
	MemberNumber: number;
	Action?: "Propose" | "Accept" | "Release" | "Break";
}

interface ServerAccountOwnershipStatus {
    MemberNumber: number;
    Result: "CanOfferStartTrial" | "CanStartTrial" | "CanOfferEndTrial" | "CanEndTrial";
}

interface ServerAccountOwnershipClear {
    ClearOwnership: true
}

interface ServerAccountOwnershipComplete {
    Ownership: ServerOwnership;
    Owner: string;
}

type ServerAccountOwnershipResponse = ServerAccountOwnershipClear | ServerAccountOwnershipStatus | ServerAccountOwnershipComplete;

type ServerBeepType = string;

type ServerAccountBeepRequest = {
	MemberNumber: number;
	BeepType: ServerBeepType;
	Message?: string;
	IsSecret?: boolean;
}

type ServerAccountBeepResponse = {
    MemberNumber: number;
    MemberName: string;
    ChatRoomSpace: ServerChatRoomSpace;
    ChatRoomName: string;
    Private: boolean;
    BeepType: ServerBeepType;
    Message: string;
};

interface ServerChatRoomSearchRequest {
    Query: string;
    Space?: ServerChatRoomSpace[] | ServerChatRoomSpace;
    Game?: ServerChatRoomGame;
    FullRooms?: boolean;
    Ignore?: string[];
    Language: string;
    SearchDescs?: boolean;
}

interface ServerChatRoomSearchData {
    Name: string;
    Language: string;
    Creator: string;
    CreatorMemberNumber: number;
    MemberCount: number;
    MemberLimit: number;
    Description: string;
    BlockCategory: string[];
    Game: ServerChatRoomGame;
    Friends: ServerFriendInfo[];
    Space: ServerChatRoomSpace;
	MapType?: string;
}

type ServerChatRoomSearchResultResponse = ServerChatRoomSearchData[];

interface ServerChatRoomCreateRequest extends ServerChatRoomSettings {}

type ServerChatRoomCreateResponse = "AccountError" | "RoomAlreadyExist" | "InvalidRoomData" | "ChatRoomCreated";

interface ServerChatRoomAdminUpdateRequest {
	MemberNumber: number;
	Action: "Update";
	Room: Partial<ServerChatRoomSettings>;
}

interface ServerChatRoomAdminMoveRequest {
	MemberNumber: number;
	Action: "Move" | "MoveLeft" | "MoveRight" | "Kick" | "Ban" | "Unban" | "Promote" | "Demote" | "Whitelist" | "Unwhitelist" | "Shuffle";
	Publish?: boolean;
}

interface ServerChatRoomAdminSwapRequest {
	MemberNumber: number;
	Action: "Swap";
	TargetMemberNumber: number;
	DestinationMemberNumber: number;
}

type ServerChatRoomAdminRequest = ServerChatRoomAdminUpdateRequest | ServerChatRoomAdminMoveRequest | ServerChatRoomAdminSwapRequest;

type ServerChatRoomSearchResponse = "JoinedRoom" | "AlreadyInRoom" | "RoomLocked" | "RoomBanned" | "RoomKicked" | "RoomFull" | "CannotFindRoom" | "AccountError" | "InvalidRoomData";

/** Base interface for a chat message */
interface ServerChatRoomMessageBase {
	/** The sender number. Provided by the server to the client, ignored otherwise. */
    Sender?: number;
}

interface ServerChatRoomJoinRequest {
	/** The name of the chatroom to join */
	Name: string;
}

interface ServerChatRoomSyncMessage extends ServerChatRoomData {
	Character: ServerAccountDataSynced[];
	SourceMemberNumber: number;
}

interface ServerChatRoomSyncPropertiesMessage extends Omit<ServerChatRoomData, "Character"> {
	SourceMemberNumber: number;
}

type ServerChatRoomMessageType = "Action" | "Chat" | "Whisper" | "Emote" | "Activity" | "Hidden" |
	"LocalMessage" | "ServerMessage" | "Status";
type ServerChatRoomMessageContentType = string;

type CharacterReferenceTag =
	| "SourceCharacter"
	| "DestinationCharacter"
	| "DestinationCharacterName"
	| "TargetCharacter"
	| "TargetCharacterName"

type CommonChatTags =
	| CharacterReferenceTag
	| "AssetName"
	| "Automatic";

/**
 * A dictionary entry containing a replacement tag to be replaced by some value. The replacement strategy depends on
 * the type of dictionary entry.
 */
interface TaggedDictionaryEntry {
	/** The tag that will be replaced in the message */
	Tag: string;
}

/**
 * A dictionary entry used to reference a character. The character reference tag will be replaced with the provided
 * character's name or pronoun. The display format will depend on the tag chosen.
 * Example substitutions for each tag (assuming the character name is Ben987):
 * * SourceCharacter: "Ben987"
 * * DestinationCharacter: "Ben987's" (if character is not self), "her"/"him" (if character is self)
 * * DestinationCharacterName: "Ben987's"
 * * TargetCharacter: "Ben987" (if character is not self), "herself"/"himself" (if character is self)
 * * TargetCharacterName: "Ben987"
 * @deprecated Use {@link SourceCharacterDictionaryEntry} and {@link TargetCharacterDictionaryEntry} instead.
 */
interface CharacterReferenceDictionaryEntry extends TaggedDictionaryEntry {
	/** The member number of the referenced character */
	MemberNumber: number;
	/** The character reference tag, determining how the character's name or pronoun will be interpreted */
	Tag: CharacterReferenceTag;
	/**
	 * The nickname of the referenced character
	 * @deprecated Redundant information
	 */
	Text?: string;
}

/**
 * A dictionary entry used to indicate the source character of a chat message or action (i.e. the character initiating
 * the message or action).
 */
interface SourceCharacterDictionaryEntry {
	SourceCharacter: number;
}

/**
 * A dictionary entry used to indicate the target character of a chat message or action (i.e. the character that is
 * being acted upon as part of the message or action).
 */
interface TargetCharacterDictionaryEntry {
	TargetCharacter: number;
	Index?: number;
}

/**
 * A dictionary entry which indicates the focused group. This represents the group that was focused or interacted with
 * when sending a chat message. For example, if the message was caused by performing an activity or modifying an item
 * on the `ItemArms` group, then it would be appropriate to send this dictionary entry with `ItemArms` as the focus
 * group name.
 */
interface FocusGroupDictionaryEntry {
	/**
	 * The tag to be replaced - this is always FocusAssetGroup.
	 * @deprecated Redundant information.
	 */
	Tag?: "FocusAssetGroup";
	/** The group name representing focused group for the purposes of the sent message */
	FocusGroupName: AssetGroupName;
}

/**
 * A direct text substitution dictionary entry. Any occurrences of the given {@link Tag} string in the associated
 * message will be directly replaced with the {@link Text} from this dictionary entry (no text lookup will be done).
 * For example, given the message:
 * ```
 * Life is like a box of ConfectionaryName.
 * ```
 * and the {@link TextDictionaryEntry}:
 * ```js
 * {Tag: "ConfectionaryName", Text: "chocolates"}
 * ```
 * The resulting message would be:
 * ```
 * Life is like a box of chocolates.
 * ```
 */
interface TextDictionaryEntry extends TaggedDictionaryEntry {
	/** The text that will be substituted for the tag */
	Text: string;
}

/**
 * A text substitution dictionary entry with text lookup functionality. Any occurrences of the given {@link Tag} string
 * in the associated message will be replaced with the {@link Text} from the dictionary entry, but only after a text
 * lookup has been done on the {@link Text}, meaning that if the text has localisations, the localised version will be
 * used. The text will be looked up against `Dialog_Player.csv`.
 * For example, given the message:
 * ```
 * Hello, {GreetingObjectName}!
 * ```
 * And the {@link TextLookupDictionaryEntry}:
 * ```js
 * {Tag: "GreetingObjectName", TextToLookup: "WorldObject"}
 * ```
 * And the following in `Dialog_Player.csv`:
 * ```
 * WorldObject,,,World,,
 * ```
 * The text to lookup (`"WorldObject"`) would be looked up against `Dialog_Player.csv`, resolving to `"World"`. This
 * would then be used to replace the tag `"GreetingObjectName"` in the message, resulting in:
 * ```
 * Hello, World!
 * ```
 */
interface TextLookupDictionaryEntry extends TaggedDictionaryEntry {
	/** The text whose lookup will be substituted for the tag */
	TextToLookUp: string;
}

/**
 * A dictionary entry that references an asset group. Note that this is different from
 * {@link FocusGroupDictionaryEntry}, which denotes the group being acted on. A dictionary should only ever contain
 * one {@link FocusGroupDictionaryEntry}, whereas it may contain many {@link GroupReferenceDictionaryEntry}s. This
 * represents any group that might be referenced in the message, but is not necessarily the focused group.
 * For example, given the message:
 * ```
 * Use your BodyPart!
 * ```
 * And the {@link GroupReferenceDictionaryEntry}:
 * ```
 * {Tag: "BodyPart", GroupName: "ItemHands"}
 * ```
 * The name of the `"ItemHands"` group would be looked up, and this would be used to replace the `"BodyPart"` tag. The
 * resulting message would be:
 * ```
 * Use your Hands!
 * ```
 */
interface GroupReferenceDictionaryEntry extends TaggedDictionaryEntry {
	/** The name of the asset group to reference */
	GroupName: AssetGroupName;
}

/**
 * A dictionary entry that references an asset. Note that a dictionary may contain multiple of these entries, one for
 * each asset mentioned or referenced in the message. For example, a message when swapping two restraints might contain
 * two of these entries, one for the restraint being removed, and one for the restraint being added.
 */
interface AssetReferenceDictionaryEntry extends GroupReferenceDictionaryEntry {
	/** The name of the asset being referenced */
	AssetName: string;
	/** The (optional) {@link CraftingItem.Name} in case the asset was referenced via a crafted item */
	CraftName?: string;
}

/**
 * A special instance of an {@link AssetReferenceDictionaryEntry} which indicates that this asset was used to carry
 * out an activity.
 */
interface ActivityAssetReferenceDictionaryEntry extends AssetReferenceDictionaryEntry {
	Tag: "ActivityAsset";
}

/**
 * A metadata dictionary entry sent with a shock event message including a shock intensity representing the strength
 * of the shock. This is used to determine the severity of any visual or gameplay effects the shock may have.
 */
interface ShockEventDictionaryEntry {
	/** The intensity of the shock - must be a non-negative number */
	ShockIntensity: number;
}

/**
 * A metadata dictionary entry sent with a shock event message including a shock intensity representing the strength
 * of the shock. This is used to determine the severity of any visual or gameplay effects the shock may have.
 */
interface SuctionEventDictionaryEntry {
	/** The intensity of the suction - must be a non-negative number */
	SuctionLevel: number;
}

/**
 * A metadata dictionary entry indicating that the message has been generated due to an automated event. Can be used
 * to filter out what might otherwise be spammy chat messages (these include things like automatic vibrator intensity
 * changes and events & messages triggered by some futuristic items).
 */
interface AutomaticEventDictionaryEntry {
	/** Indicates that this message was triggered by an automatic event */
	Automatic: true;
}

/**
 * A metadata dictionary entry carrying a numeric counter for an associated event or activity. Currently only used by
 * the Anal Beads XL to indicate how many beads were inserted.
 */
interface ActivityCounterDictionaryEntry {
	/** Counter metadata to be sent with a message */
	ActivityCounter: number;
}

/**
 * A dictionary entry for group lookup & replacement. Used ambiguously for both {@link FocusGroupDictionaryEntry} and
 * {@link GroupReferenceDictionaryEntry}. This dictionary entry type is deprecated, and one of the aforementioned entry
 * types should be used instead.
 * @deprecated Use {@link FocusGroupDictionaryEntry}/{@link GroupReferenceDictionaryEntry}
 */
interface AssetGroupNameDictionaryEntry {
	Tag?: "FocusAssetGroup";
	AssetGroupName: AssetGroupName;
}

/**
 * A dictionary entry indicating the name of an activity. Sent with chat messages to indicate that an activity was
 * carried out as part of the message.
 */
interface ActivityNameDictionaryEntry {
	/** The name of the activity carried out */
	ActivityName: ActivityName;
}

/**
 * A dictionary entry with metadata about the chat message transmitted.
 *
 * Send with Chat and Whisper-type messages to inform the other side about the
 * garbling and potentially ungarbled string if provided.
 */
interface MessageEffectEntry {
	Effects: SpeechTransformName[];
	Original: string;
}

type ChatMessageDictionaryEntry =
	| CharacterReferenceDictionaryEntry
	| SourceCharacterDictionaryEntry
	| TargetCharacterDictionaryEntry
	| FocusGroupDictionaryEntry
	| TextDictionaryEntry
	| TextLookupDictionaryEntry
	| GroupReferenceDictionaryEntry
	| AssetReferenceDictionaryEntry
	| ActivityAssetReferenceDictionaryEntry
	| ShockEventDictionaryEntry
	| SuctionEventDictionaryEntry
	| AutomaticEventDictionaryEntry
	| ActivityCounterDictionaryEntry
	| AssetGroupNameDictionaryEntry
	| ActivityNameDictionaryEntry
	| MessageEffectEntry;

type ChatMessageDictionary = ChatMessageDictionaryEntry[];

interface ServerChatRoomMessage extends ServerChatRoomMessageBase {
	/** The character to target the message at. null means it's broadcast to the room. */
	Target?: number;
	Content: ServerChatRoomMessageContentType;
	Type: ServerChatRoomMessageType;
	Dictionary?: ChatMessageDictionary;
	Timeout?: number;
}

interface ServerChatRoomGameStart {
	GameProgress: "Start" | "Next" | "Stop" | "Skip";
}

interface ServerChatRoomGameMagicBattleUpdateRequest {
	GameProgress: "Action";
	Action:
		/* MagicBattle */ "SpellSuccess" | "SpellFail" |
		/* LARP */  "Pass" | "Seduce" | "Struggle" | "Hide" | "Cover" |
					"Strip" | "Tighten" | "RestrainArms" | "RestrainLegs" | "RestrainMouth" |
					"Silence" | "Immobilize" | "Detain" | "Dress" | "Costume"
				;
	Spell: number;
	Time: number;
	Target: number;
}

interface ServerChatRoomGameLARPUpdateRequest {
	GameProgress: "Action";
	Action: "Pass" | "Seduce" | "Struggle" | "Hide" | "Cover" |
		"Strip" | "Tighten" | "RestrainArms" | "RestrainLegs" | "RestrainMouth" |
		"Silence" | "Immobilize" | "Detain" | "Dress" | "Costume"

		| "";
	Item?: string;
	Target: number;
}

interface ServerChatRoomGameBountyUpdateRequest {
	OnlineBounty: {
		finishTime: number,
		target: number,
	}
}

interface ServerChatRoomGameKDUpdateRequest {
	KinkyDungeon: any;
}

interface ServerChatRoomGameCardGameQueryRequest {
	GameProgress: "Query";
	CCData?: any;
	Player1?: number;
	Player2?: number;
}

interface ServerChatRoomGameCardGameStartRequest {
	GameProgress: "Start";
	Player1: number;
	Player2: number;
}

type ServerChatRoomGameCardGameActionRequest = { GameProgress: "Action" } & ({ CCLog: string } | { CCData: any });

type ServerChatRoomGameCardGameUpdateRequest = ServerChatRoomGameCardGameStartRequest | ServerChatRoomGameCardGameQueryRequest | ServerChatRoomGameCardGameActionRequest;

type ServerChatRoomGameUpdateRequest =
	| ServerChatRoomGameStart
	| ServerChatRoomGameMagicBattleUpdateRequest
	| ServerChatRoomGameLARPUpdateRequest
	| ServerChatRoomGameBountyUpdateRequest
	| ServerChatRoomGameKDUpdateRequest
	| ServerChatRoomGameCardGameUpdateRequest;

interface ServerChatRoomGameResponse extends ServerChatRoomMessageBase {
    Data: {
		KinkyDungeon?: any;
		OnlineBounty?: any;
		/* LARP */
		GameProgress?: "Start" | "Stop" | "Next" | "Skip" | "Action" | "Query";
		Action?: undefined;
		Target?: number;
		Item?: string;

		/* MagicBattle */
		Spell?: string;
		Time?: number; /* ms */

		/* Club Card */
		Player1?: number;
		Player2?: number;
		CCData: [any];
		CCLog: string;
	};
    RNG: number;
}

interface ServerChatRoomSyncCharacterResponse {
	SourceMemberNumber: number;
	Character: ServerAccountDataSynced;
}

interface ServerChatRoomSyncMemberJoinResponse {
    SourceMemberNumber: number;
    Character: ServerChatRoomSyncCharacterResponse["Character"],
    WhiteListedBy: number[];
    BlackListedBy: number[]
}

interface ServerChatRoomLeaveResponse {
    SourceMemberNumber: number;
}

interface ServerChatRoomReorderResponse {
    PlayerOrder: number[];
}

interface ServerCharacterUpdate {
	ID: string;
	ActivePose: readonly string[];
	Appearance: ServerAppearanceBundle;
}

interface ServerCharacterExpressionUpdate {
	Name: string;
	Group: string;
	Appearance: ServerAppearanceBundle;
}

interface ServerCharacterExpressionResponse {
    MemberNumber: number;
    Name: string;
    Group: string
}

interface ServerCharacterPoseUpdate {
	Pose: string | readonly string[] | null;
}

interface ServerCharacterPoseResponse {
    MemberNumber: number;
    Pose: readonly string[];
}

interface ServerCharacterArousalUpdate {
    OrgasmTimer: number;
    OrgasmCount: number;
    Progress: number;
    ProgressTimer: number;
}

interface ServerCharacterArousalResponse {
    MemberNumber: number;
    OrgasmTimer: number;
    OrgasmCount: number;
    Progress: number;
    ProgressTimer: number;
}

interface ServerCharacterItemUpdate {
	Target: number;
	Group: string;
	Name?: string;
	Color: string | string[];
	Difficulty: number;
	Property: any;
	Craft: any;
}

interface ServerChatRoomSyncItemResponse {
    Source: number;
    Item: any;
}

type ServerChatRoomUpdateResponse = "RoomAlreadyExist" | "Updated" | "InvalidRoomData";

interface ServerChatRoomAllowItemRequest {
	MemberNumber: number;
}

interface ServerChatRoomAllowItemResponse {
    MemberNumber: number;
    AllowItem: boolean;
}

//#endregion

//#region Socket.io defines

interface ServerToClientEvents {
	ServerInfo: (data: ServerInfoMessage) => void;
	ServerMessage: (data: string) => void;
	ForceDisconnect: (data: ServerForceDisconnectMessage) => void;

	CreationResponse: (data: ServerAccountCreateResponse) => void;

	PasswordResetResponse: (data: ServerPasswordResetResponse) => void;

	LoginResponse: (data: ServerLoginResponse) => void;
	LoginQueue: (data: ServerLoginQueueResponse) => void;

	AccountQueryResult: (data: ServerAccountQueryResponse) => void;
	AccountLovership: (data: ServerAccountLovershipResponse) => void;
	AccountOwnership: (data: ServerAccountOwnershipResponse) => void;
	AccountBeep: (data: ServerAccountBeepResponse) => void;

	ChatRoomSearchResult: (data: ServerChatRoomSearchResultResponse) => void;
	ChatRoomCreateResponse: (data: ServerChatRoomCreateResponse) => void;
	ChatRoomSearchResponse: (data: ServerChatRoomSearchResponse) => void;

	ChatRoomMessage: (data: ServerChatRoomMessage) => void;
	ChatRoomGameResponse: (data: ServerChatRoomGameResponse) => void;
	ChatRoomSync: (data: ServerChatRoomSyncMessage) => void;
	ChatRoomSyncCharacter: (data: ServerChatRoomSyncCharacterResponse) => void;
	ChatRoomSyncMemberJoin: (data: ServerChatRoomSyncMemberJoinResponse) => void;
	ChatRoomSyncMemberLeave: (data: ServerChatRoomLeaveResponse) => void;
	ChatRoomSyncRoomProperties: (data: ServerChatRoomSyncPropertiesMessage) => void;
	ChatRoomSyncReorderPlayers: (data: ServerChatRoomReorderResponse) => void;
	ChatRoomSyncSingle: (data: ServerChatRoomSyncCharacterResponse) => void;
	ChatRoomSyncExpression: (data: ServerCharacterExpressionResponse) => void;
	ChatRoomSyncPose: (data: ServerCharacterPoseResponse) => void;
	ChatRoomSyncArousal: (data: ServerCharacterArousalResponse) => void;
	ChatRoomSyncItem: (data: ServerChatRoomSyncItemResponse) => void;
	ChatRoomSyncMapData: (data: ServerMapDataResponse) => void;

	ChatRoomUpdateResponse: (data: ServerChatRoomUpdateResponse) => void;

	ChatRoomAllowItem: (data: ServerChatRoomAllowItemResponse) => void;

}

interface ClientToServerEvents {
	AccountLogin: (data: ServerAccountLoginRequest) => void;
	AccountCreate: (data: ServerAccountCreateRequest) => void;
	PasswordReset: (Email: ServerPasswordResetRequest) => void;
	PasswordResetProcess: (data: ServerPasswordResetProcessRequest) => void;

	// Post-login events
	AccountUpdate: (data: ServerAccountUpdateRequest) => void;
	AccountUpdateEmail: (data: ServerAccountUpdateEmailRequest) => void;
	AccountQuery: (data: ServerAccountQueryRequest) => void;
	AccountBeep: (data: ServerAccountBeepRequest) => void;
	AccountOwnership: (data: ServerAccountOwnershipRequest) => void;
	AccountLovership: (data: ServerAccountLovershipRequest) => void;
	AccountDifficulty: (level: number) => void;
	AccountDisconnect: (data: never) => void;

	ChatRoomSearch: (data: ServerChatRoomSearchRequest) => void;
	ChatRoomCreate: (data: ServerChatRoomCreateRequest) => void;
	ChatRoomJoin: (data: ServerChatRoomJoinRequest) => void;
	ChatRoomLeave: (data: "") => void;
	ChatRoomChat: (data: ServerChatRoomMessage) => void;

	ChatRoomCharacterUpdate: (data: ServerCharacterUpdate) => void;
	ChatRoomCharacterExpressionUpdate: (data: ServerCharacterExpressionUpdate) => void;
	ChatRoomCharacterPoseUpdate: (data: ServerCharacterPoseUpdate) => void;
	ChatRoomCharacterArousalUpdate: (data: ServerCharacterArousalUpdate) => void;
	ChatRoomCharacterItemUpdate: (data: ServerCharacterItemUpdate) => void;
	ChatRoomCharacterMapDataUpdate: (data: ChatRoomMapPos) => void;

	ChatRoomAdmin: (data: ServerChatRoomAdminRequest) => void;
	ChatRoomAllowItem: (data: ServerChatRoomAllowItemRequest) => void;

	ChatRoomGame: (data: ServerChatRoomGameUpdateRequest) => void;
}

//#endregion
