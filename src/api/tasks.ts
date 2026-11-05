import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TaskStatus } from '../types/database';
import { unwrap, unwrapOne } from './client';
import { siteKeys } from './sites';

export type TaskInput = { site_id: string; title: string; description: string; assignee_id: string };

export const taskKeys = {
  all: ['tasks'] as const,
  bySite: (siteId: string) => ['tasks', 'site', siteId] as const,
  mine: (userId: string) => ['tasks', 'mine', userId] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
  history: (id: string) => ['tasks', 'history', id] as const,
};

const LIST_COLUMNS = 'id, title, status, created_at, assignee:profiles!tasks_assignee_id_fkey(full_name)';

export function useSiteTasks(siteId: string) {
  return useQuery({
    queryKey: taskKeys.bySite(siteId),
    queryFn: async () =>
      unwrap(await supabase.from('tasks').select(LIST_COLUMNS).eq('site_id', siteId).order('created_at')),
  });
}

export function useMyTasks(userId: string) {
  return useQuery({
    queryKey: taskKeys.mine(userId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('tasks')
          .select('id, title, status, created_at, site:sites(id, name)')
          .eq('assignee_id', userId)
          .order('created_at', { ascending: false }),
      ),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('tasks')
          .select(
            `id, site_id, title, description, status, assignee_id, author_id, created_at,
             site:sites(id, name),
             assignee:profiles!tasks_assignee_id_fkey(full_name),
             author:profiles!tasks_author_id_fkey(full_name)`,
          )
          .eq('id', id)
          .maybeSingle(),
      ),
  });
}

export function useTaskHistory(taskId: string) {
  return useQuery({
    queryKey: taskKeys.history(taskId),
    queryFn: async () =>
      unwrap(
        await supabase
          .from('task_status_history')
          .select('id, from_status, to_status, comment, changed_at, actor:profiles(full_name)')
          .eq('task_id', taskId)
          .order('changed_at')
          .order('id'),
      ),
  });
}

/** Правила переходов (справочник из базы). */
export function useTransitions() {
  return useQuery({
    queryKey: ['status_transitions'],
    queryFn: async () => unwrap(await supabase.from('status_transitions').select('*')),
    staleTime: Infinity,
  });
}

export function useExecutors() {
  return useQuery({
    queryKey: ['profiles', 'executors'],
    queryFn: async () =>
      unwrap(await supabase.from('profiles').select('id, full_name').eq('role', 'executor').order('full_name')),
  });
}

function useInvalidateTasks() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      queryClient.invalidateQueries({ queryKey: siteKeys.all }),
    ]);
}

export function useSaveTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async ({ id, ...input }: TaskInput & { id?: string }) =>
      id
        ? unwrapOne(await supabase.from('tasks').update(input).eq('id', id).select('id').single())
        : unwrapOne(await supabase.from('tasks').insert(input).select('id').single()),
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('tasks').delete().eq('id', id)),
    onSuccess: invalidate,
  });
}

export function useChangeStatus() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: async (vars: { taskId: string; to: TaskStatus; comment?: string }) =>
      unwrap(
        await supabase.rpc('change_task_status', {
          p_task_id: vars.taskId,
          p_to_status: vars.to,
          p_comment: vars.comment || null,
        }),
      ),
    onSuccess: invalidate,
  });
}
