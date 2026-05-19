export type SupportTicketStatus = 'new' | 'in_progress' | 'awaiting_confirmation' | 'completed';

export interface SupportTicketListItem {
  id: string;
  status: SupportTicketStatus;
  unread_count: number;
  created_at: string | null;
  last_event_at: string | null;
}

export interface SupportMessageItem {
  id: string;
  is_admin_message: boolean;
  body: string;
  read_at: string | null;
  created_at: string | null;
}

export interface SupportTicketDetail {
  id: string;
  status: SupportTicketStatus;
  completion_reason: string | null;
  completed_at: string | null;
  created_at: string | null;
  messages: SupportMessageItem[];
}
