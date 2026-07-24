# UI/UX Session Checkpoint

> File này phải đủ để session hoặc AI khác tiếp tục mà không audit lại toàn bộ dự án.

## Current State

| Field               | Value                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Active Module ID    | **Không có — M16 vừa đóng**                                                                                         |
| Active Module       | —                                                                                                                   |
| Current Status      | **`M16 DONE — chờ xác minh độc lập`**; M20→M27 + `P15-T9` cũng đang chờ xác minh                                    |
| Current Screen      | Tiếp theo là M17 Kiểm tra / Thi (`P17-T2`, chưa claim). M24 vẫn `PARTIAL` (**nửa Flashcard hoãn, `DS-028` + `DS-029`**) |
| Last Completed Step | **P17-T1 / M16:** 6 lỗi đã sửa (múi giờ hạn nộp, tràn ngang 67px, 11 control thiếu nhãn, gom `NativeSelect`); E2E **14/14**, Vitest **209/209**, build xanh |
| Next Exact Action   | Claim `P17-T2` / M17. ⚠️ M17 **dùng chung** `question-bank-page.tsx` + `NativeSelect` vừa sửa ở M16 → sửa xong M17 phải chạy lại spec M16. Còn `UX-UIUX-M16-007` **chờ user duyệt** (lỗi Postgres thô lộ ra giao diện) |
| Last Updated        | 2026-07-22                                                                                                          |
| Agent               | Claude                                                                                                              |

> ⚠️ **`DS-027` không áp cho M16–M19.** Learning Journey Bento và palette `student-*` là **student-only**. Màn giáo viên giữ token dùng chung (`surface-page`, `text-secondary`, `primary`…), không mượn `sky/cyan/amber/coral`.

## Files Must Read Next Session

1. `uiux-redesign/01_UIUX_GOVERNANCE.md`
2. `uiux-redesign/02_UIUX_DESIGN_SYSTEM.md` ← **đã điền đầy đủ, không khảo sát lại**
3. `uiux-redesign/04_UIUX_MODULE_BOARD.md`
4. `uiux-redesign/08_UIUX_DECISIONS.md` ← **30 quyết định; đặc biệt `DS-026`/`DS-027`/`DS-029`/`DS-030`, không tự đảo**
5. `uiux-redesign/module-reports/M27_student-profile.md` ← module cuối vừa đóng; M20–M27 đều DONE, không audit lại
6. ⛔ **Không đọc/sửa route hay component Flashcard** cho tới sau Phase 16 (`DS-029`)
7. `AGENTS.md` + `CLAUDE.md` (luật cứng của repo)

Chỉ đọc báo cáo M00/M13/M15/M14 khi cần tra cứu. M14 giữ `IMPLEMENTED — chờ đo`, không viết thêm code trong đợt student redesign.

## Token nền đã có sẵn

| Token                   | Value              | Dùng cho                                                                                 |
| ----------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `bg-surface-page`       | `#F6F8FB`          | Nền trang                                                                                |
| `bg-surface-sunken`     | `#E4EAF2`          | Header bảng, thanh filter                                                                |
| `border-input`          | `#7C8DA4` (3.39:1) | **Viền input/checkbox/radio/select — tự động có sau `M00-S09`, không phải thêm class**   |
| `border-border`         | `#DDE5EE` (1.27:1) | Chỉ đường kẻ trang trí và kẻ bảng                                                        |
| `text-text-secondary`   | `#43536B` (7.81:1) | Cấp chữ thứ hai — mô tả, meta quan trọng                                                 |
| `text-text-disabled`    | `#8494A8` (3.10:1) | Chỉ control disabled, luôn kèm `[disabled]`                                              |
| `text-muted-foreground` | `#5B6B80` (5.44:1) | Chú thích mờ                                                                             |
| `bg-primary-50…950`     | thang từ `#1A5FA8` | `primary-600` = `--primary`; `700` hover; `50` nền hover hàng danh sách; `300` viền nhấn |
| `bg-brand-red`          | `#C8102E`          | Accent thương hiệu, badge đếm — **không** dùng cho lỗi                                   |
| `bg-destructive`        | `#DC2626`          | Chỉ dùng cho **lỗi/xoá**                                                                 |

`DS-027` cho phép bổ sung họ sky/cyan và amber/coral gần màu thương hiệu **chỉ qua semantic token**. Mã cụ thể phải được audit contrast + impact map trong `P15-T1`; không rải hex trực tiếp trong component. Xanh `#1A5FA8` và cam/đỏ vẫn là màu chủ đạo.

## Thang kích thước control sau `M00-S06` — đừng tự đặt `h-*` cho nút

| Size                     | Chuột | Cảm ứng |
| ------------------------ | ----: | ------: |
| `xs` / `icon-xs`         |  32px |    44px |
| `sm` / `icon-sm`         |  36px |    44px |
| `default` / `icon`       |  40px |    44px |
| `lg` / `icon-lg`         |  44px |    44px |
| `Input`, `SelectTrigger` |  40px |    44px |

**Luật:** 44px cho ngón tay **chỉ** được ép ở `globals.css` trong `@media (pointer: coarse)`. Không nhét `h-11`/`min-h-11` vào class component. Cần đúng 44px trên chuột thì dùng `size="lg"`, đừng chép `className="h-11 px-6"` (M15 vừa gỡ đúng hai chỗ như vậy).

## Component dùng lại — đừng dựng mới

