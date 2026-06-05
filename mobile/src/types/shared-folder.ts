export type FolderType = 'default' | 'gallery' | 'movies';

export interface SharedFolder {
  id: string;
  name: string;
  owner_id: number;
  parent_id: string | null;
  folder_type: FolderType;
  files_count: number;
  children_count: number;
  is_owner: boolean;
  my_access_type: 'view' | 'edit' | null;
  is_private: boolean;
  is_personal_root: boolean;
  sort_order: number | null;
  has_shared_access: boolean;
  created_at: string | null;
}

export interface SharedFolderLink {
  id: string;
  url: string;
  status: 'active' | 'disabled';
  access_type: 'view' | 'edit';
  allow_save: boolean;
  ttl_hours: number;
  expires_at: string | null;
  created_at: string | null;
}

export interface SharedFolderAccess {
  id: string;
  user_id: number | null;
  contact_id: string | null;
  access_type: 'view' | 'edit';
  user: { id: number; email: string; name: string | null } | null;
}

