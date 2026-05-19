import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '@/api/inbox';

export function useInboxCount() {
  return useQuery({
    queryKey: ['inbox', 'count'],
    queryFn: () => inboxApi.count().then((r) => r.data.data),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useInboxFiles() {
  return useQuery({
    queryKey: ['inbox', 'files'],
    queryFn: () => inboxApi.files().then((r) => r.data.data.items),
    staleTime: 1000 * 60,
  });
}

export function useInboxSharedFolders() {
  return useQuery({
    queryKey: ['inbox', 'shared-folders'],
    queryFn: () => inboxApi.sharedFolders().then((r) => r.data.data.items),
    staleTime: 1000 * 60,
  });
}

export function useAcceptFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => inboxApi.acceptFiles(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRejectFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => inboxApi.rejectFiles(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useAcceptInboxFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.acceptFiles([id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRejectInboxFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.rejectFiles([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useAcceptInboxFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.acceptSharedFolders([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}

export function useRejectInboxFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inboxApi.rejectSharedFolders([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
