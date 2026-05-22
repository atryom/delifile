export interface DocumentUser {
  id: number;
  email: string;
  name: string | null;
}

export interface DocumentLock {
  isLocked: boolean;
  lockedBy?: DocumentUser;
  expiresAt?: string;
  canTakeOver?: boolean;
}

export interface DocumentCapabilities {
  canEdit: boolean;
  canRename: boolean;
  canDelete: boolean;
  canInsertImages: boolean;
  canTakeOverLock: boolean;
}

export interface MarkdownDocument {
  id: string;
  fileName: string;
  mimeType: string;
  isEditable: boolean;
  editorType: string;
  content: string;
  etag: string;
  updatedAt: string | null;
  updatedBy: DocumentUser | null;
  lock: DocumentLock;
  capabilities: DocumentCapabilities;
}
