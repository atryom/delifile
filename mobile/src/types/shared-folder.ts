export interface SharedFolder {
  id: string;
  name: string;
  owner_id: number;
  parent_id: string | null;
  files_count: number;
  children_count: number;
  is_owner: boolean;
  my_access_type: 'view' | 'edit' | null;
  created_at: string | null;
}

