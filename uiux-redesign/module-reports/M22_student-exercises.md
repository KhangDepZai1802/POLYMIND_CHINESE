# M22 — Bài tập (Học viên)

## 1. Phạm vi

- Danh sách: `/student/exercises` + `StudentExerciseList`.
- Lượt làm: `/student/exercises/[deliveryId]/attempt/[attemptId]` + `ExerciseAttempt`.
- Kết quả: `/student/exercises/results/[attemptId]` + `AssessmentResultView`.
- Ngoài phạm vi: query/server action/RPC, RLS, scoring, auto-save, upload audio, submission lifecycle, anti-leak, route, navigation và validation.
- Component chỉ đọc/không sửa: `QuestionRenderer`, `SpeakingRecorder`, `MicrophoneCheck`, confirmation và player P14-T12.

## 2. Bằng chứng audit

| Issue        | Mức    | Bằng chứng trước sửa                                                                                        | Tác động                                                                                |
| ------------ | ------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `UX-M22-001` | High   | `exercise-list.tsx:45–67`: list mở thẳng bằng tabs + lưới card trắng                                        | Không có tổng quan ưu tiên/cảm giác tiến trình; học viên phải tự đếm các nhóm           |
| `UX-M22-002` | High   | `exercise-list.tsx:47–54`: `Tabs` controlled nhưng thiếu `activationMode="manual"`; 5 tab `flex-wrap`       | Arrow key vừa đổi focus vừa đổi nội dung; trên mobile thứ tự tab bị tách dòng khó quét  |
| `UX-M22-003` | Medium | `exercise-list.tsx:56–59`: empty state chỉ là một đoạn chữ                                                  | Thiếu biểu tượng, tiêu đề và mô tả hành động tiếp theo                                  |
| `UX-M22-004` | High   | `CardTitle` card list render `div`; route lượt làm không có `<h1>`                                          | Outline heading không phản ánh cấu trúc trang/list/câu hỏi                              |
| `UX-M22-005` | High   | `exercise-attempt.tsx:183–196`: thanh sticky alpha + blur; trạng thái lưu `text-xs`, lỗi không `role=alert` | Trạng thái quan trọng khó đọc và không được trình đọc màn hình thông báo đúng lúc       |
| `UX-M22-006` | High   | Payload lượt làm có `instructions`, `due_at`, `max_score` nhưng UI chỉ hiện `title`                         | Học viên vào làm mà không thấy hướng dẫn, hạn nộp và thang điểm ngay trên màn hình      |
| `UX-M22-007` | Medium | Các câu hỏi đều là section card trắng giống nhau, nhãn câu là `<p>`                                         | Bài dài thiếu nhịp; khó định vị câu hiện tại bằng heading/screen reader                 |
| `UX-M22-008` | Medium | `result-view.tsx` dùng gradient + màu/alpha `blue/emerald/primary` trực tiếp                                | Không theo DS-027 semantic palette và làm kết quả kém nhất quán với hành trình học viên |
| `UX-M22-009` | High   | Thanh phần trăm kết quả chỉ là `div` có inline width, không có progress semantics                           | Người dùng screen reader không nhận được mức điểm tương đối                             |

## 3. Proposal theo DS-026/DS-027

### S01 — Danh sách: priority overview + tab journey

- Giữ `PageHeader`; thêm 4 ô số liệu thật: cần ưu tiên, đang làm, chờ chấm, có kết quả.
- Tab strip student sky có icon + count, cuộn ngang trên mobile; controlled Tabs dùng `activationMode="manual"` theo luật accessibility đã chốt.
- Không đưa state tab vào URL và không đổi logic phân nhóm hiện có.

### S02 — Danh sách: card + empty state

- Card có header tone theo nhóm hiện tại, `<h2>` thật, metadata ≥14px và CTA rõ.
- Thay disabled button “Đã nộp — chờ chấm” bằng status panel không giả là hành động.
- Dùng `EmptyState` dùng chung; giữ nguyên start/resume/result href và server action.

### S03 — Lượt làm tập trung nhưng thân thiện

- Thêm `<h1>`, hướng dẫn/hạn nộp/thang điểm từ payload thật; saved state là live region ≥14px, error là alert.
- Sticky action bỏ alpha/blur; câu hỏi có `<h2>` + `aria-labelledby`, tone semantic luân phiên để tạo nhịp nhưng không dùng màu làm tín hiệu duy nhất.
- Không sửa auto-save 1 giây, upload Nói, confirmation, submit cuối, redirect hoặc renderer.

