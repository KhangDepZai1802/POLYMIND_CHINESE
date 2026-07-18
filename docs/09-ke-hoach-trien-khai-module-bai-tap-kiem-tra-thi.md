# 09 — Kế hoạch triển khai Module Bài tập và Kiểm tra/Thi

> **Dự án:** POLYMIND CHINESE — Hệ thống quản lý học viên tiếng Trung  
> **Ngày chốt kế hoạch:** 16/07/2026  
> **Trạng thái:** Đã triển khai production ngày 16/07/2026; migration 38–53, app mới và cleanup legacy đã hoàn tất  
> **Phạm vi:** Thay thế hoàn toàn module Bài tập cũ và phần Kiểm tra cũ bằng hệ thống tạo đề, làm bài và chấm bài trực tiếp trên web.

---

## 0. Cách sử dụng tài liệu này

Đây là tài liệu nguồn để triển khai hai module mới:

1. **Bài tập** — giáo viên tạo bộ bài tập trên hệ thống, giao cho lớp mình đứng chính, theo dõi tiến độ, chấm và trả kết quả.
2. **Kiểm tra/Thi** — giáo viên tạo bộ đề trên hệ thống, mở kỳ thi trong một khung giờ (có thể kéo dài nhiều ngày — EX-12 đã đảo 2026-07-18), học viên vào thi bất kỳ lúc nào trong khung cho phép, hệ thống tính thời lượng riêng từ lúc bắt đầu và tự động nộp khi hết giờ.

Tài liệu này phải được đọc cùng các tài liệu hiện có:

- `docs/01-business-analysis.md`
- `docs/02-database-design.md`
- `docs/03-workflow.md`
- `docs/04-system-architecture.md`
- `docs/05-testing-strategy.md`
- `docs/06-deployment-vercel-supabase.md`
- `docs/07-product-backlog.md`
- `docs/08-phase-plan.md`
- `WORKLOG.md`

Khi triển khai xong từng nhóm công việc, phải cập nhật đồng bộ các tài liệu liên quan. Không được để code, migration và đặc tả lệch nhau âm thầm.

### Báo cáo triển khai 16/07/2026

- P8–P12 đã hoàn tất: inventory/backup thật, question bank + builder, Bài tập, Kiểm tra/Thi và cleanup 6 bảng/2 bucket legacy.
- Production dùng 50 bảng public đều RLS, 54 RPC public, 4 bucket private; `question-media` là bucket mới.
- Finalizer chạy mỗi phút bằng Supabase `pg_cron` vì Vercel Hobby chỉ cho cron hằng ngày.
- Backup trước cleanup: `C:\tmp\polymind-chinese-backup-20260716` (schema/data/roles/storage metadata + SHA-256).
- Bằng chứng local gần nhất trước bàn giao được ghi trong `WORKLOG.md`; deployment production dùng alias `https://polymind-chinese-one.vercel.app`.

### Cập nhật P-B (17/07/2026) — Wizard soạn câu hỏi theo kỹ năng

- Trình soạn câu hỏi cũ (một dialog chung cho 11 dạng, nhập tự do) được thay bằng **wizard nhiều bước theo kỹ năng** (§19–§20): Kỹ năng → Dạng câu → Nội dung/đáp án có cấu trúc → Xem trước bằng renderer thật → Lưu & công bố. File: `src/features/question-bank/components/{question-wizard,pinyin-tone-bar}.tsx`, domain `buildStructuredPayload` trong `question-builder/domain/questions.ts`, server `saveQuestionAction`.
- **Upload + player audio ngay trong editor** cho `listening_choice`/`dictation` (§20 khu vực giữa, §72): upload vào bucket private `question-media`, ghi `question_media` cho version, player nghe thử tại chỗ. **Thanh chèn dấu Pinyin** (§27) trên mọi ô chữ.
- **Nói (`speaking`) hoãn sang P-C** — chưa có question type; wizard hiện nhãn "Sắp có".
- **Còn nợ (đưa vào P-C/đợt sau):** (1) `get_exercise_attempt_payload`/`get_exam_attempt_payload` phải **ký signed URL** cho `question_media` để học viên nghe được audio (hiện chỉ chạy trong editor GV). (2) `matching` + `reading_group` tạm loại khỏi wizard vì renderer học viên chưa render câu con/nối cặp đáng tin — cần nâng renderer trước khi mở lại (§24 Q7, Q8).

### Cập nhật P-C (17/07/2026) — Kỹ năng Nói + ký signed URL audio

- **Question type `speaking`** (migration 54 tách riêng để commit enum trước; 55 phần còn lại): đề bằng **chữ**, học viên **thu âm** trả lời, giáo viên **chấm tay điểm tự do** (`app.auto_score_answer` coi `speaking` như `essay_translation` → `pending_manual_grading`; answer_key `{ manual: true }`). Wizard mở thẻ **Nói** (không cấu hình đề gì thêm). **Không giới hạn thời lượng thu âm.**
- **Recorder web** (`speaking-recorder.tsx`, MediaRecorder ưu tiên `audio/webm;codecs=opus`, rơi về `audio/mp4`): thu âm hiển thị đồng hồ đếm lên (học viên tự bấm Dừng, không auto-dừng) → **nghe lại** (kèm độ dài bản ghi) → **Nộp bản ghi** hoặc **Xóa & thu lại** (xóa cả object storage + reset answer_payload). Câu Nói **không** đi qua vòng lưu-khi-nộp chung; lưu riêng qua RPC để không bị ghi đè.
- **Bucket + bảng bài nộp audio:** bucket private **`answer-media`** (25 MB). Bảng `answer_media` (polymorphic `attempt_kind` = exercise|exam) ánh xạ `object_path`→lượt→lớp để **storage policy** soi đúng phạm vi (giống `question_media_scoped_read`). RLS: HV sở hữu (`uploaded_by = auth.uid()`, object_path bắt đầu bằng uid), GV dạy lớp/super_admin đọc để chấm. Quy ước path: `{student_uid}/{attempt_id}/{item_id}/{uuid}.{ext}`. RPC `attach_answer_media` tái dùng `save_exercise_answer`/`save_exam_answer` (kiểm chủ lượt/hạn giờ/câu thuộc lượt, fail-closed) + upsert `answer_media`; RPC `clear_answer_media` reset payload + xóa bản ghi.
- **Trả nợ signed URL (§44 điểm 1):** `signAttemptPayloadAudio` ký `question_media` prompt_audio vào `prompt_content.audio_url` → học viên **nghe được** audio Nghe/Chép trong lúc làm bài; đồng thời ký audio bài Nói đã nộp để HV nghe lại và (`signGradingAudio`) để GV nghe khi chấm. TTL 6h (đủ một lượt, vẫn private).
- **Còn nợ:** (2) `matching` + `reading_group` vẫn tạm loại khỏi wizard — chưa mở lại ở P-C.

---

# PHẦN I — CÁC QUYẾT ĐỊNH ĐÃ CHỐT

## 1. Quyết định sản phẩm

| ID | Quyết định đã chốt |
|---|---|
| EX-01 | **Thay thế hoàn toàn** cách giao bài cũ bằng trình dựng đề mới. Không còn luồng giáo viên chỉ nhập mô tả/đính file để học viên nộp text hoặc file chung. |
| EX-02 | Hệ thống hiện **chưa có dữ liệu sử dụng thật**, vì vậy không cần màn hình tương thích hoặc khu vực lịch sử cho dữ liệu bài tập/kiểm tra cũ. Có thể xóa dữ liệu demo cũ sau khi backup và xác nhận. |
| EX-03 | Bài tập và Kiểm tra/Thi dùng chung **Ngân hàng câu hỏi + Trình dựng đề**, nhưng là hai module nghiệp vụ, menu, cấu hình giao bài và bảng dữ liệu lượt làm riêng. |
| EX-04 | Super Admin có quyền quản lý toàn bộ câu hỏi, bộ bài tập, bộ đề, kỳ giao bài, kỳ thi và kết quả; được duyệt câu hỏi vào kho dùng chung. |
| EX-05 | Câu hỏi giáo viên tạo mặc định là **riêng tư**. Giáo viên có thể chia sẻ cho giáo viên cụ thể hoặc gửi vào kho chung để Super Admin duyệt. |
| EX-06 | Mỗi bộ bài tập/bộ đề sau khi soạn có thể giao cho một hoặc nhiều lớp, nhưng giáo viên chỉ được giao cho lớp mà mình là **giáo viên phụ trách** (`class_teachers.teacher_id` ánh xạ tới tài khoản hiện tại). |
| EX-07 | Hai module là hai mục riêng trên sidebar. Không đặt chức năng quản lý chính bên trong tab chi tiết lớp như thiết kế cũ. |
| EX-08 | Học viên làm bài trực tiếp trên hệ thống bằng máy tính hoặc điện thoại. |
| EX-09 | Bài tập **không có chức năng gợi ý** trong lúc làm. Không tạo trường `hint` hoặc nút “Xem gợi ý” ở v1. |
| EX-10 | Đề thi không có mã phòng thi, không trộn câu, không trộn đáp án, không tạo nhiều mã đề và không chọn câu ngẫu nhiên. Mọi học viên nhận cùng nội dung, cùng thứ tự câu và cùng thứ tự đáp án. |
| EX-11 | Không có cấu hình cộng thêm thời gian riêng cho một học viên ở v1. |
| EX-12 | ~~Giáo viên cấu hình một **khung giờ dự thi nằm trong cùng một ngày** theo múi giờ `Asia/Ho_Chi_Minh`.~~ **ĐÃ ĐẢO (user chốt 2026-07-18):** khung mở/đóng được phép **kéo dài nhiều ngày** (chỉ ràng buộc `opens_at < closes_at`); mỗi lượt vẫn bị giới hạn bởi `duration` + `closes_at`. Học viên được bắt đầu bất kỳ lúc nào trong khung đó. |
| EX-13 | Khi học viên bắt đầu, thời điểm hết hạn thực tế là thời điểm đến trước giữa: `started_at + duration` và `exam_closes_at`. |
| EX-14 | Trong chế độ thi phải chặn toàn bộ đường copy/cut/paste chuẩn của trình duyệt. Việc chặn không được phá quá trình nhập bằng Chinese IME. |
| EX-15 | Hệ thống không dùng webcam, không chụp ảnh định kỳ, không giới hạn IP, không yêu cầu cài trình duyệt khóa và không dùng AI detector trong giai đoạn này. |
| EX-16 | Giáo viên có thể nhập câu hỏi hàng loạt bằng file Excel mẫu của hệ thống. |
| EX-17 | Việc gõ tiếng Trung chủ yếu dùng bộ gõ/IME trên thiết bị. Website phải hỗ trợ Unicode, Chinese IME, font CJK và công cụ chèn dấu Pinyin; chưa xây bộ chuyển Pinyin thành chữ Hán hoàn chỉnh. |
| EX-18 | Điểm từng câu được cộng thành điểm thô. Bài kiểm tra/thi quy đổi về thang 100; bài tập quy đổi về `max_score` do giáo viên cấu hình. |
| EX-19 | AI tạo đề, AI chấm tự luận, AI chấm phát âm và AI phát hiện gian lận không thuộc phạm vi triển khai này. |
| EX-20 | Phần `learning_evaluations` và `student_notes` hiện tại vẫn giữ nguyên. Chỉ thay thế phần Bài tập cũ và `assessments/assessment_results` cũ. |

