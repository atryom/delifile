export type CommentTargetType = 'file' | 'shared_folder' | 'local_folder';
export type CommentScope = 'shared' | 'private';

export interface CommentAuthor {
  id: number;
  name: string;
}

export interface Comment {
  id: string;
  thread_id: string;
  parent_comment_id: string | null;
  author: CommentAuthor;
  body: string | null;
  is_deleted: boolean;
  replies_count: number;
  replies: Comment[];
  edited_at: string | null;
  created_at: string | null;
  can_edit: boolean;
  can_delete: boolean;
}

export interface CommentThread {
  id: string;
  scope: CommentScope;
  comments_count: number;
  unread_count: number;
  items: Comment[];
  pagination: { page: number; per_page: number; total: number };
}

export interface CommentThreadSummary {
  id: string;
  comments_count: number;
  unread_count: number;
}

export interface CommentPolicy {
  shared_comments_allowed: boolean;
  can_write_shared: boolean;
}

export interface CommentThreadsResult {
  policy: CommentPolicy;
  threads: {
    shared: CommentThreadSummary | null;
    private: CommentThreadSummary | null;
  };
}
