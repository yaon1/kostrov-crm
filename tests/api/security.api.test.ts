// Те же правила, но через настоящий Supabase API (GoTrue + PostgREST), как если бы
// пользователь слал запросы вручную с anon-ключом и своим токеном.
// Нужен запущенный локальный Supabase с seed: npx supabase start && npm run test:api
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/database.ts';

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
assert.ok(anonKey, 'Задайте VITE_SUPABASE_ANON_KEY (npx supabase status)');
const PASSWORD = 'Demo-2026!';

async function login(email: string) {
  const client = createClient<Database>(url, anonKey!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.ifError(error);
  return client;
}

const manager = await login('manager@example.com');
const exec1 = await login('executor1@example.com');
const exec2 = await login('executor2@example.com');
const anon = createClient<Database>(url, anonKey!, { auth: { persistSession: false } });
const { data: me1 } = await exec1.auth.getUser();
const EXEC1 = me1.user!.id;

test('регистрация закрыта', async () => {
  const { error } = await anon.auth.signUp({ email: 'intruder@example.com', password: 'Intruder-123!' });
  assert.ok(error, 'signUp должен вернуть ошибку');
});

test('аноним ничего не читает', async () => {
  const { data, error } = await anon.from('tasks').select('id');
  assert.ok(error || data?.length === 0);
});

test('исполнитель видит только свои задачи и объекты', async () => {
  const { data: tasks } = await exec1.from('tasks').select('assignee_id');
  assert.ok(tasks!.length > 0 && tasks!.every((t) => t.assignee_id === EXEC1));
  const { data: all } = await manager.from('tasks').select('id');
  assert.ok(all!.length > tasks!.length);
  const { data: sites } = await exec1.from('sites').select('name');
  assert.deepEqual(sites!.map((s) => s.name).sort(), ['ЖК «Северный»', 'Склад «Южный»']);
});

test('исполнитель не меняет статус и чужие задачи в обход RPC', async () => {
  const { data: own } = await exec1.from('tasks').select('id').eq('status', 'new').limit(1).single();
  const { data: updated } = await exec1.from('tasks').update({ title: 'взлом' }).eq('id', own!.id).select();
  assert.equal(updated?.length ?? 0, 0);

  const { data: foreign } = await exec2.from('tasks').select('id').limit(1).single();
  const { error } = await exec1.rpc('change_task_status', { p_task_id: foreign!.id, p_to_status: 'in_progress' });
  assert.match(error!.message, /не найдена/);
});

test('запрещённый переход и возврат без комментария отклоняются', async () => {
  const { data: review } = await manager.from('tasks').select('id').eq('status', 'review').limit(1).single();
  const noComment = await manager.rpc('change_task_status', { p_task_id: review!.id, p_to_status: 'rework' });
  assert.match(noComment.error!.message, /нужен комментарий/);
  const jump = await manager.rpc('change_task_status', { p_task_id: review!.id, p_to_status: 'new' });
  assert.match(jump.error!.message, /запрещён/);
});

test('историю нельзя записать, изменить или удалить', async () => {
  const forged = await (manager.from('task_status_history') as any).insert({
    task_id: crypto.randomUUID(), to_status: 'accepted', changed_by: EXEC1,
  });
  assert.ok(forged.error);
  const edited = await (manager.from('task_status_history') as any).update({ comment: 'x' }).gt('id', 0).select();
  assert.ok(edited.error || edited.data.length === 0);
  const removed = await manager.from('task_status_history').delete().gt('id', 0).select();
  assert.ok(removed.error || removed.data.length === 0);
});
