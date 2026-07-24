# M24 — Ôn tập (Học viên)

> ⚠️ **Module này bị tách làm hai theo `DS-028`.**
>
> | Nửa | Task | Trạng thái |
> | --- | --- | --- |
> | **Ôn câu sai** + khung trang `/student/review` | `P15-T5a` | Trong phạm vi phiên này |
> | **Flashcard** (`student-flashcard-reader.tsx`) | `P15-T5b` | ⏸ **HOÃN** — chờ user trả lời `Q1`–`Q6` ở [`docs/10-yeu-cau-flashcard-quizlet.md`](../../docs/10-yeu-cau-flashcard-quizlet.md) §7 |
>
> Lý do hoãn: user chốt 2026-07-22 rằng flashcard sẽ chuyển từ **hai file ảnh bắt buộc** sang **thuật ngữ + định nghĩa dạng văn bản** kiểu Quizlet. Đó là đổi mô hình dữ liệu. Redesign reader theo mô hình ảnh bây giờ thì sau khi đổi schema phải làm lại lần hai cả UI, test lẫn E2E.
>
> **Vì còn treo nửa Flashcard, M24 chỉ được ghi `PARTIAL`, không `DONE`.**

## 1. Phạm vi

**Trong phạm vi (`P15-T5a`):**

- Khung trang `/student/review` — `PageHeader`, thanh tab hai nhánh.
- Tab **Ôn câu sai**: `src/features/wrong-answer-review/components/wrong-answer-review.tsx`.

**Ngoài phạm vi:**

- `StudentFlashcardReader` — hoãn theo `DS-028`, **không sửa một dòng nào** trong phiên này.
- `submitWrongAnswerReviewAction`, RPC chấm/mastery, `getMyWrongAnswerReviews`, RLS.
- `QuestionRenderer` (dùng chung cho M22/M23/M24) và `StudentAudioPlayer` (`DS-019`).
- Điều kiện một câu rời hàng đợi, thứ tự hàng đợi, `wrong_count`.

## 2. Bằng chứng audit

| Issue        | Mức        | Bằng chứng trước sửa                                                                                                                              | Tác động                                                                                                     |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `UX-M24-001` | **High**   | `wrong-answer-review.tsx:159,169,179` — ba nút mang `min-h-11` chép cứng                                                                            | Vi phạm `DS-013`: 44px chỉ được ép trong `globals.css` `@media (pointer: coarse)`. Đúng mẫu M15 đã gỡ hai chỗ |
| `UX-M24-002` | **High**   | `:131-139` — `<Alert>` chỉ tồn tại **khi có** `feedback`; `aria-live="polite"` nằm bên trong nó                                                     | Vùng live sinh ra cùng lúc với nội dung → trình đọc màn hình thường **không đọc** kết quả chấm. Lỗi a11y thật |
| `UX-M24-003` | **High**   | `:109-111` — `CardTitle` render `div`, nội dung là "Câu 1/8"                                                                                        | Cả tab không có heading nào; không có mốc điều hướng cho trình đọc màn hình                                   |
| `UX-M24-004` | Medium     | `review/page.tsx:30-33` — `TabsList` mặc định, không icon, không đếm, không dùng student palette                                                    | Lệch hẳn M21/M22/M23 vốn đã có tab icon + count + `student-sky`                                               |
| `UX-M24-005` | Medium     | Không có tổng quan nào — vào tab là thấy ngay câu hỏi                                                                                               | M20–M23 đều mở bằng bento tổng quan; học viên không biết còn bao nhiêu câu, từ nguồn nào                     |
| `UX-M24-006` | Medium     | `:110` — "Câu 1/8" là thông tin tiến độ duy nhất, dạng chữ thuần                                                                                    | M22/M23 đã dùng `role="progressbar"` có nhãn; ở đây không đo được tiến độ                                     |
| `UX-M24-007` | Medium     | `:81-92` — trả lời sai và lỗi hệ thống dùng **chung** `variant="destructive"`                                                                       | "Chưa đúng, thử lại nhé" bị trình bày y như lỗi hệ thống — ngược `DS-027` (khích lệ, không doạ)              |
| `UX-M24-008` | Medium     | `:44-54` — empty state "Bạn đã ôn xong" không có bước kế tiếp                                                                                       | Hết việc thì học viên rơi vào ngõ cụt, không có lối quay lại hành trình học                                  |
| `UX-M24-009` | Low        | `:116-127` — hai `StatusBadge` `info`/`warning`; `first_seen_at`/`last_seen_at` có trong dữ liệu nhưng **không hiển thị**                          | Thiếu ngữ cảnh "sai gần đây hay đã lâu" mà dữ liệu đã sẵn có                                                 |
| `UX-M24-010` | Low        | `page.tsx:28` — `Tabs` **uncontrolled** (`defaultValue`)                                                                                            | ✅ **Không phải lỗi.** Luật `activationMode="manual"` ở Findings §0 chỉ áp cho `Tabs` **controlled**          |

