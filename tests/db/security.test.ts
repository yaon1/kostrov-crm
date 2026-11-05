// Проверка правил доступа на уровне базы: те же запросы, что пришли бы через Supabase API
// (роль authenticated + JWT sub), но без интерфейса. Запуск: npm run test:db
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = new URL('../../supabase/', import.meta.url);
const read = (path: string | URL) => readFileSync(path, 'utf8');

const MANAGER = 'a0000000-0000-4000-8000-000000000001';
const EXEC1 = 'b0000000-0000-4000-8000-000000000001';
const EXEC2 = 'b0000000-0000-4000-8000-000000000002';
const SITE_NORTH = 'c0000000-0000-4000-8000-000000000001'; // задачи только у исполнителя 1
const SITE_ISTRA = 'c0000000-0000-4000-8000-000000000003'; // задачи только у исполнителя 2
const TASK_E1_NEW = 'd0000000-0000-4000-8000-000000000001';
const TASK_E2_NEW = 'd0000000-0000-4000-8000-000000000006';
const TASK_E2_REVIEW = 'd0000000-0000-4000-8000-000000000007';

const db = await PGlite.create({ extensions: { pgcrypto } });
await db.exec(read(new URL('./supabase-stub.sql', import.meta.url)));
for (const file of readdirSync(new URL('migrations/', root)).sort()) {
  await db.exec(read(new URL(`migrations/${file}`, root)));
}
await db.exec(read(new URL('seed.sql', root)));

