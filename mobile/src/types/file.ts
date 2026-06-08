export type FileStatus = 'uploading' | 'available' | 'processing' | 'expired' | 'deleted';
export type ContentKind = 'binary_file' | 'url_file' | 'movie_item';

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
export type FileFilter = 'all' | 'mine' | 'received' | 'favorites';
export type AccessType = 'owner' | 'shared' | 'saved';
export type TaskStatus = 'template' | 'in_progress' | 'under_review' | 'completed';

export interface FileTag {
  id: string;
  name: string;
}

export interface UserRef {
  id: number;
  email: string;
  name: string | null;
}

// Список файлов — только базовые поля
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
  view_url?: string | null;
  link_url?: string | null;
  link_title?: string | null;
  link_image_url?: string | null;
  link_site_name?: string | null;
  custom_metadata?: MovieMetadata | null;
  likes_count?: number;
  is_liked?: boolean;
  comments_count?: number;
}

// Карточка файла — расширенная версия
export interface FileCard extends FileListItem {
  is_owner: boolean;
  access_type: AccessType | null;
  is_favorite: boolean;
  is_pinned: boolean;
  shared_folder_only?: boolean;
  tags: FileTag[];
  owner: UserRef;
  view_url?: string | null;
  versions: FileVersion[];
  link_description?: string | null;
  custom_metadata?: MovieMetadata | null;
  is_task?: boolean;
  task_status?: TaskStatus | null;
  task_start_date?: string | null;
  task_due_date?: string | null;
  task_assigned_user?: UserRef | null;
}

export interface FileAccess {
  id: string;
  access_type: AccessType;
  user: UserRef | null;
  contact_id?: string | null;
  can_edit?: boolean;
  is_pending?: boolean;
}

export interface ShareLink {
  id: string;
  url: string;
  status: 'active' | 'disabled' | 'expired';
  ttl_hours: number;
  allow_save: boolean;
  expires_at: string | null;
  created_at: string | null;
}

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

export interface FileListParams {
  filter?: FileFilter;
  folder_id?: string | null;
  tag_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}
