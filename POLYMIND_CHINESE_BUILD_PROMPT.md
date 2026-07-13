# MASTER PROMPT — XÂY DỰNG POLYMIND QUẢN LÝ HỌC VIÊN TIẾNG TRUNG

> Dùng toàn bộ nội dung file này làm prompt khởi đầu cho Claude Code hoặc Codex. Đây là đặc tả thực thi, không phải tài liệu tham khảo tùy chọn.

## 1. Vai trò và nhiệm vụ

Bạn là Principal Product Engineer kiêm Business Analyst, Database Architect, UX Engineer và QA Lead. Nhiệm vụ của bạn là xây dựng mới từ đầu một web app **POLYMIND quản lý học viên tiếng Trung**, dùng web POLYMIND xuất khẩu lao động hiện tại làm nguồn tham khảo về bài học nghiệp vụ, UX, phân quyền, audit, tài liệu và QA.

Không được nhân bản máy móc code hoặc database cũ. Domain mới phải được thiết kế lại đúng cho trung tâm đào tạo tiếng Trung và chạy tốt trên Vercel + Supabase.

Mục tiêu cuối cùng:

- Có một repo mới, độc lập, build và chạy được.
- Giao diện hiện đại, mobile-first, tiếng Việt, dễ dùng cho giáo viên.
- Có đủ nghiệp vụ quản lý khóa học, lớp, lịch/buổi học, học viên, điểm danh, bài tập, bài kiểm tra, đánh giá tiến độ, học phí cơ bản, thông báo và báo cáo.
- Có đúng 3 role cố định: `super_admin`, `teacher`, `student`.
- Bảo mật dữ liệu bằng Supabase RLS, không chỉ ẩn UI.
- Deploy frontend/full-stack lên Vercel; Auth, PostgreSQL và Storage dùng Supabase.
- Có tài liệu nền bắt buộc, test, seed demo, hướng dẫn deploy và nhật ký công việc đầy đủ.

Không dừng lại sau khi phân tích hoặc tạo skeleton. Hãy triển khai tuần tự đến khi đạt tiêu chí nghiệm thu, trừ khi thật sự bị chặn bởi credential hoặc quyết định bên ngoài. Nếu bị chặn cloud, vẫn phải hoàn tất local, migration, seed, test, tài liệu và ghi đúng blocker; không được báo “hoàn thành” khi chưa kiểm chứng.

---

## 2. Vị trí project và nguyên tắc bảo vệ repo cũ

### Repo tham chiếu, chỉ đọc

```text
C:\Users\khang\OneDrive\Documents\POLYMIND APP
```

### Repo mới cần tạo

```text
C:\Users\khang\OneDrive\Documents\POLYMIND CHINESE
```

Quy tắc bắt buộc:

1. Repo `POLYMIND APP` là web XKLĐ hiện tại, chỉ được đọc để khảo sát.
2. Không sửa, di chuyển, xóa, format, migrate database hoặc ghi `WORKLOG.md` của repo cũ.
3. Mọi code, migration, tài liệu và `WORKLOG.md` mới phải nằm trong `POLYMIND CHINESE`.
4. Nếu môi trường không cho ghi thư mục sibling, hãy xin đúng quyền cần thiết; không tự ý tạo project mới lẫn vào repo XKLĐ.
5. Không copy lịch sử Git, `.env`, secret, database dump, tài khoản thật hoặc dữ liệu cá nhân từ repo cũ.

---

## 3. Nguồn sự thật của web hiện tại và cách khảo sát

Trước khi viết code mới, phải đọc có chọn lọc nhưng đầy đủ các nguồn sau trong repo cũ:

1. Source thực tế trong `src/Polymind.Domain`, `src/Polymind.Infrastructure`, `src/Polymind.Web`.
2. Migrations mới nhất và `ApplicationDbContextModelSnapshot.cs`.
3. `docs/testing/MODULE_QA_BOARD.md`, `docs/testing/SESSION_CHECKPOINT.md` và hồ sơ module M01–M20.
4. `docs/01-business-analysis.md`, `docs/02-database-design.md`, `docs/03-workflow.md`, `docs/04-system-architecture.md`.
5. `WORKLOG.md`, `AI/AGENTS.md`, `AI/CLAUDE.md` để học cách phối hợp session.

Thứ tự ưu tiên khi tài liệu mâu thuẫn:

```text
Source + migration hiện tại
→ QA board/checkpoint và test
→ WORKLOG mới nhất
→ docs 01–04
→ các dump SQL/tài liệu cũ
```

Các sai lệch đã biết, không được lặp lại:

- `docs/03-workflow.md` còn mô tả 17 bước nhưng source thật đã là 20 bước chính cộng bước phụ 7.5.
- `docs/04-system-architecture.md` còn mô tả Next.js/NestJS legacy, trong khi app thật là .NET 10 + Blazor Server.
- `docs/02-database-design.md` và `polymind.sql` cũ hơn migrations; nhiều FK mô tả trong docs thực tế không tồn tại.
- Web hiện tại để nhiều query, quyền và mutation trực tiếp trong các file Razor rất lớn. Bản mới phải tách logic khỏi UI.

Giá trị cần học từ web cũ:

- Dashboard, list/detail, search/filter, card mobile và timeline.
- Auth, fail-closed data scope, audit, private file, signed URL.
- Thông báo một chiều, điều hướng về bản ghi nguồn.
- Báo cáo, export, test theo module và tài liệu phối hợp AI.
- Các bài học QA về IDOR, stale permission, attribution, transaction, idempotency, migration và seed production.

Không được port nguyên trạng:

- Candidate → JobOrder → workflow XKLĐ.
- ASP.NET Identity/RBAC 12 role.
- Blazor Server circuit, Hangfire worker, MinIO, file log, startup migration hoặc state singleton trong RAM.

---

## 4. Các quyết định sản phẩm đã chốt

Không hỏi lại các quyết định dưới đây trừ khi phát hiện mâu thuẫn không thể triển khai:

