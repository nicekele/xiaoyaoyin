-- ============================================================
-- 逍遥引 · 燕云十六声百业宗门户站 —— Supabase 数据库结构（可重复执行）
-- 执行位置：Supabase 控制台 → SQL Editor → New query → 粘贴全文 → Run
-- 本脚本建策略前会先删除同名旧策略，因此可以反复执行不会报错
-- ============================================================

-- ---------- 1. profiles：登录用户（管理员标记） ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- 2. members：宗门成员表 ----------
create table if not exists public.members (
  id bigserial primary key,
  name text not null,
  weapon text,
  school text,
  xinfa text,
  level int not null default 100,
  role text not null default '社众',
  active int not null default 0,
  runs int not null default 0,
  online boolean not null default false,
  last_login text,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

drop policy if exists "members_select_all" on public.members;
create policy "members_select_all"
  on public.members for select using (true);

drop policy if exists "members_admin_write" on public.members;
create policy "members_admin_write"
  on public.members for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ---------- 3. posts：新闻 / 公告 / 活动 ----------
create table if not exists public.posts (
  id bigserial primary key,
  category text not null,
  title text not null,
  subtitle text,
  post_date text,
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select using (true);

drop policy if exists "posts_admin_write" on public.posts;
create policy "posts_admin_write"
  on public.posts for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ---------- 4. sect_content：宗门规矩 / 时间表 / 奖励机制 ----------
create table if not exists public.sect_content (
  id text primary key,
  title text,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.sect_content enable row level security;

drop policy if exists "sect_select_all" on public.sect_content;
create policy "sect_select_all"
  on public.sect_content for select using (true);

drop policy if exists "sect_admin_write" on public.sect_content;
create policy "sect_admin_write"
  on public.sect_content for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ));

-- ---------- 5. 注册时自动建档，且首个用户成为管理员 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_admin boolean;
begin
  select exists (select 1 from public.profiles where role = 'admin')
    into has_admin;

  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', new.email),
    case when has_admin then 'member' else 'admin' end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 6. 索引 ----------
create index if not exists idx_members_role on public.members (role);
create index if not exists idx_members_school on public.members (school);
create index if not exists idx_posts_category on public.posts (category);
create index if not exists idx_posts_created on public.posts (created_at desc);

-- ============================================================
-- 安全加固：防止普通用户自我提权为管理员
-- （本节可单独执行，同样可重复执行）
-- ============================================================

-- 1) 判断当前登录者是否管理员
--    用 security definer 避免在 policy 里查询本表造成无限递归
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2) 直接插入档案时，role 只能是 member
--    首个管理员由数据库触发器创建，不受此策略限制，所以不影响首人成管理员
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id and role = 'member');

-- 3) 管理员可以更新任意用户档案（否则无法给别人授予管理员）
drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 4) 触发器兜底：非管理员改自己的 role 直接报错
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_admin() then
      raise exception 'permission denied: only admin can change role';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_role
  before update on public.profiles
  for each row execute procedure public.guard_profile_role();

-- ============================================================
-- 说明：
-- 1. 第一个注册账号自动成为 admin，之后注册的都是 member。
-- 2. 之后加管理员：用管理员账号登录后台，把该用户 role 改为 'admin'。
-- 3. 普通注册用户无法把自己改成 admin（策略 + 触发器双重拦截）。
-- 4. 游客（未登录）对 members / posts / sect_content 只读，不可写。
-- ============================================================


-- ============================================================
-- v2 扩充：为活跃度 / 在线时长 / 打本统计三页提供可同步的数据字段
-- 执行后，这三页将改为从 members 表读取，实现全站同步
-- ============================================================

alter table public.members
    add column if not exists hours_week numeric not null default 0,
    add column if not exists runs_baiye int not null default 0,
    add column if not exists runs_raid  int not null default 0,
    add column if not exists runs_war   int not null default 0,
    add column if not exists runs_tower int not null default 0,
    add column if not exists active_history jsonb not null default '[]'::jsonb;

-- 宗门既定规则固化为数据库约束：
-- 侠境周本每人每周最多 5 次；周活跃不超过 8000；等级 1-100
alter table public.members
    drop constraint if exists runs_raid_weekly_cap;
alter table public.members
    add constraint runs_raid_weekly_cap check (runs_raid <= 5);

alter table public.members
    drop constraint if exists active_weekly_cap;
alter table public.members
    add constraint active_weekly_cap check (active >= 0 and active <= 8000);

alter table public.members
    drop constraint if exists level_cap;
alter table public.members
    add constraint level_cap check (level between 1 and 100);

-- 通知接口刷新结构缓存（否则新列在 REST 接口里暂时不可见）
NOTIFY pgrst, 'reload schema';