| Cần gì                      | Dùng cái đã có                                   | Ở đâu                                                                                    |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Hộp xác nhận                | `useConfirmation()` / `useConfirmSubmit()`       | `components/shared/confirmation-provider.tsx` — đã bọc sẵn ở `(dashboard)/layout.tsx:34` |
| Nút submit khoá khi pending | `SubmitButton` (nhận `size`, `variant`)          | `components/shared/submit-button.tsx`                                                    |
| Empty state                 | `EmptyState`                                     | `components/shared/empty-state.tsx`                                                      |
| Badge trạng thái            | `StatusBadge` + map trong `lib/domain/labels.ts` | —                                                                                        |

## Relevant Source

Module vừa hoàn tất (**M23 — Kiểm tra / Thi học viên**):

| File                                                             | Lý do cần đọc                                                    | Trạng thái                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| `src/app/(dashboard)/student/exams/page.tsx`                     | Danh sách + mount phòng chờ                                      | ✅ S01                       |
| `src/features/exams/student/exam-waiting-room.tsx`               | Preflight/micro/cam kết                                          | ✅ S02                       |
| `src/features/exams/student/exam-attempt.tsx`                    | Timer, save/submit và layout focus                               | ✅ S03                       |
| `src/features/exams/integrity/exam-integrity-boundary.tsx`       | Fullscreen/copy/visibility/integrity — đọc kỹ, không đổi hành vi | ✅ Impact-map; **không sửa** |
| `src/app/(dashboard)/student/exams/results/[attemptId]/page.tsx` | Wrapper kết quả; foundation đã được sửa ở M22                    | ✅ S04 + regression          |

## Completed This Session (2026-07-21, đợt 4)

**User duyệt 3 quyết định mới →** `DS-020` (hộp xác nhận), `DS-021` (`maxLength`), `DS-022` (sửa bug nghiệp vụ).

**M15 đóng — 4 subtask + 1 sửa nghiệp vụ:**

- `S01` màn A: gỡ `<button>` lồng trong `<a>`, focus ring cho hàng link, hết `text-xs`, `CardTitle` → `<p>` cho metadata.
- `S02` hàng học viên: bỏ `h-11` chép cứng (`min-w-22` thay `min-w-[5.5rem]`), `gap-1`→`gap-2`, `aria-label` cho 20 ô ghi chú, `maxLength={300}`.
- `S03` thanh Lưu: `fixed`→`sticky` (trả lại footer theo `D-17`), bỏ `backdrop-blur`, bỏ `md:left-64` và `pb-24`, `SubmitButton size="lg"`.
- `S04` **(phát sinh)** hộp xác nhận cho "Đánh dấu nhanh" — chỉ hỏi khi thật sự có dữ liệu sẽ mất.
- `UX-M15-014` **(nghiệp vụ, `DS-022`)** `actions.ts` chặn cả lượt lưu khi có ghi chú mà thiếu trạng thái.
- **+8 test mới** (4 roster, 4 actions). `attendance-roster.test.tsx` phải bọc `ConfirmationProvider` — làm test giống thật hơn, **không nới assertion nào**.

**M14 mở audit:** 12 issue có bằng chứng file:dòng, mới soi màn A và B.

## Completed This Session (2026-07-21, đợt 5)

**M14 audit xong cả 3 màn, §5 + §6 đã viết, chưa chạm code.**

- Màn C (`sessions/[id]/page.tsx` + `session-log-form.tsx`) → **7 issue mới** `UX-M14-013`…`-019`, và bổ sung 2 khối vào `UX-M14-008`.
- **User duyệt 3 quyết định:** `DS-023` (thêm map 8 nhãn `exercise_delivery_status` — _chỉ duyệt việc, chưa duyệt chữ_), `DS-024` (tab vào `?tab=`, ngoại lệ của `DS-012` chỉ cho M14), `DS-025` (`session-log-form.tsx` vào phạm vi ở mức trình bày).
- ⛔ **`UX-M14-002` bị rút lại — báo động giả.** User đã duyệt cho Claude sửa, nhưng đọc lại schema trước khi code thì thấy bằng chứng sai → **không sửa gì, không tạo `DS-026`**. Chi tiết ở mục "Đính chính" trong báo cáo M14.
- **`UX-M14-008` tự gỡ chặn:** `CardTitle` đã có prop `asChild` từ `M13-S01` nên không cần đụng shared component. Câu hỏi Q5 của đợt 4 đóng lại.

**Hai câu hỏi đã đóng, không hỏi lại:** Q5 (đã tự gỡ chặn) và Q4 (issue bị rút lại).

## Completed This Session (2026-07-21, đợt 6)

**M14 viết xong code — 5/5 subtask, 15/19 issue FIXED, 5 file `src/` thay đổi.**

- `S01` màn A: focus ring cho `<Link>` bọc `Card`, hover `primary/40`+`muted/20` → token `primary-300`+`primary-50`, mã lớp hết `text-xs`.
- `S02` màn C: focus ring link quay lại, 2 `CardTitle` → `<h2>`, **bỏ `truncate`** ở thẻ tóm tắt (giờ kết thúc không bị cắt ở 640–768px), `primary/10` → `primary-50`/`primary-700`.
- `S03` form nhật ký: `FieldError` có `role="alert"` + `id`, 3 control có `aria-invalid` + `aria-describedby` (chỉ khi có lỗi), gỡ `h-11` ở 2 nút.
- `S04` màn B khung: **`?tab=` với fail-closed + `activationMode="manual"`**, bóng mép cuộn thuần CSS, 8 `CardTitle` → `<h2>`, focus ring link quay lại.
- `S05` màn B nội dung: `EXERCISE_DELIVERY_STATUS_LABELS`/`_TONE` mới, `ASSESSMENT_TYPE_LABELS` cho `exam_type`, 11 chỗ `text-xs`, lưới tiến độ 2×2 ở mobile, `ExternalLink` + `aria-label`.

