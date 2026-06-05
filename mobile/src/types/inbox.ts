export interface InboxCount {
  files: number;
  folders: number;
  total: number;
}

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
  access_type: 'view' | 'edit';
  inviter: { id: string; email: string; name: string | null } | null;
  received_at: string | null;
}
