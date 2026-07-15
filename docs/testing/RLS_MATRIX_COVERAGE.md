# RLS / RPC / Storage coverage matrix

> Baseline P7-T2: 33 bảng public, 24 RPC public, 5 bucket private, 16 Storage policy.

| Vai trò | SELECT | INSERT | UPDATE | DELETE | RPC | Storage |
|---|---|---|---|---|---|---|
| Super admin | Toàn bộ domain theo policy; audit chỉ admin | CRUD catalog/lớp/nghiệp vụ | CRUD + workflow | Chỉ dữ liệu chưa có lịch sử; các bảng lịch sử chặn hard delete | Enrollment, session, assessment, tuition, announcement | Quản lý file theo policy từng bucket |
| Teacher | Chỉ lớp/học viên được phân công; không thấy học phí/audit | Điểm danh, tiến độ, assignment/assessment/evaluation đúng lớp | Đúng lớp; không sửa kết quả đã publish trái workflow | Chỉ draft/file đúng scope | RPC kiểm `teaches_class`, fail-closed | Course/assignment đúng lớp; submission đúng lớp |
| Student | Chỉ enrollment, lịch, bài, kết quả đã publish, học phí của mình | Bài nộp/file và preference của chính mình | Chỉ dữ liệu của mình chưa khóa; notification chỉ `read_at` | File bài nộp của mình trước khi chấm | Không gọi RPC admin/teacher/payment | Chỉ private object đã được RLS cho phép |

## Test thực thi

- Catalog invariant: `rls_catalog_matrix.test.sql` — số lượng, RLS toàn bộ bảng, mapping privilege→policy, RPC anon/auth/service, bucket private và policy Storage.
- Admin/teacher/student CRUD hành vi: `student_isolation`, `active_class_integrity`, `assignment_integrity`, `submission_grading`, `assessment_integrity`, `evaluation_notes`, `tuition_*`, `announcement_workflow`.
- RPC workflow và fail-closed: các file workflow kể trên cộng `generate_sessions_and_capacity`, `session_log`, `rate_limits`, `cron_jobs`.
- Storage/path: `material_uploader_attribution`, `assignment_integrity`, `submission_grading`; negative path và download-name ở unit `files.test.ts`.

Catalog test cố ý khóa baseline bằng số lượng. Thêm bảng/RPC/bucket mới mà chưa cập nhật matrix sẽ làm pgTAP đỏ, buộc review quyền trước khi merge.
