-- =============================================================================
-- 15 — GRANT quyền bảng
--
-- Postgres có HAI tầng kiểm soát độc lập, phải qua CẢ HAI:
--
--   1. GRANT  — role này có được ĐỘNG VÀO bảng không?     (thô, theo bảng)
--   2. RLS    — được đọc/ghi NHỮNG DÒNG NÀO?              (mịn, theo dòng)
--
-- Supabase bản mới KHÔNG còn tự cấp GRANT cho `anon`/`authenticated` khi tạo
-- bảng mới (xem `auto_expose_new_tables` trong config.toml). Thiếu file này thì
-- RLS policy viết đẹp đến mấy cũng vô nghĩa — mọi role đều nhận
-- "permission denied for table", kể cả super_admin.
--
-- Chiến lược:
--   • `anon`          → KHÔNG cấp gì. Chưa đăng nhập thì không có gì để xem.
--   • `authenticated` → cấp quyền bảng, để RLS quyết định từng dòng.
--   • Bảng APPEND-ONLY → chỉ SELECT. Không GRANT INSERT/UPDATE/DELETE, nên kể
--     cả khi ai đó lỡ thêm một RLS policy sai, dòng lịch sử vẫn không sửa được.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- --- authenticated: quyền bảng đầy đủ, RLS lọc dòng --------------------------

grant select, insert, update, delete on
  public.profiles,
  public.teachers,
  public.students,
  public.levels,
  public.courses,
  public.course_modules,
  public.lessons,
  public.course_materials,
  public.classes,
  public.class_teachers,
  public.class_schedules,
  public.class_sessions,
  public.enrollments,
  public.attendance_records,
  public.lesson_progress,
  public.assignments,
  public.assignment_attachments,
  public.submissions,
  public.submission_files,
  public.assessments,
  public.assessment_results,
  public.grading_scale_rules,
  public.learning_evaluations,
  public.student_notes,
  public.tuition_invoices,
  public.tuition_invoice_items,
  public.tuition_payments,
  public.tuition_receipts,
  public.announcements,
  public.notifications,
  public.notification_preferences
to authenticated;

-- --- Bảng APPEND-ONLY: chỉ đọc ------------------------------------------------
-- Ghi vào hai bảng này CHỈ qua function SECURITY DEFINER (app.write_audit,
-- các RPC enrollment). Không role app nào ghi trực tiếp được.

grant select on
  public.audit_logs,
  public.enrollment_status_history
to authenticated;

-- --- Views --------------------------------------------------------------------
-- Views dùng security_invoker = true → RLS của người gọi vẫn áp dụng khi đọc
-- bảng nền. GRANT ở đây chỉ mở cánh cửa, không mở dữ liệu.

grant select on
  public.v_student_attendance_summary,
  public.v_enrollment_progress,
  public.v_class_progress,
  public.v_at_risk_students,
  public.v_tuition_balance
to authenticated;

-- --- service_role: toàn quyền (bypass RLS — chỉ dùng cho admin flow server) ---

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- --- anon: KHÔNG CẤP GÌ -------------------------------------------------------
-- Không phải quên. Là cố ý. Anonymous không đọc/ghi được bất kỳ dữ liệu nghiệp
-- vụ nào — chặn ngay ở tầng GRANT, trước cả khi RLS kịp chạy.

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