**User quyết 2 việc:** duyệt nguyên bảng 8 nhãn (`Q6` đóng) · để `next-themes` lại (`Q1` đóng). **Không tạo `DS` mới** — `DS-023` chỉ được điền nốt phần chữ.

**Module dừng ở `IMPLEMENTED`, không `DONE`:** responsive và tốc độ đổi tab chưa đo được vì phiên không có Docker. Ghi rõ thay vì đánh dấu bừa.

## Completed This Session (2026-07-22 — P14-T12)

- Tạo `StudentAudioPlayer` dùng chung, mặc định `1×`, đúng ba tốc độ `0.5×/0.75×/1×`, giữ cao độ nếu browser hỗ trợ và reset khi `src` đổi.
- Áp cho audio nguồn ở lượt làm/kết quả Bài tập/Thi, Flashcard và Ôn câu sai; bản ghi Nói học viên giữ player riêng, không có tốc độ.
- Test mục tiêu **8/8**; lint, typecheck, full Vitest **173/173** và production build đều xanh. Không có migration/data/API/RLS/Storage impact.
- User chốt `DS-026`: chỉ tiếp tục redesign M20→M27; và `DS-027`: Learning Journey Bento, màu chủ đạo giữ nguyên, được bổ sung sky/cyan + amber/coral gần màu gốc qua semantic token.
- `UX-M22-M24-001` chuyển `FIXED — chờ xác minh độc lập`; không tự ghi Verified.

## Completed This Session (2026-07-22 — P15-T1 / M20)

- Audit/proposal ghi tại `module-reports/M20_student-dashboard.md`; không có câu hỏi sản phẩm mới.
- Thêm semantic token sky/cyan/amber/coral student-only, contrast ink/surface lần lượt 8.04/4.97/5.27/5.25:1; không đổi token cũ.
- `/student` thành Learning Journey Bento: hero buổi kế tiếp, ba KPI hỗ trợ, section có `<h2>`, metadata ≥14px, không truncate nội dung chính.
- Component test M20 **2/2**; Playwright Chromium **1/1** ở 360/768/1280 với axe A/AA + không overflow. Ảnh đầu giúp phát hiện KPI tablet quá hẹp; đã sửa 3→2 cột và chụp lại.
- Full gate: lint · typecheck · Vitest **175/175** (54 file) · production build xanh. Không có migration/data/query/RLS/API impact.
- M20 `DONE — chờ xác minh độc lập`; active chuyển M21.

## Completed This Session (2026-07-22 — P15-T2 / M21)

- Audit/proposal đủ 7 tab tại `module-reports/M21_student-class.md`; không có câu hỏi sản phẩm mới.
- `/student/class` có class identity banner, tab journey icon, section `<h2>` thật, metadata ≥14px và mobile stack; giữ nguyên read-only/query/route/RLS/công thức.
- `SessionCalendar` và `MaterialList` chỉ được bọc, không sửa shared behavior.
- E2E lần đầu bắt contrast tab chưa chọn **4.11:1**; sửa bằng `student-sky-ink` 8.04:1 rồi chạy lại axe xanh.
- Component **2/2**; Playwright Chromium + Pixel 7 xanh, 360/768/1280 + axe A/AA + không overflow; lint/typecheck/Vitest **176/176**/build xanh.
- M21 `DONE — chờ xác minh độc lập`; active chuyển M22.

## Completed This Session (2026-07-22 — P15-T3 / M22)

- Audit/proposal list/attempt/result tại `module-reports/M22_student-exercises.md`; không có câu hỏi sản phẩm mới.
- Danh sách có summary 2×2 mobile, tab icon/count/manual activation, card/empty state semantic. Lượt làm có đủ context + live status/alert/heading. Kết quả dùng semantic palette + progressbar ARIA.
- Giữ nguyên scoring/submission/anti-leak/player/query/action/RPC/RLS; không sửa QuestionRenderer/SpeakingRecorder/MicrophoneCheck.
- `AssessmentResultView` sửa visual foundation cho đúng hai consumer student M22/M23; M23 vẫn audit riêng.
- E2E phát hiện và sửa KPI mobile quá dài + vùng tab cuộn tablet thiếu focus. Fixture local tự tạo/dọn; count question/version/delivery cuối đều 0.
- Target **6/6**; Chromium + Pixel 7 xanh đủ list/attempt/result ở 360/768/1280 + axe A/AA + không overflow; lint/typecheck/Vitest **179/179**/build xanh.
- M22 `DONE — chờ xác minh độc lập`; active chuyển M23.

## Completed This Session (2026-07-22 — P15-T4 / M23)

- Audit/proposal đủ list/waiting/attempt/result tại `module-reports/M23_student-exams.md`; không có câu hỏi sản phẩm mới.
- Danh sách có summary bento/card/status/empty semantic; phòng chờ ba bước; lượt thi có hero ngữ cảnh, timer semantics, live save/error và heading từng câu; kết quả dùng wrapper đồng nhất M22.
- Giữ nguyên AudioContext/micro, cam kết, fullscreen, timer/save/submit/upload/scoring/answer release/anti-leak/player/query/action/RPC/RLS. `ExamIntegrityBoundary` đã impact-map và không sửa.
- E2E phát hiện và sửa KPI tính trùng lượt đang thi vào “sẵn sàng”. Chromium + Pixel 7 xanh đủ list/waiting/attempt/result ở 360/768/1280 + axe A/AA + không overflow; chín ảnh kiểm bằng mắt.
- Target **11/11**; lint/typecheck/Vitest **180/180** (56 file)/build xanh. Fixture local tự dọn; question/version/delivery/attempt/integrity cuối đều 0.
- M23 `DONE — chờ xác minh độc lập`. Theo yêu cầu user, dừng sau P15-T4; P15-T5 chưa claim.

