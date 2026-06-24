import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/api/contacts';

export function useContacts(search?: string) {
  return useQuery({
    queryKey: ['contacts', search],
    queryFn: () => contactsApi.list(search).then((r) => r.data.data.items),
    staleTime: 1000 * 60 * 5,
  });
}

export function useContactRequests() {
  return useQuery({
    queryKey: ['contact-requests'],
    queryFn: () => contactsApi.listRequests().then((r) => r.data.data.items),
    staleTime: 1000 * 30,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { email: string; name: string }) => contactsApi.create(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => contactsApi.update(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useReorderContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => contactsApi.reorder(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useAcceptContactRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.acceptRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-requests'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useRejectContactRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.rejectRequest(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contact-requests'] }),
  });
}