1. **Greenfield:** build lại từ đầu bằng stack khác; repo XKLĐ chỉ là core tham chiếu về bài học và UX.
2. **Không CRM tuyển sinh:** bỏ Lead, lead source, timeline chăm sóc và convert Lead. Luồng bắt đầu từ tạo hồ sơ học viên/ghi danh.
3. **Khóa học:** có hai dòng chương trình song song. Dòng cốt lõi trung tâm luôn giảng dạy gồm HSK 1–6, tiếng Trung giao tiếp, tiếng Trung thiếu nhi và luyện thi. Dòng tùy chỉnh/B2B dùng cho các chương trình theo đối tác như tiếng Trung ngân hàng và đàm phán tài chính. Không được xem các lớp Vietcombank là toàn bộ danh mục của trung tâm.
4. **Bài tập:** học viên được làm/nộp nội dung hoặc file trực tiếp trên web; giáo viên chấm điểm và phản hồi.
5. **Đánh giá:** bài kiểm tra dùng điểm 0–100; đánh giá định kỳ kết hợp xếp loại và kỹ năng nghe, nói, đọc, viết, từ vựng/ngữ pháp.
6. **Học phí:** giữ quản lý học phí cơ bản gồm hóa đơn/khoản phải thu, lịch hạn, thanh toán và phiếu thu. Bỏ vay, lịch trả nợ, thu nợ riêng, khoản chi và kế toán tổng quát.
7. **Giáo viên:** chỉ xem và thao tác trên lớp được phân công cùng học viên thuộc các lớp đó.
8. **Học viên:** chỉ xem dữ liệu của chính mình.
9. **Thông báo:** giữ thông báo một chiều cho lịch học, đổi lịch, vắng học, bài tập/kiểm tra, công bố điểm và học phí. Bỏ hoàn toàn chat/tin nhắn hai chiều.
10. **AI:** không thuộc v1. Chỉ ghi vào backlog phase sau; không mang Gemini/CV extraction của web XKLĐ sang.
11. **Tài khoản:** không mở public sign-up. Super admin tạo hồ sơ và gửi invite email cho giáo viên/học viên bằng Supabase Auth; hỗ trợ quên/đặt lại mật khẩu.
12. **Địa điểm:** v1 không cần quản lý đa tenant/chuỗi trung tâm, nhưng từng lớp phải hỗ trợ `offline`, `online`, `hybrid`, `in_house` và địa điểm linh hoạt do khách hàng chỉ định.
13. **Một học viên có thể học nhiều lớp đồng thời. Một lớp có thể có giáo viên chính và trợ giảng.**
14. **Ngôn ngữ UI:** tiếng Việt; ngày `dd/MM/yyyy`; múi giờ hiển thị `Asia/Ho_Chi_Minh`; DB lưu UTC.

---

## 5. Danh mục khóa học và dữ liệu lớp thực tế phải đưa vào seed

Phải phân biệt **chương trình/khóa học** với **lớp triển khai** và phân biệt khóa lõi của trung tâm với chương trình B2B theo đối tác.

### 5.1 Dòng khóa học cốt lõi của trung tâm

Đây là danh mục thường xuyên, không phải backlog hoặc dữ liệu demo tùy chọn:

- HSK 1.
- HSK 2.
- HSK 3.
- HSK 4.
- HSK 5.
- HSK 6.
- Tiếng Trung giao tiếp.
- Tiếng Trung thiếu nhi.
- Luyện thi HSK; cho phép cấu hình cấp độ/đích thi cụ thể thay vì tạo code cứng cho một kỳ thi duy nhất.

Seed các khóa này thành course catalog `active` riêng với `course_type` đúng. Không tự bịa học phí, số buổi, giáo trình hoặc lịch nếu chưa có nguồn; các trường chưa biết được để nullable/cần cấu hình, còn mỗi lớp triển khai phải chốt đủ số buổi, thời lượng và lịch trước khi kích hoạt. Super admin được tạo thêm biến thể như giao tiếp cơ bản/nâng cao, thiếu nhi theo độ tuổi hoặc luyện thi theo target level mà không sửa code.

### 5.2 Dòng chương trình tùy chỉnh/B2B đang triển khai cho Vietcombank

Dữ liệu đối tác hiện có gồm 2 chương trình và 3 lớp, không phải 3 khóa độc lập và không thay thế các khóa cốt lõi ở mục 5.1.

#### Chương trình A — Tiếng Trung Đàm Phán Tài Chính Chiến Lược

- Tên tiếng Anh: `Business Chinese for Executives`.
- Đối tượng: Ban Giám đốc.
- Loại: khóa tùy chỉnh / business Chinese.
- Thời lượng: 35 buổi, 90 phút/buổi.

##### Lớp 01

- Mã seed: `LOP-01`.
- Sĩ số tối đa: 3 học viên.
- Ngày bắt đầu dự kiến: 20/07/2026.
- Lịch: linh hoạt theo lịch Ban Giám đốc; chưa sinh lịch lặp cố định cho tới khi admin cấu hình.
- Hình thức: `in_house`.
- Địa điểm: trụ sở VCB hoặc địa điểm riêng tư do khách hàng chỉ định.
- Ghi chú nghiệp vụ: ưu tiên bảo mật và thuận tiện; địa điểm phải cho phép mô tả tự do, không ép chọn một cơ sở cố định.

#### Chương trình B — Tiếng Trung ngân hàng

- Đối tượng: Lãnh đạo phòng/Cán bộ nhân viên.
- Loại: khóa tùy chỉnh / business Chinese.
- Thời lượng: 35 buổi/lớp, 90 phút/buổi.
- Sĩ số tối đa: 26 học viên/lớp.
- Địa điểm: `108 Tây Thạnh, Phường Tây Thạnh, TP. HCM`.
- Hình thức: `offline`.

##### Lớp 02

- Mã seed: `LOP-02`.
- Lịch dự kiến: 08:00–09:30, thứ Hai và thứ Tư hằng tuần.
- Ngày bắt đầu dự kiến: 20/07/2026.

##### Lớp 03

- Mã seed: `LOP-03`.
- Lịch dự kiến: 08:00–09:30, thứ Ba và thứ Năm hằng tuần.
- Ngày bắt đầu dự kiến: 21/07/2026.

Seed level HSK 1–6, toàn bộ course catalog cốt lõi ở mục 5.1, hai chương trình B2B và ba lớp Vietcombank ở mục 5.2. Không tự bịa tên thật của giáo viên hoặc học viên. Dữ liệu demo phải dùng danh tính giả rõ ràng và không có mật khẩu production mặc định.

---

## 6. Phạm vi chức năng v1

### 6.1 Super Admin

- Dashboard toàn trung tâm.
- Quản lý tài khoản, mời giáo viên/học viên, khóa/mở tài khoản, gửi lại invite, reset mật khẩu.
- Quản lý hồ sơ giáo viên và học viên.
- Quản lý level, khóa học, module/chương, bài học.
- Tạo lớp, cấu hình sĩ số, thời lượng, hình thức, địa điểm, lịch học, giáo viên chính/trợ giảng.
- Ghi danh, tạm dừng, chuyển lớp, rút học và hoàn thành khóa.
- Xem/sửa lịch và buổi học; xử lý nghỉ, đổi lịch, học bù.
- Xem toàn bộ điểm danh, bài tập, bài kiểm tra, tiến độ và nhận xét.
- Quản lý học phí, hóa đơn, thanh toán, phiếu thu.
- Thông báo/announcement một chiều.
- Báo cáo, export và audit log.
- Cài đặt ngưỡng xếp loại/điều kiện hoàn thành.

### 6.2 Giáo viên