/** Выполняет fn в транзакции от имени пользователя (null — анонимный запрос). */
function as<T>(userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`);
    const claims = userId ? JSON.stringify({ sub: userId, role: 'authenticated' }) : '';
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
    return fn(tx);
  });
}

const rows = async <R>(tx: Transaction, sql: string, params: unknown[] = []) =>
  (await tx.query<R>(sql, params)).rows;

const changeStatus = (userId: string, taskId: string, to: string, comment?: string) =>
  as(userId, (tx) => tx.query('select public.change_task_status($1, $2, $3)', [taskId, to, comment ?? null]));

async function newTask(assignee: string, title = 'Тестовая задача'): Promise<string> {
  const [row] = await as(MANAGER, (tx) =>
    rows<{ id: string }>(
      tx,
      'insert into public.tasks (site_id, title, assignee_id) values ($1, $2, $3) returning id',
      [SITE_NORTH, title, assignee],
    ),
  );
  return row.id;
}

test('демо-данные: 3 объекта, 7 задач в 5 статусах', async () => {
  const stats = await as(MANAGER, (tx) =>
    rows<{ sites: number; tasks: number; statuses: number }>(
      tx,
      `select (select count(*)::int from public.sites) as sites,
              (select count(*)::int from public.tasks) as tasks,
              (select count(distinct status)::int from public.tasks) as statuses`,
    ),
  );
  assert.deepEqual(stats[0], { sites: 3, tasks: 7, statuses: 5 });
});

test('исполнитель видит только свои задачи и объекты с ними', async () => {
  await as(EXEC1, async (tx) => {
    const tasks = await rows<{ assignee_id: string }>(tx, 'select assignee_id from public.tasks');
    assert.ok(tasks.length > 0);
    assert.ok(tasks.every((t) => t.assignee_id === EXEC1));

    const sites = await rows<{ id: string }>(tx, 'select id from public.sites');
    assert.ok(sites.some((s) => s.id === SITE_NORTH));
    assert.ok(!sites.some((s) => s.id === SITE_ISTRA));

    const foreign = await rows(tx, 'select * from public.tasks where id = $1', [TASK_E2_NEW]);
    assert.equal(foreign.length, 0);
    const foreignHistory = await rows(tx, 'select * from public.task_status_history where task_id = $1', [TASK_E2_NEW]);
    assert.equal(foreignHistory.length, 0);
  });
});

test('исполнитель не может изменить, создать или удалить задачу напрямую', async () => {
  await as(EXEC1, async (tx) => {
    const own = await tx.query(`update public.tasks set title = 'взлом' where id = $1`, [TASK_E1_NEW]);
    assert.equal(own.affectedRows, 0);
    const foreign = await tx.query(`update public.tasks set assignee_id = $1 where id = $2`, [EXEC1, TASK_E2_NEW]);
    assert.equal(foreign.affectedRows, 0);
    const del = await tx.query('delete from public.tasks where id = $1', [TASK_E1_NEW]);
    assert.equal(del.affectedRows, 0);
  });
  await assert.rejects(
    as(EXEC1, (tx) =>
      tx.query('insert into public.tasks (site_id, title, assignee_id) values ($1, $2, $3)', [SITE_NORTH, 'x', EXEC1]),
    ),
    /row-level security/,
  );
  await assert.rejects(
    as(EXEC1, (tx) => tx.query(`insert into public.sites (name, address) values ('x', 'y')`)),
    /row-level security/,
  );
});

test('полный цикл статусов пишет историю: кто, откуда, куда, комментарий', async () => {
  const id = await newTask(EXEC1);
  await changeStatus(EXEC1, id, 'in_progress');
  await changeStatus(EXEC1, id, 'review');
  await assert.rejects(changeStatus(MANAGER, id, 'rework', '   '), /нужен комментарий/);
  await changeStatus(MANAGER, id, 'rework', 'Переделать узел');
  await changeStatus(EXEC1, id, 'in_progress');
  await changeStatus(EXEC1, id, 'review');
  await changeStatus(MANAGER, id, 'accepted');

  const history = await as(EXEC1, (tx) =>
    rows<{ from_status: string | null; to_status: string; changed_by: string; comment: string | null }>(
      tx,
      'select from_status, to_status, changed_by, comment from public.task_status_history where task_id = $1 order by id',
      [id],
    ),
  );
  assert.deepEqual(
    history.map((h) => [h.from_status, h.to_status, h.changed_by, h.comment]),
    [
      [null, 'new', MANAGER, null],
      ['new', 'in_progress', EXEC1, null],
      ['in_progress', 'review', EXEC1, null],
      ['review', 'rework', MANAGER, 'Переделать узел'],
      ['rework', 'in_progress', EXEC1, null],
      ['in_progress', 'review', EXEC1, null],
      ['review', 'accepted', MANAGER, null],
    ],
  );
});

test('запрещённые переходы и чужие роли отклоняются базой', async () => {
  const id = await newTask(EXEC1);
  await assert.rejects(changeStatus(MANAGER, id, 'accepted'), /запрещён/); // Новая → Принята
  await assert.rejects(changeStatus(MANAGER, id, 'in_progress'), /Нет прав/); // берёт в работу не исполнитель
  await assert.rejects(changeStatus(EXEC2, id, 'in_progress'), /не найдена/); // чужая задача
  await changeStatus(EXEC1, id, 'in_progress');
  await changeStatus(EXEC1, id, 'review');
  await assert.rejects(changeStatus(EXEC1, id, 'accepted'), /Нет прав/); // исполнитель не принимает сам
  await assert.rejects(changeStatus(EXEC1, id, 'rework', 'сам себе'), /Нет прав/);
  await assert.rejects(changeStatus(MANAGER, id, 'new'), /запрещён/);
  await assert.rejects(changeStatus(EXEC2, TASK_E2_REVIEW, 'accepted'), /Нет прав/);
});

test('статус нельзя поменять прямым UPDATE даже постановщику', async () => {
  await assert.rejects(
    as(MANAGER, (tx) => tx.query(`update public.tasks set status = 'accepted' where id = $1`, [TASK_E1_NEW])),
    /только через change_task_status/,
  );
});

test('при создании статус всегда «Новая», автор — текущий пользователь', async () => {
  const [row] = await as(MANAGER, (tx) =>
    rows<{ status: string; author_id: string }>(
      tx,
      `insert into public.tasks (site_id, title, assignee_id, status, author_id)
       values ($1, 'Подмена', $2, 'accepted', $2) returning status, author_id`,
      [SITE_NORTH, EXEC1],
    ),
  );
  assert.deepEqual(row, { status: 'new', author_id: MANAGER });
});

test('исполнителем можно назначить только пользователя с ролью «исполнитель»', async () => {
  await assert.rejects(
    as(MANAGER, (tx) =>
      tx.query('insert into public.tasks (site_id, title, assignee_id) values ($1, $2, $3)', [SITE_NORTH, 'x', MANAGER]),
    ),
    /только пользователь с ролью/,
  );
});

test('историю нельзя подделать, изменить или удалить через API', async () => {
  for (const user of [MANAGER, EXEC1]) {
    await assert.rejects(
      as(user, (tx) =>
        tx.query(
          `insert into public.task_status_history (task_id, from_status, to_status, changed_by)
           values ($1, 'review', 'accepted', $2)`,
          [TASK_E1_NEW, user],
        ),
      ),
      /permission denied/,
    );
    await assert.rejects(
      as(user, (tx) => tx.query(`update public.task_status_history set comment = 'x'`)),
      /permission denied/,
    );
    await assert.rejects(as(user, (tx) => tx.query('delete from public.task_status_history')), /permission denied/);
  }
});

test('роль и профили нельзя менять через API; исполнитель не видит коллег-исполнителей', async () => {
  await assert.rejects(
    as(EXEC1, (tx) => tx.query(`update public.profiles set role = 'manager' where id = $1`, [EXEC1])),
    /permission denied/,
  );
  await assert.rejects(
    as(EXEC1, (tx) => tx.query(`update public.status_transitions set actor = 'assignee'`)),
    /permission denied/,
  );
  const visible = await as(EXEC1, (tx) => rows<{ id: string }>(tx, 'select id from public.profiles'));
  assert.deepEqual(visible.map((p) => p.id).sort(), [MANAGER, EXEC1].sort());
});

test('анонимный запрос не получает ничего', async () => {
  await assert.rejects(as(null, (tx) => tx.query('select * from public.tasks')), /permission denied/);
  await assert.rejects(as(null, (tx) => tx.query('select * from public.sites')), /permission denied/);
  await assert.rejects(
    as(null, (tx) => tx.query('select public.change_task_status($1, $2)', [TASK_E1_NEW, 'in_progress'])),
    /permission denied/,
  );
});

test('объект с задачами нельзя удалить', async () => {
  await assert.rejects(
    as(MANAGER, (tx) => tx.query('delete from public.sites where id = $1', [SITE_NORTH])),
    /foreign key/,
  );
});
