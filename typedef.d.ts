
/** The type of our sockets */
type ServerSocket = import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents, import("socket.io/dist/typed-events").DefaultEventsMap, never>;

/* Things that are missing from Messages.d.ts */
type AssetGroupName = string;
type ItemColor = string;
type ItemProperties = any;
type CraftingItem = any;
type ActivityName = string;

type Lovership = ServerLovership;

interface Account extends ServerAccountData {
	ID: ServerSocket["id"];
	AccountName: string;
	MemberNumber: number;
	Name: string;
	/* optional on creation, purged from memory */
	Email?: string;
	/* purged from memory */
	Password?: string;
	Creation: number;
	/* purged from memory */
	LastLogin: number;
	Environment: "PROD" | "DEV" | string;
	Socket: ServerSocket;
	ChatRoom?: Chatroom;
	Ownership?: ServerOwnership;
	Lovership: Lovership[];
	DelayedAppearanceUpdate: any;
	DelayedSkillUpdate: any;
	DelayedGameUpdate: ServerChatRoomGame;
	MapData: any;
}

interface Chatroom extends ServerChatRoomData {
	ID: string;
	Environment: string;
	Creator: string;
	CreatorMemberNumber: number;
	Creation: number;
	Account: Account[];
	/**
	 * This is inherited from {@link ServerChatRoomData}, but
	 * provided on-the-fly by the server from {@link Chatroom.Account}
	 */
	Character?: never;
}
