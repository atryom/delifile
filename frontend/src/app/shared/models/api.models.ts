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

export type FileTypeGroup = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'link' | 'note' | 'other';

export type TaskStatus = 'template' | 'in_progress' | 'under_review' | 'completed';
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

export type ContentKind = 'binary_file' | 'url_file' | 'movie_item';

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
  is_owner?: boolean | null;
  access_type?: AccessType | null;
  // url_file preview fields
  link_url?: string | null;
  link_title?: string | null;
  link_image_url?: string | null;
  link_site_name?: string | null;
  // task fields
  is_task?: boolean;
  task_status?: TaskStatus | null;
  // comment counts
  comments_count?: number;
  unread_comments?: number;
  // access metadata
  is_favorite?: boolean;
  is_pinned?: boolean;
}

export interface FileCard extends FileListItem {
  is_owner: boolean;
  can_share: boolean;
  access_type: AccessType | null;
  is_favorite: boolean;
  is_pinned: boolean;
  folder_id: string | null;
  tags: Tag[];
  owner: UserRef;
  view_url?: string | null;
  versions: FileVersion[];
  // url_file extended fields
  link_description?: string | null;
  // task extended fields
  is_task: boolean;
  task_status: TaskStatus | null;
  task_start_date: string | null;
  task_due_date: string | null;
  task_assigned_user: UserRef | null;
  // movie item
  custom_metadata?: MovieMetadata | null;
}

