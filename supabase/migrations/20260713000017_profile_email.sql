-- =============================================================================
-- 17 — Thêm `email` vào profiles
--
-- Email gốc nằm ở `auth.users.email`, nhưng schema `auth` KHÔNG được PostgREST
-- expose → app không đọc được. Không có cột này thì mỗi lần hiển thị danh sách
-- giáo viên phải gọi Auth Admin API `listUsers()` (phân trang, service role,
-- chậm) — dùng service role cho một read path bình thường là đúng thứ ta cấm.
--
-- Đây là bản SAO CHÉP để hiển thị/liên hệ. Nguồn sự thật để ĐĂNG NHẬP vẫn là
-- `auth.users.email`. Cột này được ghi lúc mời và khi admin sửa hồ sơ.
-- =============================================================================

alter table public.profiles add column if not exists email text;

create index if not exists ix_profiles_email on public.profiles (email);

-- Backfill cho tài khoản đã có (seed dev).
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;
