export interface Channel {
  id: number;
  ownerId: number;
  title: string;
  username: string | null;
  description: string;
  lastPostId: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserSettings {
  userId: number;
  activeChannelId: number | null;
  awaitingDescriptionChannelId?: number | null;
  updatedAt: number;
}

export interface AudioQueueItem {
  id: string;
  userId: number;
  channelId: number;
  fileId: string;
  fileUniqueId?: string;
  thumbFileId?: string;
  fileName?: string;
  duration?: number;
  performer?: string;
  title?: string;
  mimeType?: string;
  isVoice?: boolean;
  sourceChatId?: number;
  sourceMessageId?: number;
  queuedAt: number;
}

export interface Track {
  id: string;
  userId: number;
  channelId: number;
  channelTitle: string;
  postId: number;
  postUrl: string;
  fileUniqueId?: string;
  title: string;
  artist: string;
  album: string;
  year: number | null;
  // Artwork from the metadata lookup; thumbFileId (Telegram's embedded cover) is the fallback
  coverUrl: string | null;
  thumbFileId?: string;
  duration?: number;
  isVoice?: boolean;
  createdAt: number;
}
