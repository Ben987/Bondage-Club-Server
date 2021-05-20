/** Currently connected account */
interface Account {
	/** *not updated from client* */
	AccountName: string;
	/** *not updated from client* */
	MemberNumber: number;
	/** *not updated from client* */
	Name: string;
	/** *not updated from client* */
	Email?: string;
	/** *not updated from client* */
	Password?: string;
	/** *not updated from client* */
	Creation: number;
	/** *not updated from client* */
	LastLogin?: number;
	/** *not updated from client* */
	Environment: "PROD" | "DEV" | string;
	/**
	 * Socket ID
	 *
	 * *not updated from client*
	 */
	ID: string;
	Socket: import("socket.io").Socket;
	/** *not updated from client* */
	ChatRoom?: Chatroom | null;
	Money: number;
	Log?: any;
	/** *not updated from client* */
	Lovership: Lovership[];
	Owner?: any;
	/** *not updated from client* */
	Ownership?: Ownership | null;
	/** *not updated from client* */
	Difficulty?: { Level: number; LastChange: number };
	GhostList?: any;
	BlackList: any[];
	FriendList: any[];
	WhiteList: any[];
	ItemPermission: number;
	Skill?: any;
	Reputation?: any;
	Wardrobe?: any;
	WardrobeCharacterNames?: any;
	ChatSettings?: any;
	VisualSettings?: any;
	AudioSettings?: any;
	GameplaySettings?: any;
	ArousalSettings?: any;
	OnlineSharedSettings?: any;
	Game?: any;
	LabelColor?: any;
	Appearance?: any;
	Description?: any;
	BlockItems?: any[];
	LimitedItems?: any[];
	HiddenItems?: any;
	Title?: any;
	Inventory?: string;
	AssetFamily?: any;
	/** *not updated from client* */
	ActivePose?: any;
	/** *not updated from client* */
	Pose?: any;
	/** *depracated* */
	Lover?: string;
}

interface Lovership {
	MemberNumber?: number;
	Name?: string;
	Stage?: number;
	Start?: number;
	BeginDatingOfferedByMemberNumber?: number;
	BeginEngagementOfferedByMemberNumber?: number;
	BeginWeddingOfferedByMemberNumber?: number;
}

interface Ownership {
	MemberNumber?: number;
	Name?: string;
	Stage?: number;
	Start?: number;
	StartTrialOfferedByMemberNumber?: number;
	EndTrialOfferedByMemberNumber?: number;
}

interface Chatroom {
	ID: string;
	Name: string;
	Description: string;
	Background: string;
	Limit: number;
	Private: boolean;
	Locked: boolean;
	Environment: string;
	Space: string;
	Game: string;
	Creator: string;
	Creation: number;
	Account: Account[];
	Ban: number[];
	BlockCategory: any[];
	Admin: number[];
}