## 2. Các giả định kỹ thuật được chốt trong tài liệu này

Những điểm sau chưa được Product Owner chỉ định chi tiết nhưng cần có quyết định để triển khai nhất quán:

1. Câu hỏi nhiều đáp án hỗ trợ hai cách chấm:
   - `all_or_nothing` — mặc định, phải chọn đúng toàn bộ.
   - `partial_credit` — giáo viên chủ động bật cho từng câu.
2. Đề thi v1 chỉ cho **một lượt thi hợp lệ** trên mỗi enrollment. Nếu xảy ra sự cố kỹ thuật, Super Admin có thể vô hiệu hóa lượt cũ và cấp lại một lượt mới; mọi thao tác phải có audit.
3. Hệ thống chỉ có một giáo viên phụ trách mỗi lớp theo D-22; quyền quản lý hai module thuộc Super Admin và giáo viên phụ trách.
4. Mặc định hệ thống dùng chữ Trung giản thể (`zh-Hans`). Giáo viên có thể cấu hình từng câu để chấp nhận chữ phồn thể tương đương.
5. Giải thích đáp án không phải là gợi ý. Giải thích chỉ được hiển thị sau khi nộp và đúng thời điểm công bố do giáo viên cấu hình.

---

# PHẦN II — HIỆN TRẠNG VÀ PHẠM VI THAY THẾ

## 3. Hiện trạng cần thay thế

Hệ thống cũ đang có hai luồng:

### 3.1 Bài tập cũ

- Giáo viên tạo `assignments` theo lớp.
- Nhập tiêu đề, mô tả, hạn nộp và file đính kèm.
- Học viên nộp `submissions` dạng text/file.
- Giáo viên nhập điểm và feedback.

### 3.2 Kiểm tra cũ

- Giáo viên tạo `assessments` theo lớp.
- Hệ thống không lưu nội dung câu hỏi và đáp án.
- Giáo viên nhập trực tiếp điểm tổng và điểm 6 kỹ năng vào `assessment_results`.
- Sau đó công bố kết quả.

Hai luồng này không đáp ứng mục tiêu mới vì giáo viên chưa thể dựng nội dung đề và học viên chưa thể làm từng câu trực tiếp trên hệ thống.

## 4. Phạm vi bị xóa/thay thế

Sau khi module mới vận hành ổn định, loại bỏ:

### Database cũ

- `assignments`
- `assignment_attachments`
- `submissions`
- `submission_files`
- `assessments`
- `assessment_results`

### RPC/trigger/policy cũ liên quan

- `publish_assignment`
- `close_assignment`
- `grade_submission`
- `save_assessment_result`
- `publish_assessment_results`
- Các trigger, policy, view, index chỉ phục vụ các bảng cũ.

### UI/source cũ

- Form giao bài dạng mô tả + file.
- Form học viên nộp text/file chung.
- Màn hình giáo viên nhập điểm kiểm tra thủ công cho cả lớp mà không có lượt làm.
- Tab Bài tập/Kiểm tra dùng làm nơi quản lý chính trong chi tiết lớp.
- Route, query, action, component và test chỉ phục vụ luồng cũ.

## 5. Những phần phải giữ nguyên

Không được xóa hoặc gộp nhầm:

- `grading_scale_rules` — tiếp tục dùng xếp loại điểm 0–100.
- `learning_evaluations` — nhận xét định kỳ 6 kỹ năng.
- `student_notes` — ghi chú giáo viên/học viên.
- `enrollments` — tất cả lượt làm phải gắn với enrollment, không gắn trực tiếp với student.
- `classes`, `class_teachers`, `courses`, `course_modules`, `lessons`.
- Hệ thống thông báo, audit, dashboard, báo cáo và tiến độ; nhưng phải cập nhật nguồn dữ liệu sang module mới.

---

# PHẦN III — MÔ HÌNH NGHIỆP VỤ MỚI

## 6. Thuật ngữ bắt buộc

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Question — Câu hỏi** | Thực thể nhận dạng ổn định của một câu hỏi trong ngân hàng. |
| **Question Version — Phiên bản câu hỏi** | Nội dung bất biến của câu hỏi tại một thời điểm. Sửa câu đã sử dụng phải tạo version mới. |
| **Question Bank — Ngân hàng câu hỏi** | Khu vực lưu, phân loại, tìm kiếm, chia sẻ và tái sử dụng câu hỏi. |
| **Question Set — Bộ câu hỏi** | Một bộ nội dung được dựng từ các câu hỏi theo section và thứ tự cố định. Có loại `exercise` hoặc `exam`. |
| **Set Version — Phiên bản bộ** | Bản bất biến của cấu trúc section, câu hỏi, điểm và thứ tự. |
| **Exercise Delivery — Lần giao bài tập** | Một phiên bản bộ bài tập được giao cho một lớp, có thời gian mở, hạn nộp và quy tắc làm bài. |
| **Exam Delivery — Kỳ thi** | Một phiên bản bộ đề được mở cho một lớp trong khung giờ cùng ngày, có thời lượng và quy tắc thi. |
| **Attempt — Lượt làm** | Một lần một enrollment bắt đầu làm bài tập hoặc bài thi. |
| **Answer — Câu trả lời** | Câu trả lời của một attempt cho một item cụ thể. |
| **Auto Grade — Điểm tự động** | Điểm hệ thống tính từ answer key. |
| **Manual Grade — Điểm thủ công** | Điểm giáo viên chấm cho tự luận/dịch hoặc điều chỉnh có lý do. |
| **Publish Results — Công bố kết quả** | Hành động mở quyền cho học viên xem điểm, feedback và đáp án theo cấu hình. |

## 7. Nguyên tắc tách “Bộ” và “Lần giao”

Bộ bài tập/bộ đề là tài sản tái sử dụng, không gắn cứng với lớp.

```text
Giáo viên tạo Bộ bài tập A
  ├─ giao cho LOP-01 với hạn 20/07
  ├─ giao cho LOP-02 với hạn 22/07
  └─ tháng sau có thể giao lại cho LOP-03
```

Mỗi lần giao có cấu hình và kết quả riêng. Việc sửa một lần giao không được thay đổi bộ gốc hoặc lần giao khác.

Tương tự:

```text
Bộ đề Thi giữa kỳ HSK 2 — Version 3
  ├─ Kỳ thi LOP-02 ngày 25/07, 08:00–22:00, 45 phút
  └─ Kỳ thi LOP-03 ngày 26/07, 08:00–22:00, 45 phút
```

## 8. Quy tắc phiên bản hóa

1. Câu hỏi ở trạng thái draft được sửa trực tiếp.
2. Khi câu hỏi đã xuất hiện trong set version được công bố, nội dung đó bất biến.
3. Sửa câu hỏi tạo `question_version` mới.
4. Bộ câu hỏi draft được sửa trực tiếp.
5. Khi bộ được công bố hoặc đã được giao, tạo/chốt `question_set_version` bất biến.
6. Mỗi `exercise_delivery`/`exam_delivery` tham chiếu đúng một `question_set_version_id`.
7. Khi học viên bắt đầu, nội dung không thay đổi dù giáo viên sửa bộ gốc sau đó.
8. Không hard-delete question version, set version, delivery hoặc attempt đã có lịch sử.
9. Archive chỉ ẩn khỏi danh sách tạo mới, không xóa dữ liệu.

---

# PHẦN IV — PHÂN QUYỀN

## 9. Ma trận quyền tổng quát

| Chức năng | Super Admin | Giáo viên phụ trách | Học viên |
|---|---:|---:|---:|
| Tạo câu hỏi riêng | Có | Có | Không |
| Xem câu hỏi riêng của người khác | Có | Chỉ khi được chia sẻ | Không |
| Chia sẻ câu hỏi | Có | Câu do mình sở hữu | Không |
| Duyệt vào kho chung | Có | Gửi yêu cầu | Không |
| Tạo bộ bài tập/bộ đề | Có | Có | Không |
| Giao cho lớp | Mọi lớp | Chỉ lớp mình phụ trách | Không |
| Sửa lần giao chưa publish | Có | Lớp mình phụ trách | Không |
| Publish/close/cancel | Có | Lớp mình phụ trách | Không |
| Xem tiến độ cả lớp | Có | Lớp mình phụ trách | Không |
| Chấm thủ công | Có | Lớp mình phụ trách | Không |
| Khóa/công bố điểm | Có | Lớp mình phụ trách | Không |
| Làm bài | Không | Không | Chỉ enrollment của mình |
| Xem đáp án đúng | Có | Bộ mình được phép đọc | Chỉ sau thời điểm cho phép |
| Vô hiệu hóa/cấp lại lượt thi | Có | Gửi yêu cầu/không tự làm ở v1 | Không |

## 10. Quy tắc giáo viên phụ trách

Mọi mutation giao bài hoặc tổ chức thi phải kiểm bằng DB, không chỉ lọc dropdown:

```sql
EXISTS (
  SELECT 1
  FROM class_teachers ct
  JOIN teachers t ON t.id = ct.teacher_id
  WHERE ct.class_id = target_class_id
    AND t.user_id = auth.uid()
)
```

Fail-closed:

- Không có mapping giáo viên phụ trách → từ chối.
- Giáo viên đã bị gỡ khỏi lớp → từ chối ngay cả khi đang giữ URL cũ.
- Đổi UUID trên request → RLS/RPC từ chối.

---

# PHẦN V — NAVIGATION VÀ ROUTE

## 11. Sidebar giáo viên

Hai menu cấp cao riêng:

```text
Dashboard
Lớp học
Bài tập
Kiểm tra/Thi
Đánh giá học tập
Báo cáo
Thông báo
Hồ sơ
```

### Route đề xuất cho Bài tập

```text
/teacher/exercises
/teacher/exercises/question-bank
/teacher/exercises/sets
/teacher/exercises/sets/new
/teacher/exercises/sets/[setId]
/teacher/exercises/sets/[setId]/preview
/teacher/exercises/deliveries
/teacher/exercises/deliveries/new
/teacher/exercises/deliveries/[deliveryId]
/teacher/exercises/deliveries/[deliveryId]/grading
```

### Route đề xuất cho Kiểm tra/Thi

```text
/teacher/exams
/teacher/exams/question-bank
/teacher/exams/sets
/teacher/exams/sets/new
/teacher/exams/sets/[setId]
/teacher/exams/sets/[setId]/preview
/teacher/exams/deliveries
/teacher/exams/deliveries/new
/teacher/exams/deliveries/[deliveryId]
/teacher/exams/deliveries/[deliveryId]/monitor
/teacher/exams/deliveries/[deliveryId]/grading
/teacher/exams/deliveries/[deliveryId]/analytics
```

Ngân hàng câu hỏi là lõi dùng chung. Hai route có thể dùng cùng feature component với filter `set_kind`, nhưng UI vẫn hiển thị trong đúng module để người dùng không bị lẫn.

## 12. Sidebar học viên

```text
Dashboard
Lịch học
Bài tập
Kiểm tra/Thi
Kết quả
Học phí
Thông báo
Hồ sơ
```

### Route học viên

```text
/student/exercises
/student/exercises/[deliveryId]
/student/exercises/[deliveryId]/attempt/[attemptId]
/student/exams
/student/exams/[deliveryId]
/student/exams/[deliveryId]/waiting-room
/student/exams/[deliveryId]/attempt/[attemptId]
/student/results
```

## 13. Class detail sau thay đổi

Không còn quản lý đầy đủ Bài tập/Kiểm tra trong class detail.

