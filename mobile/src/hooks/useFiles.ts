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

