# M23 — Kiểm tra / Thi (Học viên)

## 1. Phạm vi

- Danh sách + phòng chờ: `/student/exams` và `ExamWaitingRoom`.
- Lượt thi: `ExamAttempt`, giữ nguyên trong `ExamIntegrityBoundary`.
- Kết quả: `/student/exams/results/[attemptId]`; foundation dùng chung đã sửa ở M22.
- Ngoài phạm vi: query/action/RPC/RLS, timer source, auto-save/auto-submit, fullscreen, integrity logging/blocking, upload audio, scoring và answer release.

## 2. Bằng chứng audit

| Issue        | Mức    | Bằng chứng trước sửa                                | Tác động                                     |
| ------------ | ------ | --------------------------------------------------- | -------------------------------------------- |
| `UX-M23-001` | High   | Page mở thẳng bằng lưới card trắng                  | Thiếu tổng quan/neo trạng thái kỳ thi        |
| `UX-M23-002` | High   | `CardTitle` là `div`; empty là khoảng trắng         | Heading/empty semantics kém                  |
| `UX-M23-003` | Medium | Raw emerald; card/meta cùng style                   | Lệch semantic palette M20–M22                |
| `UX-M23-004` | Medium | Chờ chấm là disabled button                         | Status bị trình bày như action               |
| `UX-M23-005` | Medium | Waiting room phẳng; audio checked dùng ký tự `✓`    | Khó quét trình tự chuẩn bị                   |
| `UX-M23-006` | High   | Attempt thiếu `<h1>`; saved 12px; error không alert | Context/state khó đọc và không announce đúng |
| `UX-M23-007` | High   | Timer chỉ là text mono                              | Screen reader không nhận timer               |
| `UX-M23-008` | Medium | Question card trắng; nhãn câu là `<p>`              | Thiếu nhịp và heading navigation             |
| `UX-M23-009` | Low    | Result exam không max-width như exercise            | Độ dài dòng không nhất quán                  |

## 3. Proposal

- **S01:** summary bento thật + exam card semantic, heading đúng cấp, EmptyState và status đúng semantics; giữ nguyên precedence/canStart/href.
- **S02:** waiting room thành ba bước có icon; giữ Web Audio, micro readiness, fullscreen và điều kiện disable.
- **S03:** attempt có hero `<h1>`, saved live region, error alert, timer role/label và `<h2>` từng câu; không sửa `ExamIntegrityBoundary`.
- **S04:** result wrapper max-w-5xl; dùng nguyên result foundation M22.

## 4. Quyết định cần user

Không có. Không đổi integrity, timer, fullscreen, preflight, submission, scoring, nhãn nghiệp vụ hoặc navigation.

## 5. Impact map

| Source                                            |   Consumer | Quyết định                      |
| ------------------------------------------------- | ---------: | ------------------------------- |
| student exams page/waiting/attempt/result         |        M23 | Sửa presentation/ARIA           |
| `exam-integrity-boundary.tsx`                     |        M23 | **Không sửa**                   |
| `result-view.tsx`                                 |  M22 + M23 | Không sửa thêm; regression test |
| QuestionRenderer/SpeakingRecorder/MicrophoneCheck | nhiều flow | Không sửa                       |
| query/action/RPC/RLS                              |     server | Không sửa                       |

## 6. Implementation log

- **S01:** `/student/exams` có bốn KPI từ dữ liệu thật, card semantic theo trạng thái, heading outline đúng, EmptyState và panel chờ chấm. E2E phát hiện lượt đang thi bị tính trùng vào “sẵn sàng”; bộ lọc đã tách bốn trạng thái loại trừ nhau.
- **S02:** `ExamWaitingRoom` thành ba bước có icon/nhãn rõ; thay ký tự `✓` bằng icon có semantics. Web Audio, kiểm tra micro, checkbox cam kết, fullscreen và điều kiện khóa nút giữ nguyên.
- **S03:** `ExamAttempt` có hero ngữ cảnh, `<h1>`, timer `role="timer"`, trạng thái lưu `aria-live`, lỗi `role="alert"` và `<h2>` cho từng câu. `ExamIntegrityBoundary` không sửa.
- **S04:** route kết quả giới hạn `max-w-5xl`; dùng nguyên `AssessmentResultView` đã regression-test cho M22/M23.
- Component mục tiêu **11/11**; full Vitest **180/180** (56 file). Playwright Chromium + Pixel 7 đều xanh cho list/waiting/attempt/result ở 360/768/1280, axe A/AA và không overflow; fixture local tự dọn, năm nhóm count cuối đều 0.
- Lint, typecheck và production build xanh. Không có migration/schema/API/RLS/Storage hoặc dữ liệu production impact.
- Ảnh 9 trạng thái đã kiểm bằng mắt; không phát hiện vỡ bố cục. Axe ban đầu đo contrast khi dialog còn trong animation; test đã đợi trạng thái ổn định trước khi đo.

## 7. Completion gate

- [x] S01 exam overview + cards.
- [x] S02 waiting room.
- [x] S03 attempt.
- [x] S04 result wrapper/regression.
- [x] Component/E2E responsive/a11y.
- [x] Lint/typecheck/full test/build.
- [x] Docs/board/QA/WORKLOG đồng bộ và dừng tại P15-T4.

**Trạng thái:** `DONE — chờ Claude/user xác minh độc lập`. Codex vừa thiết kế vừa sửa nên không tự ghi Verified.
