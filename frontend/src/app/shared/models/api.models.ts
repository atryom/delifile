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

export type FileTypeGroup = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'link' | 'other';
export type SortBy = 'date' | 'extension' | 'size';
export type SortOrder = 'asc' | 'desc';

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  available_type_groups?: FileTypeGroup[];
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

export interface FileVersion {
  id: string;
  version_number: number;
  version_label: string | null;
  comment: string | null;
  original_name: string;
  size: number;
  mime_type: string;
  is_active: boolean;
  preview_url: string | null;
  created_at: string | null;
}

export interface FileListItem {
  id: string;
  content_kind: ContentKind;
  original_name: string;
  display_name: string | null;
  has_versions: boolean;
  size: number;
  mime_type: string | null;
  status: FileStatus;
  expires_at: string | null;
  uploaded_at: string | null;
  folder_id?: string | null;
  description?: string | null;
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
  shared_folder_only?: boolean;
  tags: Tag[];
  owner: UserRef;
  view_url?: string | null;
  versions: FileVersion[];
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
  thumbnail_name?: string;
  thumbnail_size?: number;
  thumbnail_mime?: string;
}

export interface InitUploadResponse {
  file: { id: string; status: FileStatus };
  upload: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  thumbnail?: {
    key: string;
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
  notifications_enabled: boolean;
  notify_new_files: boolean;
  notify_contacts_added: boolean;
  allow_contacts_without_confirmation: boolean;
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

// ─── Shared Folder Models ────────────────────────────────────────────────────

export type SharedFolderAccessType = 'view' | 'edit';

export interface SharedFolder {
  id: string;
  name: string;
  owner_id: number;
  files_count: number;
  is_owner: boolean;
  my_access_type: SharedFolderAccessType | null;
  created_at: string | null;
}

export interface SharedFolderAccess {
  id: string;
  user_id: number | null;
  contact_id: string | null;
  access_type: SharedFolderAccessType;
  user: { id: number; email: string; name: string | null } | null;
}

export interface SharedFolderLink {
  id: string;
  url: string;
  status: ShareLinkStatus;
  access_type: SharedFolderAccessType;
  allow_save: boolean;
  ttl_hours: number;
  expires_at: string | null;
  created_at: string | null;
}

export interface SharedFolderFileItem {
  id: string;
  original_name: string;
  display_name?: string | null;
  has_versions?: boolean;
  content_kind: ContentKind;
  size: number;
  mime_type: string | null;
  status: FileStatus;
  expires_at: string | null;
  uploaded_at: string | null;
  preview_url: string | null;
  view_url?: string | null;
  link_url: string | null;
  link_title: string | null;
  link_image_url: string | null;
  link_site_name: string | null;
  is_owner?: boolean;
  added_by?: number;
  shared_folder_only?: boolean;
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

// ─── Tariff Usage Models ─────────────────────────────────────────────────────

export interface TariffUsage {
  storage_used_bytes: number;
  storage_limit_bytes: number;
  device_count: number;
  device_limit: number | null;
  max_file_size_bytes: number;
  file_size_limit_bytes: number;
}

// ─── Contact Request Models ──────────────────────────────────────────────────

export interface ContactRequestItem {
  id: string;
  requester: { id: number; email: string; name: string | null };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string | null;
}

// ─── User Settings ───────────────────────────────────────────────────────────

export interface UserSettings {
  notifications_enabled?: boolean;
  notify_new_files?: boolean;
  notify_contacts_added?: boolean;
  allow_contacts_without_confirmation?: boolean;
}

// ─── Support Models ───────────────────────────────────────────────────────────

export type SupportTicketStatus =
  | 'new'
  | 'in_progress'
  | 'awaiting_confirmation'
  | 'completed';

export type SuggestionStatus = 'new' | 'accepted';

export interface SupportAttachmentItem {
  id: string;
  original_name: string;
  mime_type: string | null;
  size: number;
}

export interface SupportMessageItem {
  id: string;
  is_admin_message: boolean;
  body: string;
  read_at: string | null;
  created_at: string | null;
  attachments: SupportAttachmentItem[];
}

export interface SupportTicketListItem {
  id: string;
  status: SupportTicketStatus;
  unread_count: number;
  created_at: string | null;
  last_event_at: string | null;
}

export interface SupportTicketDetail {
  id: string;
  status: SupportTicketStatus;
  completion_reason: string | null;
  completed_at: string | null;
  created_at: string | null;
  messages: SupportMessageItem[];
  // admin-only fields
  user?: { id: number; email: string; name: string | null };
  taken_at?: string | null;
  awaiting_at?: string | null;
  confirmed_at?: string | null;
  auto_closed_at?: string | null;
}

export interface SuggestionItem {
  id: string;
  body: string;
  status: SuggestionStatus;
  created_at: string | null;
  attachments: SupportAttachmentItem[];
  user?: { id: number; email: string; name: string | null };
}

export interface SuggestionDetail extends SuggestionItem {
  admin_comments?: { id: string; body: string; created_at: string | null }[];
}
