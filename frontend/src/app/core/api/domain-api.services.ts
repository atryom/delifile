import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, Contact, ActivityLog, Folder, Tag, PaginatedData } from '../../shared/models/api.models';

// ─── Contacts API ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ContactsApiService {
  private readonly api = inject(ApiService);

  list(search?: string): Observable<ApiResponse<{ items: Contact[] }>> {
    const params: Record<string, string> = {};
    if (search) params['search'] = search;
    return this.api.get('/contacts', params);
  }

  create(data: { name: string; email?: string | null; phone?: string | null }): Observable<ApiResponse<{ contact: Contact; invitation_sent: boolean }>> {
    return this.api.post('/contacts', data);
  }

  get(id: string): Observable<ApiResponse<{ contact: Contact }>> {
    return this.api.get(`/contacts/${id}`);
  }

  import(contacts: { name: string; phone: string }[]): Observable<ApiResponse<{ imported: number }>> {
    return this.api.post('/contacts/import', { contacts });
  }

  resolve(): Observable<ApiResponse<{ newly_resolved: number }>> {
    return this.api.post('/contacts/resolve');
  }

  delete(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/contacts/${id}`);
  }

  history(id: string): Observable<ApiResponse<{ items: unknown[] }>> {
    return this.api.get(`/contacts/${id}/history`);
  }
}

// ─── Activity API ─────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
  private readonly api = inject(ApiService);

  list(page = 1): Observable<ApiResponse<PaginatedData<ActivityLog>>> {
    return this.api.get('/activity', { page });
  }
}

// ─── Organization API (Folders + Tags) ────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OrganizationApiService {
  private readonly api = inject(ApiService);

  // Folders
  listFolders(): Observable<ApiResponse<{ items: Folder[] }>> {
    return this.api.get('/folders');
  }

  createFolder(name: string): Observable<ApiResponse<{ folder: Folder }>> {
    return this.api.post('/folders', { name });
  }

  updateFolder(id: string, name: string): Observable<ApiResponse<{ folder: Folder }>> {
    return this.api.patch(`/folders/${id}`, { name });
  }

  deleteFolder(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/folders/${id}`);
  }

  // Tags
  listTags(): Observable<ApiResponse<{ items: Tag[] }>> {
    return this.api.get('/tags');
  }

  createTag(name: string): Observable<ApiResponse<{ tag: Tag }>> {
    return this.api.post('/tags', { name });
  }

  deleteTag(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/tags/${id}`);
  }
}
