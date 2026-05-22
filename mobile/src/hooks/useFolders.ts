import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { foldersApi } from '@/api/folders';

export function useFolderTree() {
  return useQuery({
    queryKey: ['folders', 'tree'],
    queryFn: () => foldersApi.tree().then((r) => r.data.data.items),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
  });
}

export function useFolderList() {
  return useQuery({
    queryKey: ['folders', 'list'],
    queryFn: () => foldersApi.list().then((r) => r.data.data.items),
    staleTime: 1000 * 60 * 5,
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      foldersApi.update(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      foldersApi.delete(id, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
      qc.invalidateQueries({ queryKey: ['files'] });
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, parent_id }: { name: string; parent_id?: string | null }) =>
      foldersApi.create(name, parent_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}
