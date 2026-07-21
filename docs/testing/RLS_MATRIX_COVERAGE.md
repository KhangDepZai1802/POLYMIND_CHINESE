# RLS / RPC / Storage coverage matrix

> Baseline P7-T2: 33 bảng public, 24 RPC public, 5 bucket private, 16 Storage policy. Baseline sau P14: 56 bảng public, 65 RPC public, 6 bucket nghiệp vụ private; catalog migration sạch còn kiểm hai bucket legacy rỗng cho tới bước cleanup local.

| Vai trò | SELECT | INSERT | UPDATE | DELETE | RPC | Storage |
|---|---|---|---|---|---|---|
| Super admin | Toàn bộ domain theo policy; audit chỉ admin | CRUD catalog/lớp/nghiệp vụ | CRUD + workflow | Chỉ dữ liệu chưa có lịch sử; các bảng lịch sử chặn hard delete | Enrollment, session, assessment, tuition, announcement | Quản lý file theo policy từng bucket |
| Teacher | Chỉ lớp/học viên được phân công; không thấy học phí/audit | Điểm danh, tiến độ, assignment/assessment/evaluation đúng lớp | Đúng lớp; không sửa kết quả đã publish trái workflow | Chỉ draft/file đúng scope | RPC kiểm `teaches_class`, fail-closed | Course/assignment đúng lớp; submission đúng lớp |
| Student | Chỉ enrollment, lịch, bài, kết quả đã publish, học phí, flashcard và queue ôn của mình | Bài nộp/file và preference của chính mình | Chỉ dữ liệu của mình chưa khóa; notification chỉ `read_at`; queue mastery không sửa trực tiếp | File bài nộp của mình trước khi chấm | RPC ôn câu sai chỉ chấm own; không gọi RPC admin/teacher/payment | Chỉ private object đã được RLS cho phép; media review hết quyền khi resolved |

## Test thực thi

- Catalog invariant: `rls_catalog_matrix.test.sql` — số lượng, RLS toàn bộ bảng, mapping privilege→policy, RPC anon/auth/service, bucket private và policy Storage.
- Admin/teacher/student CRUD hành vi: `student_isolation`, `active_class_integrity`, `assignment_integrity`, `submission_grading`, `assessment_integrity`, `evaluation_notes`, `tuition_*`, `announcement_workflow`.
- RPC workflow và fail-closed: các file workflow kể trên cộng `generate_sessions_and_capacity`, `session_log`, `rate_limits`, `cron_jobs`.
- Storage/path: `material_uploader_attribution`, `assignment_integrity`, `submission_grading`, `flashcards`, `wrong-answer-review`; negative path và download-name ở unit `files.test.ts` / `flashcard-media.test.ts`.

Catalog test cố ý khóa baseline bằng số lượng. Thêm bảng/RPC/bucket mới mà chưa cập nhật matrix sẽ làm pgTAP đỏ, buộc review quyền trước khi merge.
