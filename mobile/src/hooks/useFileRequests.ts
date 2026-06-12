import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fileRequestsApi } from '@/api/file-requests';

export function useFileRequests() {
  return useQuery({
    queryKey: ['file-requests'],
    queryFn: () => fileRequestsApi.list().then((r) => r.data.data.items),
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60,
  });
}

export function useFulfilledFileRequests() {
  const query = useFileRequests();
  return {
    ...query,
    data: query.data?.filter((r) => r.status === 'fulfilled') ?? [],
  };
}

export function useCreateFileRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ description, ttlHours, folderId }: { description: string; ttlHours: number; folderId?: string | null }) =>
      fileRequestsApi.create(description, ttlHours, folderId).then((r) => r.data.data.request),
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