Class detail chỉ hiển thị summary:

- Số bài tập đang mở.
- Số kỳ thi sắp tới.
- Số bài chờ chấm.
- Nút “Mở Module Bài tập” hoặc “Mở Module Kiểm tra/Thi” với filter lớp hiện tại.

---

# PHẦN VI — NGÂN HÀNG CÂU HỎI

## 14. Mục tiêu

Ngân hàng câu hỏi phải giúp giáo viên:

- Không nhập lại câu hỏi đã dùng.
- Tìm theo khóa học, level, bài học, kỹ năng, dạng câu, độ khó và tag.
- Nhân bản và chỉnh sửa thành câu mới.
- Xem câu đã được dùng trong những bộ nào.
- Chia sẻ có kiểm soát.
- Import hàng loạt từ Excel.
- Xem trước đúng như học viên sẽ thấy.

## 15. Metadata câu hỏi

Mỗi câu hỏi có:

- Mã câu hỏi tự sinh.
- Chủ sở hữu.
- Tiêu đề nội bộ ngắn.
- `course_id` nullable.
- `module_id` nullable.
- `lesson_id` nullable.
- Level.
- Kỹ năng: `listening | speaking | reading | writing | vocabulary | grammar`.
- Chủ đề.
- Độ khó: `easy | medium | hard`.
- Loại câu hỏi.
- Ngôn ngữ đáp án mong đợi.
- Tag.
- Trạng thái.
- Visibility.
- Phiên bản hiện tại.
- Số lần được sử dụng.
- Người tạo/người sửa/thời gian.

Quan hệ course/module/lesson phải được kiểm bằng FK và trigger hierarchy, tương tự `course_materials` hiện tại.

## 16. Visibility và chia sẻ

Enum đề xuất:

```text
private
shared
pending_global_review
global
rejected
archived
```

Quy trình:

```text
Teacher tạo câu hỏi
  → private
  → có thể share cho Teacher B
  → hoặc submit_global_review
  → Super Admin approve → global
  → hoặc reject + lý do
```

Bảng chia sẻ phải lưu người chia sẻ, người nhận, quyền `read` hoặc `clone`. Không cho người nhận sửa trực tiếp câu gốc của chủ sở hữu.

## 17. Tìm kiếm và bộ lọc

- Từ khóa trong nội dung.
- Course/Module/Lesson.
- Level.
- Kỹ năng.
- Dạng câu.
- Độ khó.
- Tag.
- Câu của tôi / được chia sẻ / kho chung.
- Đã dùng/chưa dùng.
- Có audio/không có audio.
- Trạng thái draft/ready/archived.

## 18. Thao tác hàng loạt

- Gắn tag.
- Chuyển folder/collection.
- Archive.
- Gửi duyệt kho chung.
- Nhân bản.
- Thêm vào bộ bài tập/bộ đề đang mở.

Không cho sửa hàng loạt answer key của câu đã được sử dụng.

---

# PHẦN VII — TRÌNH DỰNG ĐỀ DÙNG CHUNG

## 19. Quy trình dựng bộ

```text
Bước 1 — Thông tin bộ
Bước 2 — Tạo section
Bước 3 — Thêm câu hỏi
Bước 4 — Đặt điểm và quy tắc chấm
Bước 5 — Kiểm tra lỗi
Bước 6 — Xem trước như học viên
Bước 7 — Lưu nháp hoặc chốt phiên bản
```

## 20. Thành phần giao diện

### Cột trái

- Danh sách section.
- Danh sách câu hỏi theo thứ tự.
- Kéo thả để đổi thứ tự trong khi còn draft.

### Khu vực giữa

- Form chỉnh nội dung câu đang chọn.
- Preview nội dung tiếng Trung, Pinyin, hình/audio.

### Cột phải

- Điểm câu.
- Loại kỹ năng.
- Cấu hình chấm.
- Answer key.
- Giải thích sau khi công bố.
- Validation status.

## 21. Section

Mỗi bộ có thể chia phần:

- Từ vựng.
- Ngữ pháp.
- Nghe.
- Đọc.
- Viết.
- Phần tự luận.

Mỗi section có:

- Tên.
- Hướng dẫn.
- Thứ tự.
- Điểm thô.
- Nội dung chung hoặc audio chung nếu cần.

Đề thi giữ thứ tự cố định. Không tạo tùy chọn shuffle trong UI hoặc schema v1.

## 22. Validation trước khi chốt

Không cho chốt version nếu có một trong các lỗi:

- Bộ không có câu hỏi.
- Câu hỏi thiếu nội dung.
- Trắc nghiệm không có đủ phương án.
- Không có answer key.
- Điểm câu `<= 0`.
- Audio question thiếu file audio.
- Dictation không có đáp án chấp nhận.
- Matching có key trùng hoặc cặp thiếu.
- Section rỗng không có chủ đích.
- Tổng điểm thô bằng 0.
- Có question version bị archive hoặc mất media.

## 23. Preview

Preview phải dùng cùng renderer với màn hình học viên, không viết renderer riêng giả lập. Preview có các kích thước:

- Desktop.
- Tablet.
- Mobile.

Giáo viên thử được:

- Chọn đáp án.
- Nhập chữ Hán bằng IME.
- Phát audio.
- Sắp xếp/nối cặp.

Preview không tạo attempt thật và không ghi điểm.

---

# PHẦN VIII — CÁC DẠNG CÂU HỎI

## 24. Giai đoạn triển khai đầu

### Q1 — Trắc nghiệm một đáp án

- Tối thiểu 2 lựa chọn.
- Một answer key.
- Tự chấm.
- Giữ nguyên thứ tự giáo viên thiết lập.

### Q2 — Trắc nghiệm nhiều đáp án

- Nhiều lựa chọn đúng.
- `all_or_nothing` mặc định.
- Có thể bật `partial_credit`.
- Nếu partial credit, không cho điểm âm.

Công thức đề xuất:

```text
điểm = điểm tối đa × số đáp án đúng đã chọn / tổng đáp án đúng
```

Nếu chọn bất kỳ đáp án sai, giáo viên có thể cấu hình:

- Trừ phần tương ứng nhưng không âm.
- Hoặc cho 0 toàn câu.

### Q3 — Đúng/Sai

- Một statement.
- Answer key boolean.
- Tự chấm.

### Q4 — Điền vào chỗ trống

- Một hoặc nhiều blank.
- Mỗi blank có danh sách đáp án chấp nhận.
- Có thể chấm độc lập từng blank.
- Có tùy chọn bỏ qua khoảng trắng và dấu câu.

### Q5 — Trả lời ngắn

Chế độ:

- Chỉ chữ Hán.
- Chỉ Pinyin.
- Chữ Hán hoặc Pinyin.
- Một từ/cụm từ.

Tự chấm bằng danh sách đáp án chấp nhận và quy tắc normalization.

### Q6 — Sắp xếp từ thành câu

- Giáo viên nhập các token theo thứ tự đúng.
- Học viên kéo thả hoặc bấm chọn thứ tự.
- Trên mobile phải có nút di chuyển lên/xuống thay cho drag-only để bảo đảm accessibility.
- Tự chấm.

### Q7 — Nối cặp

Ứng dụng:

- Chữ Hán ↔ Pinyin.
- Chữ Hán ↔ nghĩa tiếng Việt.
- Câu hỏi ↔ câu trả lời.
- Hình ảnh ↔ từ.

Không shuffle ở v1; hai cột giữ thứ tự giáo viên thiết lập. Việc không shuffle làm bài dễ đoán hơn, nhưng đây là quyết định sản phẩm đã chốt.

### Q8 — Đọc hiểu với câu hỏi con

- Một passage dùng chung.
- Nhiều child question.
- Child có thể là single choice, multiple choice, true/false, short text.
- Passage và câu con phải được version chung để không lệch ngữ cảnh.

### Q9 — Nghe và chọn đáp án

- Audio private trong Storage.
- Giáo viên cấu hình số lần nghe tối đa.
- Có thể cấm tua hoặc cho phép tua.
- Không tải trực tiếp public URL.
- Transcript chỉ dành cho giáo viên và chỉ hiển thị cho học viên sau thời điểm công bố nếu được bật.

### Q10 — Nghe chép chính tả

- Audio + input chữ Hán/Pinyin.
- Số lần nghe cấu hình được.
- Chấm từng cụm hoặc toàn câu.
- Hỗ trợ danh sách đáp án tương đương.

### Q11 — Tự luận/Dịch

- Học viên nhập nội dung dài.
- Không tự chấm.
- Giáo viên chấm theo điểm và rubric.
- Autosave debounce, không gửi request trên từng phím.

## 25. Giai đoạn sau

Không triển khai trong batch đầu nhưng schema/versioning phải không cản trở:

- Ghi âm phần nói.
- Giáo viên ghi âm trực tiếp khi tạo câu.
- Viết chữ Hán bằng chuột/màn hình cảm ứng.
- Kiểm tra thứ tự nét.
- Quay video trả lời.

Không tạo route/menu/code chết cho các loại này ở batch đầu.

---

# PHẦN IX — NHẬP VÀ CHẤM TIẾNG TRUNG

## 26. Website và bộ gõ

Website không tự sinh chữ Hán từ phím Latin. Người dùng bật bộ gõ tiếng Trung trên thiết bị:

- Windows: Microsoft Pinyin.
- macOS: Pinyin – Simplified/Traditional.
- iOS/Android: bàn phím Chinese Pinyin.

Website chịu trách nhiệm:

- UTF-8 toàn bộ.
- PostgreSQL lưu Unicode.
- Font có CJK fallback.
- Không regex giới hạn Latin.
- Không làm mất ký tự trong composition.
- Không submit/validate khi `event.isComposing = true`.
- Hỗ trợ `compositionstart`, `compositionupdate`, `compositionend`.

## 27. Công cụ hỗ trợ Pinyin

Trong editor giáo viên và input cần thiết, cung cấp thanh chèn ký tự:

```text
ā á ǎ à
ē é ě è
ī í ǐ ì
ō ó ǒ ò
ū ú ǔ ù
ǖ ǘ ǚ ǜ
ü
```

Có trang kiểm tra nhanh:

```text
Hãy bật bàn phím tiếng Trung và nhập: 你好
Hãy nhập Pinyin có dấu: nǐ hǎo
```

Không xây IME Pinyin-to-Hanzi trên web ở phase này.

## 28. Normalization đáp án

Mỗi câu short text/fill blank/dictation có cấu hình:

- `trim_spaces`.
- `collapse_internal_spaces`.
- `ignore_punctuation`.
- `case_insensitive_latin`.
- `pinyin_tone_required`.
- `accept_tone_numbers`.
- `accept_unmarked_pinyin`.
- `accept_simplified`.
- `accept_traditional`.
- `accepted_answers[]`.

### Quy tắc mặc định

- Chữ Hán: trim khoảng trắng ngoài; không tự ý đổi chữ.
- Pinyin: chuẩn hóa Unicode NFC.
- `u:` và `v` có thể quy đổi thành `ü` nếu giáo viên bật.
- `ni3 hao3` có thể quy đổi sang dạng tone number chuẩn.
- Không tự coi `ni hao` đúng nếu câu bắt buộc thanh điệu.

Normalization phải là hàm domain thuần, có unit test đầy đủ. Không dùng một package không rõ quy tắc rồi coi là nguồn sự thật.

---

# PHẦN X — MODULE BÀI TẬP

## 29. Dashboard giáo viên — Bài tập

