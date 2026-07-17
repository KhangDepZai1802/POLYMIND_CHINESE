-- 36 — Tài khoản nội bộ bằng tên đăng nhập

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format check (
    username is null
    or (
      username = lower(username)
      and username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'
    )
  );

create unique index if not exists ux_profiles_username
  on public.profiles (username)
  where username is not null;

comment on column public.profiles.username is
  'Tên đăng nhập nội bộ do Super Admin cấp; email trong profiles chỉ là liên hệ tùy chọn.';
