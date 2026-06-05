import { useQuery } from '@tanstack/react-query';
import { tagsApi } from '@/api/tags';

export function useTags(search?: string) {
  return useQuery({
    queryKey: ['tags', search],
    queryFn: () => tagsApi.list(search).then((r) => r.data.data),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
  });
}