KPI:

- Bộ bài tập của tôi.
- Bài đang mở.
- Bài sắp đến hạn.
- Học viên chưa bắt đầu.
- Bài đã nộp chờ chấm.
- Điểm trung bình gần đây.

Danh sách lần giao:

| Cột | Nội dung |
|---|---|
| Tên bài | Tên delivery + tên bộ nguồn |
| Lớp | Class code/name |
| Mở từ | `available_from` |
| Hạn nộp | `due_at` |
| Trạng thái | draft/scheduled/open/closed/grading/results_published |
| Tiến độ | chưa bắt đầu/đang làm/đã nộp |
| Chờ chấm | số answer tự luận chưa chấm |
| Điểm TB | chỉ sau khi có điểm |

Bộ lọc:

- Lớp.
- Course/lesson.
- Trạng thái.
- Khoảng ngày.
- Chờ chấm.
- Có nộp trễ.

## 30. Tạo bộ bài tập

Thông tin:

- Tên bộ.
- Mô tả nội bộ.
- Course/module/lesson.
- Mục tiêu học tập.
- Tag.
- Sections/questions.
- Điểm thô từng câu.
- Giải thích đáp án sau nộp.

Không có hint.

## 31. Giao bộ bài tập

Quy trình:

```text
Teacher chọn một set version
  → chọn một hoặc nhiều lớp mình đứng chính
  → hệ thống tạo delivery riêng cho từng lớp
  → cấu hình thời gian/quy tắc từng lớp
  → lưu draft
  → publish ngay hoặc schedule
```

Nếu chọn nhiều lớp, phải hiển thị rõ sẽ tạo nhiều delivery độc lập. Không tạo một row delivery gắn nhiều class vì sẽ làm phức tạp RLS, tiến độ và audit.

### Cấu hình delivery

- Tiêu đề hiển thị.
- Hướng dẫn chung.
- `available_from`.
- `due_at`.
- `allow_late_submission`.
- `late_penalty_percent` tùy chọn.
- `attempt_limit`.
- Cách lấy điểm: `first | latest | highest`.
- `max_score` > 0.
- Cho phép lưu và tiếp tục.
- Cho phép sửa attempt đang làm trước khi submit.
- Cho phép giáo viên trả lại để làm lại.
- Thời điểm công bố điểm:
  - ngay sau khi đã chấm xong attempt;
  - sau hạn nộp;
  - giáo viên công bố thủ công.
- Thời điểm công bố đáp án/giải thích:
  - sau submit;
  - sau due date;
  - cùng lúc công bố kết quả;
  - không công bố.

Không có:

- Hint.
- Shuffle.
- Random question.
- Mã truy cập.

## 32. Trạng thái bài tập

### Delivery

```text
draft
→ scheduled
→ open
→ closed
→ grading
→ results_published
→ archived
```

Các nhánh:

- `draft → cancelled` nếu chưa publish.
- `scheduled/open → cancelled` với lý do và audit; attempt đã có phải giữ.

### Attempt

```text
not_started (giá trị tổng hợp, không cần row)
→ in_progress
→ submitted
→ pending_manual_grading
→ graded
→ returned_for_revision
→ in_progress (attempt mới hoặc revision theo rule)
→ graded
```

Có cờ:

- `is_late`.
- `auto_submitted` nếu delivery có time limit và hết giờ.
- `invalidated` chỉ Super Admin.

## 33. Trải nghiệm học viên — Bài tập

Trang danh sách có các tab:

```text
Cần làm | Đang làm | Đã nộp | Đã chấm | Quá hạn
```

Mỗi card:

- Tên bài.
- Lớp/giáo viên.
- Mở từ/hạn nộp.
- Số câu.
- Tiến độ số câu đã trả lời.
- Số lượt còn lại.
- Trạng thái.
- Điểm nếu đã công bố.

Trong attempt:

- Autosave.
- Thanh tiến độ.
- Danh sách câu.
- Đánh dấu câu cần xem lại.
- Cho chuyển tự do giữa các câu.
- Không có gợi ý.
- Hiển thị trạng thái “Đã lưu lúc …”.
- Xác nhận trước khi nộp.

## 34. Theo dõi và chấm bài

Bảng lớp:

| Học viên | Trạng thái | Bắt đầu | Nộp | Trễ | Thời gian | Điểm | Chờ chấm |
|---|---|---|---|---|---:|---:|---:|

Hai chế độ chấm:

1. **Theo học viên:** xem toàn bộ attempt.
2. **Theo câu hỏi:** chấm một câu tự luận lần lượt cho cả lớp.

Giao diện chấm phải:

- Hiển thị rubric.
- Cho nhập điểm trong giới hạn câu.
- Feedback từng câu.
- Feedback toàn bài.
- Phím tắt lưu và chuyển học viên kế tiếp.
- Không ghi đè điểm tự động nếu giáo viên không chủ động chọn override.
- Override phải có lý do và audit.

## 35. Công thức điểm bài tập

```text
raw_score = tổng final_score của các answer
raw_max = tổng điểm thô của set version
final_assignment_score = raw_score / raw_max × delivery.max_score
```

Làm tròn theo một quy tắc duy nhất, đề xuất 2 chữ số thập phân bằng `numeric`, không dùng float.

Nếu có late penalty:

```text
score_after_penalty = final_assignment_score × (1 - late_penalty_percent / 100)
```

Không cho âm.

---

# PHẦN XI — MODULE KIỂM TRA/THI

## 36. Dashboard giáo viên — Kiểm tra/Thi

KPI:

- Bộ đề của tôi.
- Kỳ thi sắp mở.
- Kỳ thi đang mở.
- Học viên đang thi.
- Bài chờ chấm tự luận.
- Kết quả chưa công bố.

Danh sách kỳ thi:

| Cột | Nội dung |
|---|---|
| Tên kỳ thi | Delivery title |
| Lớp | Class |
| Ngày thi | Ngày địa phương |
| Khung vào thi | opens_at–closes_at |
| Thời lượng | duration_minutes |
| Tiến độ | chưa bắt đầu/đang thi/đã nộp |
| Chờ chấm | số answer |
| Trạng thái | scheduled/open/closed/grading/published |

## 37. Tạo bộ đề

Bộ đề có:

- Loại: quiz, midterm, final, mock_hsk, custom.
- Tiêu đề.
- Course/module/lesson.
- Hướng dẫn.
- Sections.
- Câu hỏi cố định.
- Thứ tự cố định.
- Điểm thô từng câu.
- Tổng điểm thô.
- Preview.

Không có:

- Random pool.
- Shuffle question.
- Shuffle option.
- Mã đề A/B/C.

## 38. Tạo kỳ thi

Teacher chọn bộ đề đã chốt và một lớp mình đứng chính.

Cấu hình:

- Tên kỳ thi.
- Ngày thi theo `Asia/Ho_Chi_Minh`.
- `opens_at` và `closes_at` bắt buộc cùng ngày địa phương.
- `duration_minutes` > 0.
- `opens_at < closes_at`.
- Thời lượng có thể dài hơn cửa sổ, nhưng deadline thực tế vẫn bị chặn bởi `closes_at`.
- Điểm đạt.
- Thời điểm công bố kết quả: luôn thủ công sau khi chấm xong.
- Thời điểm công bố đáp án: sau khi kết quả được công bố hoặc không công bố.
- Số lần nghe cho từng audio nằm ở question config.

Không có:

- Access code.
- Extra time theo học viên.
- Nhiều lượt thi do giáo viên cấu hình.
- Shuffle.
- Random.

## 39. Validation khung thi cùng ngày

DB lưu UTC, nhưng rule “cùng ngày” phải kiểm theo `Asia/Ho_Chi_Minh`:

```text
local_date(opens_at) = local_date(closes_at)
```

Không dùng ngày UTC vì một khung 20:00–23:00 Việt Nam có thể nằm ngày khác ở UTC.

Ví dụ hợp lệ:

```text
Ngày 25/07/2026
Mở: 07:00
Đóng: 22:00
Thời lượng: 45 phút
```

- Học viên A bắt đầu 08:10 → deadline 08:55.
- Học viên B bắt đầu 21:40 → deadline 22:00, chỉ còn 20 phút.

Waiting room phải cảnh báo rõ nếu bắt đầu gần giờ đóng.

## 40. Phòng chờ

Hiển thị:

- Tên kỳ thi.
- Lớp.
- Ngày/khung giờ.
- Thời lượng.
- Số câu.
- Tổng điểm 100.
- Số lần nghe nếu có.
- Quy định không copy/paste.
- Kiểm tra audio.
- Trạng thái mạng.
- Đồng ý quy định.
- Thời gian còn lại để có thể bắt đầu.

Nút bắt đầu chỉ bật khi:

- Enrollment thuộc chính user.
- Enrollment đang hợp lệ.
- Kỳ thi published/scheduled và đã mở.
- Chưa qua giờ đóng.
- Chưa có valid attempt.
- Tài khoản active.

## 41. Bắt đầu thi — transaction bắt buộc

RPC `start_exam_attempt(exam_delivery_id)`:

1. Xác thực user/student/enrollment.
2. `SELECT ... FOR UPDATE` delivery và attempt key.
3. Kiểm thời gian bằng `clock_timestamp()` ở DB.
4. Kiểm chưa có valid attempt.
5. Tính `deadline_at = LEAST(started_at + duration, closes_at)`.
6. Tạo attempt.
7. Ghi audit/integrity event `exam_started`.
8. Trả attempt ID, server time, deadline và payload câu hỏi không có answer key.

Hai request đồng thời chỉ được tạo đúng một attempt nhờ UNIQUE + transaction.

## 42. Giao diện thi

- Đồng hồ đếm ngược sticky.
- Server deadline là nguồn sự thật.
- Thanh tiến độ.
- Danh sách số câu.
- Đã trả lời/chưa trả lời.
- Đánh dấu xem lại.
- Cho chuyển câu tự do.
- Autosave.
- Báo “Đã lưu”.
- Cảnh báo 10 phút, 5 phút, 1 phút.
- Xác nhận khi nộp sớm.
- Tự nộp khi deadline.

Không nên tải toàn bộ answer key xuống client dưới bất kỳ dạng mã hóa/ẩn field nào.

## 43. Autosave

### Câu chọn đáp án

Lưu ngay khi chọn.

### Câu ngắn/tự luận

- Giữ state local.
- Debounce khoảng 1–2 giây sau khi ngừng nhập.
- Lưu khi blur/chuyển câu.
- Không request trên từng phím.

### Khi mất mạng

- Hiển thị cảnh báo rõ.
- Xếp thay đổi vào hàng đợi cục bộ theo attempt.
- Retry khi mạng trở lại và attempt còn thời gian.
- Server từ chối update sau deadline dù client gửi trễ.
- Khi refresh, tải lại answer đã lưu trên server.

Không tin timestamp do client gửi.

## 44. Kết thúc thi

Các trường hợp:

- Học viên nộp chủ động.
- Hết thời lượng.
- Đến giờ đóng kỳ thi.
- Cron/DB finalize attempt bị bỏ quên do browser đóng.

RPC `submit_exam_attempt` phải idempotent:

- Gọi lại lần hai không chấm/nộp trùng.
- Khóa answer mutation.
- Chấm phần tự động.
- Xác định có phần thủ công hay không.
- Chuyển `pending_manual_grading` hoặc `graded`.
- Ghi `submitted_at`, `submission_reason`.

