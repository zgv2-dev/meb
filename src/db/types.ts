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
