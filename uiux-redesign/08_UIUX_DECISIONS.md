# UI/UX Decisions

## Mục đích

Ghi những quyết định đã chốt để AI khác không tự thay đổi lại.

---

## Decision Log

| Decision ID | Date | Scope | Decision | Reason | Evidence | Impacted Modules | Status |
|---|---|---|---|---|---|---|---|
| `DS-001` | 2026-07-21 | Global | **Giữ nguyên chính xác màu thương hiệu**: `--primary #1A5FA8`, `--brand-red #C8102E`, `--brand-orange #FB9518`, `--brand-navy #0D3F78`. Không đổi hue, không đổi giá trị | Bảo toàn nhận diện. User chốt trực tiếp trong phiên | `globals.css`; `02_UIUX_DESIGN_SYSTEM.md` §2 | ALL | ACTIVE |
| `DS-002` | 2026-07-21 | Global | **Thứ tự module đã chốt**: M00 → nhóm Giáo viên (M13, M15, M14, M16, M17, M18, M19) → nhóm Học viên (M20–M27) → M28 → nhóm Quản trị (M01–M12) | M00 trước vì là nền tảng, làm khi chưa có gì để phá. Giáo viên là người thao tác dày đặc nhất mỗi buổi dạy. Học viên đông nhất và chủ yếu dùng điện thoại | `03_UIUX_MODULE_INVENTORY.md`; `04_UIUX_MODULE_BOARD.md` | ALL | ACTIVE |
| `DS-003` | 2026-07-21 | Global | **Mức can thiệp = "Sâu"**, nhưng bắt buộc triển khai theo từng module và từng màn hình nhỏ. Được chuẩn hoá visual layer và shared design token; **không** đổi business logic, database, API, route, permission, validation, nhãn hay chức năng | User chốt trực tiếp trong phiên: cho phép làm sâu nhưng cấm redesign toàn bộ trong một lần | Yêu cầu của user, phiên 2026-07-21 | ALL | ACTIVE |
| `DS-004` | 2026-07-21 | Global | **Thang `primary-50…950` dẫn xuất từ `#1A5FA8`**, giữ nguyên hue `210.8°`. `primary-600` phải luôn khớp chính xác `#1A5FA8` | Thang màu phải truy được về màu thương hiệu, không phải bảng màu mặc định của skill. `primary-600` tính ra đúng `#1A5FA8` là bằng chứng dẫn xuất đúng | `02` §3.2 | ALL (áp dụng từ M00) | ACTIVE |
| `DS-005` | 2026-07-21 | Token | **Sửa 2 lỗi contrast**: `--info` `#0284C7` → `#0369A1` (4.10:1 → 5.93:1); thêm `--border-strong: #7C8DA4` (3.39:1) cho viền control, giữ `--border: #DDE5EE` cho divider trang trí | WCAG AA cho chữ, WCAG 1.4.11 (≥3:1) cho thành phần giao diện | `07` → `UX-M00-001`, `UX-M00-002` | ALL (triển khai trong M00) | ACTIVE |
| `DS-006` | 2026-07-21 | Token | **Thêm token mới**: `--surface-page #F6F8FB`, `--surface-sunken #E4EAF2`, `--text-secondary #43536B`, `--text-disabled #8494A8`. Đổi `--muted` `#F1F5F9` → `#EDF1F7` | Hiện chỉ có 2 cấp chữ nên mọi thứ phụ đều dồn vào `muted-foreground`; nền trang đang là alpha ngẫu hứng `bg-muted/30` chứ không phải token | `02` §3.3; `07` → `UX-M00-004`, `UX-M00-009` | ALL (triển khai trong M00) | ACTIVE |
| `DS-007` | 2026-07-21 | Component | **Không thêm variant nút mới.** Phân cấp hành động ánh xạ vào 6 variant sẵn có của `button.tsx` (`default`, `outline`, `ghost`, `destructive`, `link`, `secondary`) | Thêm variant là thêm bề mặt phải bảo trì; 6 variant đủ cho 5 cấp hành động | `02` §8 | ALL | ACTIVE |
| `DS-008` | 2026-07-21 | Component | **Không cài thêm thư viện icon.** Dùng `lucide-react` đã có. Không dùng emoji làm icon | `components.json` đã khai báo `iconLibrary: lucide`; governance §3 | `components.json` | ALL | ACTIVE |
| `DS-009` | 2026-07-21 | Global | **Đóng băng dark mode.** Đợt redesign này chỉ làm giao diện Light. Khối `.dark` trong `globals.css` và 35 class `dark:` **giữ nguyên, không sửa, không xoá**. Không lắp `ThemeProvider` hay nút chuyển theme | Dark mode hiện không tới được (không có provider, `<html>` không nhận class `dark`) nên không ai nhìn thấy. Lắp nút chuyển theme là **thêm chức năng mới** — vi phạm ràng buộc phạm vi của chính master prompt. User chốt: chỉ làm Light | `07` → `UX-M00-006`; `02` §1 | ALL | ⛔ **SUPERSEDED bởi `DS-016`** (2026-07-21, cùng phiên) |
| `DS-010` | 2026-07-21 | Process | **`button.tsx` không được sửa nếu chưa có đề xuất riêng được duyệt.** Cụ thể là việc tách thang kích thước (`UX-M00-003`) | Đổi chiều cao nút là đổi layout của mọi màn hình trong repo. Đây đúng là trường hợp master prompt yêu cầu "tách thành task shared foundation riêng và chỉ làm khi board cho phép" | `07` → `UX-M00-003`; `02` §15 | ALL | ACTIVE |
| `DS-011` | 2026-07-21 | Process | **Thư mục quản lý đặt tại `uiux-redesign/` ở gốc repo** (chuyển bằng `git mv` từ `UIUX_Redesign_Management_Pack/uiux-redesign/`) | Master prompt và `UIUX_NEXT_SESSION_PROMPT.md` đều tham chiếu đường dẫn `uiux-redesign/...` không có tiền tố; đặt ở gốc thì mọi đường dẫn trong tài liệu đúng sẵn, không phải sửa link. User chốt | `git status` phiên 2026-07-21 | — | ACTIVE |
| `DS-012` | 2026-07-21 | Process | **Giữ nguyên `NAVIGATION` trong `src/lib/permissions/navigation.ts`** — danh sách mục menu, nhãn và `href` của cả 3 role không được đổi trong bất kỳ task UI/UX nào | Đó là dữ liệu phân quyền/điều hướng, không phải trang trí. Đổi nhãn menu là đổi nội dung — bị cấm | `03` → SH02 | M00–M27 | ACTIVE |
| `DS-013` | 2026-07-21 | Component | **Duyệt tách thang kích thước control** — gỡ chặn `DS-010`. Chiều cao *thị giác* đi theo con trỏ: chuột `xs` 32 / `sm` 36 / `default` 40 / `lg` 44; cảm ứng vẫn ≥44px nhưng **ép bằng CSS trong `globals.css`** (`@media (pointer: coarse)`), không nhét vào class Tailwind. Nút icon thêm `min-width: 44px` trên cảm ứng, nếu không sẽ thành 44×32. **Kèm theo:** `input`/`select trigger` hạ `h-11` → `h-10` cho khớp `button default` | Trước đây cả 8 size đều 44px nên `lg` bằng đúng `xs` — không tạo được phân cấp bằng kích thước, toolbar desktop bị nút to chiếm chỗ. Tách theo `pointer` giữ được cả hai: ngón tay vẫn đủ 44px, chuột được mật độ hợp lý. Phải hạ input cùng lúc, nếu không mọi thanh lọc `Input + Button` sẽ lệch 4px | `07` → `UX-M00-003`; `02` §8; user duyệt phiên 2026-07-21 | ALL | ACTIVE |
| `DS-014` | 2026-07-21 | Token | **Thu hẹp luật 44px cho link**: giữ `a[href] { min-height: 44px }` nhưng thêm `p a[href] { min-height: 0 }` để link chữ chạy trong đoạn văn không bị kéo cao dòng. Dùng hai rule đơn giản thay vì `:not()` phức hợp | Bằng chứng đo lại khi triển khai: `min-height` **không có tác dụng lên inline box** (CSS 2.1 §10.5), nên phần lớn lo ngại ở `UX-M00-007` không xảy ra. Rủi ro thật chỉ còn ở link `inline-flex` nằm trong đoạn văn. Cách này không phải sửa một dòng nào trong page của module khác — đúng luật "một module một task". `:not(p a)` phức hợp sẽ làm cả rule bị bỏ trên trình duyệt cũ, mất luôn touch target | `07` → `UX-M00-007`; user duyệt phiên 2026-07-21 | ALL | ACTIVE |
| `DS-015` | 2026-07-21 | Global | **Nửa trái header desktop giữ trống** — không thêm breadcrumb, không thêm tiêu đề trang vào header. Ngữ cảnh vị trí tiếp tục do `PageHeader` trong vùng main đảm nhiệm | Thêm breadcrumb là thêm chức năng mới (phải dựng map route→nhãn cho 51 page, định nghĩa cấp cha cho trang `[id]`), nằm ngoài phạm vi redesign. User chốt | `07` → `UX-M00-013` | ALL | ACTIVE |
| `DS-016` | 2026-07-21 | Global | **Xoá hẳn dark mode** — thay thế `DS-009`. Gỡ khối `.dark` trong `globals.css`, gỡ `@custom-variant dark`, gỡ toàn bộ 35 class `dark:` trong `src/`, và gỡ `useTheme` của `next-themes` khỏi `ui/sonner.tsx`. Đợt này và về sau chỉ có Light | Dark mode là **code không tới được**: không có `ThemeProvider`, `<html>` không bao giờ nhận class `dark`, nên biến thể `dark:` (biên dịch thành `.dark *`) không bao giờ khớp. Vì vậy xoá là **thay đổi không ảnh hưởng thị giác**, chứng minh được chứ không phải phỏng đoán. Giữ lại thì mỗi module sau đều phải bảo trì một bộ màu chết — trong đó có 4 cặp fail contrast nặng và cả màu thương hiệu bị đổi sai. User chốt | `07` → `UX-M00-006`; `02` §1 | ALL | ACTIVE |
| `DS-017` | 2026-07-21 | Token | **Trỏ `--input` sang `#7C8DA4`** (giá trị của `--border-strong`) thay cho `#DDE5EE`. Một dòng trong `globals.css`; không đổi `--border` (divider trang trí vẫn `#DDE5EE`), không sửa class của `input.tsx`/`checkbox.tsx`/`select.tsx` | `UX-M00-002` được đánh `FIXED` ở M00 nhưng thực tế **mới sửa một nửa**: token `--border-strong` được thêm vào rồi **không được dùng ở đâu cả** (`grep -rn "border-strong" src/` → chỉ khớp 3 dòng khai báo trong chính `globals.css`). Mọi input/checkbox/select/table vẫn vẽ viền bằng `border-input` = `#DDE5EE` = **1.27:1**, dưới xa ngưỡng 3:1 của WCAG 1.4.11. Sửa ở tầng token thay vì đi thêm class `border-border-strong` cho từng component: một dòng, không sinh ra hai kiểu viền input trong cùng ứng dụng, và module sau không phải nhớ tự thêm | `globals.css:84`; `07` → `UX-M00-002`; user duyệt phiên 2026-07-21 | ALL | ACTIVE |
| `DS-018` | 2026-07-21 | Global | **Thêm error boundary**: `src/app/(dashboard)/error.tsx` + `src/app/global-error.tsx`. Tiếng Việt, có nút "Thử lại" (gọi `reset()`) và "Về trang chủ", giữ nguyên shell dashboard. **Không** bắt lỗi im lặng, **không** đổi một dòng nào trong query/action | `UX-M13-009`: không có `error.tsx` ở bất kỳ đâu trong `src/app/` nên mọi query `throw` đều rơi vào trang lỗi mặc định của Next — tiếng Anh, không đường phục hồi, mất luôn sidebar/header. Đây là **thêm hành vi mới ở tầng shell** nên vượt ranh giới "chỉ sửa UI" của master prompt → phải có quyết định của user trước khi làm. Làm một lần ở M00, cả 29 module hưởng; để lại thì mỗi báo cáo module sau đều phải ghi "Error: chưa xử lý" | `07` → `UX-M13-009`; user duyệt phiên 2026-07-21 | ALL | ACTIVE |
| `DS-019` | 2026-07-21 | Student audio | **Mọi audio do giáo viên/Super Admin tải lên mà học viên nghe trong Bài tập, Kiểm tra/Thi và Ôn tập (Flashcard + câu sai) phải có đúng `0.5× · 0.75× · 1×`; mặc định `1×`; không có `1.25×/1.5×`.** Dùng playback rate phía client, giữ cao độ nếu hỗ trợ, không tạo file chậm trên server. Không áp dụng cho bản ghi Nói do học viên tự thu | User chốt trực tiếp; học viên cần giảm tốc audio học tiếng Trung nhưng không cần tốc độ nhanh hơn bản gốc | `P14-T12`; `07` → `UX-M22-M24-001`; `docs/01` → BR-14 | M22, M23, M24 | IMPLEMENTED — chờ xác minh độc lập |
| `DS-020` | 2026-07-21 | M15 | **"Đánh dấu nhanh" hỏi lại trước khi ghi đè** — nhưng **chỉ khi có dữ liệu thật sẽ mất**: tồn tại học viên đang mang trạng thái KHÁC đích đến. Dùng lại `useConfirmation()` trong `components/shared/confirmation-provider.tsx`, không thêm component mới, không thêm `AlertDialog` riêng | `UX-M15-012`: điểm danh tay 18/20 người rồi lỡ chạm "Tất cả có mặt" là mất sạch, không `Ctrl+Z`. Nhưng hỏi **mọi lần** thì thêm một thao tác vào đúng cái nút sinh ra để bớt thao tác — nên bấm trên danh sách trắng, hoặc bấm lại đúng nút vừa bấm, vẫn đi thẳng. Đây là **thêm hành vi mới** nên phải có quyết định của user. User chốt, chọn hộp xác nhận thay vì toast Hoàn tác | `07` → `UX-M15-012`; user duyệt phiên 2026-07-21 | M15 | ACTIVE |
| `DS-021` | 2026-07-21 | M15 | **Thêm `maxLength={300}` cho ô ghi chú điểm danh**, khớp đúng `recordSchema.note.max(300)`. Không đổi schema, không đổi thông báo lỗi của server | `UX-M15-013`: gõ 301 ký tự → submit hỏng với "Dữ liệu điểm danh không hợp lệ.", không chỉ ra ô của học viên nào. Về hình thức đây là chạm tầng validation (governance §1 cấm) nên phải hỏi; thực chất chỉ là **phản chiếu đúng giới hạn đã có** ra client, không tạo luật mới. User chốt | `07` → `UX-M15-013`; user duyệt phiên 2026-07-21 | M15 | ACTIVE |
| `DS-022` | 2026-07-21 | M15 (**nghiệp vụ**) | **Sửa `UX-M15-014` ngay trong task UI/UX** — ngoại lệ có chủ đích của governance §1, **không phải tiền lệ tự động** cho module sau. Cách sửa: `saveAttendanceAction` phát hiện `note_<id>` có chữ mà thiếu `status_<id>` thì **chặn cả lượt lưu** và báo rõ; không đổi schema, không đổi RPC, không đổi bảng | Ghi chú sống chung bản ghi với trạng thái nên **không thể lưu riêng** — thứ sửa được là *đừng im lặng*. Chặn cả lượt (thay vì lưu phần hợp lệ rồi bỏ ghi chú) vì form không reload khi action trả lỗi, chữ vừa gõ còn nguyên trong ô; lưu một nửa mới là chỗ mất dữ liệu. **Claude là người sửa → bắt buộc Codex xác minh độc lập** (CLAUDE.md). User chốt | `07` → `UX-M15-014`; `tests/unit/server/attendance-actions.test.ts`; user duyệt phiên 2026-07-21 | M15 | ACTIVE |
| `DS-023` | 2026-07-21 | M14 (**nhãn mới**) | **Duyệt thêm `EXERCISE_DELIVERY_STATUS_LABELS` đủ 8 giá trị** (+ `_TONE` kèm theo) vào `lib/domain/labels.ts`, theo khuôn `Record<Enums[...], string>` như 16 map đang có. ⚠️ **Mới duyệt *việc thêm map*, CHƯA duyệt *nội dung chữ*** — 8 nhãn đề xuất nằm ở §5.2 báo cáo M14, phải được user duyệt từng chữ trước khi viết code | `UX-M14-001`: badge bài tập ở màn B in thẳng enum DB ra giao diện, vi phạm `D-12`/`EX-21`/`EX-22`. `exercise_delivery_status` chưa có map tiếng Việt ở **bất kỳ đâu** trong repo (`exercise-dashboard.tsx` không hiển thị trạng thái delivery nên chưa lộ ra). Thêm nhãn mới bị governance §1 cấm → phải có quyết định. Dùng khuôn `Record<>` bắt buộc phủ đủ enum: thêm giá trị mới vào DB mà quên dịch thì TypeScript báo lỗi ngay. 6/8 chữ đề xuất lấy nguyên từ nhãn đã có trong repo để không sinh giọng điệu thứ hai. User chốt | `07` → `UX-M14-001`; `database.ts:3858-3866`; báo cáo M14 §5.2; user duyệt phiên 2026-07-21 | M14, và M16 khi tới lượt | ACTIVE — chờ duyệt chữ |
| `DS-024` | 2026-07-21 | M14 | **Đồng bộ 8 tab của `/teacher/classes/[id]` vào query param `?tab=`** — ngoại lệ có chủ đích của `DS-012`, **chỉ cho M14**. Đọc `searchParams` ở server component, đối chiếu danh sách 8 tab có sẵn, giá trị lạ → **fail-closed** về `overview`; `TabsTrigger asChild` bọc `<Link scroll={false}>`. Không thêm `"use client"`, không đổi route/permission, **không** kèm theo `UX-M14-011` | `UX-M14-003`: tab là state React nên Back sau khi bấm một link là mất chỗ đang đứng, không share/bookmark/refresh giữ được tab. `DS-012` cấm tự đổi hành vi navigation nên phải có quyết định của user. Phạm vi cố ý hẹp: chỉ tab **của chính trang này**, không mở sang việc mang `classId` sang module khác. **Rủi ro phải đo khi triển khai:** đổi tab thành 8 lần điều hướng server, mỗi lần chạy lại `getClassById` (`select *` + 6 quan hệ lồng). Chậm rõ rệt thì **dừng và hỏi lại**, không tự chuyển sang client component | `07` → `UX-M14-003`; báo cáo M14 §5.3; user duyệt phiên 2026-07-21 | M14 | ACTIVE |
| `DS-025` | 2026-07-21 | M14 | **`features/sessions/components/session-log-form.tsx` vào phạm vi M14, ở mức trình bày.** Được sửa: `h-*` chép cứng, `text-xs`, thuộc tính ARIA của lỗi field. **Không** đụng `saveSessionLogAction`, `useFormAction`, `name=`, `value=`, `maxLength`, nhãn, hộp xác nhận, hay luồng submit | Đây là **giao diện có thao tác ghi duy nhất của cả M14** và nằm ngay trong màn C; bỏ ra ngoài thì màn C chỉ còn phần chỉ-đọc và 2 issue `High` bị treo vô thời hạn — không module nào trong `DS-002` sở hữu file này. File nằm ở `features/sessions/components/`, **không phải** `features/*/server` nên không thuộc danh sách cấm ở handoff M14. User chốt | `07` → `UX-M14-013`, `-014`, `-015`; báo cáo M14 §1 "Ghi chú phạm vi" | M14 | ACTIVE |
| `DS-026` | 2026-07-22 | UI/UX scope | **Sau `P14-T12`, chỉ tiếp tục redesign khu vực Học viên theo thứ tự M20 → M27.** Giữ nguyên mọi thay đổi M00/M13/M15/M14 đã làm; M14 vẫn ở trạng thái đã triển khai nhưng chờ đo, không viết thêm code. Tạm dừng M16–M19, M28 và M01–M12 trong đợt redesign này | User chốt trực tiếp: toàn bộ module học viên cần được thiết kế lại hấp dẫn hơn để tăng động lực học, còn các role khác không thuộc phạm vi tiếp theo. `P14-T12` làm trước để player dùng chung không phải sửa lại khi tới M22–M24 | Yêu cầu user 2026-07-22; `P14-T12` | M20–M27; giữ nguyên M00/M13/M15/M14 | ACTIVE — **thay thứ tự còn lại của `DS-002`** |
| `DS-027` | 2026-07-22 | Student visual system | **Hướng “Learning Journey Bento”: sinh động, khích lệ, mobile-first nhưng không trẻ con.** `#1A5FA8`, `#FB9518`, `#C8102E` vẫn là màu chủ đạo; được bổ sung các sắc độ gần kề dẫn xuất theo hai họ **sky/cyan** và **amber/coral**, nhưng chỉ qua semantic token có kiểm tra WCAG, không rải mã màu trong component. Giữ Be Vietnam Pro. Gamification nhẹ chỉ được dùng dữ liệu thật đang có; không tự thêm streak, huy hiệu, nhiệm vụ hay tính năng. Không emoji, claymorphism, gradient trang trí hoặc hiệu ứng nặng | User cho phép mở rộng màu trang trí quanh xanh/cam/đỏ để giao diện học viên bắt mắt hơn, với điều kiện màu hiện tại vẫn là chủ đạo. Hệ thống phục vụ cả thiếu nhi lẫn người lớn nên phong cách phải thân thiện mà không ấu trĩ | User chốt 2026-07-22; `ui-ux-pro-max` đề xuất Bento + mobile stack + focus/touch rõ | M20–M27 và student-only shell | ACTIVE |
| `DS-028` | 2026-07-22 | M24 scope | **Tách `P15-T5` / M24 làm hai nửa.** Nửa **Ôn câu sai** làm bình thường. Nửa **Flashcard** (`student-flashcard-reader.tsx`) **hoãn** cho tới khi user trả lời `Q1`–`Q6` ở [`docs/10-yeu-cau-flashcard-quizlet.md`](../docs/10-yeu-cau-flashcard-quizlet.md) §7. M24 chỉ được ghi `PARTIAL`, **không** `DONE`, khi còn treo nửa Flashcard. Board tiếp tục sang `P15-T6`→`P15-T8` (M25/M26/M27) vì không module nào trong đó chạm flashcard | User chốt 2026-07-22 rằng flashcard sẽ đi theo mô hình Quizlet: nội dung là **thuật ngữ/định nghĩa dạng văn bản**, ảnh chỉ tùy chọn — thay cho hai file ảnh **bắt buộc** hiện nay. Đó là đổi **mô hình dữ liệu**, `DS-003` cấm làm trong task UI/UX. Nếu redesign reader theo mô hình ảnh bây giờ thì khi đổi schema phải làm lại lần hai cả UI, test lẫn E2E — đúng loại lãng phí mà `P14-T12` được làm trước M20 để tránh | Yêu cầu user + 2 ảnh Quizlet 2026-07-22; `docs/10-yeu-cau-flashcard-quizlet.md` §8; `database.ts:1443-1458`; `flashcards/schema.ts:22-23` | M24; và M06 khi tới lượt | ACTIVE |
| `DS-029` | 2026-07-22 | Flashcard (**Phase 16**, ngoài phạm vi UI/UX) | **`Q1`–`Q6` đã có câu trả lời — gỡ chặn Phase 16, KHÔNG gỡ chặn `P15-T5b`.** Chốt: `Q1` **chỉ Super Admin** tạo flashcard (không đụng RLS/nav) · `Q2` xoá làm lại **sau khi đã đếm dữ liệu thật**, có dữ liệu người soạn thì dừng và báo · `Q3` tách Pinyin riêng, và thẻ đi theo **ảnh mẫu POLYMIND** (§7ter) chứ không phải mô hình 2 ô của Quizlet · `Q4` chỉ làm ★ thẻ khó, **hoãn** theo dõi tiến độ · `Q5` **`session_cover` giữ nguyên mô hình 2 ảnh, không chữ, không mp3** · `Q6` làm nhập hàng loạt + xáo trộn + phát tự động, **không** làm đảo mặt. Xáo trộn chỉ trong buổi đang chọn và **không bền qua đăng xuất**. **`P15-T5b` vẫn hoãn**: `DS-028` giữ nguyên, M24 vẫn `PARTIAL`, và redesign reader chỉ làm **sau** khi Phase 16 đổi xong mô hình dữ liệu | Trả lời `Q1`/`Q5` làm Phase 16 **nhẹ hơn hẳn** so với giả định ban đầu: không đổi phân quyền, và `session_cover` không cần migration. Nhưng ảnh mẫu lại làm `Q3` **nặng hơn hẳn**: thẻ từ vựng là bản ghi có cấu trúc với **ba danh sách con** (tách nghĩa · câu ví dụ · cụm từ thường dùng), không phải 2 ô chữ. Hệ quả bắt buộc: **hai loại trang có hai mô hình dữ liệu khác nhau** → ràng buộc `NOT NULL` của `front_image_path`/`back_image_path` phải thành **CHECK theo `kind`**, không được drop vô điều kiện. Vì Phase 16 sẽ viết lại chính `student-flashcard-reader.tsx`, redesign nó bây giờ vẫn là làm hai lần — lý do gốc của `DS-028` **không mất đi khi câu hỏi được trả lời** | User trả lời 2026-07-22 đợt 2 + 2 ảnh thẻ mẫu `胡萝卜`; `docs/10-yeu-cau-flashcard-quizlet.md` §7bis, §7ter | M24 (giữ `PARTIAL`); M06 khi tới lượt; Phase 16 | ACTIVE |
| `DS-030` | 2026-07-22 | Component + Token (**dùng chung, ảnh hưởng cả Admin/Teacher**) | **Sửa hai lỗi contrast AA có thật ở tầng dùng chung.** (1) `ui/alert.tsx` biến thể `destructive`: bỏ opacity ở `*:data-[slot=alert-description]:text-destructive/90` → dùng thẳng `text-destructive`. (2) Thêm token `--danger-ink: #B91C1C` (+ `--color-danger-ink`) và `shared/status-badge.tsx` tone `danger` đổi `text-destructive` → `text-danger-ink`; **nền và viền giữ nguyên** `bg-destructive/12` / `border-destructive/25`. Không đổi `--destructive`, không đổi ba tone còn lại, không đổi bố cục hay chữ | Đo bằng công thức WCAG: `text-destructive/90` = `#E03C3C` trên `bg-card` trắng = **4.30:1**; badge `danger` = `#DC2626` trên `#FBE5E5` = **4.01:1** — cả hai dưới ngưỡng AA 4.5:1 cho chữ thường (badge còn là chữ 12px). Sau khi sửa: **4.83:1** và **5.37:1**. Cùng một nguyên nhân với `UX-M00-002`: **opacity modifier phá đúng cái contrast mà token được chọn để đạt**. Đã đo cả 5 tone để không phải sửa hai lần — `success` 5.95, `warning` 5.88, `info` 5.58 đều đạt, **chỉ `danger` hỏng**. Dùng token mới thay vì rải hex trong component, theo bài học M14. Lỗi này **có sẵn từ trước**, không do đợt redesign sinh ra; fixture hóa đơn quá hạn của M26 chỉ làm nó lộ. Không sửa thì M26 không thể ghi a11y xanh, mà nới ngưỡng axe là điều bị cấm tuyệt đối. User chốt | E2E `student-tuition-responsive.spec.ts` fail axe `color-contrast` trước khi sửa; `alert.tsx:15`; `status-badge.tsx:9`; `globals.css` | **Impact map:** `Alert variant="destructive"` — **27 file** trong `src/features/*` (auth, attendance, tuition, exams, exercises, question-bank, schedules, sessions, students, teachers, courses, classes, enrollments, evaluations, announcements, flashcards, wrong-answer-review…). `StatusBadge tone="danger"` — mọi nhãn map sang `danger` trong `lib/domain/labels.ts`: `cancelled` ×3, `withdrawn`, `absent`, `overdue`. Tất cả **chỉ đậm màu chữ lên**, không đổi hình dáng/kích thước/bố cục | ACTIVE |
| `DS-031` | 2026-07-22 | UI/UX scope | **Mở lại phạm vi sau khi M20→M27 đóng: tiếp tục theo thứ tự board M16 → M17 → M18 → M19.** Đây là **đảo ngược có chủ đích phần "tạm dừng M16–M19" của `DS-026`/`D-27`** — không sửa lén `DS-026`, mà ghi một quyết định mới thay thế đúng theo Quy tắc cuối file này. `DS-027` (Learning Journey Bento) **không áp cho M16–M19**: bốn module này là màn làm việc của giáo viên, giữ hệ màu/token dùng chung hiện có, không mượn palette student-only `sky/cyan/amber/coral`. M28 và M01–M12 vẫn tạm dừng | User yêu cầu trực tiếp 2026-07-22 (đợt 3): *"làm tiếp các module tiếp theo trong phạm vi uiux-redesign… đừng dừng lại ở mỗi module"*. Lý do gốc của `DS-026` là ưu tiên học viên trước, không phải cấm vĩnh viễn phần còn lại; ưu tiên đó đã hoàn thành khi `P15-T9` đóng. Phạm vi mới đi đúng thứ tự board `DS-002` từ chỗ M20 chen vào, nên không phải xếp lại thứ tự lần nữa | Yêu cầu user 2026-07-22 đợt 3; `P15-T9` đóng M20–M27 | M16, M17, M18, M19 | ACTIVE — **thay phần "tạm dừng M16–M19" của `DS-026`**; phần còn lại của `DS-026` (M28, M01–M12 tạm dừng; giữ nguyên M00/M13/M15/M14) **vẫn hiệu lực** |

