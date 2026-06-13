import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileRequestsApi } from '@/api/file-requests';
import type { FileRequestItem } from '@/types';

export function useFileRequests() {
  return useQuery({
    queryKey: ['file-requests'],
    queryFn: () => fileRequestsApi.list().then((r) => r.data.data.items),
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60,
  });
}

function isPendingEntry(r: FileRequestItem): boolean {
  if (r.allow_multiple) {
    return r.files?.some((f) => f.status === 'pending') ?? false;
  }
  return r.status === 'fulfilled';
}

export function usePendingFileRequests() {
  const query = useFileRequests();
  return {
    ...query,
    data: query.data?.filter(isPendingEntry) ?? [],
  };
}

/** @deprecated use usePendingFileRequests */
export function useFulfilledFileRequests() {
  return usePendingFileRequests();
}

export function useCreateFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      description,
      ttlHours,
      folderId,
      allowMultiple,
    }: {
      description: string;
      ttlHours: number;
      folderId?: string | null;
      allowMultiple?: boolean;
    }) => fileRequestsApi.create(description, ttlHours, folderId, allowMultiple).then((r) => r.data.data.request),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-requests'] }),
  });
}

export function useAcceptFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fileRequestsApi.accept(id).then((r) => r.data.data.file_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-requests'] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRejectFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fileRequestsApi.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-requests'] }),
  });
}

export function useAcceptFileRequestFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, fileItemId }: { requestId: string; fileItemId: string }) =>
      fileRequestsApi.acceptFile(requestId, fileItemId).then((r) => r.data.data.file_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['file-requests'] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useRejectFileRequestFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, fileItemId }: { requestId: string; fileItemId: string }) =>
      fileRequestsApi.rejectFile(requestId, fileItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-requests'] }),
  });
}
