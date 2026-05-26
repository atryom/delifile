import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import {
  ApiResponse,
  SharedFolder,
  SharedFolderAccess,
  SharedFolderLink,
  SharedFolderFileItem,
  SharedFolderAccessType,
  InitUploadRequest,
  InitUploadResponse,
  PaginatedData,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class SharedFoldersApiService {
  private readonly api = inject(ApiService);

  // ── Folder CRUD ───────────────────────────────────────────────────────────

  list(): Observable<ApiResponse<{ items: SharedFolder[] }>> {
    return this.api.get('/shared-folders');
  }

  create(name: string): Observable<ApiResponse<{ folder: SharedFolder }>> {
    return this.api.post('/shared-folders', { name });
  }

  update(id: string, name: string): Observable<ApiResponse<{ folder: SharedFolder }>> {
    return this.api.patch(`/shared-folders/${id}`, { name });
  }

  delete(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/shared-folders/${id}`);
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  listFiles(id: string, page = 1, perPage = 20): Observable<ApiResponse<PaginatedData<SharedFolderFileItem>>> {
    return this.api.get(`/shared-folders/${id}/files`, { page, per_page: perPage });
  }

  initUpload(id: string, data: InitUploadRequest): Observable<ApiResponse<InitUploadResponse>> {
    return this.api.post(`/shared-folders/${id}/init-upload`, data);
  }

  completeUpload(id: string, fileId: string, thumbnailKey?: string): Observable<ApiResponse<{ file: { id: string; status: string } }>> {
    return this.api.post(`/shared-folders/${id}/complete-upload`, {
      file_id: fileId,
      ...(thumbnailKey ? { thumbnail_key: thumbnailKey } : {}),
    });
  }

  addUrlFile(id: string, url: string, preview?: { title: string | null; image_url: string | null; site_name: string | null } | null): Observable<ApiResponse<{ file: SharedFolderFileItem }>> {
    return this.api.post(`/shared-folders/${id}/url-file`, { url, preview: preview ?? null });
  }

  // ── Accesses ──────────────────────────────────────────────────────────────

  listAccesses(id: string): Observable<ApiResponse<{ items: SharedFolderAccess[] }>> {
    return this.api.get(`/shared-folders/${id}/accesses`);
  }

  addAccess(id: string, contactId: string, accessType: SharedFolderAccessType): Observable<ApiResponse<{ access: SharedFolderAccess }>> {
    return this.api.post(`/shared-folders/${id}/accesses`, { contact_id: contactId, access_type: accessType });
  }

  removeAccess(id: string, accessId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/shared-folders/${id}/accesses/${accessId}`);
  }

  // ── Links ─────────────────────────────────────────────────────────────────

  listLinks(id: string): Observable<ApiResponse<{ items: SharedFolderLink[] }>> {
    return this.api.get(`/shared-folders/${id}/links`);
  }

  createLink(id: string, data: { access_type: SharedFolderAccessType; ttl_hours: number; allow_save: boolean }): Observable<ApiResponse<{ link: SharedFolderLink }>> {
    return this.api.post(`/shared-folders/${id}/links`, data);
  }

  disableLink(id: string, linkId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/shared-folders/${id}/links/${linkId}/disable`);
  }

  // ── Public resolve ────────────────────────────────────────────────────────

  resolveSharedLink(token: string): Observable<ApiResponse<{ folder: SharedFolder; link: { access_type: SharedFolderAccessType; allow_save: boolean } }>> {
    return this.api.post(`/shared-links/${token}/resolve`);
  }

  publicFiles(token: string, page = 1): Observable<ApiResponse<{ items: import('../../shared/models/api.models').SharedFolderFileItem[]; pagination: import('../../shared/models/api.models').Pagination }>> {
    return this.api.get(`/shared-links/${token}/files`, { page });
  }

  // ── File shared-folder membership ─────────────────────────────────────────

  getFileSharedFolders(fileId: string): Observable<ApiResponse<{ folder_ids: string[]; folders: { id: string; name: string; is_in: boolean }[] }>> {
    return this.api.get(`/files/${fileId}/shared-folders`);
  }

  updateFileSharedFolders(fileId: string, folderIds: string[]): Observable<ApiResponse<{ folder_ids: string[] }>> {
    return this.api.post(`/files/${fileId}/shared-folders`, { folder_ids: folderIds });
  }

  addFileToMyFiles(fileId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/files/${fileId}/add-to-my-files`);
  }

  // ── Subfolders ────────────────────────────────────────────────────────────

  getSubfolders(parentId: string): Observable<ApiResponse<{ items: SharedFolder[] }>> {
    return this.api.get(`/shared-folders/${parentId}/subfolders`);
  }

  createSubfolder(parentId: string, name: string): Observable<ApiResponse<{ folder: SharedFolder }>> {
    return this.api.post(`/shared-folders/${parentId}/subfolders`, { name });
  }

  removeFile(folderId: string, fileId: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/shared-folders/${folderId}/files/${fileId}`);
  }

  leaveFolder(id: string): Observable<ApiResponse<Record<string, never>>> {
    return this.api.delete(`/shared-folders/${id}/leave`);
  }

  ensureRootFolder(): Observable<ApiResponse<{ folder: SharedFolder }>> {
    return this.api.post('/shared-folders/ensure-root');
  }

  setFilePrivacy(folderId: string, fileId: string, isPrivate: boolean): Observable<ApiResponse<Record<string, never>>> {
    return this.api.patch(`/shared-folders/${folderId}/files/${fileId}/privacy`, { is_private: isPrivate });
  }

  setFolderPrivacy(folderId: string, isPrivate: boolean): Observable<ApiResponse<{ folder: SharedFolder }>> {
    return this.api.patch(`/shared-folders/${folderId}/privacy`, { is_private: isPrivate });
  }

  listAll(): Observable<ApiResponse<{ items: SharedFolder[] }>> {
    return this.api.get('/shared-folders/all-flat');
  }

  addFile(folderId: string, fileId: string, move = false): Observable<ApiResponse<Record<string, never>>> {
    return this.api.post(`/shared-folders/${folderId}/files/${fileId}`, move ? { move: true } : {});
  }
}