## Completed This Session (2026-07-22 — P15-T5a / M24 nửa Ôn câu sai)

- **Yêu cầu mới của user được ghi lại trước khi làm gì khác:** flashcard sẽ đi theo mô hình Quizlet (thuật ngữ + định nghĩa **dạng văn bản**, ảnh chỉ tùy chọn) thay cho hai file ảnh bắt buộc. Đó là đổi **schema + phân quyền**, `DS-003` cấm làm trong task UI/UX → ghi tại [`docs/10-yeu-cau-flashcard-quizlet.md`](../docs/10-yeu-cau-flashcard-quizlet.md) với **6 câu hỏi chặn `Q1`–`Q6`**, mở mục Phase 16 (chưa duyệt), tạo `DS-028`.
- **`DS-028` tách M24 làm đôi.** Nửa Flashcard **hoãn**; redesign reader theo mô hình ảnh bây giờ thì sau khi đổi schema phải làm lại lần hai cả UI, test lẫn E2E — đúng lý do `P14-T12` được làm trước M20.
- Audit/proposal tại `module-reports/M24_student-review.md`; 9 issue có bằng chứng file:dòng, 1 mục ghi rõ **không phải lỗi**.
- Sửa: thanh tab có icon + số câu còn lại; bento tổng quan 4 ô + progressbar tiến độ phiên ôn; `<h2>` thật; dòng "Sai gần nhất ngày …" từ `last_seen_at` vốn bị bỏ không; gỡ 3 `min-h-11`; empty state có hai lối đi tiếp.
- **Lỗi a11y chính (`UX-M24-002`):** `aria-live` trước đây nằm **trong** `<Alert>` chỉ render khi đã có thông báo → vùng live sinh ra cùng lúc với nội dung, trình đọc màn hình bỏ qua kết quả chấm. Nay vùng live **thường trú trong DOM**, chỉ nội dung đổi.
- Tách tone "chưa đúng, làm lại" (amber) khỏi tone lỗi hệ thống (destructive) — **chữ thông báo không đổi**.
- Test **5/5** + **2/2**; full Vitest **184/184** (56 file); Chromium + Pixel 7 xanh ở 360/768/1280 + axe A/AA + không overflow; lint/typecheck/build xanh. Không có migration/API/RLS/Storage impact.
- **M24 = `PARTIAL`, KHÔNG phải `DONE`.** Dừng theo yêu cầu user sau `P15-T5a`; `P15-T6` chưa claim.

## Completed This Session (2026-07-22 — P15-T6 / M25)

- **User trả lời đủ `Q1`–`Q6` về Flashcard** và gửi **2 ảnh thẻ mẫu POLYMIND**, chốt *lấy cách dựng của Quizlet, nội dung thẻ theo ảnh mẫu*. Ghi tại `docs/10-yeu-cau-flashcard-quizlet.md` §7bis + §7ter, quyết định `DS-029`, phase plan Phase 16 viết lại phạm vi. **`P15-T5b` VẪN hoãn** — Phase 16 sẽ viết lại chính `student-flashcard-reader.tsx`.
- Audit/proposal tại `module-reports/M25_student-results.md`; **10 issue** có bằng chứng `file:dòng`, **2 mục ghi rõ không phải lỗi** (chuỗi `result.kind` là tiếng Việt sẵn, không phải enum thô; `?tab=` chỉ đọc là cố ý theo `DS-012`).
- Sửa: bento tổng quan 4 ô (lộ ra `attendance_rate` vốn bị truy vấn rồi bỏ không), thanh tab icon + badge theo mẫu M21/M24, `<h2>`/`<h3>` thật cho toàn trang (trước đó **không có heading cấp 2 nào**), thanh tỉ lệ điểm có chặn chia cho 0, thanh tiến độ thật ở tab Tiến độ, gỡ 7 chỗ `text-xs`, focus ring cho link chi tiết.
- 🔴 **Hai lỗi nội dung do chính Claude gây ra, ảnh chụp bắt được, đã sửa trước khi đóng** — xem mục `0000` ở Current Findings.
- Component **7/7**; E2E Chromium + Pixel 7 **4/4**, `--repeat-each=2` → **8/8** không flake; lint/typecheck/Vitest **191/191** (57 file)/build xanh. Không có migration/query/API/RLS/Storage impact.
- M25 `DONE — chờ xác minh độc lập`; active chuyển M26.

## Completed This Session (2026-07-22 — P15-T7 / M26 + P15-T8 / M27)

**M26 — Học phí.** Bento tóm tắt 4 ô, thanh tiến độ đóng học phí (`aria-valuetext` đọc bằng tiền thật), và **hiện `Tạm tính`/`Giảm trừ`** — hai trường vốn được truy vấn nhưng không hiển thị ở đâu, học viên được giảm mà không thấy giảm bao nhiêu. Chữ lấy nguyên từ màn quản trị (`invoice-manager.tsx:244-245`), **không đặt từ mới**. Gỡ toàn bộ `text-xs` cho thông tin tài chính; `<h2>/<h3>/<h4>` thật; khối tiền thành `<dl>`; `bg-muted/30` → `bg-surface-sunken`. Ảnh chụp mobile bắt được icon trang trí bị xuống dòng lạc lõng → gỡ. Component **8/8**, E2E **4/4**.

**`DS-030` — user duyệt sửa 2 lỗi contrast AA có thật ở tầng dùng chung** (xem Current Findings `00000`).