| `DS-032` | 2026-07-22 | Shared component | **Logo gọi theo `height` (chiều cao thật của chữ ký), không gọi theo ô vuông `size`.** Bề rộng do component tự sinh từ `LOGO_ASPECT = 640/292`. Asset chuẩn là `public/polymind-lockup.png` — đã cắt hết lề, nền **trắng tuyệt đối `#ffffff`**. `variant="bare"` cho nền sáng, `variant="plate"` (tile trắng bo góc) **chỉ** cho nền tối. Không đặt logo vào khung vuông ở bất kỳ bề mặt nào nữa | Chữ ký thương hiệu nằm ngang tỉ lệ 2,19:1. Ép vào ô vuông thì `object-contain` co nó còn 1/2,19 chiều cao ô — ô 40px chỉ vẽ chữ cao ~16px, đúng thứ user báo là "khó nhìn". Gọi theo chiều cao là cách duy nhất để mọi bề mặt dùng chung một đơn vị mà không ai phải tự tính lại bề rộng | User báo trực tiếp 2026-07-22 (đợt 4); đo `bbox` của asset; `UX-UIUX-M00-015`/`-016`/`-017` | M00 và mọi module dùng `Logo` (sidebar, drawer, header, auth) | ACTIVE — khoá bằng `tests/e2e/brand-logo-responsive.spec.ts` (đo `getBoundingClientRect()` của `<img>`, không đo ô bọc) |
| `DS-033` | 2026-07-22 | Token | **Luật 44px cho nút icon trên cảm ứng bắt theo `[data-size^="icon"]`, KHÔNG kèm `[data-slot="button"]`.** `DS-013` đã đặt luật này nhưng nó chưa bao giờ áp được | Đo DOM thật: Radix `<XTrigger asChild>` hợp nhất props và **ghi đè `data-slot`** của Button bằng slot của chính nó — nút hamburger render ra `data-slot="sheet-trigger"`, `el.matches('[data-slot="button"][data-size^="icon"]')` = `false`, đo được **40×44** thay vì ≥44×44. Ảnh hưởng **>8** nút icon nằm trong sheet/dropdown/dialog trigger. `data-size` sống sót qua `asChild`; trong toàn `src/` chỉ Button phát giá trị bắt đầu bằng `icon` (avatar/select/switch chỉ `sm\|default\|lg`) nên selector vẫn đủ hẹp. User duyệt sửa tầng dùng chung như tiền lệ `DS-030` | `07` → `UX-UIUX-M00-018` | ALL | ACTIVE |
| `DS-034` | 2026-07-22 | Test | **Ngưỡng touch target trong E2E đi theo LOẠI CON TRỎ:** cảm ứng 44px (WCAG 2.5.5), chuột 24px (WCAG 2.5.8 — mức AA thật sự) | `accessibility-responsive.spec.ts` đòi 44px cho cả hai project, tức luật **trước** `DS-013`. `DS-013` đã cố ý đổi thang desktop thành 32/36/40/44 để tạo phân cấp kích thước và chỉ ép 44px ở `pointer: coarse`. Test cũ vì thế mã hoá một luật đã bị thay — sửa test là **đồng bộ với quyết định**, không phải nới cho xanh; vẫn giữ một ngưỡng WCAG có thật nên vẫn bắt được hồi quy | `07` → `UX-UIUX-M00-018` | ALL | ACTIVE |
| `DS-040` | 2026-07-23 | Test infrastructure (**toàn bộ E2E**) | **Spec E2E KHÔNG được ghim UUID của hàng do seed sinh ra.** Tra qua khóa nghiệp vụ ổn định: `classes.code`, hoặc `profiles.id` của auth user (những UUID này seed đặt cố định) | `seed.sql` insert `classes`/`students`/`enrollments` **không chỉ định `id`** → `gen_random_uuid()` cấp UUID mới sau **mỗi `db reset`**. Hệ quả nghiêm trọng hơn "test đỏ": **mọi con số "E2E xanh" của các phiên trước chỉ tái lập được trên DB chưa reset**. Phát hiện được vì `P17-T5` reset DB rồi mới chạy — 22 test đỏ ngay. Cùng loại `UX-UIUX-M18-007` (smoke test chưa từng thực thi assertion) | `07` → `UX-UIUX-M00-019`; lỗi gốc: `Key (student_id)=(447aa2c2-…) is not present in table "students"` | **9 spec**: 1 UUID lớp, 1 UUID học viên, 1 UUID ghi danh | ACTIVE |
| `DS-039` | 2026-07-23 | Layout (**mẫu lặp lại**) | **Grid item chứa chữ dài phải có `min-w-0`.** Không phải trang trí — grid/flex item mặc định `min-width: auto`, tức **không co được dưới bề rộng min-content** | Đo thật ở 360px: `/teacher` tràn **31px**, `/teacher/classes` tràn **70px** (thẻ lớp **414px** ở cả viewport 360 lẫn 390 — bề rộng không đổi chính là dấu hiệu bị min-content ghim). **Kiểm chứng nguyên nhân trước khi sửa**: đặt `min-width: 0` cho mọi con grid/flex trong trình duyệt → tràn về **0px** cả hai màn. Thang 3 mốc cũ không bắt được vì M13/M14/M15 đóng **trước** khi thang 6 mốc thành chuẩn | `07` → `UX-UIUX-M13-010`, `UX-UIUX-M14-020` | M13, M14 | ACTIVE |
| `DS-051` | 2026-07-23 | Architecture (**toàn app**) | **Server Component KHÔNG được truyền React element vào một prop rồi bị Client Component đưa xuống `asChild`.** Nút/trigger phải do **chính Client Component dựng**, suy từ cờ dữ liệu sẵn có (`isEdit`, `version`…). Khoá bằng bài kiểm **tĩnh** `tests/unit/rsc-aschild-trigger.test.ts`, **không** bằng E2E | Element đi qua ranh giới RSC thì Radix `Children.only()` **có lúc** không thấy đúng một phần tử → ném *"Primitive.button failed to slot onto its children"* → React bỏ cả cây → `(dashboard)/error.tsx`. **Đo được `47/120` lượt hỏng (39%) · 99 lỗi**, sau khi sửa **`0/120`** và **`0/90`**. 🔴 Bài học đắt nhất: lỗi này **sống sót ba đợt QA** vì trang lỗi có **đúng một `<h1>` và không `<h2>` nào**, trùng khít triệu chứng "màn thiếu heading cấp 2" — đợt 9 ghi thành lỗi a11y, đợt 10 ghi thành "RSC còn stream", đầu đợt 11 ghi thành "truy vấn máy chủ `throw`"; vế cuối bị bác bỏ bằng `webServer.stdout: "pipe"` (log `next dev` cho thấy **mọi request đều 200**). Chọn bài kiểm **tĩnh** vì tần suất 47/120 khiến mọi bài E2E bắt nó đều là bài *chập chờn* — thứ `DS-038` cấm | `UX-UIUX-M00-025`; đợt 11 | 3 call site đã sửa: `admin/classes/[id]`, `admin/courses/[id]`, `question-bank-page.tsx` (2 chỗ) | ACTIVE — Claude là người sửa, **chờ xác minh độc lập** |
| `DS-050` | 2026-07-23 | Data model (Phase 16 — Flashcard) | **Bốn điểm mô hình dữ liệu, user chốt ở cổng `P16-T0`:** (1) ba danh sách con lưu **3 cột `jsonb` + Zod**; (2) ảnh trong danh sách con đi qua **`media_paths text[]` + trigger + GIN**; (3) giữ `front_image_path`/`back_image_path`, không dùng `illustration_path`; (4) ảnh `胡萝卜` chỉ là chuẩn bố cục, không nhân bản nội dung | (1) Zod là chỗ cưỡng chế hình dạng; DB giữ sàn ba giá trị phải là mảng. (2) Bản thực thi dùng `media_paths @> array[path]` thay câu chữ ban đầu `path = any(media_paths)`: hai phép có cùng nghĩa với một path, nhưng `@>` dùng được GIN. **Codex đo độc lập 2026-07-24:** `EXPLAIN` ra `Bitmap Index Scan on ix_flashcard_pages_media_paths`; giữ `@>` và GIN. (3) User chốt tiếp ở `P16-T1`: ảnh vocabulary tuỳ chọn, khi có cả hai thì phải là hai file khác nhau; giữ `flashcard_pages_distinct_media_check`, sửa §7ter. (4) Migration thay `term` hoàn toàn bằng `hanzi` để không giữ hai nguồn sự thật; quét `src/`/test không còn code Flashcard đọc `term` | `P16-T0`; `DS-049`; migration `070` | Phase 16 toàn bộ (`P16-T1`…`P16-T9`) | ACTIVE — cổng đã mở sau khi user đếm cloud = 0; lựa chọn `@>` + GIN được xác nhận độc lập |
| `DS-038` | 2026-07-23 · **luật (1) sửa 2026-07-23 (đợt 11)** | Test method (**áp cho mọi gate sau**) | **Ba luật đo:** (1) ⚠️ **SỬA** — chờ **NỘI DUNG THẬT của đúng màn đang đo** rồi mới đếm heading/landmark: một mỏ neo mà **chỉ phân đoạn trang** mới render được (dùng `<h1>` mang **đúng chuỗi tiêu đề** của màn đó), **KHÔNG** dùng `networkidle`, và cho mỏ neo ngân sách cỡ điều hướng (30s) chứ không phải 5s mặc định của `expect`; (2) chờ `document.getAnimations()` dừng rồi mới quét axe trong dialog; (3) vùng cuộn chỉ tính là lỗi bàn phím khi nó **thật sự cuộn** và bên trong không có phần tử Tab tới được | Bản gốc luật (1) ("chờ `networkidle`") **tự nó là nguồn đỏ giả** và đã bị chính nó bắt: `networkidle` kích hoạt sau **500ms không request**, mà giữa các đoạn stream của RSC có đúng những khoảng lặng đó → đo lúc `<main>` (do layout cấp) đã hiện nhưng thân trang chưa về → `h2 = 0` bị quy cho sản phẩm. **Số đo, cùng lệnh cùng máy:** bản cũ chạy riêng xanh **13,2s** → `--repeat-each=3` **3/3 đỏ** → xanh **27,1s**; đợt 11 kiểm ngược lại bản cũ được **1/6 đỏ**, bản mới **6/6 xanh**. Mỏ neo phải là `<h1>` **chứ không phải `<h2>`** — neo vào chính thứ mình kiểm thì bài kiểm tự chứng minh mình (hết giờ thay vì báo `h2 = 0`). Nguồn stream là ranh giới Suspense ngầm do `(dashboard)/loading.tsx` tạo ra. Lượt gốc còn suýt ghi **hai báo động giả**: `h1=0` trên hai màn **đều có `PageHeader`**, và contrast `4.45:1` đo giữa lúc dialog fade-in — tin lượt đo đầu thì đã **sửa nhầm token dùng chung ảnh hưởng toàn app** | `P17-T5` §4.1; sửa luật (1): đợt 10 chẩn đoán + đợt 11 đo lại và kiểm ngược | Mọi spec responsive/a11y | ACTIVE |
| `DS-037` | 2026-07-22 | UI/UX scope (M19) | **M19 Báo cáo lớp: KHÔNG thêm export và KHÔNG thêm bộ lọc thời gian; CÓ thêm đúng 1 biểu đồ dựng từ dữ liệu đã truy vấn sẵn.** Vế "giữ export đúng date range" trong Definition of Done của `P17-T4` được ghi **N/A** kèm bằng chứng | Đã kiểm bằng đọc source: `/teacher/progress` **không có** export lẫn date range — chỉ có `ClassPicker`. `features/reports/export.ts` tồn tại nhưng chỉ phục vụ **báo cáo học phí của Admin** (`/api/export/reports`). Nghĩa là DoD mô tả một thứ chưa tồn tại; thêm vào là **thêm tính năng**, không phải redesign. Biểu đồ thì khác: `03_UIUX_MODULE_INVENTORY.md` đã liệt kê M19 phụ thuộc `Chart`, và dữ liệu vẽ ra là số **đã có sẵn** trong `getTeacherClassReport` — không thêm query, không thêm công thức | User chốt 2026-07-22 đợt 6, sau khi được trình bày bằng chứng | M19 | ACTIVE |
| `DS-036` | 2026-07-22 | Shared component (**dùng chung — M18, M19, Admin**) | **Mọi `SelectTrigger` phải có tên gọi được bằng `id` + `<Label htmlFor>` (ưu tiên nhãn hiện hình) hoặc `aria-label`.** `ClassPicker` nhận `useId()` + `<Label>` hiện hình mặc định "Lớp"; thêm prop `label` để trang khác đổi chữ. `DatePicker` nhận thêm **2 prop tùy chọn** `aria-invalid`/`aria-describedby` chuyển thẳng xuống nút mở lịch | `SelectTrigger` của Radix render `role="combobox"`, mà `combobox` **không thuộc nhóm role lấy tên từ nội dung** — nên chữ hiển thị bên trong không bao giờ trở thành accessible name. axe báo `select-name` mức **critical**. Đây là lý do lỗi sống sót qua M16/M17: hai module đó dùng `<select>` gốc và `NativeSelect`, không đụng `ClassPicker`. Chọn nhãn **hiện hình** thay vì `aria-label` ẩn vì nó phục vụ cả người dùng sáng mắt (`input-labels`). User duyệt sửa tầng dùng chung như tiền lệ `DS-030` | `07` → `UX-UIUX-M18-001`; script quét: 32 `SelectTrigger`, 6 vô danh | **Impact map:** `ClassPicker` — đúng **3 trang**: `/admin/schedule`, `/teacher/evaluations` (M18), `/teacher/progress` (M19); mỗi trang thêm một dòng nhãn phía trên ô chọn. `DatePicker` — **14 call site / 7 file**; thay đổi **thuần cộng thêm**, không truyền prop mới thì render y hệt trước. 5 combobox vô danh còn lại (M10/M11/M16-M17) **cố ý chưa sửa** — ngoài phạm vi, ghi `UX-UIUX-M18-008` | ACTIVE |
| `DS-035` | 2026-07-22 | Shared component | **`GradingWorkspace` không được render `<main>` của riêng nó** — dùng `<section aria-labelledby>`; mọi component trong `(dashboard)` đều nằm sẵn trong `<main>` của layout | `grep -rn '<main' src/` trả đúng **một** kết quả và đó chính là chỗ sai, tạo hai landmark `main` lồng nhau. Vì workspace dùng chung nên lỗi phủ cả màn chấm Bài tập (M16) lẫn Thi (M17) | `07` → `UX-UIUX-M17-002` | M16, M17 | ACTIVE |

