export type FileRequestStatus = 'pending' | 'fulfilled' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface FileRequestItem {
  id: string;
  url: string;
  description: string;
  status: FileRequestStatus;
  ttl_hours: number;
  expires_at: string | null;
  fulfilled_at: string | null;
  sender_name: string | null;
  sender_email: string | null;
  file: {
    id: string;
    original_name: string;
    size: number | null;
    mime_type: string | null;
    preview_url: string | null;
  } | null;
}