- Dashboard “Hôm nay”: lịch dạy, lớp sắp tới, buổi chưa điểm danh, bài chờ chấm, học viên cần chú ý.
- Chỉ thấy lớp được phân công và học viên đang/đã ghi danh trong các lớp đó.
- Xem chương trình, module, bài học, tài liệu của lớp.
- Mở/hoàn tất buổi học, ghi nội dung thực dạy, ghi chú và bài học liên quan.
- Điểm danh nhanh theo roster: Có mặt, Đi muộn, Vắng, Có phép; hỗ trợ thao tác hàng loạt.
- Tạo bài tập, đính kèm file, đặt hạn nộp; xem bài nộp; chấm điểm và phản hồi.
- Tạo bài kiểm tra/quiz/midterm/final/mock HSK; nhập điểm tổng và điểm kỹ năng.
- Tạo đánh giá tuần/tháng, nhận xét, kế hoạch cải thiện và chọn thời điểm công bố cho học viên.
- Xem báo cáo lớp mình dạy.
- Không được xem học phí, quản lý tài khoản, audit, lớp khác hoặc học viên không liên quan.

### 6.3 Học viên

- Dashboard cá nhân: buổi học kế tiếp, bài sắp đến hạn, điểm mới, chuyên cần và tiến độ.
- Xem hồ sơ cơ bản của chính mình.
- Xem lớp/khóa đang học, lịch, buổi học, tài liệu được công bố.
- Xem điểm danh của chính mình.
- Xem bài tập, nộp nội dung/file, theo dõi trạng thái và phản hồi.
- Xem bài kiểm tra, kết quả đã công bố, đánh giá kỹ năng và nhận xét được phép hiển thị.
- Xem hóa đơn/học phí và lịch sử thanh toán của chính mình; không được tự ghi nhận thanh toán.
- Xem thông báo của chính mình.
- Không thấy học viên khác, ghi chú nội bộ, dữ liệu lớp khác hoặc chức năng quản trị.

### 6.4 Chức năng dùng chung

- Đăng nhập, logout, quên mật khẩu, đổi mật khẩu.
- Search, filter, sort, pagination; trạng thái rõ ràng.
- Responsive desktop/tablet/mobile.
- Loading, empty, error, confirmation, unsaved-change state.
- Private file upload/download qua signed URL.
- Audit cho mutation quan trọng.
- Export CSV/XLSX cho danh sách học viên, điểm danh, kết quả, tiến độ và học phí.
- Trang báo cáo tiến độ cá nhân có bản in thân thiện; PDF server-side không phải blocker v1.

---

## 7. Những module bắt buộc xóa hoàn toàn

Không tạo route, table, enum, seed, permission, menu, label hay code chết cho các domain sau:

- Lead CRM và hoạt động chăm sóc Lead.
- Candidate/ứng viên XKLĐ.
- Jobs/đơn hàng tuyển dụng.
- Workflow 20 bước XKLĐ, COE và tái chọn đơn hàng.
- Đại lý, cộng tác viên, cây đại lý, bảng thi đua.
- Cấu hình/tính/duyệt/chi hoa hồng.
- Hỗ trợ vay, vay ngân hàng, nợ công ty, lịch trả góp, thu nợ.
- Khoản chi, duyệt chi, lợi nhuận tổng quát.
- Visa, phỏng vấn visa, chuyến bay, xuất cảnh, hỗ trợ ở nước ngoài.
- Chat/tin nhắn 1-1, audio message, thu hồi tin.
- Phụ huynh như một role đăng nhập.
- Gemini, OCR CV/hộ chiếu, phân tích hồ sơ XKLĐ trong v1.
- Passport, COE, quốc gia đến, nghiệp đoàn, lương, phí xuất cảnh, agent/CTV ID và mọi thuật ngữ XKLĐ.

“Còn phải thu học phí” là số dư hóa đơn học phí, không được biến thành module vay/thu nợ như web cũ.

---

## 8. Kiến trúc công nghệ bắt buộc

Trước khi scaffold, kiểm tra tài liệu chính thức và chọn phiên bản stable tương thích mới nhất tại thời điểm thực hiện; khóa phiên bản bằng lockfile. Không dùng package beta nếu có lựa chọn stable tương đương.

### Web/full-stack

- Next.js App Router.
- TypeScript `strict`.
- React Server Components cho read path; Client Components chỉ cho phần tương tác cần thiết.
- Server Actions cho form mutation nội bộ.
- Route Handlers cho export, health, cron/webhook và API tích hợp.
- Node runtime cho nghiệp vụ cần Supabase/service role; không ép Edge nếu thư viện không tương thích.
- Package manager: `npm`.

### UI

- Tailwind CSS.
- shadcn/ui.
- Lucide icons.
- React Hook Form + Zod.
- TanStack Table cho bảng lớn.
- Recharts cho dashboard/report khi cần.
- `date-fns` hoặc thư viện tương đương để xử lý ngày/lịch rõ ràng.

### Backend/data

- Supabase Auth.
- Supabase PostgreSQL.
- Supabase Storage private buckets.
- Supabase RLS trên toàn bộ bảng exposed.
- `@supabase/ssr` theo hướng dẫn chính thức, tách browser/server/admin client.
- Supabase CLI và SQL migrations trong repo.
- PostgreSQL functions/RPC cho mutation nhiều bảng cần transaction hoặc locking.
- In-app notifications lưu DB; cron dùng Supabase Cron hoặc Vercel Cron có secret. Không dùng worker luôn chạy trong process.

### Test

- Vitest.
- React Testing Library.
- Playwright.
- pgTAP/Supabase SQL tests cho RLS và database rules.

### Deploy

- Vercel cho Next.js.
- Supabase cho Auth/Postgres/Storage.
- Vercel Function region đặt gần Supabase region; ưu tiên Singapore/region gần Việt Nam khi tài khoản hỗ trợ.
- Preview deployment cho pull request; production từ `main`.
- Migration chạy qua Supabase CLI/CI trước deploy production; không migration khi app startup.

Không tạo NestJS/backend server riêng ở v1. Không Docker Compose production. Docker/Supabase local chỉ dùng development nếu cần.

---

## 9. Cấu trúc source bắt buộc

Có thể tinh chỉnh tên nhỏ nhưng phải giữ ranh giới trách nhiệm tương đương:

```text
POLYMIND CHINESE/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  ├─ (dashboard)/
│  │  │  ├─ admin/
│  │  │  ├─ teacher/
│  │  │  └─ student/
│  │  ├─ api/
│  │  └─ auth/
│  ├─ features/
│  │  ├─ users/
│  │  ├─ students/
│  │  ├─ teachers/
│  │  ├─ courses/
│  │  ├─ classes/
│  │  ├─ schedules/
│  │  ├─ enrollments/
│  │  ├─ attendance/
│  │  ├─ assignments/
│  │  ├─ assessments/
│  │  ├─ progress/
│  │  ├─ tuition/
│  │  ├─ notifications/
│  │  ├─ reports/
│  │  └─ audit/
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ layout/
│  │  └─ shared/
│  ├─ lib/
│  │  ├─ supabase/
│  │  ├─ auth/
│  │  ├─ permissions/
│  │  ├─ validation/
│  │  ├─ dates/
│  │  └─ domain/
│  └─ types/
├─ supabase/
│  ├─ migrations/
│  ├─ tests/
│  ├─ seed.sql
│  └─ config.toml
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
├─ docs/
├─ public/
├─ AGENTS.md
├─ CLAUDE.md
├─ WORKLOG.md
├─ README.md
└─ .env.example
```

