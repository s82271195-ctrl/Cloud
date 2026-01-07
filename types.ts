export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  status?: 'online' | 'offline';
  lastSeen?: number;
  unreadChats?: Record<string, boolean>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'image';
}

export interface ChatSession {
  chatId: string;
  partnerId: string;
  partnerName: string;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount?: number;
}

export const AI_BOT_ID = 'chitchat_ai_assistant';

// WebRTC / Calling Types
export interface CallSignal {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface IncomingCallData {
    callerId: string;
    callerName: string;
    callerPhoto?: string;
    callId: string;
    isVideo: boolean;
    offer: CallSignal;
}

export interface IceCandidateData {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
}