export interface FileAccess {
  id: string;
  access_type: AccessType;
  user: UserRef | null;
  contact_id?: string | null;
  is_favorite: boolean;
  saved_at: string | null;
  can_edit?: boolean;
  is_pending?: boolean;
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
  created_by: string;
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
  notify_folder_shared: boolean;
  notify_shared_folder_updates: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  notify_support_reply: boolean;
  notify_contacts_added: boolean;
  allow_contacts_without_confirmation: boolean;
  auto_add_received_files: boolean;
  notify_task_assigned: boolean;
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
  notifications_enabled: boolean;
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

export interface Tag {
  id: string;
  name: string;
  files_count?: number;
}

// ─── Shared Folder Models ────────────────────────────────────────────────────

export type SharedFolderAccessType = 'view' | 'edit';

export type FolderType = 'default' | 'gallery' | 'movies';

export interface MovieMetadata {
  kinopoisk_id: number | null;
  title: string | null;
  year: number | null;
  poster_url: string | null;
  rating_kp: number | null;
  genres: string[];
  director: string | null;
  description: string | null;
  kp_url: string | null;
  watched?: boolean | null;
  personal_rating?: number | null;
}

export interface SharedFolder {
  id: string;
  name: string;
  owner_id: number;
  parent_id: string | null;
  folder_type: FolderType;
  files_count: number;
  tasks_count: number;
  children_count: number;
  is_owner: boolean;
  my_access_type: SharedFolderAccessType | null;
  is_private: boolean;
  is_personal_root: boolean;
  sort_order: number | null;
  has_shared_access: boolean;
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
  is_private?: boolean;
  is_task?: boolean;
  task_status?: TaskStatus | null;
  custom_metadata?: MovieMetadata | null;
  owner?: { id: number; name: string | null; email: string } | null;
  likes_count?: number;
  is_liked?: boolean;
  is_favorite?: boolean;
  comments_count?: number;
  unread_comments?: number;
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

// ─── API Token Models ─────────────────────────────────────────────────────────

export interface ApiToken {
  id: string;
  name: string;
  created_at: string | null;
  last_used_at: string | null;
}

// ─── Session Models ──────────────────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  device_name: string;
  device_type: string | null;
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
  notify_folder_shared?: boolean;
  notify_shared_folder_updates?: boolean;
  notify_comments?: boolean;
  notify_mentions?: boolean;
  notify_support_reply?: boolean;
  notify_contacts_added?: boolean;
  allow_contacts_without_confirmation?: boolean;
  auto_add_received_files?: boolean;
  notify_task_assigned?: boolean;
}

// ─── Inbox Models ────────────────────────────────────────────────────────────

export interface InboxFile {
  id: string;
  file_id: string;
  file: {
    id: string;
    original_name: string;
    description: string | null;
    size: number | null;
    mime_type: string | null;
    thumbnail_url: string | null;
  } | null;
  sender: { id: string; email: string; name: string | null } | null;
  received_at: string | null;
}

export interface InboxSharedFolder {
  id: string;
  shared_folder_id: string;
  folder: { id: string; name: string } | null;
  access_type: string;
  inviter: { id: string; email: string; name: string | null } | null;
  received_at: string | null;
}

export interface InboxCount {
  files: number;
  folders: number;
  total: number;
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

// ─── Document / Markdown Editor Models ───────────────────────────────────────

export type LockLostReason = 'LOCK_EXPIRED' | 'LOCK_TAKEN_OVER';

export interface DocumentLock {
  isLocked: boolean;
  lockedBy: { id: number | string; name: string } | null;
  expiresAt: string;
  canTakeOver: boolean;
}

export interface DocumentCapabilities {
  canEdit: boolean;
  canRename: boolean;
  canDelete: boolean;
  canInsertImages: boolean;
  canTakeOverLock: boolean;
}

export interface Document {
  id: string;
  fileName: string;
  mimeType: string;
  isEditable: boolean;
  editorType: string;
  storageKey?: string;
  content: string;
  etag: string | null;
  updatedAt: string | null;
  updatedBy: { id: number | string; name: string } | null;
  lock: DocumentLock | null;
  capabilities: DocumentCapabilities;
}

export interface DocumentSaveResult {
  id: string;
  etag: string;
  updatedAt: string;
  updatedBy: { id: number | string; name: string } | null;
}

export interface ImageAsset {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  previewUrl: string;
  embedUrl: string;
  stableUrl: string;
  updatedAt: string | null;
}

export interface ImageAssetsResponse {
  items: ImageAsset[];
  nextCursor: string | null;
}

// ─── Comment Models ───────────────────────────────────────────────────────────

export type CommentScope = 'shared' | 'private';
export type CommentTargetType = 'file' | 'shared_folder' | 'local_folder';
export type SharedCommentMode = 'enabled' | 'disabled' | 'inherit_for_items';
export type SharedCommentOverride = 'inherit' | 'enabled' | 'disabled';

export interface CommentAuthor {
  id: number;
  name: string;
}

export interface CommentItem {
  id: string;
  thread_id: string;
  parent_comment_id: string | null;
  author: CommentAuthor;
  body: string | null;
  is_deleted: boolean;
  replies_count: number;
  edited_at: string | null;
  created_at: string | null;
  can_edit: boolean;
  can_delete: boolean;
  replies: CommentItem[];
}

export interface CommentThreadSummary {
  id: string;
  comments_count: number;
  unread_count: number;
}

export interface CommentThreadDetail {
  id: string;
  scope: CommentScope;
  comments_count: number;
  unread_count: number;
  items: CommentItem[];
  pagination: { page: number; per_page: number; total: number };
}

export interface CommentPolicy {
  shared_comments_allowed: boolean;
  source?: string;
  shared_comments_mode?: SharedCommentMode | null;
  file_override?: SharedCommentOverride;
  shared_comments_enabled?: boolean;
  can_write_shared: boolean;
  can_write_private: boolean;
  mentions_enabled: boolean;
}

export interface CommentThreadsResponse {
  policy: CommentPolicy;
  threads: {
    shared?: CommentThreadSummary | null;
    private?: CommentThreadSummary | null;
  };
}

export interface FileCommentSettings {
  shared_comments_enabled: boolean;
  shared_comments_override: SharedCommentOverride;
  private_comments_enabled: boolean;
  mentions_enabled: boolean;
}

export interface SharedFolderCommentSettings {
  shared_comments_mode: SharedCommentMode;
  private_comments_enabled: boolean;
  mentions_enabled: boolean;
}


// ─── File Request Models ─────────────────────────────────────────────────────

export type FileRequestStatus = 'pending' | 'fulfilled' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
export type FileRequestFileStatus = 'pending' | 'accepted' | 'rejected';

export interface FileRequestFileItem {
  id: string;
  file_id: string | null;
  status: FileRequestFileStatus;
  sender_name: string | null;
  sender_email: string | null;
  created_at: string | null;
  file: {
    id: string;
    original_name: string;
    size: number;
    mime_type: string | null;
    preview_url: string | null;
  } | null;
}

export interface FileRequestItem {
  id: string;
  url: string;
  description: string;
  status: FileRequestStatus;
  allow_multiple: boolean;
  ttl_hours: number;
  expires_at: string | null;
  fulfilled_at: string | null;
  created_at: string | null;
  sender_name: string | null;
  sender_email: string | null;
  file: {
    id: string;
    original_name: string;
    size: number;
    mime_type: string | null;
    preview_url: string | null;
  } | null;
  files: FileRequestFileItem[];
}

export interface FileRequestResolve {
  status: FileRequestStatus;
  description?: string;
  expires_at?: string | null;
  allow_multiple?: boolean;
  limits?: {
    max_file_size_bytes: number;
  };
}

export interface FileRequestInitUpload {
  original_name: string;
  size: number;
  mime_type: string;
  sender_name?: string;
  sender_email?: string;
}

export type NotificationGroup = 'administrative' | 'access' | 'contacts' | 'other';

export interface AppNotification {
  id: string;
  type: string;
  group: NotificationGroup;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  total: number;
  page: number;
  last_page: number;
}