Quy tắc code:

- Không để page/component truy vấn và mutation DB dài hàng trăm dòng.
- Business rule nằm trong `features/*/server` hoặc domain service/function, có unit test.
- Schema types được generate từ Supabase; không tự duy trì type DB bằng tay nếu có thể generate.
- Mọi mutation kiểm quyền ở server và được RLS bảo vệ ở DB.
- Không dùng service role cho thao tác thông thường của teacher/student.
- Không dùng `user_metadata` do client sửa làm nguồn phân quyền.
- Authenticated page không được cache/ISR theo cách có thể rò session giữa user.

---

## 10. Thiết kế database tối thiểu

Dùng UUID, `snake_case`, `timestamptz`, `created_at`, `updated_at`; có trigger `updated_at`. Mọi FK và cột thường filter phải có index phù hợp. Enum có thể dùng PostgreSQL enum hoặc text + CHECK; lựa chọn phải nhất quán và migration-safe.

### 10.1 Danh tính

#### `profiles`

- `id` PK/FK → `auth.users.id`.
- `role`: `super_admin | teacher | student`.
- `full_name`, `phone`, `avatar_path`.
- `is_active`.
- timestamps.

Role chỉ được set/đổi bởi trusted server/admin function. Không cho user tự nâng role.

#### `teachers`

- `id` UUID PK.
- `user_id` UNIQUE, NOT NULL, FK → `auth.users.id`.
- `teacher_code` UNIQUE.
- `specialization`, `bio`, `is_active`.
- timestamps.

#### `students`

- `id` UUID PK.
- `user_id` UNIQUE, nullable, FK → `auth.users.id` để có thể tạo hồ sơ trước rồi mới invite.
- `student_code` UNIQUE.
- `full_name`, `dob`, `gender`, `phone`, `email`, `address`.
- `guardian_name`, `guardian_phone`, `guardian_relation` chỉ là thông tin liên hệ; không tạo role phụ huynh.
- `current_level_id`, `target_level_id`.
- `learning_goal`, `joined_on`, `status`, `note`, `archived_at`.
- timestamps.

### 10.2 Khóa học và giáo trình

#### `levels`

- Danh mục cấu hình, seed HSK 1–6.
- Có `code`, `name`, `framework`, `order_index`, `description`, `is_active`.
- Không hard-code toàn bộ app vào enum HSK để vẫn tạo được level nội bộ.

#### `courses`

- `code`, `title`, `title_en`, `course_type`.
- `course_type` tối thiểu hỗ trợ: `hsk | communication | kids | exam_prep | business_custom | custom`.
- `level_id` nullable cho khóa tùy chỉnh.
- `target_audience`, `objectives`, `description`.
- `default_session_count`, `default_session_duration_minutes` nullable ở catalog khi trung tâm chưa cung cấp; phải có giá trị cụ thể ở class trước khi kích hoạt.
- `default_tuition_amount` nullable.
- Điều kiện hoàn thành cấu hình: ngưỡng chuyên cần, điểm tối thiểu, yêu cầu bài tập.
- `status`: `draft | active | archived`.
- timestamps, `created_by`.

#### `course_modules`

- FK course; title, description, order index.
- UNIQUE `(course_id, order_index)`.

#### `lessons`

- FK module/course; title, objectives, content summary, planned duration, order index.
- UNIQUE trong module.

#### `course_materials`

- FK course/module/lesson rõ ràng theo thiết kế, tránh polymorphic UUID mềm.
- title, object path, MIME, size, visibility, uploader.

### 10.3 Lớp, lịch và ghi danh

#### `classes`

- `code` UNIQUE, `course_id` FK.
- `name`, `target_audience` override nullable.
- `capacity` CHECK > 0.
- `planned_session_count`, `session_duration_minutes`.
- `start_date`, `expected_end_date`.
- `delivery_mode`: `offline | online | hybrid | in_house`.
- `location_name`, `address`, `meeting_url`, `location_note` nullable theo mode.
- `status`: `planned | active | paused | completed | cancelled`.
- timestamps, `created_by`.

#### `class_teachers`

- `class_id`, `teacher_id`.
- `assignment_role`: `primary | assistant`.
- UNIQUE `(class_id, teacher_id)`.
- Bảo đảm mỗi lớp tối đa một giáo viên `primary` bằng partial unique index.

#### `class_schedules`

- FK class.
- `weekday` theo ISO 1–7.
- `start_time`, `end_time` CHECK end > start.
- `effective_from`, `effective_to` nullable.
- timezone mặc định `Asia/Ho_Chi_Minh`.
- Lớp linh hoạt có thể chưa có row schedule.

#### `class_sessions`

- FK class, optional schedule, optional lesson.
- `session_number` unique trong class.
- `starts_at`, `ends_at` UTC.
- `topic`, `lesson_log`, `teacher_note`.
- `status`: `scheduled | completed | cancelled | rescheduled`.
- `original_session_id` nullable cho học bù/đổi lịch.
- timestamps, actor.

Sinh buổi từ lịch lặp phải idempotent, không tạo trùng và dừng đúng `planned_session_count`. Nghỉ/đổi/học bù là override trên session, không sửa mất lịch sử.

#### `enrollments`

- `student_id`, `class_id`.
- UNIQUE `(student_id, class_id)`.
- `status`: `pending | active | paused | completed | withdrawn | transferred`.
- ngày ghi danh/bắt đầu/kết thúc, lý do, học phí override nullable.
- timestamps, actor.

#### `enrollment_status_history`

- FK enrollment; old/new status, reason, actor, time.
- Append-only.

Chuyển lớp không xóa enrollment cũ: đánh dấu `transferred`, tạo enrollment mới trong cùng transaction và lưu history/audit.

### 10.4 Điểm danh và tiến độ bài học

#### `attendance_records`

- `session_id`, `enrollment_id`.
- UNIQUE `(session_id, enrollment_id)`.
- `status`: `present | late | absent | excused`.
- check-in time, note, marked_by, marked_at.
- Chỉ tạo cho enrollment thuộc đúng class của session.

#### `lesson_progress`

- `enrollment_id`, `lesson_id`.
- UNIQUE `(enrollment_id, lesson_id)`.
- `status`: `not_started | in_progress | completed`.
- completed_at, teacher note, actor.

Không dùng một cột `% tiến độ` nhập tay như app cũ. Progress tổng hợp phải được tính từ bài học hoàn thành, chuyên cần, bài tập và kết quả; có view/RPC rõ công thức.

### 10.5 Bài tập và bài nộp

#### `assignments`

- FK class, optional lesson/session.
- title, instructions, `due_at`, max score, published_at.
- `allow_late_submission`, `max_attempts`, status.
- created_by, timestamps.

#### `assignment_attachments`

- FK assignment; object path, file metadata, uploader.

#### `submissions`

