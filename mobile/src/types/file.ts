export type FileStatus = 'uploading' | 'available' | 'processing' | 'expired' | 'deleted';
export type ContentKind = 'binary_file' | 'url_file';
export type FileFilter = 'all' | 'mine' | 'received' | 'favorites';
export type AccessType = 'owner' | 'shared' | 'saved';

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
  link_url?: string | null;
  link_title?: string | null;
  link_image_url?: string | null;
  link_site_name?: string | null;
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
