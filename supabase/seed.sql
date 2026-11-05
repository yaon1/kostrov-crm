-- Демо-данные: 1 постановщик, 2 исполнителя, 3 объекта, 7 задач в разных статусах.
-- Запуск: локально — `supabase db reset`; в облаке — вставить в SQL Editor и выполнить.
-- Пароль у всех демо-пользователей: Demo-2026!
--
-- Пользователи создаются напрямую в auth.users (открытая регистрация выключена).
-- Задачи и смены статусов выполняются от имени пользователей (role authenticated + JWT sub),
-- то есть через те же RLS, триггеры и change_task_status(), что и из интерфейса.

-- 1. Пользователи --------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Demo-2026!', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'app_role', u.app_role),
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'manager@example.com',   'manager',  'Анна Смирнова'),
  ('b0000000-0000-4000-8000-000000000001'::uuid, 'executor1@example.com', 'executor', 'Пётр Иванов'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'executor2@example.com', 'executor', 'Дмитрий Козлов')
) as u (id, email, app_role, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email in ('manager@example.com', 'executor1@example.com', 'executor2@example.com');

-- 2. Объекты и задачи (от имени постановщика) ---------------------------------
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);

insert into public.sites (id, name, address) values
  ('c0000000-0000-4000-8000-000000000001', 'ЖК «Северный»',        'г. Москва, ул. Летчика Бабушкина, 12'),
  ('c0000000-0000-4000-8000-000000000002', 'Склад «Южный»',        'Московская обл., г. Подольск, ул. Индустриальная, 5'),
  ('c0000000-0000-4000-8000-000000000003', 'Коттедж в Истре',      'Московская обл., г. Истра, КП «Лесное», уч. 48');

insert into public.tasks (id, site_id, title, description, assignee_id) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Принять бетон на фундамент', 'Проверить паспорта на партию, отобрать кубики для лаборатории.',
   'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Армирование плиты 3 этажа', 'Шаг арматуры по проекту КЖ, лист 14.',
   'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',
   'Фотоотчёт по кровле', 'Снимки всех примыканий, загрузить в общую папку.',
   'b0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002',
   'Монтаж ворот секции Б', 'Ворота 4×4 м, проверить работу автоматики.',
   'b0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002',
   'Исполнительная схема по сетям', 'Схема наружных сетей водоснабжения.',
   'b0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003',
   'Утепление перекрытия', 'Минвата 200 мм, пароизоляция с проклейкой швов.',
   'b0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000003',
   'Разметка под септик', 'Разметить по согласованному плану участка.',
   'b0000000-0000-4000-8000-000000000002');

-- 3. Движение по статусам ----------------------------------------------------
-- Исполнитель 1: задача 2 → в работе, задача 3 → на проверке.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.change_task_status('d0000000-0000-4000-8000-000000000002', 'in_progress');
select public.change_task_status('d0000000-0000-4000-8000-000000000003', 'in_progress');
select public.change_task_status('d0000000-0000-4000-8000-000000000003', 'review');

-- Исполнитель 2: задачи 4, 5, 7 → на проверке.
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.change_task_status('d0000000-0000-4000-8000-000000000004', 'in_progress');
select public.change_task_status('d0000000-0000-4000-8000-000000000004', 'review');
select public.change_task_status('d0000000-0000-4000-8000-000000000005', 'in_progress');
select public.change_task_status('d0000000-0000-4000-8000-000000000005', 'review');
select public.change_task_status('d0000000-0000-4000-8000-000000000007', 'in_progress');
select public.change_task_status('d0000000-0000-4000-8000-000000000007', 'review');

-- Постановщик: задача 4 принята, задача 5 возвращена на доработку.
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
select public.change_task_status('d0000000-0000-4000-8000-000000000004', 'accepted');
select public.change_task_status('d0000000-0000-4000-8000-000000000005', 'rework',
  'Нет отметок колодцев К3 и К4, дополните схему.');

-- Итог: новая — 1, 6; в работе — 2; на проверке — 3, 7; принята — 4; на доработке — 5.
reset role;
select set_config('request.jwt.claims', '', false);
