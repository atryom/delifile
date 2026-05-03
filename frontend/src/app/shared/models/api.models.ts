// ─── Unified API Response Contract ──────────────────────────────────────────
// Matches backend {result, message, data} contract exactly.

export interface ApiResponse<T = Record<string, unknown>> {
  result: 'success' | 'error';
  message: string;
  data: T;
}

export interface ApiError {
  result: 'error';
  message: string;
  data: {
    code: string;
    errors: Record<string, string[]>;
  };
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}

// ─── File Models ─────────────────────────────────────────────────────────────

export type FileStatus =
  | 'uploading'
  | 'available'
  | 'processing'
  | 'expired'
  | 'deleted';

export type AccessType = 'owner' | 'shared' | 'saved';

export interface FileListItem {
  id: string;
  original_name: string;
  size: number;
  mime_type: string;
  status: FileStatus;
  expires_at: string | null;
  uploaded_at: string | null;
}

export interface FileCard extends FileListItem {
  is_owner: boolean;
  access_type: AccessType | null;
  is_favorite: boolean;
  is_pinned: boolean;
  folder_id: string | null;
  tags: Tag[];
  owner: UserRef;
}

export interface FileAccess {
  id: string;
  access_type: AccessType;
  user: UserRef | null;
  is_favorite: boolean;
  saved_at: string | null;
}

// ─── Upload Models ───────────────────────────────────────────────────────────

export interface InitUploadRequest {
  original_name: string;
  size: number;
  mime_type: string;
  checksum?: string;
}

export interface InitUploadResponse {
  file: { id: string; status: FileStatus };
  upload: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
}

export interface CompleteUploadResponse {
  file: { id: string; status: FileStatus };
}

// ─── Share Link Models ───────────────────────────────────────────────────────

export type ShareLinkStatus = 'active' | 'disabled' | 'expired';

export interface ShareLink {
  id: string;
  url: string;
  status: ShareLinkStatus;
  ttl_hours: number;
  expires_at: string | null;
  created_at: string | null;
}

// ─── Contact Models ──────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
  is_registered: boolean;
  resolved_user?: UserRef | null;
}

// ─── User Models ─────────────────────────────────────────────────────────────

export interface UserRef {
  id: number;
  phone: string;
  name: string | null;
}

export interface CurrentUser extends UserRef {}

// ─── Activity Models ─────────────────────────────────────────────────────────

export interface ActivityLog {
  id: string;
  action: string;
  label: string;
  file: { id: string; name: string } | null;
  user: UserRef | null;
  meta: Record<string, unknown>;
  created_at: string | null;
}

// ─── Organization Models ─────────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  files_count: number;
  created_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
  files_count?: number;
}

// ─── Session Models ──────────────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  device_name: string;
  ip_address: string | null;
  last_active_at: string | null;
}
