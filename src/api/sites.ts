import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { unwrap, unwrapOne } from './client';

export type SiteInput = { name: string; address: string };

export const siteKeys = {
  all: ['sites'] as const,
  detail: (id: string) => ['sites', id] as const,
};

/** Объекты с числом задач. RLS сам оставляет исполнителю только его объекты и задачи. */
export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () =>
      unwrap(await supabase.from('sites').select('id, name, address, tasks(count)').order('name')),
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: siteKeys.detail(id),
    queryFn: async () =>
      unwrap(await supabase.from('sites').select('id, name, address, created_at').eq('id', id).maybeSingle()),
  });
}

export function useSaveSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: SiteInput & { id?: string }) =>
      id
        ? unwrapOne(await supabase.from('sites').update(input).eq('id', id).select('id').single())
        : unwrapOne(await supabase.from('sites').insert(input).select('id').single()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('sites').delete().eq('id', id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteKeys.all }),
  });
}
