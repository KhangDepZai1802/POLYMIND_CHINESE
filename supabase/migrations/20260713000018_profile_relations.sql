-- =============================================================================
-- 18 — FK từ teachers/students sang profiles
--
-- Vấn đề: `teachers.user_id` và `students.user_id` trỏ tới `auth.users(id)`.
-- Đúng về mặt dữ liệu, nhưng PostgREST KHÔNG suy ra được quan hệ
-- `teachers → profiles` (nó chỉ đọc FK thật), nên
-- `.select("*, profile:profiles(...)")` báo:
--     "could not find the relation between teachers and profiles"
--
-- Cách sửa: thêm FK TRỰC TIẾP sang `profiles(id)`.
-- An toàn vì `profiles.id` CHÍNH LÀ `auth.users.id` (PK/FK 1-1) → không sinh ra
-- nguồn sự thật thứ hai, chỉ khai báo tường minh quan hệ vốn đã tồn tại.
--
-- Hệ quả nghiệp vụ: mỗi teacher/student có tài khoản đều BẮT BUỘC có profile —
-- đúng như luồng invite (tạo profile trước, tạo teacher/student sau).
-- =============================================================================

alter table public.teachers
  add constraint fk_teachers_profile
  foreign key (user_id) references public.profiles (id) on delete restrict;

alter table public.students
  add constraint fk_students_profile
  foreign key (user_id) references public.profiles (id) on delete set null;