- `assignment_id`, `enrollment_id`.
- Một record hiện hành cho mỗi cặp; nếu hỗ trợ nhiều lần nộp thì có `submission_attempts` riêng, không ghi đè lịch sử.
- text answer, submitted_at, late flag, status.
- score CHECK 0..max score, feedback, graded_by, graded_at.
- Học viên chỉ nộp cho enrollment của chính mình và assignment đã publish thuộc lớp đang học.

#### `submission_files`

- FK submission/attempt; private object path, MIME, size, original filename.

### 10.6 Kiểm tra, điểm và đánh giá

#### `assessments`

- FK class, optional lesson/module.
- type: `quiz | midterm | final | mock_hsk | speaking | custom`.
- title, assessment date, max score, skill weights, published_at.

#### `assessment_results`

- `assessment_id`, `enrollment_id` UNIQUE.
- Điểm tổng 0–100.
- Điểm kỹ năng nullable 0–100: listening, speaking, reading, writing, vocabulary, grammar.
- classification được tính từ grading scale, không cho client tự bịa.
- feedback, graded_by, graded_at, published_at.

#### `grading_scale_rules`

- Super admin cấu hình ngưỡng min/max và label.
- Seed mặc định hợp lý, không hard-code label rải rác trong UI.
- Ngưỡng không chồng lấn, phủ 0–100 bằng constraint/validation.

#### `learning_evaluations`

- FK enrollment, evaluation date/period.
- Rating định kỳ: `weak | average | good | excellent`.
- Có rating hoặc score cho nghe, nói, đọc, viết, từ vựng/ngữ pháp.
- strengths, areas for improvement, action plan, teacher comment.
- `visible_to_student`, `published_at`, created_by.
- Không có tiêu chí “tài chính” trong đánh giá học tập.

#### `student_notes`

- Ghi chú giáo viên theo enrollment.
- visibility: `staff_only | student_visible`.
- Học viên tuyệt đối không đọc `staff_only` qua API, query trực tiếp hoặc signed URL.

### 10.7 Học phí cơ bản

#### `tuition_invoices`

- `invoice_code` UNIQUE.
- FK student và optional enrollment/class.
- issue date, due date, subtotal, discount, total CHECK >= 0.
- status: `draft | issued | partial | paid | overdue | cancelled | refunded`.
- note, actor, timestamps.

#### `tuition_invoice_items`

- FK invoice; description, quantity, unit amount, line total.

#### `tuition_payments`

- `payment_code` UNIQUE.
- FK invoice/student.
- amount CHECK > 0, paid_at, method, reference, note, recorded_by.
- Không cho tổng thanh toán hợp lệ vượt số phải thu nếu chưa đi qua flow hoàn tiền/điều chỉnh rõ ràng.

#### `tuition_receipts`

- `receipt_code` UNIQUE.
- FK payment UNIQUE để chống sinh trùng.
- issued_at, metadata người lập, optional printable snapshot/object path.

Số dư học phí là giá trị tính từ invoice và payment, không lưu một “công nợ” rời dễ lệch. Teacher không có quyền đọc bảng học phí. Student chỉ đọc invoice/payment của chính mình.

### 10.8 Thông báo, announcement và audit

#### `announcements`

- Thông báo một chiều theo toàn hệ thống hoặc một lớp.
- title, body, publish/expire time, actor.
- Không có reply/thread/chat.

#### `notifications`

- user, type, title, body, link/reference rõ ràng, read_at, created_at.
- `dedupe_key` nullable; partial unique khi khác null để chống tạo trùng.
- V1 ưu tiên in-app; email nghiệp vụ ngoài invite/reset là phase sau nếu chưa có provider.

#### `notification_preferences`

- user + notification type; in-app enabled.
- Thiết kế mở rộng email nhưng không thêm SMS/Zalo giả lập.

#### `audit_logs`

- actor, action, resource, resource_id, before/after JSONB, request context, created_at.
- Append-only; không update/delete qua role app.
- Chỉ super admin đọc.
- Audit mutation nhạy cảm: role/account, hồ sơ, khóa/lớp/lịch, enrollment/transfer, attendance, grade publish, học phí/payment, file visibility.

### 10.9 Views/RPC đề xuất

- `v_student_attendance_summary`.
- `v_enrollment_progress`.
- `v_class_progress`.
- `v_at_risk_students`.
- `v_tuition_balance`.
- RPC transaction cho invite/link account, enroll/transfer, bulk attendance, publish grades, record payment/receipt và generate sessions.

Views exposed phải dùng `security_invoker = true` hoặc được bảo vệ đúng cách. Security-definer function đặt trong schema private, cố định `search_path`, revoke quyền mặc định và test kỹ.

---

## 11. Ràng buộc integrity và lifecycle

1. FK thật cho mọi quan hệ; không lặp pattern UUID mềm của app cũ.
2. Index mọi FK, cột RLS và filter chính.
3. CHECK amount > 0, score 0–100, capacity > 0, end > start, ngày hợp lệ.
4. Code business unique và sinh an toàn khi concurrency.
5. Dữ liệu lịch sử không hard delete. Dùng archive/status; `ON DELETE RESTRICT` hoặc `SET NULL` phù hợp. Cascade chỉ cho child thuần không có ý nghĩa độc lập.
6. Mutation nhiều bảng phải atomic.
7. Bulk attendance phải idempotent/upsert theo unique key, không tạo bản ghi trùng.
8. Sinh session theo recurrence phải idempotent.
9. Công bố điểm/đánh giá tách khỏi lưu draft. Student chỉ thấy dữ liệu có `published_at` và visibility hợp lệ.
10. Student có thể ở nhiều lớp; class capacity phải được kiểm tra transactionally khi activate enrollment.
11. Hoàn thành khóa dựa trên rule cấu hình. Hệ thống hiển thị “đủ/chưa đủ điều kiện”; super admin hoặc giáo viên được phân công xác nhận hoàn thành, có audit.
12. Mặc định đề xuất: chuyên cần tối thiểu 80%, điểm tổng tối thiểu 50/100; super admin được chỉnh theo course trước khi lớp bắt đầu. Không sửa hồi tố âm thầm cho lớp đang chạy.
13. Mọi thời điểm lưu UTC; lịch hiển thị và tạo recurrence theo `Asia/Ho_Chi_Minh`, xử lý rõ ranh giới ngày.

---

## 12. Supabase Auth, RLS và Storage

### 12.1 Auth

- Dùng Supabase Auth email/password với SSR cookie theo official guide.
- Không public sign-up.
- Super admin invite user qua server-only action dùng service role.
- Tạo/link `profiles`, `teachers` hoặc `students` an toàn và idempotent.
- User bị `is_active=false` phải bị chặn cả UI lẫn server/data path.
- Generic login error, rate limit phù hợp, reset password an toàn.
- Service-role key chỉ tồn tại trong Vercel server environment, tuyệt đối không `NEXT_PUBLIC_`.

### 12.2 Ma trận RLS bắt buộc

#### Anonymous

- Không đọc/ghi bất kỳ dữ liệu nghiệp vụ hoặc object private nào.

#### Super Admin

- Toàn quyền nghiệp vụ.
- Chỉ trusted server path được invite/khóa user hoặc đổi role.

#### Teacher