---

## Quyết định của dự án phải tôn trọng (nguồn: `WORKLOG.md`)

Đây **không phải** quyết định UI/UX, nhưng ràng buộc mọi task UI/UX trong repo này:

| ID | Nội dung ràng buộc |
|---|---|
| `D-12` | UI **tiếng Việt**, ngày `dd/MM/yyyy`, hiển thị theo `Asia/Ho_Chi_Minh`, DB lưu UTC. Không đổi định dạng ngày/giờ khi redesign |
| `D-17` | Footer bản quyền phải có dưới **mọi** trang: `© <năm> Bản quyền thuộc về POLYMIND` + `POLYMIND — Đồng Hành Cùng Bạn Vươn Xa`. Không được bỏ khi làm lại layout |
| `D-20` | **Agent không được tự `git commit`.** Để thay đổi trong working tree cho user review |
| `EX-14` | Trang thi chặn copy/cut/paste/drop nhưng **không phá Chinese IME**. Không đụng vào hành vi này khi làm M23 |
| `EX-21` | Màn chấm dùng tiếng Việt nghiệp vụ, **không lộ JSON/enum** ra giao diện |
| `EX-22` | Kết quả học viên phải ở dạng đọc được, không lộ payload kỹ thuật |

## `DS-041` — Locator test bám nhãn phải `exact`, không khớp chuỗi con

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE

