import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '@/api/files';
import type { FileListParams, TaskStatus } from '@/types';

export function useFileList(params: FileListParams) {
  return useQuery({
    queryKey: ['files', params],
    queryFn: () => filesApi.list(params).then((r) => r.data.data),
    staleTime: 1000 * 60 * 2,
  });
}

export function useFile(id: string) {
  return useQuery({
    queryKey: ['file', id],
    queryFn: () => filesApi.get(id).then((r) => r.data.data.file),
    staleTime: 1000 * 60 * 5,
  });
}

export function useDownloadUrl(id: string) {
  return useMutation({
    mutationFn: () => filesApi.download(id).then((r) => r.data.data.url),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      isFavorite ? filesApi.unfavorite(id) : filesApi.favorite(id),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['files'] });
      qc.invalidateQueries({ queryKey: ['file', id] });
    },
  });
}

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['files'] });
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
    },
  });
}

export function useSetTags(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tag_ids: string[]) => filesApi.setTags(id, tag_ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useShareToContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contact_id, can_edit }: { contact_id: string; can_edit?: boolean }) =>
      filesApi.shareToContact(id, contact_id, can_edit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-accesses', id] });
    },
  });
}

export function useVersionDownload(fileId: string) {
  return useMutation({
    mutationFn: (versionId: string) =>
      filesApi.downloadVersion(fileId, versionId).then((r) => r.data.data.url),
  });
}

export function useActivateVersion(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => filesApi.activateVersion(fileId, versionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file', fileId] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useCreateLink(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { ttl_hours?: number; allow_save?: boolean }) =>
      filesApi.createLink(id, opts).then((r) => r.data.data.link),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-links', id] });
    },
  });
}

export function useFileLinks(id: string) {
  return useQuery({
    queryKey: ['file-links', id],
    queryFn: () => filesApi.listLinks(id).then((r) => r.data.data.items),
    staleTime: 0,
    enabled: !!id,
  });
}

export function useDisableFileLink(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) => filesApi.disableLink(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-links', fileId] });
    },
  });
}

export function useFileAccesses(id: string) {
  return useQuery({
    queryKey: ['file-accesses', id],
    queryFn: () => filesApi.listAccesses(id).then((r) => r.data.data.items),
    staleTime: 0,
    enabled: !!id,
  });
}

export function useRevokeAccess(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => filesApi.revokeAccess(fileId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-accesses', fileId] });
    },
  });
}

export function useUpdateAccess(fileId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ accessId, canEdit }: { accessId: string; canEdit: boolean }) =>
      filesApi.updateAccess(fileId, accessId, canEdit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-accesses', fileId] });
    },
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      is_task?: boolean;
      task_status?: TaskStatus | null;
      task_start_date?: string | null;
      task_due_date?: string | null;
      task_assigned_user_id?: number | null;
    }) => filesApi.updateTask(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

