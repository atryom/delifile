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

export type ContentKind = 'binary_file' | 'url_file';

export interface FileListItem {
  id: string;
  content_kind: ContentKind;
  original_name: string;
  size: number;
  mime_type: string | null;
  status: FileStatus;
  expires_at: string | null;
  uploaded_at: string | null;
  preview_url?: string | null;
  // url_file preview fields
  link_url?: string | null;
  link_title?: string | null;
  link_image_url?: string | null;
  link_site_name?: string | null;
}

export interface FileCard extends FileListItem {
  is_owner: boolean;
  access_type: AccessType | null;
  is_favorite: boolean;
  is_pinned: boolean;
  folder_id: string | null;
  tags: Tag[];
  owner: UserRef;
  // url_file extended fields
  link_description?: string | null;
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
  allow_save: boolean;
  expires_at: string | null;
  created_at: string | null;
}

// ─── Contact Models ──────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_registered: boolean;
  resolved_user?: UserRef | null;
}

// ─── User Models ─────────────────────────────────────────────────────────────

export type AccountStatus =
  | 'active'
  | 'pending_email_verification'
  | 'blocked_unverified_email';

export type TariffPlan = 'free' | 'silver' | 'gold';

export interface UserRef {
  id: number;
  email: string;
  name: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  email_verified: boolean;
  account_status: AccountStatus;
  email_verification_deadline_at: string | null;
  plan: TariffPlan | null;
  is_superuser: boolean;
}

// ─── Admin Models ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  account_status: AccountStatus;
  email_verified: boolean;
  plan: TariffPlan | null;
  is_superuser: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface AdminStats {
  total_users: number;
  total_files: number;
  total_size: number;
  pinned_files: number;
  pinned_size: number;
}

// ─── Tariff Models ────────────────────────────────────────────────────────────

export interface TariffPlanInfo {
  key: TariffPlan;
  price_rub: number;
  file_size_mb: number;
  storage_mb: number;
  device_limit: number | null;
}

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
  parent_id: string | null;
  sort_order: number | null;
  files_count: number;
  created_at: string | null;
  children?: FolderTreeNode[];
}

export interface FolderTreeNode {
  id: string;
  name: string;
  sort_order: number | null;
  files_count: number;
  children: FolderTreeNode[];
}

export interface Tag {
  id: string;
  name: string;
  files_count?: number;
}

// ─── Invitation Models ───────────────────────────────────────────────────────

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface Invitation {
  id: string;
  target_email: string;
  status: InvitationStatus;
  file_id: string | null;
  expires_at: string | null;
  created_at: string | null;
}

// ─── Link Preview Models ─────────────────────────────────────────────────────

export interface LinkPreview {
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  hostname: string;
}

// ─── Session Models ──────────────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  device_name: string;
  ip_address: string | null;
  last_active_at: string | null;
}