Cần job nền finalize attempt quá deadline để không phụ thuộc browser còn mở.

## 45. Chấm thi và công bố

Quy trình:

```text
submitted
→ auto grade objective questions
→ pending_manual_grading nếu có tự luận
→ giáo viên phụ trách chấm
→ grading_complete
→ teacher lock results
→ publish results
→ student mới đọc được điểm
```

Không cho publish khi:

- Còn answer bắt buộc chấm thủ công.
- Có lỗi chấm chưa xử lý.
- Delivery chưa đóng, trừ Super Admin override có lý do.

Khi publish:

- Ghi `results_published_at`.
- Sinh notification idempotent.
- Cập nhật dashboard/progress/report.

## 46. Phúc tra và chấm lại

Nếu answer key sai:

1. Không sửa question version đang dùng.
2. Tạo version mới cho tương lai.
3. Với kỳ thi hiện tại, Super Admin/giáo viên phụ trách tạo regrade action có lý do.
4. Chọn:
   - thay answer key override cho delivery;
   - bỏ câu khỏi điểm;
   - cho toàn bộ điểm câu.
5. Chạy lại điểm tất cả attempt trong transaction/batch an toàn.
6. Ghi điểm trước/sau và actor trong audit.
7. Gửi thông báo nếu kết quả đã công bố bị thay đổi.

---

# PHẦN XII — CHỐNG COPY/PASTE VÀ GIAN LẬN

## 47. Phạm vi cam kết

Trong trang thi, hệ thống phải ngăn các đường copy/cut/paste chuẩn:

- `copy` event.
- `cut` event.
- `paste` event.
- `beforeinput` với `insertFromPaste`/`insertFromDrop`.
- `Ctrl/Cmd + C`, `X`, `V`.
- `Shift + Insert`.
- Context menu trên vùng đề/input.
- Drag/drop text vào ô trả lời.
- Mobile long-press paste khi trình duyệt cho phép chặn.

Tuy nhiên, không được tuyên bố hệ thống ngăn gian lận tuyệt đối ngoài trình duyệt. Học viên vẫn có thể dùng thiết bị khác, chụp màn hình hoặc DevTools. Đây là giới hạn kỹ thuật khách quan.

## 48. Không phá Chinese IME

Chinese IME dùng composition, không phải paste. Logic chặn phải:

- Không `preventDefault` cho composition event.
- Không chặn chọn candidate.
- Không validate giữa lúc đang composing.
- Test thật trên Microsoft Pinyin, iOS và Android.

## 49. Integrity events

Ghi sự kiện hỗ trợ giáo viên rà soát:

- `copy_blocked`.
- `paste_blocked`.
- `cut_blocked`.
- `tab_hidden`.
- `window_blurred`.
- `window_focused`.
- `network_offline`.
- `network_online`.
- `attempt_resumed`.
- `auto_submitted`.

Nguyên tắc:

- Không tự động cho 0 điểm chỉ vì event.
- Không tự kết luận “gian lận”.
- Chỉ hiển thị “dấu hiệu cần xem xét”.
- Không lưu nội dung clipboard.
- Có retention để bảng không phình vô hạn.

## 50. Biện pháp học thuật thay cho shuffle

Vì Product Owner quyết định không trộn đề, nên giảm lợi ích gian lận bằng:

- Khung thi trong ngày + thời lượng rõ.
- Câu nghe giới hạn lượt phát.
- Câu hỏi dựa trên bài học và ngữ cảnh lớp.
- Kết hợp nhiều dạng câu.
- Tự luận ngắn yêu cầu giải thích.
- Phỏng vấn/xác minh trực tiếp ngoài hệ thống cho kỳ thi quan trọng nếu trung tâm cần.

Không dùng AI detector làm bằng chứng chấm điểm.

---

# PHẦN XIII — CHẤM ĐIỂM

## 51. Tách answer key khỏi nội dung học viên được đọc

Không đặt `is_correct` trong row option mà student có quyền SELECT.

Đề xuất tách:

- `question_versions` — prompt và cấu hình hiển thị.
- `question_options` — nội dung option, không có cờ đúng.
- `question_answer_keys` — đáp án và grading config, chỉ admin/teacher có scope và RPC chấm được đọc.

Student nhận payload qua RPC/view an toàn, không query answer key.

## 52. Điểm answer

Mỗi answer lưu:

- `auto_score`.
- `manual_score`.
- `final_score`.
- `is_correct` nullable.
- `graded_by`.
- `graded_at`.
- `feedback`.
- `override_reason`.

Quy tắc:

- Câu objective: `final_score = auto_score` trừ khi có override hợp lệ.
- Câu manual: `final_score = manual_score`.
- Điểm không vượt item max points.
- Client không gửi được trường điểm/actor.

## 53. Quy đổi điểm

### Bài tập

```text
final_score = raw_score / raw_max × exercise_delivery.max_score
```

### Kiểm tra/Thi

```text
final_score_100 = raw_score / raw_max × 100
```

Classification lấy từ `grading_scale_rules` bằng DB, không để client gửi label.

## 54. Rubric

Rubric áp dụng cho tự luận/dịch:

- Một rubric có nhiều tiêu chí.
- Mỗi tiêu chí có max point.
- Tổng tiêu chí phải bằng điểm câu.
- Giáo viên chấm từng tiêu chí hoặc nhập tổng, tùy config.
- Rubric version cũng phải đóng băng cùng set version.

Ví dụ bài dịch 10 điểm:

| Tiêu chí | Điểm |
|---|---:|
| Đúng ý | 4 |
| Ngữ pháp | 2 |
| Từ vựng | 2 |
| Tự nhiên | 1 |
| Dấu câu/chính tả | 1 |

---

# PHẦN XIV — THIẾT KẾ DATABASE

## 55. Enum mới đề xuất

```text
question_type:
  single_choice | multiple_choice | true_false | fill_blank
  | short_text | ordering | matching | reading_group
  | listening_choice | dictation | essay_translation

question_skill:
  listening | speaking | reading | writing | vocabulary | grammar

question_difficulty:
  easy | medium | hard

question_visibility:
  private | shared | pending_global_review | global | rejected | archived

question_status:
  draft | ready | archived

question_set_kind:
  exercise | exam

question_set_status:
  draft | ready | archived

exercise_delivery_status:
  draft | scheduled | open | closed | grading | results_published | cancelled | archived

exam_delivery_status:
  draft | scheduled | open | closed | grading | results_published | cancelled | archived

attempt_status:
  in_progress | submitted | pending_manual_grading | graded
  | returned_for_revision | invalidated

submission_reason:
  manual | duration_expired | exam_window_closed | system_finalize

result_release_mode:
  after_graded | after_due | manual

answer_release_mode:
  after_submit | after_due | with_results | never

multi_select_scoring_mode:
  all_or_nothing | partial_credit

question_share_permission:
  read | clone
```

Không sửa enum cũ đã chạy bằng cách recreate. Dùng migration `ALTER TYPE` hoặc enum mới.

## 56. Bảng ngân hàng câu hỏi

### `question_collections`

Folder tổ chức câu hỏi theo owner.

Cột chính:

- `id`.
- `owner_id`.
- `name`.
- `parent_id` nullable.
- timestamps.

### `questions`

Identity ổn định:

- `id`.
- `owner_id` FK profiles.
- `current_version_id` nullable.
- `course_id`, `module_id`, `lesson_id` nullable.
- `skill`.
- `difficulty`.
- `visibility`.
- `status`.
- `collection_id`.
- `created_by`.
- `archived_at`.
- timestamps.

### `question_versions`

Bất biến sau khi ready/được sử dụng:

- `id`.
- `question_id`.
- `version_no`.
- `question_type`.
- `prompt_text`.
- `prompt_content jsonb` cho cấu trúc type-specific.
- `normalization_config jsonb`.
- `explanation_text`.
- `created_by`.
- `created_at`.
- UNIQUE `(question_id, version_no)`.

`prompt_content` dùng JSONB có version schema rõ ràng vì cấu trúc 11 loại câu khác nhau. Phải validate bằng Zod ở server và DB function/check tối thiểu; không để JSON tùy ý.

### `question_options`

- `id`.
- `question_version_id`.
- `option_key`.
- `content`.
- `order_index`.
- UNIQUE `(question_version_id, order_index)`.

Không có `is_correct`.

### `question_answer_keys`

- `question_version_id` PK/FK.
- `answer_key jsonb`.
- `grading_config jsonb`.
- `created_by`.
- timestamps.

Student deny toàn bộ SELECT.

### `question_media`

- `id`.
- `question_version_id`.
- `media_role`: prompt_audio, prompt_image, shared_passage_media.
- `object_path` UNIQUE.
- `mime_type`.
- `size_bytes`.
- `duration_ms` nullable.
- `uploaded_by` do DB ghi.
- timestamps.

### `question_tags` và `question_tag_links`

Tag có scope owner/global. Link many-to-many.

### `question_shares`

- `question_id`.
- `shared_with_teacher_id`.
- `permission`.
- `shared_by`.
- UNIQUE `(question_id, shared_with_teacher_id)`.

### `question_review_requests`

- Câu gửi duyệt global.
- Status pending/approved/rejected.
- Reviewer.
- Lý do.
- timestamps.

## 57. Bảng bộ câu hỏi

### `question_sets`

- `id`.
- `owner_id`.
- `kind` (`exercise|exam`).
- `title`.
- `description`.
- `course_id/module_id/lesson_id` nullable.
- `status`.
- `current_version_id`.
- timestamps.

### `question_set_versions`

- `id`.
- `question_set_id`.
- `version_no`.
- `title_snapshot`.
- `instructions_snapshot`.
- `raw_max_score`.
- `rubric_config` nếu dùng chung.
- `created_by`.
- `locked_at`.
- UNIQUE `(question_set_id, version_no)`.

### `question_set_sections`

- `id`.
- `set_version_id`.
- `title`.
- `instructions`.
- `order_index`.
- shared stimulus config/media nullable.

### `question_set_items`

- `id`.
- `set_version_id`.
- `section_id`.
- `question_version_id`.
- `order_index`.
- `points` numeric > 0.
- `required` boolean.
- `display_config jsonb`.
- UNIQUE `(set_version_id, order_index)` hoặc `(section_id, order_index)`.

### `question_set_shares`

Tương tự question share. Người nhận được đọc/clone, không sửa bộ gốc.

## 58. Bảng Bài tập

### `exercise_deliveries`

- `id`.
- `class_id`.
- `set_version_id`.
- `title`.
- `instructions`.
- `available_from`.
- `due_at`.
- `allow_late_submission`.
- `late_penalty_percent`.
- `attempt_limit`.
- `grading_method` first/latest/highest.
- `max_score`.
- `result_release_mode`.
- `answer_release_mode`.
- `status`.
- `published_at`.
- `created_by`.
- timestamps.

### `exercise_attempts`

- `id`.
- `delivery_id`.
- `enrollment_id`.
- `attempt_no`.
- `status`.
- `started_at`.
- `submitted_at`.
- `is_late`.
- `raw_score`.
- `final_score`.
- `graded_at`.
- `results_published_at`.
- `invalidated_at/reason` nullable.
- UNIQUE `(delivery_id, enrollment_id, attempt_no)`.

### `exercise_answers`

- `id`.
- `attempt_id`.
- `set_item_id`.
- `answer_payload jsonb`.
- `saved_at`.
- `auto_score`.
- `manual_score`.
- `final_score`.
- `feedback`.
- grading actor/timestamps.
- UNIQUE `(attempt_id, set_item_id)`.

