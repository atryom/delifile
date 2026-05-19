export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_registered: boolean;
  resolved_user?: { id: string; email: string; name: string | null } | null;
}

export interface ContactRequest {
  id: string;
  requester: { id: string; email: string; name: string | null };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string | null;
}