## 3. Proposal

| Subtask | Nội dung |
| ------- | -------- |
| **S01** | Khung `/student/review`: tab hai nhánh có icon + số câu còn lại, dùng `student-sky` như M22/M23. Không đổi `defaultValue`, không đưa tab vào URL (`DS-012`; `DS-024` chỉ mở cho M14) |
| **S02** | `WrongAnswerReview` — tổng quan bento: số câu còn lại, tách theo nguồn Bài tập/Bài thi, số câu sai nhiều lần. Toàn bộ tính từ `initialItems` đang có, **không thêm query** |
| **S03** | `WrongAnswerReview` — thẻ câu hỏi: `<h2>` thật, `role="progressbar"` có nhãn, vùng `aria-live` **thường trú**, tách tone "chưa đúng" khỏi tone "lỗi hệ thống", gỡ ba `min-h-11` |
| **S04** | Empty state có lối đi tiếp (về Tổng quan / sang Bài tập) và giọng khích lệ |

**Giữ nguyên tuyệt đối:** `submitWrongAnswerReviewAction` và mọi tham số gọi nó; điều kiện `hasAnswer`; việc câu đúng rời `items`; chỉ số `index` sau khi rời; `QuestionRenderer` và `audioPlayback="student-source"`; toàn bộ chữ trong `toast` và trong thông báo do server trả về.

## 4. Quyết định cần user

Không có quyết định mới cho `P15-T5a` — tất cả nằm trong tầng trình bày.

⏸ `P15-T5b` bị chặn bởi `Q1`–`Q6` của `docs/10-yeu-cau-flashcard-quizlet.md`.

## 5. Impact map

| Source                                | Consumer                    | Quyết định                                       |
| ------------------------------------- | --------------------------- | ------------------------------------------------ |
| `student/review/page.tsx`             | chỉ M24                     | Sửa khung tab; **không** đụng props flashcard    |
| `wrong-answer-review.tsx`             | chỉ M24                     | Sửa presentation + ARIA                          |
| `student-flashcard-reader.tsx`        | chỉ M24                     | ⛔ **Không sửa** — `DS-028`                       |
| `QuestionRenderer`                    | M22 + M23 + M24             | **Không sửa**                                    |
| `StudentAudioPlayer`                  | M22 + M23 + M24             | **Không sửa** (`DS-019`)                         |
| `EmptyState` / `StatusBadge` / `Card` | toàn repo                   | **Không sửa** — chỉ truyền props                 |
| query / action / RPC / RLS            | server                      | **Không sửa**                                    |

## 6. Implementation log