**M27 — Hồ sơ.** Màn **duy nhất trong M20–M27 có thao tác ghi của học viên** → trọng tâm là ARIA: `FieldError` có `role="alert"` + `id`; 4 ô nhập có `aria-invalid`/`aria-describedby` **chỉ khi thật sự có lỗi**; yêu cầu mật khẩu nói ra thành chữ và ô mật khẩu luôn trỏ tới nó (khi có lỗi thì trỏ cả hai). `<h2>` thật cho 3 khối, khối thông tin thành `<dl>`, lỗi `text-xs` → `text-sm`, `maxLength` phản chiếu đúng schema (120/20/72). Component **5/5**, E2E **6/6** gồm **kịch bản trạng thái lỗi vẫn sạch axe** và **thứ tự Tab**.

**Cả M20→M27 đã đóng.** Việc còn lại của Phase 15 là `P15-T9` — quality gate liên module.

## Current Findings

00000. 🔴 **LUẬT MỚI TỪ `P15-T7` — OPACITY MODIFIER PHÁ ĐÚNG CÁI CONTRAST MÀ TOKEN ĐƯỢC CHỌN ĐỂ ĐẠT.** `--destructive: #DC2626` được chọn vì đạt 4.83:1 trên trắng; `text-destructive/90` kéo xuống **4.30:1**. Badge `danger` dùng `#DC2626` trên nền `bg-destructive/12` (#FBE5E5) chỉ còn **4.01:1**. Cả hai dưới AA và **có sẵn từ trước**, không do redesign sinh ra. Sửa ở `DS-030`: bỏ `/90`, và thêm token `--danger-ink: #B91C1C` (5.37:1) cho badge. **Đã đo cả 5 tone một lượt** — success 5.95, warning 5.88, info 5.58 đều đạt, chỉ `danger` hỏng; đo hết ngay từ đầu để không phải quay lại lần hai. **Đi soi mẫu `text-<token>/<số>` và `bg-<token>/<số>` ở mọi component còn lại.** Cùng họ với `UX-M00-002`.
00000b. 🟡 **Hai bẫy E2E gặp ở M27.** (a) Gọi `.focus()` ngay sau `domcontentloaded` thì React hydrate xong lấy mất focus → `Received: inactive`. Đợi một control đã hydrate (`toBeEnabled()`) rồi `.click()`. (b) `getByLabel` khớp **chuỗi con**: `getByLabel("Mật khẩu mới")` khớp cả `"Nhập lại mật khẩu mới"` → strict mode violation. Nhãn nào là tiền tố của nhãn khác thì bắt buộc `{ exact: true }`.

0000. 🔴 **LUẬT MỚI TỪ `P15-T6` — TÊN CỘT MÔ TẢ KIỂU DỮ LIỆU, KHÔNG MÔ TẢ CÁCH TÍNH.** Bản dựng đầu của M25 viết hai câu chú thích diễn giải hai con số, và **cả hai đều sai**: (a) đặt "0/5 bài học đã hoàn thành" ngay dưới "27%" như thể `progress_percent` là tỉ lệ bài học — `pg_get_viewdef('v_enrollment_assessment_progress')` cho thấy nó là **tổng hợp có trọng số** `0.40×bài học + 0.30×chuyên cần + 0.15×bài nộp + 0.15×điểm`; (b) in `avg_score` thành **"80"** trần ngay trên các thẻ điểm dạng `8/10`, trong khi view **đã quy về thang 100**. **Trước khi viết bất kỳ câu nào diễn giải một con số, đọc định nghĩa view/RPC sinh ra nó.** Cùng họ với `UX-M14-002` và `UX-M00-002`: đừng kết luận từ cái tên mà chưa kiểm cách tính. **Kèm theo:** chính **ảnh chụp thật** là thứ bắt được — hai con số đá nhau chỉ lộ ra khi đặt cạnh nhau trên màn hình, không lộ qua test.
0000b. 🟡 **Cách đợi transition của M24 chưa đủ mạnh.** M24 đợi tab *vừa nhả* về nền trong suốt; M25 vẫn fail vì tab *vừa được chọn* còn đang chuyển màu **vào** primary (axe đọc `#3c78b6` → 3.51:1). Cách tổng quát hơn, dùng từ nay: `await expect.poll(() => tablist.evaluate(l => [...l.querySelectorAll('[role="tab"]')].every(t => t.getAnimations().length === 0))).toBe(true)` — đợi thẳng vào "không còn transition nào chạy", không so màu bằng hằng số nên đổi token cũng không làm test giòn.

00. 🔴 **LUẬT MỚI TỪ `P15-T5a` — `aria-live` phải nằm trên phần tử THƯỜNG TRÚ, không phải trên chính thông báo.** Mẫu sai rất dễ viết: `{feedback && <Alert><AlertDescription aria-live="polite">…</AlertDescription></Alert>}`. Vùng live được tạo ra **cùng lúc** với nội dung nên phần lớn trình đọc màn hình không đọc gì cả. Cách đúng: `<div aria-live="polite" aria-atomic="true">{feedback && <Notice/>}</div>` — vùng rỗng có sẵn từ đầu, chỉ nội dung bên trong đổi. **Đi soi mẫu này ở mọi màn có chấm/lưu/nộp.** Kèm theo: nếu component bị **unmount** ngay sau khi đặt thông báo (ví dụ câu cuối rời hàng đợi → chuyển sang empty state) thì vùng live cũng biến mất; ở M24 phần đó do `toast` của sonner đảm nhiệm.
000. 🟡 **Axe + CSS transition = báo động giả về contrast.** Nếu axe báo một cặp màu mà **không tìm thấy trong `globals.css`**, gần như chắc chắn đó là màu **pha giữa hai trạng thái** đang transition, không phải lỗi thật. Ở M24: `#5b82ab` trên `#aac8e4` = 2.31:1, thực ra là `#134B86`/`#EAF6FF` (8.04:1) đang chuyển. `TabsTrigger` của Radix mang `transition-all`. **Cách sửa đúng là đợi trạng thái ổn định rồi mới đo** (poll tới khi `backgroundColor` về `rgba(0, 0, 0, 0)`), tuyệt đối **không nới ngưỡng hay bỏ rule**. Sau khi sửa phải chạy lại ít nhất 3 lần để chứng minh hết flake.
0. 🔴 **LUẬT MỚI TỪ ĐỢT 6 — `Tabs` controlled thì PHẢI đặt `activationMode="manual"`.** Radix mặc định `automatic`: mũi tên trái/phải vừa dời focus vừa gọi `onValueChange`. Khi `Tabs` là controlled mà giá trị chỉ đổi qua điều hướng (`?tab=`), `automatic` làm focus nằm ở tab 2 trong khi tab 1 vẫn `aria-selected="true"` — trình đọc màn hình đọc sai. Gặp `Tabs` + URL ở module sau thì kiểm ngay điều này.
   0b. **Kỹ thuật bóng mép cuộn chỉ chạy nếu phần tử cuộn nhìn thấy được nền của chính nó.** `background-attachment: local/scroll` vẽ lên nền phần tử cuộn; nếu con của nó (ở đây `TabsList` với `bg-muted min-w-max`) phủ kín thì bóng bị che sạch. Cách sửa: chuyển màu nền ra **phần tử cuộn**, cho con thành `bg-transparent`.
1. **Mẫu lỗi "link phủ cả hàng thiếu focus" nay đã lặp 6 lần qua 4 module** (M00 nav item → M13 hàng lớp → M15 hàng buổi → M14: thẻ lớp màn A + link quay lại màn B + link quay lại màn C). Module sau **kiểm cái này đầu tiên**, đừng đợi audit tới nơi. Chuỗi class chuẩn đã ổn định: `rounded-* focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none` (thêm `focus-visible:ring-inset` khi link phủ hết chiều rộng hàng).
2. **`text-xs` cho nội dung thật** vẫn là issue số một về số lượng (`UX-M00-004`, 242 chỗ toàn repo; riêng M14 có 12).
3. **Mẫu mới phát hiện ở M14 — kiểm ngay ở M16, M17, M18:** **enum thô lọt ra giao diện** (`label={x.status}`, `{x.exam_type}`) trong khi `lib/domain/labels.ts` đã có sẵn map tiếng Việt. Vi phạm `D-12` + `EX-21`/`EX-22`. **Bài học kèm theo từ đợt 6:** chỗ in enum thô thường đi cùng một biểu thức `tone` viết tay kiểu `x === "results_published" ? "success" : "neutral"` — cái này **gộp mọi trạng thái còn lại vào một màu**, kể cả `cancelled`. Sửa nhãn thì sửa luôn `tone`; dùng `Record<Enums[...], BadgeTone>` để TypeScript bắt thiếu.
4. **Mẫu M15 vẫn phải kiểm ở mọi form:** `<button>` lồng trong `<a>`, ô nhập chỉ có placeholder làm nhãn, `h-*` chép cứng.
5. **Một issue về token chỉ được ghi `FIXED` khi chỉ ra được consumer thật** — bài học `UX-M00-002`, đã ghi ở đầu `07_UIUX_ISSUES_LOG.md`.
6. 🔴 **LUẬT MỚI TỪ ĐỢT 5 — kết luận về schema phải đọc migration từ MỚI NHẤT về CŨ.** `UX-M14-002` bị đánh `High` (và user đã duyệt cho sửa) dựa trên `20260713000003_classes_schedules.sql`, trong khi `20260716000037_remove_assistant_teacher_role.sql` đã `drop column assignment_role` và đổi ràng buộc thành `unique (class_id)`. Sửa theo đề xuất cũ sẽ **làm hỏng query**. Từ nay: `grep -rn "<tên bảng>" supabase/migrations` rồi đọc **ngược từ file mới nhất**, và đối chiếu với `src/types/database.ts` — typegen là ảnh chụp schema thật, cột không có trong `Row` nghĩa là cột không tồn tại. Cùng họ với bài học `UX-M00-002`: **đừng kết luận từ một dòng source mà chưa kiểm dòng đó còn hiệu lực không.**
7. **`isOneToOne: true` trong `database.ts` nghĩa là `supabase-js` trả về object chứ không phải mảng** — `[x.relation].map(...)` là cách **đúng** để duyệt quan hệ to-one, đừng nhầm là lỗi bọc mảng.
8. **Test có flaky đã biết** khi chạy song song (`wrong-answer-review`, `student-review-page` timeout). Không do thay đổi UI. Nếu gặp: `npm test -- --maxWorkers=4`.

## Decisions Already Made

`DS-001` … `DS-027` trong `08_UIUX_DECISIONS.md`. Ràng buộc mạnh nhất cho phase tiếp theo:

- `DS-001` Không đổi màu thương hiệu.
- `DS-002` là thứ tự gốc; phần còn lại đã bị `DS-026` thay thế.
- `DS-003` Mức "Sâu" nhưng đi từng module, từng màn hình nhỏ.
- `DS-012` Không đổi `NAVIGATION`. ← vẫn **chặn `UX-M14-011`**; phần tab đã được `DS-024` mở riêng cho M14
- `DS-013` Thang kích thước control — **không nhét 44px vào class component**.
- `DS-015` Header desktop giữ trống, không thêm breadcrumb.
- `DS-016` Chỉ có Light. **`DS-009` đã bị thay thế.**
- `DS-017` `--input` = `#7C8DA4`.
- `DS-018` Có error boundary ở `(dashboard)` và `global-error`.
- `DS-020` Hộp xác nhận chỉ hỏi khi thật sự có dữ liệu sẽ mất — dùng lại `useConfirmation()`.
- `DS-021` `maxLength` phản chiếu đúng giới hạn server, không tạo luật validation mới.
- `DS-022` Sửa `UX-M15-014` là **ngoại lệ có chủ đích**, không phải tiền lệ cho module sau.
- `DS-023` Được thêm map 8 nhãn `exercise_delivery_status` — nhưng **chữ chưa duyệt**, xem §5.2 báo cáo M14.
- `DS-024` Tab màn B vào `?tab=` — ngoại lệ của `DS-012`, **chỉ M14**, không mở rộng sang `UX-M14-011`.
- `DS-025` `session-log-form.tsx` vào phạm vi M14 **ở mức trình bày**: `h-*`, `text-xs`, ARIA của lỗi. Không đụng action/schema/nhãn/luồng submit.
- `DS-026` Sau P14-T12 chỉ redesign học viên M20→M27; giữ thay đổi cũ và hoãn các module khác.
- `DS-027` Learning Journey Bento; xanh/cam-đỏ chủ đạo, sky/cyan + amber/coral hỗ trợ qua semantic token WCAG; không gamification giả hay hiệu ứng nặng.
- `DS-028` M24 tách đôi: Ôn câu sai xong, **Flashcard hoãn**. M24 giữ `PARTIAL`, không `DONE`.
- `DS-030` Sửa 2 lỗi contrast AA ở tầng dùng chung: `alert.tsx` bỏ `/90` (4.30→**4.83:1**), token mới `--danger-ink: #B91C1C` cho badge `danger` (4.01→**5.37:1**). Ba tone còn lại đã đo và đạt. Impact map 27 file `Alert destructive` + 6 nhãn `danger`.
- `DS-029` `Q1`–`Q6` đã có trả lời → **Phase 16 hết chặn**, nhưng **`P15-T5b` vẫn hoãn tới sau Phase 16**. Chốt: chỉ Super Admin tạo flashcard · `session_cover` giữ nguyên 2 ảnh không chữ không mp3 · thẻ từ vựng theo **ảnh mẫu POLYMIND** (Hán tự · Pinyin riêng · Nghĩa · Ảnh · Audio + 3 danh sách con) · chỉ làm ★ thẻ khó · làm nhập hàng loạt + xáo trộn + phát tự động, **không** đảo mặt.

## Unresolved Questions or Blockers

✅ **`Q1`–`Q6` về Flashcard ĐÃ ĐÓNG** (2026-07-22 đợt 2) — toàn văn câu trả lời tại [`docs/10-yeu-cau-flashcard-quizlet.md`](../docs/10-yeu-cau-flashcard-quizlet.md) §7bis, đặc tả thẻ mẫu tại §7ter, quyết định `DS-029`.

⏸ **Nhưng `P15-T5b` VẪN hoãn.** Lý do gốc của `DS-028` không mất đi khi câu hỏi được trả lời: Phase 16 sẽ **viết lại chính `student-flashcard-reader.tsx`** theo mô hình dữ liệu mới, nên redesign nó bây giờ vẫn là làm hai lần cả UI, test lẫn E2E. M24 giữ `PARTIAL`.

📋 **Một câu hỏi mới, nhỏ, gửi tới user:** ảnh mẫu mặt trước ghi pinyin `bǔ`, mặt sau ghi `bo`. `卜` trong `萝卜` đọc **thanh nhẹ `bo`** → mặt trước sai dấu. Đây là **lỗi nội dung dạy học**, Claude không tự sửa; cần user xác nhận trước khi dùng ảnh này làm chuẩn nhân bản.

M14 vẫn còn hai phép đo trình duyệt thật nhưng được hoãn theo `DS-026`; không đánh dấu M14 `DONE`.

## Verification Status

Chạy ngày 2026-07-22, **sau khi** P15-T8/M27 hoàn tất:

| Check                           | Command                      | Result                       | Notes                                                                         |
| ------------------------------- | ---------------------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| Component target M25/M26/M27    | 3 file test mới                 | ✅ **7/7 · 8/8 · 5/5**    | Khoá thang `x/100`, chặn chia cho 0, `Giảm trừ` có điều kiện, ARIA lỗi form   |
| E2E responsive/a11y M25/M26/M27 | Chromium + Pixel 7           | ✅ **4/4 · 4/4 · 6/6**       | 360/768/1280, axe A/AA, không overflow, fixture tự dọn; M27 có cả trạng thái lỗi và thứ tự Tab |
| Chống flake E2E M25             | `--repeat-each=2`            | ✅ **8/8 PASS**              | Sau khi đổi cách đợi transition (xem Current Findings `0000b`)                |
| Contrast dùng chung (`DS-030`)  | công thức WCAG + axe         | ✅ **4.83:1 · 5.37:1**       | Trước khi sửa: 4.30 và 4.01 — cả hai fail AA, có sẵn từ trước                 |
| Visual inspection M25/M26/M27   | 9 ảnh Chromium               | ✅ **PASS** — và bắt 3 lỗi   | Ảnh chụp phơi ra 2 lỗi diễn giải số liệu (`0000`) và 1 icon lạc lõng ở M26    |
| Lint                            | `npm run lint`               | ✅ **PASS**                  | Không có output                                                               |
| Type-check                      | `npm run typecheck`          | ✅ **PASS**                  | TypeScript strict xanh                                                        |
| Test                            | `npm test -- --maxWorkers=4` | ✅ **204/204 PASS**          | 59 file, không sửa/nới/skip test cũ (baseline vào phiên: 184)                 |
| Build                           | `npm run build`              | ✅ **PASS**                  | Production build xanh                                                         |
| **Media/browser smoke P14-T12** | trình duyệt thật             | ⛔ **CHƯA XÁC MINH ĐỘC LẬP** | Cần media thật, keyboard/touch và kiểm bản ghi Nói không có tốc độ            |
| **M14 responsive/tab**          | trình duyệt thật             | ⏸ **HOÃN THEO `DS-026`**     | M14 vẫn `IMPLEMENTED — chờ đo`, không ghi pass/DONE                           |

**Không dùng một `eslint-disable`, `@ts-ignore` hay nới cấu hình nào.**

> Người sửa là Claude nên **không tự ghi Verified**. Cần Codex/user xác minh độc lập.
>
> **Của M14 (đợt 6)** — danh sách đầy đủ 5 mục ở §8 báo cáo M14, ưu tiên cao nhất:
>
> - **`?tab=`:** đổi tab → URL đổi theo; Back → về **đúng tab cũ**; F5 → giữ tab; `?tab=xyz` → rơi về "Tổng quan", không khung rỗng.
> - **Bàn phím tab strip:** mũi tên trái/phải **dời focus mà chưa đổi tab**, `Enter` mới đổi (`activationMode="manual"`).
> - **Lỗi form màn C:** xóa trắng "Nội dung thực dạy" → bấm "Hoàn tất buổi" → trình đọc màn hình phải **đọc lỗi lên**.
>
> **Của M15 (đợt 4, vẫn chờ):**
>
> - **`UX-M15-014` (ưu tiên cao nhất, vì đây là sửa nghiệp vụ):** mở `/teacher/attendance?session=<id>`, gõ ghi chú cho một học viên, **không** chọn trạng thái, bấm Lưu → phải thấy lỗi nêu **số học viên** và chữ vừa gõ **còn nguyên** trong ô. Rồi chọn trạng thái cho người đó → lưu được.
> - **`M15-S04`:** bấm tay vài người, rồi chạm "Tất cả có mặt" → phải hiện hộp xác nhận nêu đúng số người bị ảnh hưởng. "Giữ nguyên" thì không đổi gì. Bấm "Tất cả có mặt" trên danh sách trắng → **không** được hỏi.
> - **`M15-S03`:** cuộn tới cuối form → thanh Lưu phải **nhả ra** và thấy footer bản quyền. Kiểm ở 360 / 768 / 1280.

## Hành động kế tiếp (Next Exact Action)

**M20 → M27 đã đóng hết.** Còn đúng một việc trong Phase 15:

1. Claim `P15-T9` — **quality gate liên module học viên**: soát nhất quán M20–M27, responsive 360/390/430/768/1024/1280+, keyboard/focus/reduced-motion/contrast; cập nhật report/board/changelog/QA.
2. Ở `P15-T9`, hai việc cụ thể đáng làm trước:
   - **Quét mẫu `text-<token>/<số>` và `bg-<token>/<số>` toàn `src/`** — `DS-030` mới chỉ sửa hai chỗ đã chứng minh được; mẫu này còn ở đâu nữa thì chưa đo.
   - **Gom `StudentStat`/`SummaryCard`** — helper gần y hệt nhau đang bị chép ở `student/page.tsx` (M20), `student/results/page.tsx` (M25) và `student-tuition-overview.tsx` (M26). Cố ý để lại vì tách là đổi shared component; `P15-T9` là chỗ đúng để gom, có impact map.
3. **Bỏ qua `P15-T5b`** — hoãn tới sau Phase 16 (`DS-029`).
4. Phase 16 (dựng lại flashcard theo ảnh mẫu POLYMIND) **hết chặn nhưng chưa chia task**; mở khi user yêu cầu.

## Handoff Instruction

1. Chỉ tiếp tục M20→M27 theo `DS-026`; không quay lại M16–M19/M28/Admin trong đợt này.
2. Giữ xanh `#1A5FA8`, cam/đỏ thương hiệu và Be Vietnam Pro là chủ đạo. Màu hỗ trợ chỉ theo `DS-027`, qua semantic token đã đo contrast.
3. Mỗi module vẫn đi đủ audit → proposal → implementation → responsive/a11y → quality gate; không redesign hàng loạt.
4. Student-only visual layer không được làm đổi Admin/Teacher. Nếu bắt buộc sửa shared component/token, lập impact map và tuân thủ governance trước.
5. Không đổi business logic/API/route/RLS/validation/nhãn/chức năng nếu chưa nêu rõ để user quyết định.
6. P14-T12 đã code xong nhưng chưa Verified; giữ trong Verification Queue cho tới khi agent khác/user smoke độc lập.
7. M14 vẫn `IMPLEMENTED — chờ đo`; hoãn không có nghĩa là DONE.
8. M20–M23 đã DONE; không audit/sửa lại nếu không có regression có bằng chứng. `P15-T6` chỉ được mở khi user yêu cầu tiếp tục.
9. ⛔ **Không sửa `student-flashcard-reader.tsx`, `flashcards/schema.ts`, `flashcards/server/*` hay migration flashcard** cho tới khi `Q1`–`Q6` có trả lời (`DS-028`). M24 giữ `PARTIAL`.