- Read course/lesson/material cần cho lớp được phân công.
- Read học viên/enrollment thuộc lớp được phân công.
- CRUD session log, attendance, assignment, assessment, result, evaluation và note trong lớp được phân công theo rule.
- Không đọc tuition, audit, account admin, role hoặc lớp không được phân công.
- Không thể tự gán mình sang lớp khác.

#### Student

- Read profile/student record của chính mình.
- Read enrollment, schedule, session/material được publish của lớp mình học.
- Read attendance, published result/evaluation và tuition của chính mình.
- Insert/update submission của chính mình theo rule; không sửa điểm/feedback.
- Read notification/announcement được nhắm tới mình/lớp mình.
- Không đọc roster hoặc dữ liệu học viên khác.

Mọi policy phải fail-closed khi mapping thiếu. Không coi việc ẩn menu/nút là authorization.

### 12.3 Storage

Private buckets đề xuất:

- `avatars`.
- `course-materials`.
- `assignment-files`.
- `submissions`.
- `student-documents` nếu thực sự triển khai hồ sơ đính kèm.

Yêu cầu:

- Policy Storage đồng bộ đúng role/class/student như DB.
- Object path do server/domain function sinh, không tin path tùy ý từ client.
- Whitelist extension/MIME, giới hạn dung lượng, tên file an toàn.
- Signed URL thời hạn ngắn.
- Xóa metadata/object phải có transaction/compensation rõ; không để orphan im lặng.
- Test IDOR bằng cách đổi object path/class/student ID.

---

## 13. Workflow nghiệp vụ mới

### 13.1 Thiết lập chương trình và lớp

```text
Super Admin tạo Level/Khóa học
→ tạo Module/Bài học
→ tạo Lớp triển khai
→ cấu hình sĩ số, số buổi, hình thức, địa điểm
→ gán giáo viên chính/trợ giảng
→ cấu hình lịch lặp hoặc đánh dấu lịch linh hoạt
→ sinh các buổi học có kiểm soát
→ ghi danh học viên
→ kích hoạt lớp
```

### 13.2 Vận hành mỗi buổi học

```text
Giáo viên mở Dashboard Hôm nay
→ chọn buổi/lớp
→ điểm danh nhanh
→ ghi nội dung thực dạy + bài học đã hoàn thành
→ giao bài tập/tài liệu nếu có
→ hoàn tất buổi
→ hệ thống cập nhật thống kê và thông báo
```

### 13.3 Bài tập

```text
Giáo viên tạo và publish bài + hạn nộp
→ học viên xem và nộp text/file
→ hệ thống đánh dấu đúng hạn/nộp muộn
→ giáo viên chấm 0–100 + phản hồi
→ giáo viên publish
→ học viên nhận thông báo và xem kết quả
```

### 13.4 Kiểm tra và đánh giá tiến độ

```text
Giáo viên tạo bài kiểm tra
→ nhập điểm tổng/kỹ năng
→ lưu draft
→ review và publish
→ hệ thống tính xếp loại/progress
→ giáo viên tạo nhận xét tuần/tháng + kế hoạch cải thiện
→ học viên chỉ thấy bản đã publish/được phép hiển thị
```

### 13.5 Tạm dừng/chuyển/rút lớp

- Không xóa enrollment.
- Lưu trạng thái, lý do, actor và thời điểm.
- Chuyển lớp tạo enrollment mới và giữ lịch sử lớp cũ.
- Không tự động chuyển điểm/attendance sang lớp mới; nếu cần quy đổi phải là thao tác riêng có audit.
- Học phí liên quan xử lý qua invoice adjustment/refund rõ ràng, không sửa số liệu lịch sử trực tiếp.

### 13.6 Học phí

```text
Super Admin phát hành invoice
→ học viên xem số phải thu/hạn
→ Super Admin ghi nhận payment
→ transaction cập nhật trạng thái invoice + sinh receipt duy nhất
→ student nhận thông báo
```

### 13.7 Hoàn thành

- Tính readiness từ chuyên cần, lesson progress, assignment và assessment theo rule khóa.
- Teacher lớp hoặc super admin xác nhận completion.
- Khóa học/lớp đã hoàn thành vẫn read-only/history; chỉnh sửa hồi tố phải giới hạn và audit.
- Certificate là optional phase sau, không blocker v1.

---

## 14. Thông báo v1

Giữ thông báo một chiều, không chat. Tối thiểu có:

- Lịch học sắp tới.
- Buổi học bị đổi/hủy/học bù.
- Bài tập mới và sắp hết hạn.
- Bài kiểm tra sắp tới.
- Kết quả/nhận xét vừa được publish.
- Học viên bị đánh dấu vắng/đi muộn.
- Invoice học phí mới, sắp hạn hoặc quá hạn.
- Announcement toàn hệ thống/lớp.

Mỗi notification có link nội bộ hợp lệ, kiểm authorization khi click. Dùng dedupe key để cron không sinh trùng. V1 chỉ bắt buộc in-app; email nghiệp vụ có thể bật sau khi có provider, nhưng email invite/reset của Supabase Auth phải hoạt động.

---

## 15. Báo cáo và dashboard

### Super Admin dashboard

- Học viên đang học.
- Lớp đang hoạt động.
- Lịch/buổi học hôm nay.
- Tỷ lệ chuyên cần toàn trung tâm.
- Tiến độ và điểm trung bình.
- Học viên cần chú ý: vắng nhiều, bài thiếu, điểm thấp.
- Hóa đơn đến hạn/quá hạn và tổng học phí đã thu theo kỳ.
- Lớp sắp bắt đầu/kết thúc.

### Teacher dashboard

- Lịch dạy hôm nay/tuần này.
- Buổi chưa điểm danh/chưa hoàn tất.
- Bài chờ chấm.
- Học viên cần hỗ trợ trong lớp mình.
- Chuyên cần và tiến độ theo lớp mình.

### Student dashboard

- Buổi học kế tiếp.
- Bài tập/kiểm tra sắp tới.
- Chuyên cần cá nhân.
- Điểm và đánh giá mới.
- Tiến độ khóa/kỹ năng.
- Học phí sắp hạn.

### Reports

- Danh sách và trạng thái học viên.
- Sĩ số/ghi danh theo khóa/lớp.
- Điểm danh theo buổi/lớp/học viên/thời gian.
- Bài tập và tỷ lệ hoàn thành.
- Kết quả kiểm tra và kỹ năng.
- Tiến độ/xếp loại/học viên cần chú ý.
- Học phí đã thu/còn phải thu/quá hạn.

Mọi report phải áp đúng data scope; teacher chỉ lớp mình, student chỉ mình. Export phải giữ đúng filter/date range đang chọn.

---

## 16. UX/UI và information architecture

### Design direction