### S04 — Kết quả dùng chung M22/M23

- Đổi hero gradient/raw color thành semantic student palette; thêm heading thật và progressbar ARIA.
- Kết quả từng câu dùng semantic section/result block; giữ toàn bộ điều kiện công bố answer key, audio nguồn/bản ghi, format answer và điểm.
- `AssessmentResultView` chỉ có hai consumer đều là kết quả học viên (M22/M23). Sửa visual foundation một lần ở M22; M23 vẫn phải audit route/phòng chờ/lượt thi riêng.

## 4. Quyết định cần user

Không có. Toàn bộ proposal chỉ thay hierarchy/layout/semantic/ARIA bằng dữ liệu đã có. Không đổi nhãn nghiệp vụ, route, hành động, scoring, submission, anti-leak, validation hoặc shared behavior. Hướng màu đã được user chốt ở DS-027.

## 5. Impact map

| Source                                |                 Consumer | Quyết định                                                     |
| ------------------------------------- | -----------------------: | -------------------------------------------------------------- |
| `student/exercises/page.tsx`          |                      M22 | Wrapper student-only trong scope                               |
| `exercise-list.tsx`                   |                      M22 | Sửa presentation + ARIA; giữ nguyên phân nhóm/action           |
| `exercise-attempt.tsx`                |                      M22 | Sửa presentation + ARIA; giữ nguyên state/action/upload        |
| `result-view.tsx`                     |                M22 + M23 | Sửa visual foundation student-only; test cả kind exercise/exam |
| `QuestionRenderer`                    | M22, M23, M24, authoring | Không sửa                                                      |
| `SpeakingRecorder`, `MicrophoneCheck` |    nhiều assessment flow | Không sửa; chỉ bọc trong M22 nếu cần                           |
| query/action/RPC                      |             M22 + server | Không sửa                                                      |

## 6. Implementation log

- **S01 — hoàn tất:** thêm 4 summary bento từ dữ liệu thật và 5 tab có icon/count. Controlled Tabs dùng `activationMode="manual"`; vùng tab cuộn có `tabIndex` + focus ring sau khi axe tablet phát hiện `scrollable-region-focusable`.
- **S02 — hoàn tất:** card có `<h2>`, tone theo nhóm, metadata ≥14px và CTA/status đúng semantics; empty dùng `EmptyState`. Ảnh mobile lần đầu cho thấy 4 KPI một cột đẩy bài cần làm xuống quá xa, đã chuyển thành lưới 2×2 mobile và chụp lại.
- **S03 — hoàn tất:** lượt làm có hero xanh thương hiệu, `<h1>`, hướng dẫn/hạn/thang điểm/số câu thật, saved live region, error alert và `<h2>` từng câu. Giữ nguyên auto-save, upload Nói, confirm/submit/redirect và renderer.
- **S04 — hoàn tất:** `AssessmentResultView` bỏ gradient/raw alpha; dùng semantic palette, heading thật và progressbar ARIA. Impact chỉ hai route kết quả học viên M22/M23; audio/answer release/format/score giữ nguyên.
- **Component test:** 3 file mục tiêu **6/6**; thêm test hành động theo nhóm, manual activation, context/heading attempt và progressbar result.
- **E2E:** fixture local có đủ 5 trạng thái + attempt/result, tự tạo trước và dọn sau test bằng `docker exec` byte-safe. Cleanup ban đầu để sót version vì `session_replication_role=replica` cũng tắt cascade; đã sửa xóa con→cha và xác minh count question/version/delivery đều **0** sau chạy.
- **Responsive/a11y:** Chromium + Pixel 7 đều **1/1**; đủ list/attempt/result tại 360/768/1280, axe WCAG A/AA không violation, không page overflow, keyboard manual activation xanh. 9 ảnh cuối đã xem trực tiếp.
- **Full gate:** lint sạch; typecheck sạch; Vitest **179/179** (55 file); production build xanh; `git diff --check` không có whitespace error.
- Không có migration hay thay đổi production data/API/RLS/Storage.

## 7. Completion gate

- [x] S01 list summary + tabs.
- [x] S02 list cards + empty state.
- [x] S03 attempt.
- [x] S04 result shared foundation.
- [x] Component/E2E responsive/a11y đủ list/attempt/result.
- [x] Lint/typecheck/full test/build.
- [x] Docs/board/QA/WORKLOG đồng bộ.

**Kết luận:** `DONE — chờ xác minh độc lập`. Codex vừa thiết kế vừa triển khai nên không tự ghi `Verified`.
