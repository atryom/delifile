export type AccountStatus =
  | 'active'
  | 'pending_email_verification'
  | 'blocked_unverified_email';

export type TariffPlan = 'free' | 'silver' | 'gold';

export interface User {
  id: string;
  email: string;
  name: string | null;
  email_verified: boolean;
  account_status: AccountStatus;
  email_verification_deadline_at: string | null;
  plan: TariffPlan | null;
  is_superuser?: never;
  notifications_enabled: boolean;
  notify_new_files: boolean;
  notify_folder_shared: boolean;
  notify_shared_folder_updates: boolean;
  notify_comments: boolean;
  notify_mentions: boolean;
  notify_support_reply: boolean;
  notify_contacts_added: boolean;
  notify_task_assigned: boolean;
  allow_contacts_without_confirmation: boolean;
  auto_add_received_files: boolean;
}

export interface DeviceSession {
  id: string;
  device_name: string;
  device_type: string | null;
  ip_address: string | null;
  last_active_at: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
  device_id?: string;
  device_type?: string;
  device_name?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  password_confirmation: string;
}