- Light-first, sạch, hiện đại, ít chữ thừa.
- Giữ xanh POLYMIND làm primary; đỏ Trung Hoa chỉ là accent, không phủ toàn màn hình.
- Font rõ tiếng Việt và hỗ trợ chữ Hán/pinyin; ưu tiên Be Vietnam Pro/Inter kèm fallback CJK phù hợp.
- Touch target tối thiểu 44px, WCAG AA, keyboard navigation.
- Không dùng màu là tín hiệu trạng thái duy nhất.
- Form lớn dùng page/sheet; tránh dialog lồng nhau.
- Desktop sidebar; mobile bottom navigation theo role, tối đa 4–5 mục chính.

### Menu Super Admin

- Tổng quan.
- Học viên.
- Giáo viên.
- Khóa học.
- Lớp học.
- Lịch học.
- Học phí.
- Báo cáo.
- Thông báo.
- Quản trị & Audit.

### Menu Teacher

- Hôm nay.
- Lớp của tôi.
- Điểm danh.
- Bài tập & Chấm bài.
- Đánh giá tiến độ.

### Menu Student

- Tổng quan.
- Lịch học.
- Bài tập.
- Kết quả.
- Hồ sơ.

### Màn hình ưu tiên

1. Attendance roster một màn hình, nút lớn, chọn hàng loạt, nút Lưu sticky.
2. Teacher “Hôm nay” vào được lớp/buổi trong 1–2 thao tác.
3. Student dashboard nhìn ngay buổi kế tiếp và deadline.
4. Class detail dùng tabs: Tổng quan, Lịch/Buổi, Học viên, Điểm danh, Bài tập, Kiểm tra, Tiến độ, Tài liệu.
5. Student detail dùng tabs: Hồ sơ, Lớp học, Chuyên cần, Bài tập, Điểm/Đánh giá, Học phí, Audit rút gọn cho admin.

Không tạo lại trang monolith hơn 2.000 dòng như `CandidateDetail.razor` cũ.

---

## 17. Tài liệu bắt buộc phải tạo trước và duy trì cùng code

Ngay giai đoạn đầu, phải tạo tối thiểu các file sau trong repo mới:

```text
docs/01-business-analysis.md
docs/02-database-design.md
docs/03-workflow.md
docs/04-system-architecture.md
WORKLOG.md
AGENTS.md
CLAUDE.md
README.md
.env.example
```

Khuyến nghị tạo thêm:

```text
docs/05-testing-strategy.md
docs/06-deployment-vercel-supabase.md
docs/07-product-backlog.md
docs/testing/MODULE_QA_BOARD.md
```

### `01-business-analysis.md`

- Mục tiêu, actors, glossary.
- Module v1/in-out scope.
- Role matrix.
- Business rules và acceptance criteria.
- Hai chương trình/ba lớp thực tế.
- Không còn thuật ngữ XKLĐ.

### `02-database-design.md`

- ERD Mermaid.
- Bảng/cột/type/FK/index/unique/check/delete behavior.
- RLS matrix từng bảng.
- Storage buckets/policies.
- Views/RPC/trigger/audit.
- Seed strategy và migration rules.

### `03-workflow.md`

- Setup course/class.
- Invite account.
- Enroll/transfer/pause/withdraw/complete.
- Session/attendance.
- Assignment/submission/grade.
- Assessment/evaluation/publish.
- Tuition/payment/receipt.
- Notification workflows và failure paths.

### `04-system-architecture.md`

- Kiến trúc Next.js/Vercel/Supabase thực tế, không copy tài liệu legacy.
- Auth SSR, server/client/admin Supabase clients.
- Feature boundaries, data flow, transaction, caching.
- RLS, Storage, cron, logs, deploy, backup và rollback.

### `WORKLOG.md`

Đây là nguồn phối hợp bắt buộc giữa Claude/Codex. Mỗi session phải:

1. Đọc trạng thái hiện tại, quyết định đã chốt, blocker và entry mới nhất trước khi làm.
2. Ghi mục tiêu session.
3. Sau khi làm, ghi đúng:
   - ngày/giờ và agent;
   - việc đã làm;
   - file thay đổi;
   - migration/data impact;
   - test đã chạy và kết quả thật;
   - quyết định mới;
   - blocker/rủi ro;
   - next action chính xác.
4. Không ghi “pass”, “deploy”, “verified” nếu chưa chạy/kiểm chứng.
5. Giữ phần current status gọn; lịch sử session append có cấu trúc.

### `AGENTS.md` và `CLAUDE.md`

Bắt buộc nêu:

- Đọc `WORKLOG.md` và docs 01–04 trước khi sửa code.
- Docs là source of truth về yêu cầu; migration/source là source of truth về implementation.
- Cập nhật docs cùng business change.
- Không sửa repo XKLĐ.
- Không tự đổi các quyết định đã chốt.
- Mọi bảng public phải RLS; mọi migration phải có test.
- Không commit secret.
- Không bypass RLS bằng service role cho user flow.
- Build/lint/typecheck/test xanh trước khi kết thúc; nếu không xanh phải ghi blocker thật.
- Không tự ghi đè thay đổi không liên quan của user/agent khác.

---

## 18. Kế hoạch triển khai bắt buộc

### Phase 0 — Khảo sát và đặc tả

- Đọc repo cũ theo mục 3.
- Tạo repo mới và Git riêng.
- Tạo đầy đủ docs bắt buộc.
- Chốt ERD, role/RLS matrix, route map, test strategy.
- Ghi WORKLOG session đầu.

Gate: docs không mâu thuẫn và phân biệt đúng Course/Class/Session.

### Phase 1 — Scaffold và nền tảng

- Scaffold Next.js TypeScript strict.
- Cài UI/test stack.
- Khởi tạo Supabase local/config/migrations.
- Auth SSR, login/reset/invite, role routing.
- App shell theo 3 role.
- CI lint/typecheck/unit/build.

Gate: ba role login/redirect đúng; anonymous bị chặn.

### Phase 2 — Schema, RLS và seed

- Tạo migrations toàn bộ core schema.
- FK/index/check/trigger/RPC.
- RLS và Storage policies.
- pgTAP RLS tests.
- Seed level HSK 1–6; catalog HSK 1–6, giao tiếp, thiếu nhi, luyện thi; hai chương trình B2B và ba lớp Vietcombank thực tế.

Gate: `supabase db reset` sạch, seed idempotent, RLS tests pass.

### Phase 3 — Academic admin core

- CRUD teacher/student/course/module/lesson/class.
- Class teacher, schedule/session generation.
- Enrollment lifecycle và transfer.
- Admin dashboards/lists/details.

Gate: super admin tạo được Course → Class → Schedule → Teacher → Enrollment hoàn chỉnh.

### Phase 4 — Teacher operations

- Dashboard hôm nay.
- Session/lesson log.
- Bulk attendance.
- Assignment/files/submissions/grading.
- Assessment/results/evaluation/publish.
- Teacher reports.

Gate: teacher không truy cập được lớp ngoài scope qua UI, direct URL, server action và Supabase client.

### Phase 5 — Student portal

- Dashboard, schedule, materials.
- Attendance self-view.
- Assignment submission/file.
- Published grades/evaluations/progress.
- Profile/password/notifications.

Gate: student không thấy bất kỳ dữ liệu học viên khác; submission workflow end-to-end pass.