- **S01** `review/page.tsx`: thanh tab thành `nav` có nhãn, nền `student-sky`, focus ring; hai tab có icon và tab Ôn câu sai mang số câu còn lại tính từ dữ liệu server đã tải sẵn. Nhãn tab **không đổi một chữ nào** (`DS-012`); `defaultValue` giữ nguyên nên `Tabs` vẫn uncontrolled — không cần `activationMode="manual"` (`UX-M24-010`).
- **S02** Bento tổng quan bốn ô: Còn cần ôn · Từ Bài tập · Từ Bài thi · Sai nhiều lần. Tất cả tính từ `initialItems` đã có trong props — **không thêm một query nào**. Thanh `role="progressbar"` có `aria-valuetext` đo tiến độ phiên ôn, mốc `startingCount` chốt bằng `useState` khởi tạo lười nên không trôi khi `items` rút ngắn.
- **S03** Thẻ câu hỏi: `CardTitle asChild` → `<h2>` thật; header dùng `student-sky` có đường kẻ; thêm dòng "Sai gần nhất ngày …" qua `formatDate` (`D-12`, `Asia/Ho_Chi_Minh`) từ `last_seen_at` vốn đã có trong schema mà trước đây bị bỏ không. **Gỡ ba `min-h-11`** (`DS-013`); nút chính đổi sang `size="lg"` để vẫn cao 44px trên chuột mà không chép class.
- **S03 (a11y, quan trọng nhất)** Vùng `aria-live="polite" aria-atomic="true"` nay **thường trú trong DOM**, chỉ nội dung bên trong đổi. Trước đó `aria-live` nằm trong `<Alert>` chỉ được render khi đã có `feedback`, nên vùng live sinh ra cùng lúc với nội dung và trình đọc màn hình bỏ qua kết quả chấm.
- **S03 (tone)** Tách `retry` khỏi `error`: "chưa đúng, làm lại" dùng hộp `student-amber`, lỗi hệ thống vẫn `Alert variant="destructive"`, đúng thành công dùng `student-cyan`. **Chữ của mọi thông báo giữ nguyên** — chỉ đổi cách trình bày.
- **S04** Empty state đặt trong nền `student-cyan`, mô tả nói rõ câu mới sẽ tự vào đây, kèm hai lối đi tiếp `/student` và `/student/exercises`. Thanh tiến độ **không** dựng khi hàng đợi rỗng từ đầu.
- **Không sửa:** `submitWrongAnswerReviewAction` và mọi tham số gọi nó, `hasAnswer`, luật câu đúng rời `items`, `index` sau khi rời, `QuestionRenderer`, `audioPlayback="student-source"`, chữ trong `toast`. `student-flashcard-reader.tsx` **không bị chạm** (`DS-028`).
- **Test:** `wrong-answer-review.test.tsx` **5/5** (2 test cũ **chạy nguyên, không sửa, không nới**; +3 test mới cho bento/progressbar/live region/empty state). `student-review-page.test.tsx` **2/2** — assertion nhãn tab đổi từ so bằng tuyệt đối sang khớp mẫu **kèm kiểm số đếm**, tức là chặt hơn trước chứ không lỏng hơn; thêm 1 test đếm nhãn tab.
- **Full gate:** lint ✅ · typecheck ✅ · Vitest **184/184** (56 file) ✅ · production build ✅.
- **E2E:** `tests/e2e/student-review-responsive.spec.ts` — Chromium **1/1** và Pixel 7 **1/1**, ba khung 360/768/1280, axe `wcag2a/2aa/21a/21aa` sạch, không overflow ngang; thêm một lượt trả lời đúng để kiểm câu rời hàng đợi và progressbar nhích `0 → 50`. Fixture local tự dựng/tự dọn — kiểm sau khi chạy: queue/question/set đều **0**.
- **E2E bắt được một flake và đã sửa đúng chỗ:** lần chạy Pixel 7 ở khung 768 báo contrast `2.31:1` với màu `#5b82ab` trên `#aac8e4`. Hai mã đó **không có trong hệ màu** — chúng là màu **pha giữa hai trạng thái** của `TabsTrigger` (Radix mang `transition-all`), tức axe đo trúng lúc tab vừa đổi còn đang chuyển màu. Sửa bằng `waitForTabColorsToSettle()` đợi nền tab không-được-chọn về `rgba(0, 0, 0, 0)` rồi mới đo — **không nới ngưỡng axe, không bỏ rule nào**. Chạy lại **3 lần liên tiếp cả hai project đều xanh**. Cùng họ với ghi chú của M23 ("axe đo contrast khi dialog còn trong animation").
- **Kiểm bằng mắt:** ảnh 360 và 1280. Ảnh desktop lộ khoảng trắng thừa giữa header và câu hỏi (`py-6` của `Card` + `pt-5` + margin của vùng live rỗng cộng dồn ~64px); đã gỡ `pt-5`.
- **Migration / data / API / RLS / Storage impact:** không có.

## 7. Completion gate

- [x] S01 khung tab
- [x] S02 bento tổng quan
- [x] S03 thẻ câu hỏi + ARIA
- [x] S04 empty state
- [x] Responsive 360 / 768 / 1280 (Chromium + Pixel 7, axe A/AA)
- [x] Keyboard focus — focus ring cho vùng tab cuộn; nút điều hướng giữ thứ tự tab
- [x] Không đổi business logic / API / route / database / permission / validation / nhãn
- [x] Lint · typecheck · Vitest 184/184 · build
- [ ] ⏸ **Flashcard — chưa làm, hoãn theo `DS-028`**

> **Final status: `PARTIAL — chờ xác minh độc lập`.** Không được nâng lên `DONE` cho tới khi `P15-T5b` (Flashcard) hoàn tất.
>
> Claude là người viết code này nên **không tự ghi Verified** (CLAUDE.md). Cần Codex hoặc user xác minh độc lập:
>
> - Mở `/student/review` khi hàng đợi còn câu → tab "Ôn Tập Câu Sai" phải hiện đúng số câu.
> - Bật trình đọc màn hình, trả lời sai một câu → **phải nghe** thông báo "Chưa đúng…" (đây là `UX-M24-002`, lỗi chính đã sửa).
> - Trả lời đúng câu cuối → thấy empty state và hai nút đi tiếp, **không** còn thanh tiến độ trống.
