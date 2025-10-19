export type Participant = { id: string; name: string };
export type ChatMessage = { fromId: string; fromName: string; text: string; ts?: number };


export type RoomState = {
participants: Participant[];
messages: ChatMessage[];
};


export type RoomsStore = Record<string, RoomState>;


// Signaling message types
export type JoinMessage = { type: 'join'; room: string; name?: string };
export type JoinedMessage = { type: 'joined'; id: string };
export type ParticipantsMessage = { type: 'participants'; list: Participant[] };
export type OfferMessage = { type: 'offer'; from: string; to: string; sdp: string };
export type AnswerMessage = { type: 'answer'; from: string; to: string; sdp: string };
export type CandidateMessage = { type: 'candidate'; from: string; to: string; candidate: RTCIceCandidateInit };


export type SignalMessage =
| JoinMessage
| JoinedMessage
| ParticipantsMessage
| OfferMessage
| AnswerMessage
| CandidateMessage;