### Phase 6 — Tuition, notifications và reports

- Invoice/payment/receipt.
- In-app notifications/announcements/dedupe/cron.
- Dashboards/KPI/reports/export.
- Audit coverage.

Gate: finance self-scope đúng; teacher không đọc được tuition; export giữ filter.

### Phase 7 — Hardening và deploy

- Security review, IDOR, upload abuse, rate limit.
- E2E ba role.
- Accessibility/responsive review.
- Vercel production build.
- Supabase staging/prod migration rehearsal.
- Deployment docs, backup/restore và rollback.
- Deploy cloud khi đã có credential/quyền; smoke test URL thật.

Gate: đạt toàn bộ Definition of Done bên dưới.

---

## 19. Test plan bắt buộc

### Unit/domain

- Class capacity.
- Session recurrence 35 buổi, weekday, start/end và idempotency.
- Enrollment transitions/transfer.
- Attendance summary.
- Assignment due/late/attempt rule.
- Score range, weighted overall, grading classification.
- Course completion readiness.
- Invoice balance, partial/paid/overdue/refund rules.
- Notification dedupe/link.

### Database/integration

- FK, unique, check, trigger, transaction rollback.
- Concurrent enrollment không vượt capacity.
- Bulk attendance không sinh trùng.
- Generate sessions chạy lại không tạo trùng.
- Record payment sinh đúng một receipt.
- Views tính đúng từ dữ liệu biết trước.

### RLS/IDOR

Kiểm đủ SELECT/INSERT/UPDATE/DELETE, RPC và Storage:

- Anonymous đọc/ghi = denied.
- Student A không đọc/sửa Student B.
- Student không đọc roster lớp hoặc note staff-only.
- Student không sửa attendance/score/payment.
- Teacher A chỉ lớp được phân công.
- Teacher không tự gán lớp/đổi role/xem tuition/audit.
- Teacher không chấm submission lớp khác.
- Super admin có đúng quyền nhưng admin action vẫn qua server-only flow khi cần service role.
- Đổi UUID trực tiếp trên URL/action/query không vượt scope.
- Signed URL/object path không làm lộ file khác.

### Component/UI

- Form validation/error/loading/empty.
- Attendance roster bulk actions.
- Assignment submission và upload states.
- Grade draft/publish.
- Responsive role navigation.
- Unsaved changes và confirmation mutation nhạy cảm.

### Playwright E2E

1. Super admin login → tạo teacher/student → course → class → schedule → enroll.
2. Teacher login → chỉ thấy lớp mình → điểm danh → tạo bài → chấm → publish.
3. Student login → xem lịch → nộp bài/file → xem điểm sau publish.
4. Super admin tạo invoice → ghi payment → receipt → student chỉ xem của mình.
5. Transfer/pause/withdraw/completion giữ lịch sử.
6. Negative paths: direct URL, stale form, duplicate submit, file sai loại/quá lớn, account disabled.

### Build/deploy

- `npm run lint`.
- `npm run typecheck`.
- `npm run test`.
- Supabase reset/migration/pgTAP tests.
- Playwright critical suite.
- `npm run build` bằng env hợp lệ.
- Vercel preview smoke.
- Production smoke sau deploy.

---

## 20. Environment, secret và vận hành

Tạo `.env.example` không có secret thật, tối thiểu mô tả:

```text
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Quy tắc:

- Không commit `.env.local`, token, service role hoặc database password.
- Tách Supabase development/staging/production khi có điều kiện.
- Tách Vercel Preview/Production env.
- Không log PII, token, password, signed URL đầy đủ hoặc nội dung bài nộp nhạy cảm.
- Dùng Vercel/Supabase logs; không ghi rolling file local trong production.
- Có `/api/health` tối giản và không lộ secret/schema.
- Backup DB và Storage là hai phạm vi riêng; tài liệu phải nói rõ backup DB không đồng nghĩa backup object Storage.
- Có migration rollback/forward-fix plan; không sửa migration đã chạy production.
- Production không có user demo/mật khẩu mặc định.

Nếu CLI chưa authenticated hoặc thiếu project ID/token:

1. Không bịa là đã deploy.
2. Hoàn tất local và production configuration.
3. Ghi blocker chính xác trong WORKLOG.
4. Đưa đúng lệnh và danh sách credential người dùng cần cung cấp.

---

## 21. Definition of Done

Chỉ coi v1 hoàn thành khi:

- Repo mới độc lập, repo XKLĐ không bị sửa.
- Tất cả docs bắt buộc tồn tại, khớp code/migration.
- Không còn module/thuật ngữ XKLĐ bị cấm.
- Course/Class/Session tách đúng; seed đủ dòng khóa cốt lõi của trung tâm và hai chương trình/ba lớp B2B Vietcombank thực tế.
- Ba role hoạt động đúng; RLS/Storage fail-closed và có test.
- Super admin hoàn thành flow setup và học phí.
- Teacher hoàn thành flow buổi học → điểm danh → bài tập/kiểm tra → đánh giá.
- Student hoàn thành flow xem lịch → nộp bài/file → xem kết quả/progress/học phí.
- Migration reset được từ đầu và seed idempotent.
- Lint, typecheck, unit, integration/RLS, critical E2E và production build đều pass.
- Responsive, accessible, không có trang monolith khó bảo trì.
- `.env.example`, deploy guide, backup/restore, rollback và WORKLOG đầy đủ.
- Vercel/Supabase đã deploy và smoke pass nếu có credential; nếu chưa có thì trạng thái phải ghi rõ “ready to deploy, blocked by credentials”, không được gọi là deployed.

---

## 22. Cách báo cáo sau mỗi phase và khi bàn giao

Sau mỗi phase:

1. Cập nhật `WORKLOG.md`.
2. Nêu outcome trước, không chỉ kể thao tác.
3. Liệt kê file/module chính đã thay đổi.
4. Nêu migration/data impact.
5. Nêu test thực chạy và số pass/fail.
6. Nêu blocker/rủi ro còn lại.
7. Nêu next action cụ thể.

Khi bàn giao cuối:

- URL local và production/preview nếu có.
- Cách đăng nhập demo development mà không lộ production secret.
- Sơ đồ module/routes.
- Trạng thái migrations và seed.
- Bảng test/QA.
- Danh sách env còn cần.
- Known limitations và backlog phase 2.

Backlog phase 2 mặc định:

- AI hỗ trợ soạn bài, nhận xét và luyện tiếng Trung có scope an toàn.
- Email notification nghiệp vụ/nhắc lịch nâng cao.
- Chứng chỉ.
- CSV import dữ liệu học viên cũ.
- Đa cơ sở/đa tenant nếu phát sinh nhu cầu thực tế.
- PWA/native app nếu được yêu cầu riêng.

Hãy bắt đầu bằng khảo sát read-only repo cũ, tạo repo mới đúng path, viết docs 01–04 và ERD/RLS matrix, sau đó triển khai tuần tự theo các phase trên. Không được quay lại kiến trúc .NET/Blazor hoặc cố deploy web cũ lên Vercel.
