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
    staleTime: 1000 * 60 * 2,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => contactsApi.create(email),
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