## 59. Bảng Kiểm tra/Thi

### `exam_deliveries`

- `id`.
- `class_id`.
- `set_version_id`.
- `title`.
- `exam_type`.
- `opens_at`.
- `closes_at`.
- `duration_minutes`.
- `passing_score`.
- `status`.
- `published_at`.
- `results_published_at`.
- `created_by`.
- timestamps.

Constraint/trigger:

- `opens_at < closes_at`.
- Cùng ngày `Asia/Ho_Chi_Minh`.
- `duration_minutes > 0`.
- Set kind phải là `exam`.
- Scope lớp giáo viên phụ trách.

### `exam_attempts`

- `id`.
- `exam_delivery_id`.
- `enrollment_id`.
- `status`.
- `started_at`.
- `deadline_at`.
- `submitted_at`.
- `submission_reason`.
- `raw_score`.
- `final_score_100`.
- `classification_rule_id`.
- `graded_at`.
- `invalidated_at/reason`.
- UNIQUE valid attempt theo `(exam_delivery_id, enrollment_id)` bằng partial unique index.

### `exam_answers`

Tương tự exercise answer, nhưng không được update sau `deadline_at` hoặc submit.

### `exam_integrity_events`

- `id`.
- `attempt_id`.
- `event_type`.
- `occurred_at` do server.
- `client_context jsonb` giới hạn allowlist.
- Không lưu clipboard content.

### `exam_regrade_runs`

- `id`.
- `exam_delivery_id`.
- `reason`.
- `rule_override jsonb`.
- `started_by`.
- `started_at/completed_at`.
- trạng thái và thống kê thay đổi.

## 60. Index bắt buộc

- Mọi FK.
- `(owner_id, status)` cho questions/sets.
- GIN/search index phù hợp cho tag hoặc full-text prompt.
- `(class_id, status, due_at)` exercise.
- `(class_id, status, opens_at)` exam.
- `(delivery_id, enrollment_id)` attempts.
- `(attempt_id, set_item_id)` answers.
- `(attempt_id, occurred_at)` integrity events.
- Các cột được helper RLS truy vấn: owner, class, enrollment, teacher mapping.

---

# PHẦN XV — RPC, TRANSACTION VÀ TOÀN VẸN

## 61. RPC tối thiểu

### Authoring

- `create_question_version`
- `publish_question_version`
- `submit_question_for_global_review`
- `review_global_question`
- `create_question_set_version`
- `lock_question_set_version`

### Bài tập

- `create_exercise_delivery`
- `publish_exercise_delivery`
- `start_exercise_attempt`
- `save_exercise_answer`
- `submit_exercise_attempt`
- `grade_exercise_answer`
- `return_exercise_for_revision`
- `publish_exercise_results`

### Thi

- `create_exam_delivery`
- `publish_exam_delivery`
- `start_exam_attempt`
- `save_exam_answer`
- `submit_exam_attempt`
- `finalize_expired_exam_attempts`
- `grade_exam_answer`
- `lock_exam_results`
- `publish_exam_results`
- `invalidate_exam_attempt`
- `run_exam_regrade`

## 62. Quy tắc RPC

Mỗi RPC:

1. Kiểm `app.is_active()`.
2. Kiểm role/scope ở dòng đầu.
3. Không nhận `actor_id`, `owner_id`, `enrollment_id` nguy hiểm từ client nếu server có thể suy ra.
4. Dùng `auth.uid()` làm actor.
5. `SECURITY DEFINER` phải `SET search_path = ''`.
6. Revoke `PUBLIC` và `anon`.
7. Chỉ grant đúng role.
8. Dùng lock/UNIQUE để chống request đồng thời.
9. Ghi audit trong cùng transaction cho mutation nhạy cảm.
10. Idempotent khi client retry.

## 63. Student không tự truyền enrollment

Tương tự bài học đã có trong hệ thống hiện tại:

- Server/RPC tìm student theo `auth.uid()`.
- Tìm open enrollment thuộc class của delivery.
- Không nhận enrollment tùy ý từ form.

Nếu không có đúng một enrollment hợp lệ → fail-closed.

## 64. Deadline do DB quyết định

- Dùng `clock_timestamp()` hoặc `now()` phù hợp trong transaction.
- Không tin giờ máy học viên.
- Server trả `deadline_at` để UI render.
- Update answer kiểm deadline trong DB.
- Browser cố sửa đồng hồ không có tác dụng.

---

# PHẦN XVI — RLS

## 65. Anonymous

- Deny mọi bảng nghiệp vụ.
- Deny question media.
- Không bắt đầu attempt.

## 66. Student

Chỉ được:

- Đọc exercise/exam delivery đã publish thuộc class của enrollment mình.
- Đọc set content cần làm nhưng không đọc answer key.
- Đọc/ghi attempt và answer của chính mình khi trạng thái/thời gian hợp lệ.
- Đọc kết quả chỉ khi đã publish.
- Đọc đáp án/giải thích theo release mode.

Bị chặn:

- Attempt của student khác, kể cả cùng lớp.
- Answer key.
- Draft delivery.
- Bộ/câu riêng của giáo viên.
- Sửa điểm/feedback/status.
- Gửi answer sau deadline.
- Tạo attempt lần hai.

## 67. Teacher

- Đọc question/set mình sở hữu, được share hoặc global.
- Tạo private question/set.
- Chỉ quản lý delivery của class mình đứng chính.
- Teacher ngoài scope nhận 0 row/permission denied.
- Không đọc attempts lớp khác.

## 68. Super Admin

Toàn quyền nghiệp vụ, nhưng vẫn nên dùng server action/RPC cho mutation để audit và invariant. Không dùng service role cho request user thường chỉ vì role là Super Admin.

## 69. Kiểm tra IDOR bắt buộc

- Teacher A đổi `class_id` sang lớp Teacher B.
- Teacher A đoán delivery/attempt ID lớp khác.
- Student A đoán attempt Student B cùng lớp.
- Student query trực tiếp `question_answer_keys`.
- Student gửi `final_score` trong payload.
- Student sửa `submitted_at` hoặc `deadline_at`.
- Student gọi submit hai lần.
- Teacher ngoài lớp gọi publish.

Tất cả phải bị chặn ở DB dù bỏ qua UI/server action.

---

# PHẦN XVII — STORAGE VÀ MEDIA

## 70. Bucket đề xuất

### `question-media` — private

Lưu:

- Audio câu nghe.
- Hình ảnh câu hỏi.
- Media passage.

Path:

```text
{owner_id}/{question_id}/{question_version_id}/{uuid}.{ext}
```

### `question-imports` — private, tạm thời

Lưu file Excel import trong thời gian xử lý. Có retention/xóa tự động sau thời gian ngắn.

Phase đầu không cần bucket nộp bài chung vì học viên trả lời trực tiếp. **P-C (17/07/2026):** đã tạo bucket private `answer-media` + bảng `answer_media` cho bài nộp audio của câu Nói (xem "Cập nhật P-C").

## 71. Upload validation

- Allowlist MIME/extension.
- Giới hạn dung lượng.
- Kiểm tra magic bytes nếu có thể.
- Tên object do server sinh.
- Không nhận object path từ client.
- `uploaded_by` do DB/server xác định.
- Signed URL thời hạn ngắn.
- Không hard-delete media đang được question version tham chiếu.

## 72. Audio

- Format ưu tiên: MP3/M4A tương thích browser.
- Lưu duration.
- Không expose bucket public.
- Số lượt phát được đếm trên client và xác nhận event server; không thể bảo đảm tuyệt đối khi user can thiệp DevTools, nhưng UI phải thực thi đúng.

---

# PHẦN XVIII — IMPORT EXCEL

## 73. Quy trình import

```text
Tải file mẫu
→ điền dữ liệu
→ upload
→ hệ thống parse server-side
→ dry-run validation
→ hiển thị preview + lỗi theo dòng
→ user xác nhận
→ import toàn bộ trong transaction/batch
→ trả báo cáo kết quả
```

Không ghi một phần nếu file có lỗi nghiêm trọng, trừ khi user chủ động chọn “bỏ qua dòng lỗi” trong phiên bản sau. V1 mặc định all-or-nothing.

## 74. Cấu trúc workbook đề xuất

### Sheet `Questions`

- `external_key`
- `question_type`
- `title`
- `prompt`
- `course_code`
- `module_order`
- `lesson_order`
- `skill`
- `difficulty`
- `points_default`
- `normalization_mode`
- `explanation`
- `tags`

### Sheet `Options`

- `question_external_key`
- `option_key`
- `option_text`
- `order_index`

### Sheet `AnswerKeys`

- `question_external_key`
- `answer_value`
- `answer_order`
- `is_required`

### Sheet `AcceptedAnswers`

Dùng cho short text/fill blank/dictation:

- `question_external_key`
- `blank_key`
- `accepted_answer`

Audio/hình ảnh không nhúng trực tiếp trong Excel ở v1. Giáo viên attach media sau import để tránh xử lý file nhúng không ổn định.

## 75. Validation import

- External key trùng.
- Type không hợp lệ.
- Thiếu option/answer.
- Course/module/lesson không tồn tại.
- Skill/difficulty sai enum.
- Điểm không hợp lệ.
- Pinyin/Unicode parse lỗi.
- Formula cell bị từ chối hoặc đọc giá trị an toàn.
- File quá lớn.

Xuất file lỗi có cột `row_number`, `error_code`, `message`.

---

# PHẦN XIX — THÔNG BÁO VÀ CRON

## 76. Notification type mới

```text
exercise_assigned
exercise_due
exercise_returned
exercise_result_published
exam_scheduled
exam_opening
exam_result_published
```

Có thể migration từ enum cũ hoặc tạo enum mới theo quy ước hiện tại.

## 77. Thông báo Bài tập

- Khi publish/giao.
- Trước hạn nộp.
- Khi giáo viên trả lại làm lại.
- Khi công bố điểm.

## 78. Thông báo Thi

- Khi kỳ thi được schedule.
- Nhắc trước giờ mở.
- Khi công bố kết quả.

Không gửi notification trên mỗi autosave hoặc integrity event.

## 79. Cron/job

- Mở/đóng trạng thái delivery theo thời gian, nhưng quyền làm bài vẫn phải kiểm trực tiếp theo timestamp, không phụ thuộc cron chạy đúng phút.
- Nhắc hạn bằng `dedupe_key`.
- Finalize exam attempt đã quá deadline.
- Dọn file import tạm.
- Retention integrity events.

Cron lỗi không được làm học viên thi quá giờ; deadline guard ở DB là chốt cuối.

---

# PHẦN XX — DASHBOARD, TIẾN ĐỘ VÀ BÁO CÁO

## 80. Dashboard giáo viên

Cập nhật nguồn:

- Bài chờ chấm từ `exercise_answers`/`exam_answers` manual.
- Bài chưa nộp từ delivery + enrollment + attempts.
- Kỳ thi đang mở.
- Học viên có điểm thấp.

## 81. Dashboard học viên

- Số bài tập cần làm.
- Bài sắp hết hạn.
- Kỳ thi hôm nay/sắp tới.
- Kết quả mới công bố.

## 82. Progress và hoàn thành khóa

View `v_enrollment_progress` phải thay logic cũ:

- Assignment completion dựa trên exercise delivery bắt buộc và attempt hợp lệ.
- Assignment score lấy theo grading method của delivery.
- Assessment score lấy từ exam attempt đã graded/published theo rule nghiệp vụ.
- Không tính attempt invalidated.
- Không tính draft/cancelled delivery.

