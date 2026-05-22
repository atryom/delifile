import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '@/api/files';
import type { FileListParams } from '@/types';

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

export function useMoveFolder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (folder_id: string | null) => filesApi.moveFolder(id, folder_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file', id] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useShareToContact(id: string) {
  return useMutation({
    mutationFn: ({ contact_id, can_edit }: { contact_id: string; can_edit?: boolean }) =>
      filesApi.shareToContact(id, contact_id, can_edit),
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
  return useMutation({
    mutationFn: (opts: { ttl_hours?: number; allow_save?: boolean }) =>
      filesApi.createLink(id, opts).then((r) => r.data.data.link),
  });
}

