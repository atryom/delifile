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