## 83. Analytics câu hỏi

Cho giáo viên:

- Tỷ lệ đúng từng câu.
- Điểm trung bình từng câu.
- Thời gian trung bình.
- Số bỏ trống.
- Câu có tỷ lệ đúng quá cao/thấp.
- Phân bố đáp án trắc nghiệm.

Dữ liệu chỉ thuộc lớp giáo viên đứng chính. Không dùng analytics để tự kết luận gian lận.

## 84. Export

- Danh sách nộp bài.
- Điểm bài tập.
- Kết quả kỳ thi.
- Điểm từng section/kỹ năng.
- Integrity event summary.
- Giữ đúng filter/date range đang chọn.
- Export phải kiểm RLS/scope, không dùng admin client cho teacher.

---

# PHẦN XXI — KIẾN TRÚC SOURCE

## 85. Feature structure đề xuất

```text
src/features/question-bank/
  domain/
  schemas/
  queries/
  actions/
  components/
  import/

src/features/question-builder/
  domain/
  renderers/
  editors/
  preview/

src/features/exercises/
  teacher/
  student/
  grading/
  domain/

src/features/exams/
  teacher/
  student/
  grading/
  integrity/
  domain/

src/features/chinese-input/
  composition/
  pinyin/
  normalization/
```

## 86. Renderer registry

Dùng registry theo `question_type`:

```text
editor component
student renderer
preview renderer = student renderer
answer validator
scoring handler
serialization schema
```

Không tạo switch khổng lồ rải rác ở nhiều page.

Mỗi type phải có contract chung:

- `parseContent`.
- `parseAnswer`.
- `renderPrompt`.
- `renderInput`.
- `autoGrade` hoặc `manualOnly`.

## 87. Server/client boundary

- Read authenticated: RSC + Supabase server client/RLS.
- Mutation: Server Actions/RPC.
- Builder và attempt UI: Client Component cần state tương tác.
- Answer key chỉ xử lý server/DB.
- Admin client không dùng cho teacher/student flow.

## 88. Error handling

User-facing error không lộ:

- SQL.
- Schema/table name.
- Answer key.
- UUID ngoài scope.
- Stack trace.

Route ID sai hoặc ngoài scope trả 404/permission phù hợp, không 500.

---

# PHẦN XXII — CHIẾN LƯỢC MIGRATION

## 89. Vì sao vẫn cần migration hai bước

Dù chưa có dữ liệu thật, production app đang tồn tại. Nếu drop bảng cũ trước khi deploy app mới, phiên bản app cũ đang chạy sẽ lỗi trong khoảng giữa hai deployment.

Vì vậy dùng chiến lược additive → switch → cleanup.

## 90. Stage A — Backup và kiểm kê

1. Backup database.
2. Liệt kê row count 6 bảng cũ.
3. Liệt kê object trong bucket `assignment-files` và `submissions`.
4. Xác nhận chỉ là demo/test.
5. Lưu báo cáo vào WORKLOG.
6. Không dựa vào lời nói chung; phải ghi số count thật.

## 91. Stage B — Migration additive

- Tạo enum/bảng/helper/RLS/RPC mới.
- Tạo bucket mới.
- Không drop bảng cũ.
- Generate TypeScript types.
- Seed một bộ demo mới local/staging.
- Chạy pgTAP.

App cũ vẫn hoạt động vì bảng cũ còn tồn tại.

## 92. Stage C — Deploy app mới

- Thay sidebar/routes.
- App mới chỉ dùng schema mới.
- Smoke 3 role.
- E2E end-to-end.
- Xác nhận không còn query runtime vào bảng cũ bằng grep/log.

## 93. Stage D — Cleanup destructive

Sau khi app mới chạy ổn:

1. Xóa object demo trong bucket cũ.
2. Drop policy/trigger/RPC/view cũ.
3. Drop 6 bảng cũ theo thứ tự FK.
4. Xóa bucket cũ nếu không còn dùng.
5. Regenerate types.
6. Xóa source/test cũ.
7. Chạy full test/build.
8. Deploy cleanup.

Không sửa migration đã chạy. Mọi cleanup là migration mới forward-only.

## 94. Rollback

- Trước Stage D: rollback app về deployment cũ được vì bảng cũ còn.
- Sau Stage D: không rollback app cũ; chỉ forward-fix hoặc restore backup.
- Vì vậy Stage D chỉ chạy sau smoke và sign-off.

---

# PHẦN XXIII — KIỂM THỬ

## 95. Unit/domain test

### Question validation

- Mỗi type hợp lệ/không hợp lệ.
- Option/answer key.
- Điểm > 0.
- Section/order.

### Chinese normalization

- Unicode NFC.
- Pinyin dấu/số.
- `ü/u:/v`.
- Simplified/traditional config.
- Khoảng trắng/dấu câu.
- Tone required/optional.

### Scoring

- Single/multiple/partial.
- Fill blank từng phần.
- Ordering/matching.
- Quy đổi max score.
- Late penalty.
- Không điểm âm.

### Time

- Same-day Asia/Ho_Chi_Minh.
- Start ở đầu/cuối window.
- `min(start+duration, closes_at)`.
- Boundary UTC/local date.

### State machine

- Chuyển hợp lệ.
- Chuyển sai bị từ chối.
- Submit idempotent.

## 96. Component test

- Builder thêm/xóa/reorder câu.
- Validation summary.
- IME composition không submit sớm.
- Copy/paste blocked trong exam nhưng typing/IME hoạt động.
- Autosave indicator.
- Timer warnings.
- Mobile ordering controls.
- Empty/loading/error state.

## 97. pgTAP/integration

- FK/UNIQUE/CHECK/index.
- Version immutable.
- Student deny answer key.
- Chỉ giáo viên phụ trách được assign/publish/grade.
- Giáo viên không phụ trách lớp bị từ chối mutation.
- Teacher A ≠ Teacher B.
- Student A ≠ Student B cùng lớp.
- Start attempt đồng thời → đúng một.
- Save answer sau deadline → denied.
- Submit hai lần → một kết quả.
- Auto finalize.
- Publish result rule.
- Regrade audit.
- Notification dedupe.
- Storage scope/path.

## 98. E2E bắt buộc

### E2E-EX-01 — Giáo viên tạo và giao bài

- Tạo câu hỏi.
- Tạo bộ.
- Preview.
- Giao cho lớp mình đứng chính.
- Không giao được lớp khác.

### E2E-EX-02 — Học viên làm bài

- Thấy bài.
- Làm nhiều dạng.
- Autosave.
- Nộp.
- Giáo viên chấm tự luận.
- Công bố.
- Học viên thấy đúng điểm.

### E2E-EX-03 — Thi trong khung cùng ngày

- Trước giờ không bắt đầu.
- Trong giờ bắt đầu được.
- Deadline đúng.
- Bắt đầu gần giờ đóng bị rút ngắn thời gian.
- Hết giờ auto-submit.

### E2E-EX-04 — Copy/paste và IME

- Copy/cut/paste bị chặn.
- Event được ghi.
- Microsoft Pinyin composition vẫn nhập được chữ Hán.
- Không lưu clipboard content.

### E2E-EX-05 — IDOR

- Student A không đọc answer/attempt B.
- Teacher A không đọc delivery B.
- Direct URL trả 404/denied.

### E2E-EX-06 — Kết quả

- Objective auto grade.
- Essay pending.
- Không publish khi chưa chấm.
- Publish xong student mới thấy.

## 99. Performance/load

Mục tiêu ban đầu phù hợp quy mô trung tâm:

- 100 học viên bắt đầu thi trong khoảng ngắn không tạo duplicate attempt.
- Autosave theo thay đổi, không polling ghi DB liên tục.
- Query monitor lớp không N+1 theo từng học viên/câu.
- Danh sách 500–1000 câu hỏi có pagination/server filter.
- Index được xác minh bằng explain cho query quan trọng.

Không tuyên bố đạt tải nếu chưa chạy test thật.

## 100. Security review

- Answer key leakage trong RSC payload/HTML/source map.
- IDOR.
- Service role import nhầm client.
- Storage path traversal.
- Excel formula injection khi export/import.
- XSS trong prompt/essay/explanation.
- Rate limit start/save/submit/import/export.
- Replay request sau deadline.
- Tamper client score/time/status.

---

# PHẦN XXIV — LỘ TRÌNH TASK CHO CLAUDE/CODEX

> Task phải đủ nhỏ để một session làm xong. Agent claim task trong WORKLOG, làm đúng scope, cập nhật ngay sau mỗi task. User tự commit theo D-20.

## Phase P8 — Đặc tả và nền migration

| ID | Task | Definition of Done |
|---|---|---|
| P8-T1 | Đồng bộ quyết định | Thêm EX-01…EX-20 vào docs/WORKLOG; không code |
| P8-T2 | Schema design final | ERD + enum + table + FK + state machine được review |
| P8-T3 | RLS matrix final | Ma trận 3 role + giáo viên phụ trách + answer key |
| P8-T4 | Migration inventory | Count thật bảng/bucket cũ; backup; báo cáo không có data thật |
| P8-T5 | Source impact map | Liệt kê route/component/query/RPC/test cũ cần thay |

## Phase P9 — Question Bank và Builder core

| ID | Task | Definition of Done |
|---|---|---|
| P9-T1 | Migration question core | questions, versions, options, answer_keys, tags, collections |
| P9-T2 | Migration sharing/review | shares + global review + RLS |
| P9-T3 | Migration set core | sets, versions, sections, items + immutable rule |
| P9-T4 | Storage question-media | Bucket private + policy/path/upload validation |
| P9-T5 | Domain schemas | Zod schema 11 question type |
| P9-T6 | Question Bank list | Search/filter/pagination/scope |
| P9-T7 | Question CRUD | Create/edit/version/archive/clone |
| P9-T8 | Sharing flow | Share teacher + submit/approve/reject global |
| P9-T9 | Builder shell | Section/item reorder + score summary |
| P9-T10 | Editor objective types | Q1–Q7 |
| P9-T11 | Editor passage/audio types | Q8–Q10 + media |
| P9-T12 | Editor essay | Q11 + rubric |
| P9-T13 | Preview/render registry | Cùng renderer với student |
| P9-T14 | Excel template/import | Dry-run + error report + transaction |
| P9-T15 | Tests gate | pgTAP/RLS/unit/component xanh |

## Phase P10 — Module Bài tập

| ID | Task | Definition of Done |
|---|---|---|
| P10-T1 | Migration exercise | deliveries, attempts, answers, enum/index |
| P10-T2 | Exercise RPC/RLS | publish/start/save/submit/grade/release |
| P10-T3 | Teacher sidebar/routes | Module riêng, không quản lý chính trong class tab |
| P10-T4 | Set list/create | Bộ bài tập |
| P10-T5 | Assign to managed classes | Multi-class creates separate deliveries |
| P10-T6 | Teacher delivery list/detail | KPI/filter/progress |
| P10-T7 | Student exercise list | 5 tab + dashboard counts |
| P10-T8 | Student attempt renderer | 11 type + autosave |
| P10-T9 | Submit/multiple attempts | limit + grading method + late |
| P10-T10 | Teacher grading | theo student/theo question/rubric |
| P10-T11 | Result/answer release | đúng mode, notification dedupe |
| P10-T12 | Progress/report update | view/dashboard/export dùng schema mới |
| P10-T13 | Tests gate | E2E exercise + RLS + scoring pass |

