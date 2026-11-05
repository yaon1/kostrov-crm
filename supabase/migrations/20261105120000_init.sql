-- Мини-CRM «Объекты и задачи»: схема, правила переходов статусов, RLS.
--
-- Принципы:
--  * все проверки доступа — в базе (RLS + триггеры + одна RPC), интерфейс только отражает их;
--  * статус задачи меняется только через public.change_task_status();
--  * история статусов пишется только сервером (триггер/RPC), через API её можно лишь читать.

-- ---------------------------------------------------------------------------
-- Типы
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');
-- Кто выполняет переход: любой постановщик или назначенный исполнитель задачи.
create type public.transition_actor as enum ('manager', 'assignee');

-- ---------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null default 'executor',
  created_at  timestamptz not null default now()
);
comment on table public.profiles is 'Пользователь CRM и его роль. Роль меняет только администратор (SQL / service_role).';

-- Объект = стройка.
create table public.sites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  address     text not null check (length(btrim(address)) > 0),
  created_at  timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references public.sites (id) on delete restrict,
  title        text not null check (length(btrim(title)) > 0),
  description  text not null default '',
  assignee_id  uuid not null references public.profiles (id) on delete restrict,
  status       public.task_status not null default 'new',
  author_id    uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_site_id_idx on public.tasks (site_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

-- Справочник разрешённых переходов: единый источник правил для базы и интерфейса.
create table public.status_transitions (
  from_status       public.task_status not null,
  to_status         public.task_status not null,
  actor             public.transition_actor not null,
  comment_required  boolean not null default false,
  primary key (from_status, to_status)
);

insert into public.status_transitions (from_status, to_status, actor, comment_required) values
  ('new',         'in_progress', 'assignee', false),
  ('in_progress', 'review',      'assignee', false),
  ('review',      'accepted',    'manager',  false),
  ('review',      'rework',      'manager',  true),
  ('rework',      'in_progress', 'assignee', false);

create table public.task_status_history (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  from_status  public.task_status,          -- null: задача создана
  to_status    public.task_status not null,
  comment      text,
  changed_by   uuid not null references public.profiles (id) on delete restrict,
  changed_at   timestamptz not null default now()
);
create index task_status_history_task_id_idx on public.task_status_history (task_id, changed_at);

-- ---------------------------------------------------------------------------
-- Вспомогательные функции (security definer, чтобы не было рекурсии RLS на profiles)
-- ---------------------------------------------------------------------------
create function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'manager' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Профиль создаётся автоматически при создании пользователя в Supabase Auth.
-- Роль берётся из app_metadata (её не может задать сам пользователь), по умолчанию — исполнитель.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email),
    coalesce((new.raw_app_meta_data ->> 'app_role')::public.user_role, 'executor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Целостность задач
-- ---------------------------------------------------------------------------
-- Запросы через API выполняются под ролями anon/authenticated. Внутри security definer
-- функции change_task_status() current_user — владелец функции, поэтому только она
-- может сменить статус.
create function public.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_via_api boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if v_via_api then
      new.status     := 'new';
      new.author_id  := auth.uid();
      new.created_at := now();
    end if;
  else
    new.author_id  := old.author_id;
    new.created_at := old.created_at;
    if v_via_api and new.status is distinct from old.status then
      raise exception 'Статус задачи меняется только через change_task_status()'
        using errcode = '42501';
    end if;
  end if;

  if (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (
       select 1 from public.profiles p where p.id = new.assignee_id and p.role = 'executor'
     ) then
    raise exception 'Исполнителем может быть только пользователь с ролью «исполнитель»'
      using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- Первая запись истории: «— → Новая».
create function public.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function public.tasks_after_insert();

-- ---------------------------------------------------------------------------
-- Смена статуса: единственная точка входа
-- ---------------------------------------------------------------------------
create function public.change_task_status(
  p_task_id   uuid,
  p_to_status public.task_status,
  p_comment   text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_manager boolean := public.is_manager();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_task    public.tasks;
  v_from    public.task_status;
  v_rule    public.status_transitions;
begin
  if v_uid is null then
    raise exception 'Требуется вход' using errcode = '28000';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  -- Чужая задача для исполнителя неотличима от несуществующей.
  if not found or not (v_manager or v_task.assignee_id = v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;
  v_from := v_task.status;

  select * into v_rule
  from public.status_transitions
  where from_status = v_from and to_status = p_to_status;
  if not found then
    raise exception 'Переход % → % запрещён', v_from, p_to_status using errcode = '42501';
  end if;

  if (v_rule.actor = 'manager' and not v_manager)
     or (v_rule.actor = 'assignee' and v_task.assignee_id <> v_uid) then
    raise exception 'Нет прав на переход % → %', v_from, p_to_status using errcode = '42501';
  end if;

  if v_rule.comment_required and v_comment is null then
    raise exception 'Для перехода % → % нужен комментарий', v_from, p_to_status
      using errcode = '23514';
  end if;

  update public.tasks set status = p_to_status where id = p_task_id
  returning * into v_task;

  insert into public.task_status_history (task_id, from_status, to_status, comment, changed_by)
  values (p_task_id, v_from, p_to_status, v_comment, v_uid);

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- Права и RLS
-- ---------------------------------------------------------------------------
-- Анонимный доступ не нужен ни к чему.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.tasks_before_write() from authenticated;
revoke execute on function public.tasks_after_insert() from authenticated;

-- Таблицы, которые через API только читаются.
revoke insert, update, delete, truncate on public.profiles from authenticated;
revoke insert, update, delete, truncate on public.status_transitions from authenticated;
revoke insert, update, delete, truncate on public.task_status_history from authenticated;

alter table public.profiles            enable row level security;
alter table public.sites               enable row level security;
alter table public.tasks               enable row level security;
alter table public.status_transitions  enable row level security;
alter table public.task_status_history enable row level security;

-- profiles: свой профиль, профили постановщиков (авторы задач и записей истории);
-- постановщик видит всех.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'manager'
    or (select public.is_manager())
  );

-- sites: постановщик — всё; исполнитель — только объекты, где у него есть задачи.
create policy sites_select on public.sites
  for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.site_id = sites.id and t.assignee_id = (select auth.uid())
    )
  );
create policy sites_insert on public.sites
  for insert to authenticated with check ((select public.is_manager()));
create policy sites_update on public.sites
  for update to authenticated
  using ((select public.is_manager())) with check ((select public.is_manager()));
create policy sites_delete on public.sites
  for delete to authenticated using ((select public.is_manager()));

-- tasks: постановщик — всё; исполнитель — только свои и только чтение
-- (его действия со статусом идут через change_task_status()).
create policy tasks_select on public.tasks
  for select to authenticated
  using ((select public.is_manager()) or assignee_id = (select auth.uid()));
create policy tasks_insert on public.tasks
  for insert to authenticated with check ((select public.is_manager()));
create policy tasks_update on public.tasks
  for update to authenticated
  using ((select public.is_manager())) with check ((select public.is_manager()));
create policy tasks_delete on public.tasks
  for delete to authenticated using ((select public.is_manager()));

create policy status_transitions_select on public.status_transitions
  for select to authenticated using (true);

-- История видна тем, кто видит задачу.
create policy task_status_history_select on public.task_status_history
  for select to authenticated
  using (
    (select public.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.id = task_status_history.task_id and t.assignee_id = (select auth.uid())
    )
  );