`PasswordInput` đặt nhãn nút hiện/ẩn theo từng ô ("Hiện mật khẩu mới", "Hiện ô
nhập lại mật khẩu"). Chuỗi "mật khẩu" nằm trong nhãn nút, nên
`getByLabel("Mật khẩu")` — vốn khớp **chuỗi con, không phân biệt hoa thường** —
trúng cả ô nhập lẫn nút và hỏng ở strict mode.

Đã sửa **21 chỗ ở 19 spec** thành `{ exact: true }`. Đây **không phải** "sửa test
cho nó xanh": locator lỏng thì phép đo vô nghĩa ngay từ đầu — đúng bài học
`UX-UIUX-M18` (`getByRole(name)` khớp chuỗi con làm phép đếm sai) và `DS-038`.

Luật từ nay: locator bám nhãn/tên trong spec **mặc định dùng `exact: true`**, trừ
khi cố ý muốn khớp một họ chuỗi và có ghi chú giải thích.

⚠️ Kèm theo: **không dùng `getByRole("alert")`** để bắt thông báo của app —
Next.js tự chèn `#__next-route-announcer__` cũng mang `role="alert"`. Bám theo
`[data-slot=alert]`.

---

## `DS-042` — Trang auth: `<h1>` là TÊN MÀN, tên thương hiệu là chữ thường

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE · **Thay cho:** cách đặt heading cũ ở `(auth)/layout.tsx`

Bản cũ đặt `<h1>POLYMIND CHINESE</h1>` trong layout dùng chung, nên đo được: cả
**4 màn auth có đúng một heading và cả 4 mang cùng một chữ**. Người dùng trình
đọc màn hình điều hướng bằng danh sách heading nghe y hệt nhau ở `/login`,
`/forgot-password`, `/reset-password`, `/accept-invite`.

Nay: khối thương hiệu là `<p>` (hình thức không đổi), còn `<h1>` là tiêu đề card
của từng trang qua `CardTitle asChild`.

Ràng buộc phải giữ: logo dùng `alt=""` **chỉ hợp lệ khi tên thương hiệu vẫn có
mặt dưới dạng chữ đọc được** cạnh nó. `brand-logo-responsive.spec.ts` kiểm đúng
điều đó thay vì kiểm "phải là h1".

---

## `DS-043` — Mở lại nhóm Xác thực + Quản trị (đảo phần còn lại của `D-27`)

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE

User chốt: làm M28 trước, xong thì **chạy tiếp M01→M12** mà không dừng hỏi giữa
chừng. Đảo nốt phần "tạm dừng Auth và Admin" của `D-27`/`DS-026`. Thứ tự theo
board: **M28 → M01 → M02 → … → M12**.

Ràng buộc kế thừa nguyên vẹn:
- `DS-027` (Learning Journey Bento + palette `student-*`) là **student-only**,
  **không** áp cho Admin. Màn quản trị là công cụ làm việc: ưu tiên mật độ thông
  tin, quét nhanh, thao tác bàn phím.
- Không đổi query · server action · RPC · RLS · Storage · route · phân quyền ·
  validation · công thức · nhãn nghiệp vụ (`DS-003`).

---

---

## Quy tắc

- Quyết định thay đổi token dùng chung phải ghi tại đây **trước khi** sửa code.
- Không đảo ngược quyết định đang `ACTIVE` mà không ghi một quyết định mới thay thế.
- Khi có xung đột giữa thẩm mỹ và nghiệp vụ, ưu tiên độ rõ ràng và hành vi hiện có.
- Không tự quyết định thay đổi route, permission, label hoặc workflow — vướng thì hỏi user.

---

## `DS-044` — Bốn luật cho khu Quản trị (M01–M12)

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE · **Nguồn:** user chốt đầu phiên đợt 9

### 1. Dựng lại bố cục thật sự, không chỉ vá lỗi

Khu Quản trị đi theo hướng **bảng điều khiển mật độ cao**: thanh công cụ lọc ở
trên, dữ liệu dày, thao tác bằng bàn phím. **Không** dùng Learning Journey Bento
và **không** mượn palette `student-*` (giữ nguyên `D-30`/`DS-043`) — màn quản trị
là công cụ làm việc hằng ngày, không phải màn tạo động lực học tập.

### 2. Bảng nhiều cột: MỘT giao diện, cuộn ngang — không nhân đôi

Trước đợt này, **6 bảng** dựng hai giao diện (`hidden md:block` + `md:hidden`).
Hai bản đã **trôi khác nhau ở chỗ mất dữ liệu**: bản điện thoại bỏ hẳn email,
người giám hộ, số điện thoại, chuyên môn, học phí, số buổi, ngày khai giảng, mã
tài khoản. Trên điện thoại quản trị viên **không có cách nào** đọc được các
thông tin đó, mà không spec nào báo đỏ vì mỗi bản đều "đúng" theo tiêu chí của
chính nó — đúng mẫu hỏng `UX-UIUX-M25-010`. Đây cũng là nguyên nhân
`admin-accounts.smoke` đỏ ở `P17-T5`.

→ Mọi bảng Quản trị dùng `components/shared/data-table.tsx`.

⚠️ **Ghim CỘT ĐỊNH DANH, không ghim hàng tiêu đề — đã đo trước khi xây.** Bọc
`overflow-x: auto` thì CSS tính luôn `overflow-y: auto`, khiến
`clientHeight === scrollHeight` và `<thead position:sticky; top:0>` **không còn
chỗ để dính** (cuộn trang 600px → thead trôi lên `top: -199px`). Cột đầu
`sticky; left:0` thì dính đúng (mép ô `1px` so với mép vùng `0px` sau khi cuộn
ngang 400px). Với bảng cuộn **ngang**, cột định danh mới là thứ giữ cho người
dùng biết đang đọc dòng của ai. **Khác mô tả lúc hỏi user — cần xác nhận lại.**

### 3. Lỗi nghiệp vụ thật thì sửa luôn, kèm test khoá

Điều kiện: **dựng lại được lỗi** trong trình duyệt/DB **và** có số đo. Áp dụng
trong đợt này cho: ngày ISO lọt ra UI ở `/admin/reports` (trái `D-12`), tương
phản tab dưới AA ở tầng dùng chung, và vùng cuộn không tới được bằng bàn phím.

### 4. Bộ E2E đầy đủ chạy một lượt ở CUỐI

Trong lúc làm chỉ chạy spec liên quan (vài phút). Lượt đầy đủ ~50 phút để dành
cho `P18-T14`, vừa đóng nợ đợt 8 vừa kiểm 13 màn mới trong một lần.

---

## `DS-045` — `text-foreground/60` bị cấm ở `TabsTrigger`; dùng token thật

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE · **Tầng:** dùng chung

`ui/tabs.tsx` đổi màu tab **không** được chọn từ `text-foreground/60` sang
`text-text-secondary`.

**Bằng chứng:** axe trên `/admin/notifications` đo được `#687689` trên nền
`bg-muted` `#edf1f7` = **4.07:1**, dưới ngưỡng AA 4.5:1, mức `serious`. Token
`--text-secondary` `#43536b` trên cùng nền = **6.89:1**, vẫn nhạt hơn
`text-foreground` của tab đang chọn nên phân cấp thị giác không mất.

Đúng nguyên nhân gốc `DS-030`/`UX-M00-002`: **opacity modifier phá đúng cái
contrast mà token được chọn để đạt** — nền tab bar tối hơn nền trắng nên phần
alpha 40% ăn mất phần dư.

⚠️ **Bài học đo lường, lặp lại lần thứ tư:** tự tính lại bằng `getComputedStyle`
ra **18.52:1** vì hàm đó trả `oklab(... / 0.6)` **chưa trộn nền** — alpha không
được áp. Con số của axe (trộn nền thật) mới đúng. **Đo điểm ảnh thật, đừng tính
từ token.**

**Impact map:** 7 file dùng `Tabs`, **0** file dùng `variant="line"`. Bốn file
học viên/giáo viên tự đè `bg-transparent` + `text-student-sky-ink` nên **không
đổi hình** — đã kiểm chứng bằng cách quét axe `/student/class` và
`/student/results` **trước khi sửa**: `color-contrast = 0`, tức lỗi chỉ nổ ở màn
dùng giá trị mặc định. Hai file Quản trị và `exercise-list.tsx` nhận màu mới.

---

## `DS-046` — Cột `date` của Postgres dùng `formatDateOnly`, không dùng `formatDate`

**Ngày:** 2026-07-23 · **Trạng thái:** ACTIVE

`formatDate` dành cho `timestamptz` (mốc thời gian thật, có múi giờ).
Cột `date` là **ngày lịch, không có múi giờ** — đẩy nó qua `formatDate` là sai
loại dữ liệu.

**Đo thật bằng `TZ=<tz> node`:**

```
UTC · America/New_York · Europe/Berlin · Asia/Ho_Chi_Minh → 15/07/2026  ✅
Pacific/Auckland (+12) · Pacific/Kiritimati (+14)          → 14/07/2026  ❌
```

`parseISO("2026-07-15")` cho nửa đêm theo giờ **máy**, đổi sang giờ Việt Nam thì
máy ở phía đông +07 **lùi một ngày**.

Lỗi phát hiện ở `/admin/reports`: trang in **thẳng chuỗi ISO** `2026-07-15` ra
màn hình (trái `D-12`), không ai thấy vì **seed không có hóa đơn nào**.

Khoá bằng 6 unit test, trong đó bài chính **đã kiểm ngược**: thay bằng cài đặt
`new Date()` → đỏ đúng như mong đợi (`16/07` thay vì `15/07`).

⚠️ **Không kiểm múi giờ bằng cách gán `process.env.TZ` trong test** — Node đọc TZ
một lần lúc khởi động, gán lại giữa chừng không có tác dụng và bài kiểm sẽ xanh
với cả bản cài đặt hỏng.

---

## `DS-047` — Bảng cuộn ngang ghim CỘT ĐỊNH DANH, không ghim hàng tiêu đề

**Ngày:** 2026-07-23 (đợt 10) · **Trạng thái:** ACTIVE — user xác nhận

`DS-044` §2 chốt "cuộn ngang + tiêu đề dính", và câu hỏi lúc đó mô tả nhầm rằng
đó là **hàng tiêu đề**. Đợt 9 đo trước khi xây và thấy không làm được:

| Đo gì | Kết quả |
|---|---|
| `overflow-x: auto` → `overflow-y` tính ra | `auto` (CSS ép trục còn lại thoát khỏi `visible`) |
| `clientHeight` vs `scrollHeight` của vùng bọc | **820 = 820** → không có chỗ trống để dính |
| `<thead position:sticky; top:0>` sau khi cuộn trang 600px | `top: **-199px**` → trôi hẳn khỏi khung nhìn |
| Cột đầu `sticky; left:0` sau khi cuộn ngang 400px | mép trái ô **1px** vs mép vùng **0px** → dính đúng |

**Luật:** hàng tiêu đề chỉ cứu được cuộn **DỌC**. Bảng của khu Quản trị cuộn
**NGANG**, nên thứ phải ghim là **cột định danh** (Mã / Họ tên) — đó mới là thứ
giữ cho người dùng biết đang đọc dòng của ai.

Muốn có hàng tiêu đề dính thì buộc phải tạo thêm một vùng cuộn **dọc** lồng bên
trong (chiều cao cố định) — thứ gây rối cuộn trang trên điện thoại. Không làm.

⚠️ Ô định danh dính **bắt buộc nền đặc** (`--row-hover: #f8f9fc`), không được
dùng `bg-muted/40`: nền trong suốt làm chữ cột sau trôi qua bên dưới ô dính, đọc
ra "Mãên hệ". Đã khoá bằng bài kiểm đo `alpha` của nền.

---

## `DS-048` — Chữ tiếng Anh trên giao diện KHÔNG được `DS-003` bảo vệ

**Ngày:** 2026-07-23 (đợt 10) · **Trạng thái:** ACTIVE — user chốt

`UX-UIUX-M11-001`: `/admin/notifications` hiện chữ **"Announcement"** ở 4 chỗ.
`DS-003` cấm đổi **nhãn**, `D-12` đòi **UI tiếng Việt** → hai luật có vẻ đá nhau.

**User chốt: Việt hoá cả 4 chỗ.** Ranh giới để không phải hỏi lại lần sau:

| Loại chữ | `DS-003` có bảo vệ không |
|---|---|
| Giá trị enum, tên trạng thái, tên trường form mà **người dùng và DB cùng gọi một tên** | ✅ **Có** — cấm đổi |
| Chữ mô tả/tiêu đề tab/câu giải thích chỉ tồn tại trên giao diện | ❌ **Không** — `D-12` thắng |

Ở đây không có mã nghiệp vụ nào tên "Announcement"; `lib/domain/labels.ts` vốn
đã dịch `announcement: "Thông báo chung"` từ trước. Tab bên cạnh cũng đã là tiếng
Việt ("Thông báo của tôi") nên bản cũ lệch ngay trong cùng một dải tab.

---

## `DS-049` — Phase 16 chia task; ba ràng buộc dữ liệu phải chốt trước khi viết migration

**Ngày:** 2026-07-23 (đợt 10) · **Trạng thái:** ACTIVE

Phase 16 chia thành `P16-T0`…`P16-T9` tại [`docs/08-phase-plan.md`](../docs/08-phase-plan.md).
`P16-T8` là chỗ đóng của **cả** `P15-T5b` (M24 nửa Flashcard) và `P18-T7`
(M06 Flashcard Admin) — hai task ⏸ cuối cùng của `uiux-redesign`.

`P16-T0` là **cổng chặn**, đọc từ source ngày 2026-07-23:

1. 🔴 **RLS media liệt kê cứng 3 cột.** `app.can_student_read_flashcard_media()`
   kiểm `p_object_path in (p.front_image_path, p.back_image_path, p.audio_path)`.
   Ảnh của **câu ví dụ** nằm trong `jsonb` → học viên nhận **403**, còn admin xem
   vẫn thấy (đi nhánh policy khác). Đúng mẫu "mỗi bên đều đúng theo tiêu chí của
   chính nó" nên **không spec nào báo đỏ** — cùng hình dạng `UX-UIUX-M25-010`.
   → Đề xuất: `media_paths text[]` do **trigger** tổng hợp + index GIN, policy đổi
   thành `= any(p.media_paths)`. Một đường ghi duy nhất (`BUG_M10_01`).
2. 🔴 **Quy ước đường dẫn chỉ có 3 khe.** `isOwnedFlashcardMediaPath()` khoá regex
   `^(front|back|audio)-<uuid>\.(jpg|png|webp|mp3|m4a)$`; `flashcardUploadRequestSchema`
   giới hạn `.max(3)` file/lượt. Ảnh minh hoạ + ảnh từng câu ví dụ là khe mới.
3. 🟡 **Thẻ từ vựng cần 1 ảnh, schema đang ép 2.** `flashcard_pages_distinct_media_check`
   bắt hai mặt phải khác file — giữ nguyên là ép admin upload 2 ảnh cho 1 thẻ,
   trái mẫu §7ter. Đề xuất `illustration_path` cho `vocabulary`, còn
   `front_image_path`/`back_image_path` chỉ còn của `session_cover`.

⛔ **Đếm dữ liệu thật phải đếm ở CLOUD.** Điều kiện user chấp nhận khi chốt `Q2`
("xoá làm lại") là đếm trước. Local bị `db reset` liên tục nên số 0 ở local
**không chứng minh được gì** — đã đếm local 2026-07-23: `decks=0 · sections=0 ·
pages=0`, và con số đó **không** đủ để cho phép xoá.