## Phase P11 — Module Kiểm tra/Thi

| ID | Task | Definition of Done |
|---|---|---|
| P11-T1 | Migration exam | deliveries, attempts, answers, integrity, regrade |
| P11-T2 | Same-day time rules | Trigger/domain test Asia/Ho_Chi_Minh |
| P11-T3 | Exam RPC/RLS | start/save/submit/finalize/grade/publish |
| P11-T4 | Teacher sidebar/routes | Module riêng |
| P11-T5 | Exam set workflow | Fixed order, no shuffle/random/access code |
| P11-T6 | Schedule exam | Window same day + duration + validation |
| P11-T7 | Student exam list/waiting room | Eligibility + audio check |
| P11-T8 | Exam attempt UI | Timer/autosave/warnings |
| P11-T9 | Clipboard protection | Copy/cut/paste/drop block, IME safe |
| P11-T10 | Integrity events | Log allowlist, no automatic accusation |
| P11-T11 | Auto-submit/finalizer | Browser close vẫn finalize |
| P11-T12 | Grading/lock/publish | 0–100 + classification |
| P11-T13 | Regrade | audit before/after |
| P11-T14 | Monitor/analytics/export | Scope lớp giáo viên phụ trách |
| P11-T15 | Tests gate | E2E exam/time/clipboard/IDOR pass |

## Phase P12 — Cleanup module cũ

| ID | Task | Definition of Done |
|---|---|---|
| P12-T1 | Verify new app no old query | grep + runtime smoke |
| P12-T2 | Drop old RPC/policies/views | Migration forward-only |
| P12-T3 | Drop old tables | 6 bảng cũ removed |
| P12-T4 | Cleanup old buckets | Object count 0, delete policy/bucket |
| P12-T5 | Remove old source/routes/tests | Không còn UI luồng cũ |
| P12-T6 | Regenerate types/docs | build/typecheck xanh |

## Phase P13 — Hardening và production rollout

| ID | Task | Definition of Done |
|---|---|---|
| P13-T1 | Full pgTAP matrix | Mọi bảng/RPC/Storage mới |
| P13-T2 | Full Playwright 3 role | Exercise + exam + negative |
| P13-T3 | A11y/mobile/IME | 44px, keyboard, Chinese input real devices |
| P13-T4 | Performance test | Có số thật, không đoán |
| P13-T5 | Security review | Answer key/XSS/IDOR/rate limit/import |
| P13-T6 | Staging rehearsal | Migration A → app → cleanup |
| P13-T7 | Production deploy | DB additive trước app, smoke, cleanup sau sign-off |
| P13-T8 | Post-deploy monitoring | Error/query/storage/job/notification |

---

# PHẦN XXV — ACCEPTANCE CRITERIA

## 101. Ngân hàng câu hỏi

- AC-EX-001: Teacher tạo được câu hỏi private.
- AC-EX-002: Teacher B không đọc được câu private của A.
- AC-EX-003: Share/clone hoạt động đúng quyền.
- AC-EX-004: Super Admin duyệt global.
- AC-EX-005: Sửa câu đã dùng tạo version mới.
- AC-EX-006: Student không đọc được answer key bằng UI hoặc query trực tiếp.
- AC-EX-007: Import Excel dry-run báo đúng dòng lỗi và không ghi nửa chừng.

## 102. Builder

- AC-EX-010: Tạo đủ 11 loại câu giai đoạn đầu.
- AC-EX-011: Preview dùng cùng renderer với student.
- AC-EX-012: Không chốt bộ lỗi/thiếu answer key.
- AC-EX-013: Set version bất biến sau khi giao.
- AC-EX-014: Không có shuffle/random/access code/hint trong UI/schema v1.

## 103. Bài tập

- AC-EX-020: Teacher chỉ giao lớp mình đứng chính.
- AC-EX-021: Một bộ giao nhiều lớp tạo delivery riêng.
- AC-EX-022: Student chỉ thấy bài lớp/enrollment mình.
- AC-EX-023: Autosave không tạo answer trùng.
- AC-EX-024: Nộp trễ/penalty/attempt limit đúng.
- AC-EX-025: Auto + manual score quy đổi đúng max score.
- AC-EX-026: Không có gợi ý trong lúc làm.
- AC-EX-027: Kết quả/đáp án chỉ hiện đúng release mode.

## 104. Kiểm tra/Thi

- AC-EX-030: ~~Opens/closes bắt buộc cùng ngày Việt Nam.~~ **ĐÃ ĐẢO (2026-07-18):** Opens/closes được phép khác ngày; chỉ cần `opens_at < closes_at` (migration 57 bỏ CHECK cùng-ngày).
- AC-EX-031: Học viên bắt đầu bất kỳ lúc nào trong window.
- AC-EX-032: Deadline = min(start + duration, closes_at).
- AC-EX-033: Hai request start đồng thời chỉ tạo một attempt.
- AC-EX-034: Không save sau deadline.
- AC-EX-035: Hết giờ tự nộp dù browser đóng.
- AC-EX-036: Copy/cut/paste/drop bị chặn trong trang thi.
- AC-EX-037: Chinese IME vẫn hoạt động.
- AC-EX-038: Mọi học viên nhận cùng thứ tự câu/đáp án.
- AC-EX-039: Không có extra-time override, room code, random hoặc shuffle.
- AC-EX-040: Student chỉ thấy kết quả sau publish.

## 105. Security và dữ liệu

- AC-EX-050: RLS bật trên mọi bảng mới.
- AC-EX-051: Anonymous deny.
- AC-EX-052: Student A không đọc attempt/answer Student B cùng lớp.
- AC-EX-053: Teacher A không đọc/chấm lớp B.
- AC-EX-054: Giáo viên ngoài lớp không publish/grade.
- AC-EX-055: Client tự gửi score/status/deadline bị bỏ qua hoặc từ chối.
- AC-EX-056: Media private, signed URL đúng scope.
- AC-EX-057: Audit ghi actor thật và before/after cho override/regrade/invalidate.

## 106. Cleanup

- AC-EX-060: Không còn 6 bảng cũ.
- AC-EX-061: Không còn RPC/routes/components luồng cũ.
- AC-EX-062: learning_evaluations/student_notes vẫn hoạt động.
- AC-EX-063: Dashboard/progress/report không tham chiếu schema cũ.
- AC-EX-064: Full lint/typecheck/unit/pgTAP/E2E/build xanh với số pass thật.

---

# PHẦN XXVI — CÁC TÀI LIỆU PHẢI CẬP NHẬT SAU KHI DUYỆT KẾ HOẠCH

## 107. `01-business-analysis.md`

- Thay BR-6 bằng nghiệp vụ bộ bài tập/lần giao/attempt/answer.
- Thay phần assessment cũ bằng kỳ thi trực tuyến.
- Giữ learning evaluation riêng.
- Cập nhật scope/menu/acceptance criteria.

## 108. `02-database-design.md`

- Thay ERD.
- Thêm enum/bảng/RLS/RPC/index/schema mới.
- Đánh dấu các bảng cũ bị loại bỏ.
- Cập nhật progress views và notification type.

## 109. `03-workflow.md`

- Workflow Question Bank.
- Workflow Builder/version.
- Workflow Bài tập.
- Workflow Thi same-day.
- Autosave/auto-submit/failure path.
- Chấm/regrade/publish.

## 110. `04-system-architecture.md`

- Feature folders.
- Renderer registry.
- Route map.
- Server/client boundary.
- Cron finalizer.
- Storage bucket.

## 111. `05-testing-strategy.md`

- Unit normalization/scoring/time.
- pgTAP full matrix.
- E2E copy/paste + IME + deadline.
- Load/performance.

## 112. `06-deployment-vercel-supabase.md`

- Additive migration → app switch → cleanup.
- Backup old tables/buckets.
- Cron finalize.
- Smoke test module mới.

## 113. `07-product-backlog.md`

Đưa vào backlog:

- Speaking recording.
- Handwriting/stroke order.
- Video response.
- AI authoring/grading.
- Advanced proctoring nếu sau này thật sự cần.

## 114. `08-phase-plan.md`

- Thêm P8–P13 theo task ledger trong tài liệu này.
- Không xóa task cũ; ghi extension phase.

## 115. `WORKLOG.md`

- Thêm decision EX-01…EX-20.
- Claim P8-T1 khi bắt đầu.
- Ghi count/backup thật trước destructive migration.

---

# PHẦN XXVII — DEFINITION OF DONE TOÀN BỘ

Hai module chỉ được coi là hoàn thành khi:

1. Hai menu riêng hoạt động cho teacher và student.
2. Giáo viên dựng được bộ hoàn toàn trên web.
3. Có đủ 11 loại câu phase đầu.
4. Ngân hàng private/share/global đúng scope.
5. Giáo viên chỉ giao cho lớp mình đứng chính.
6. Học viên làm trực tiếp, autosave và resume được.
7. Bài tập chấm auto/manual và release đúng rule.
8. Kỳ thi same-day window + duration hoạt động đúng DB time.
9. Copy/paste bị chặn trong trang thi và Chinese IME không bị phá.
10. Hết giờ tự nộp kể cả browser đóng.
11. Answer key không xuất hiện trong client payload hoặc quyền student.
12. RLS/IDOR pass cho mọi bảng/RPC/Storage.
13. Scoring 0–100 và grading scale đúng.
14. Dashboard/progress/report/export dùng nguồn mới.
15. Notification/cron idempotent.
16. Migration production chạy theo additive → switch → cleanup.
17. Sáu bảng và toàn bộ source luồng cũ được xóa.
18. `learning_evaluations`/`student_notes` không bị ảnh hưởng.
19. Tài liệu 01–08 và WORKLOG được cập nhật đồng bộ.
20. Có bằng chứng thật: lint, typecheck, unit, pgTAP, Playwright, build và smoke production.

---

# PHẦN XXVIII — NGOÀI PHẠM VI

Không làm trong kế hoạch này:

- Giáo viên chụp đề để học viên nộp file.
- File submission chung không gắn từng câu.
- Hint trong bài tập.
- Trộn câu/trộn đáp án.
- Random question/multiple exam forms.
- Room access code.
- Extra time cho từng học viên.
- Webcam/chụp ảnh/face verification.
- IP lockdown/Safe Exam Browser.
- AI tạo câu hỏi/chấm bài/phát hiện AI.
- Speaking recording, video, handwriting, stroke order ở batch đầu.
- Parent role hoặc chat hai chiều.

---

## Kết luận kiến trúc

Giải pháp đích không phải là “thêm vài dạng input” vào bảng `assignments` cũ. Đây là một **learning assessment engine** mới gồm:

```text
Ngân hàng câu hỏi có version
        ↓
Trình dựng bộ có version
        ↓
Bài tập hoặc Kỳ thi theo lớp
        ↓
Attempt + Answer + Autosave
        ↓
Auto grade + Manual grade
        ↓
Khóa và công bố kết quả
        ↓
Progress + Dashboard + Report + Audit
```

Việc dùng chung lõi giúp tránh xây hai editor khác nhau, trong khi tách delivery/attempt của Bài tập và Thi giúp giữ quy tắc thời gian, chấm điểm, chống gian lận và RLS rõ ràng. Vì chưa có dữ liệu thật, module cũ sẽ được xóa hoàn toàn sau khi app mới qua smoke test; không duy trì code tương thích lâu dài.
