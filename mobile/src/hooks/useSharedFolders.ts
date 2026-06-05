import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sharedFoldersApi } from '@/api/shared-folders';

export function useEnsurePersonalRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sharedFoldersApi.ensureRoot(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
    },
  });
}

export function useSharedFolderAllFlat() {
  return useQuery({
    queryKey: ['shared-folders', 'all-flat'],
    queryFn: () => sharedFoldersApi.allFlat().then((r) => r.data.data.items),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useSetFolderPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPrivate }: { id: string; isPrivate: boolean }) =>
      sharedFoldersApi.setFolderPrivacy(id, isPrivate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folders'] });
    },
  });
}

export function useSetFilePrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, fileId, isPrivate }: { folderId: string; fileId: string; isPrivate: boolean }) =>
      sharedFoldersApi.setFilePrivacy(folderId, fileId, isPrivate),
    onSuccess: (_data, { folderId }) => {
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId] });
    },
  });
}

export function useFolderLinks(folderId: string) {
  return useQuery({
    queryKey: ['shared-folders', folderId, 'links'],
    queryFn: () => sharedFoldersApi.listLinks(folderId).then((r) => r.data.data.items),
    staleTime: 0,
    enabled: !!folderId,
  });
}

export function useCreateFolderLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      folderId,
      opts,
    }: {
      folderId: string;
      opts: { access_type: 'view' | 'edit'; allow_save: boolean; ttl_hours: number };
    }) => sharedFoldersApi.createLink(folderId, opts),
    onSuccess: (_data, { folderId }) => {
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId, 'links'] });
    },
  });
}

export function useDisableFolderLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, linkId }: { folderId: string; linkId: string }) =>
      sharedFoldersApi.disableLink(folderId, linkId),
    onSuccess: (_data, { folderId }) => {
      qc.invalidateQueries({ queryKey: ['shared-folders', folderId, 'links'] });
    },
  });
}

export function useSharedFolderAccesses(folderId: string) {
  return useQuery({
    queryKey: ['shared-folder-accesses', folderId],
    queryFn: () => sharedFoldersApi.listAccesses(folderId).then((r) => r.data.data.items),
    staleTime: 0,
    enabled: !!folderId,
  });
}

export function useAddFolderMember(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, accessType }: { contactId: string; accessType: 'view' | 'edit' }) =>
      sharedFoldersApi.addAccess(folderId, contactId, accessType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folder-accesses', folderId] });
    },
  });
}

export function useRemoveFolderMember(folderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accessId: string) => sharedFoldersApi.removeAccess(folderId, accessId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-folder-accesses', folderId] });
    },
  });
}
