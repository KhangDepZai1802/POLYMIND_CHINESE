# P18 — Khu Quản trị (UIUX-M01 → M12)

> Đợt 9 · 2026-07-23 · Claude · `P18-T2` … `P18-T14`
> Trạng thái: **DONE — chờ xác minh độc lập** (Claude viết toàn bộ code đợt này nên **không tự ghi Verified**).

---

## 0. Bốn quyết định user chốt đầu phiên (`DS-044`)

| # | Câu hỏi | User chốt |
|---|---|---|
| 1 | Mức redesign khu Quản trị | **Dựng lại bố cục thật sự** theo hướng bảng điều khiển mật độ cao. Không dùng Learning Journey Bento / palette `student-*` (`D-30`) |
| 2 | Bảng nhiều cột trên điện thoại | **Cuộn ngang + ghim tiêu đề**, KHÔNG nhân đôi giao diện thành thẻ |
| 3 | Gặp lỗi nghiệp vụ thật | **Sửa luôn** nếu dựng lại được lỗi + có số đo, kèm test khoá |
| 4 | Bộ E2E đầy đủ (~50 phút) | **Chạy một lượt ở cuối** (`P18-T14`); trong lúc làm chỉ chạy spec liên quan |

Yêu cầu nguyên văn: *"LÀM LIÊN TỤC CHO XONG LUÔN"* → không dừng hỏi giữa chừng.

---

## 1. ⚠️ Một chỗ làm KHÁC điều đã hứa, có lý do đo được

User chọn "cuộn ngang, **có tiêu đề dính**", và câu hỏi của Claude mô tả đó là **hàng tiêu đề** luôn nhìn thấy. **Không làm được hàng tiêu đề, và đã đo trước khi xây thay vì hứa suông:**

| Đo gì | Kết quả |
|---|---|
| `overflow-x: auto` → `overflow-y` tính ra | `auto` (CSS ép trục còn lại thoát khỏi `visible`) |
| `clientHeight` vs `scrollHeight` của vùng bọc | **820 = 820** → không có chỗ trống để dính |
| `<thead position:sticky; top:0>` sau khi cuộn trang 600px | `top: **-199px**` → **trôi hẳn khỏi khung nhìn** |
| Cột đầu `sticky; left:0` sau khi cuộn ngang 400px | mép trái ô = **1px** so với mép vùng **0px** → **dính đúng** |

Nghĩa là: bọc bảng trong vùng cuộn ngang thì hàng tiêu đề **về nguyên tắc** không dính được nếu không tạo thêm một vùng cuộn dọc lồng bên trong (mà đó lại là thứ gây rối cuộn trang).

→ Đã ghim **cột định danh** (Mã / Họ tên) thay vì hàng tiêu đề. Với bảng cuộn **ngang**, cột định danh mới là thứ giữ cho người dùng biết đang đọc dòng của ai — đúng nhu cầu thật. **Cần user xác nhận lại chỗ này.**

---

## 2. Bề mặt thật: 13 màn

`/admin` · `/admin/students` · `/admin/teachers` · `/admin/courses` · `/admin/courses/[id]` · `/admin/classes` · `/admin/classes/[id]` · `/admin/schedule` · `/admin/tuition` · `/admin/reports` · `/admin/question-bank-review` · `/admin/notifications` · `/admin/system`

⏸ **M06 Flashcard (Admin) hoãn** tới sau Phase 16 (`DS-043`, cùng lý do `DS-028`).

---

## 3. Baseline đo bằng trình duyệt TRƯỚC khi sửa

Harness đo 13 màn × 6 bề rộng × 2 project (Chromium + Pixel 7), theo ba luật đo của `DS-038`.

| Màn | Tràn ngang @360 | `<h2>` | Chữ <14px | axe |
|---|---|---|---|---|
| `/admin` | **127px** (97@390, 57@430) | **0** | 33 | 0 |
| `/admin/students` | 0 | **0** | 24 | 0 |
| `/admin/teachers` | 0 | **0** | 13 | 0 |
| `/admin/courses` | 0 | 2 | 37 | 0 |
| `/admin/courses/[id]` | **106px** | **0** | 16 | **1 serious** |
| `/admin/classes` | 0 | **0** | 16 | 0 |
| `/admin/classes/[id]` | **193px** | **0** | 24 | 0 |
| `/admin/reports` | **93px** | **0** | 4 | **1 serious** |
| `/admin/notifications` | 0 | **0** | 4 | **1 serious** |
| `/admin/system` | 0 | **0** | 24–44 | 0 |

**Kết luận đắt nhất của baseline: `<h2>` = 0 trên 12/13 màn.** Người dùng trình đọc màn hình không có mốc nào để nhảy giữa các khối trong toàn bộ khu Quản trị.

---

## 4. Chín lỗi thật, đều có bằng chứng chạy được

### 4.1 🔴 Bản điện thoại **giấu mất dữ liệu** — 6 bảng, không bài kiểm nào bắt được

Sáu bảng dựng **hai giao diện** (`hidden md:block` + `md:hidden`) và hai bản đã **trôi khác nhau ở chỗ mất dữ liệu**:

| Màn | Cột bản điện thoại **bỏ hẳn** |
|---|---|
| Học viên | **email**, **người giám hộ** (tên + điện thoại) |
| Giáo viên | **số điện thoại**, **chuyên môn** |
| Khóa học | **học phí**, **số buổi** |
| Lớp học | **ngày khai giảng** |
| Quản trị (tài khoản) | **mã**, **số điện thoại** |

Trên điện thoại, quản trị viên **không có cách nào** đọc được email học viên hay tra giá khóa học. Mỗi bản đều "đúng" theo tiêu chí của chính nó nên không spec nào báo đỏ — đúng mẫu hỏng `UX-UIUX-M25-010`.

Đây cũng chính là thứ làm `admin-accounts.smoke` đỏ ở `P17-T5` (locator `.first()` trúng bản desktop đang `display:none` trên Pixel 7). Gộp về **một bảng** thì cả lớp lỗi đó biến mất.

### 4.2 🔴 Tương phản tab dưới chuẩn AA — **tầng dùng chung**

`ui/tabs.tsx` dùng `text-foreground/60` cho tab **không** được chọn. axe đo trên nền `bg-muted`:

> `#687689` trên `#edf1f7` = **4.07:1**, cần ≥ 4.5:1 — mức `serious`.

Đúng nguyên nhân gốc `DS-030` / `UX-M00-002`: **opacity modifier phá đúng cái contrast mà token được chọn để đạt**.

⚠️ **Suýt tự lừa mình:** tự tính lại bằng `getComputedStyle` ra **18.52:1** — vì `getComputedStyle` trả về `oklab(... / 0.6)` **chưa trộn nền**, alpha không được áp. Con số của axe (trộn nền thật) mới đúng. Bài học lặp lại lần thứ tư trong dự án: **đo điểm ảnh thật, đừng tính từ token.**

**Vì sao khu học viên không dính:** `/student/class`, `/student/results`… **ghi đè** cả nền (`bg-transparent`) lẫn màu chữ (`text-student-sky-ink`), nên đợt M20–M27 vô tình đi vòng qua lỗi. Đã kiểm chứng: quét axe hai màn học viên **trước khi sửa** → `color-contrast = 0`. Tức lỗi chỉ nổ ở màn dùng **mặc định**, tức khu Quản trị.

Sửa: `text-text-secondary` (token thật) → **6.89:1** trên cùng nền, vẫn nhạt hơn tab đang chọn nên phân cấp không mất.

**Impact map:** 7 file dùng `Tabs`, **0** file dùng `variant="line"`. 4 file học viên/giáo viên có class riêng đè lên nên **không đổi hình**; 2 file Quản trị và `exercise-list.tsx` nhận màu mới.

### 4.3 🔴 Tràn ngang — hai nguyên nhân **khác nhau**, chẩn đoán đầu SAI

Đầu tiên đoán theo mẫu quen (`DS-039` — con grid `min-width:auto`) và **đặt `min-w-0` khắp nơi. Đo lại thì vẫn tràn nguyên 193px / 106px** → chẩn đoán sai, phải đi tìm đúng phần tử:

| Màn | Nguyên nhân thật (đo được) |
|---|---|
| `/admin/classes/[id]` | `<div class="flex shrink-0 flex-wrap">` chứa cụm nút thao tác ghi danh, đo được **516px trong khung 360px**. `shrink-0` và `flex-wrap` **triệt tiêu nhau**: `flex-wrap` cho phép xuống dòng, nhưng `shrink-0` giữ khối ở bề rộng max-content nên **nó không bao giờ xuống dòng thật**. Cùng hình dạng `UX-UIUX-M16-002` |
| `/admin/courses/[id]` | Dải **4 tab** `inline-flex w-fit` đo được **450px trong khung 360px** |
| `/admin` | Đúng là `DS-039` — `min-w-0` sửa được (127 → 0) |

⚠️ **Một bẫy đo của chính mình:** probe đầu chỉ báo `<path>` của SVG, vì `getBoundingClientRect` trên ruột SVG trả toạ độ theo hệ của chính SVG. Đã lọc bỏ SVG rồi mới thấy thủ phạm thật.

⚠️ **Bẫy đo thứ hai:** sau khi bọc vùng cuộn, probe vẫn báo dải tab "tràn" — nhưng đó là **con nằm trong vùng cuộn**, `getBoundingClientRect` trả vị trí chưa bị cắt. Đo lại ở **cấp trang** (`documentElement.scrollWidth`) thì **0px**. Nếu tin lượt đo đầu thì đã đi sửa một thứ không hỏng.

### 4.4 🔴 `/admin/reports` in **thẳng chuỗi ISO** ra màn hình — trái `D-12`

`v_tuition_balance.issue_date` là cột `date`, PostgREST trả `"2026-07-15"`, và trang render `{row.issue_date}` **nguyên xi**. Không ai từng thấy vì **seed không có hóa đơn nào** → bảng luôn rỗng.

Sửa bằng helper mới `formatDateOnly`, **không** dùng `formatDate` — và lý do có số đo:

```
TZ=UTC · America/New_York · Europe/Berlin · Asia/Ho_Chi_Minh → 15/07/2026  ✅
TZ=Pacific/Auckland (+12) · Pacific/Kiritimati (+14)        → 14/07/2026  ❌
```

`formatDate` đẩy chuỗi qua `parseISO` (nửa đêm theo giờ **máy**) rồi đổi sang giờ Việt Nam → máy ở phía đông +07 **lùi một ngày**. Ngày lịch không có múi giờ: hạn hóa đơn 15/07 là 15/07 ở mọi nơi. Đã đổi luôn 4 chỗ khác đang dùng `formatDate` cho cột `date` (`classes.start_date`, `expected_end_date`).

### 4.5 🔴 `scrollable-region-focusable` — vùng cuộn không tới được bằng bàn phím

axe mức `serious` trên `/admin/reports`. Cùng lỗi `UX-UIUX-M19` và `UX-UIUX-M21-009`. Đã gom vào `DataTable`/`ScrollableNav`, và **chỉ gắn `tabIndex` khi vùng thật sự cuộn** (`DS-038` luật 3) — đo bằng `ResizeObserver` nên đúng ở mọi bề rộng.

### 4.6 Chữ dưới 14px mang thông tin nghiệp vụ

`text-xs` (12px) dùng cho mã học viên, tên lớp, email, nhãn tiền, giờ buổi học. Toàn khu giảm từ **~200 chỗ xuống ~90** (phần còn lại là badge/nhãn phụ hợp lệ). Cùng lỗi đã sửa ở M25/M26/M27.

### 4.7 Bảng thiếu `<caption>` và `th[scope]`

Không có `<caption>` nào trong cả khu; **0/4 `th`** ở `/admin` có `scope`. Trình đọc màn hình không ghép được ô dữ liệu với tên cột. `DataTable` nay **bắt buộc `caption` trong kiểu dữ liệu** — quên là lỗi biên dịch, đúng cách `native-select.tsx` bắt buộc `id`.

### 4.8 `<select>` viền gần như vô hình — bản chép thứ 7 và 8

Hai ô lọc ở `/admin/reports` tự dựng `<select>` với `border` (**1.27:1** trên nền trắng) thay vì `border-input` (**3.39:1**), kèm `h-9` lệch 4px so với thang `h-10` của `DS-013`. Đúng chuỗi class đã gom thành `NativeSelect` ở `P17-T1`. Đã thay.

### 4.9 Nhảy cấp heading `h1 → h3`

`/admin/courses/[id]` có `<h1>` rồi nhảy thẳng `<h3>`. Đã sửa thành `<h2>` và **khoá bằng bài kiểm phát hiện nhảy cấp**, không chỉ đếm số lượng.

---

## 5. Ba lỗi do **chính đợt này** gây ra — test/ảnh chụp bắt trước khi giao

1. **`<dl>` sai cấu trúc, hai lần.** Bọc `<dl>` ra ngoài các `Card` thì `<dt>` nằm sâu hai cấp so với `<dl>` → axe báo `definition-list` + `dlitem` mức `serious` (tới **10 node** ở `/admin/reports`). Sửa: **mỗi thẻ tự chứa `<dl>` của riêng nó**, grid bên ngoài là `<div>` thường.
2. **Ô định danh dính không đổi màu theo hàng.** Nền đặc `bg-card` (bắt buộc, nếu không chữ cột sau trôi qua dưới nó) **che mất** màu hover của hàng — nhìn ảnh chụp mới thấy ô đầu còn trắng trong khi cả hàng đã đổi màu. **E2E không bắt được.** Sửa: tô hover ở **từng ô** qua `group-hover`.
3. **Chặng Tab vô nghĩa.** Bọc dải 2 tab ngắn của `/admin/notifications` trong vùng cuộn có `tabIndex={0}` cố định → tạo một chặng Tab không làm gì. Sửa bằng `ScrollableNav` dùng chung, `tabIndex` **có điều kiện**.
5. **Bài kiểm tràn ngang tự nó hỏng.** Bản đầu gộp **13 màn × 6 bề rộng = 78 lượt điều hướng** vào **một** `test()` có ngân sách 90s → hết giờ **ngay cả khi máy rảnh** (đã dừng hẳn suite chạy nền rồi chạy lại, vẫn đỏ). Đó là **bài kiểm hỏng, không phải sản phẩm hỏng** — và bài "đỏ ngẫu nhiên" còn tệ hơn không có bài kiểm (`DS-038`). Tách thành **một bài cho mỗi màn**: mỗi màn có ngân sách riêng, và khi đỏ thì tên bài chỉ thẳng màn nào. Suite đi từ 14 → **40 bài, 40/40 xanh**.

4. **`min-width` đặt quá tay khiến laptop 1280 phải cuộn.** Đặt `min-w-[72rem]` (1152px) cho bảng Khóa học, trong khi vùng nội dung ở viewport 1280 đo được **974px** → bảng cuộn ngang **ngay trên máy phổ biến nhất của quản trị viên**, cột `Trạng thái` và nút xem chi tiết **nằm ngoài màn hình** — đi ngược đúng mục tiêu "mật độ thông tin" của `DS-044`. **E2E không bắt được** vì bài kiểm chỉ hỏi *"có cuộn thì có tới được bằng bàn phím không"*, chứ không hỏi *"ở bề rộng này có **cần** cuộn không"* — lại **chỉ lộ khi nhìn ảnh chụp** (lần thứ hai trong đợt). Sửa: chuẩn hoá mọi bảng về **`min-w-[60rem]` (960px)**; luật là *bảng phải vừa laptop 1280, chỉ cuộn khi hẹp hơn*. Đo lại: **0 bảng cuộn** ở 1280 · 1440 · 1920.

---

## 6. Thành phần dùng chung mới

| File | Vì sao |
|---|---|
| `components/shared/data-table.tsx` | Một cách dựng bảng cho cả khu. Ép 4 thứ từng bị quên: `caption` bắt buộc **trong kiểu dữ liệu**, vùng cuộn tới được bằng bàn phím **chỉ khi thật sự cuộn**, cột định danh dính, `min-width` thật |
| `components/shared/scrollable-nav.tsx` | Cùng luật `tabIndex` có điều kiện cho dải tab. Radix dùng **roving tabindex** nên "bên trong có nút" không cứu được vùng cuộn |
| `lib/dates → formatDateOnly` | Cột `date` **không** đi qua quy đổi múi giờ. Có 6 unit test, trong đó bài quan trọng nhất **đã kiểm ngược**: cài đặt sai bằng `new Date()` → đỏ đúng như mong đợi (`16/07` thay vì `15/07`) |

---

## 7. Kết quả đo LẠI sau khi sửa

| Chỉ số | Trước | Sau |
|---|---|---|
| Tràn ngang `/admin` @360 | 127px | **0px** |
| Tràn ngang `/admin/classes/[id]` @360 | 193px | **0px** |
| Tràn ngang `/admin/courses/[id]` @360 | 106px | **0px** |
| Tràn ngang `/admin/reports` @360 | 93px | **0px** |
| Màn có `<h2>` | 1/13 | **13/13 đạt luật** (màn nhiều khối đều có) |
| axe `serious` toàn khu | 3 | **0** |
| Cột dữ liệu mất trên điện thoại | 10 cột / 5 màn | **0** |
| Bảng phải cuộn ở laptop 1280 | 4/7 (do `min-width` đợt này đặt quá tay) | **0/7** |

---

## 8. Đã test (kết quả THẬT)

- `npm run lint` ✅ · `npx tsc --noEmit` ✅ · **Vitest 226/226** (63 file; baseline 220 → **+6**, không sửa/nới/skip test cũ nào) ✅ · `npm run build` ✅
- **`admin-responsive.spec.ts` mới: 40/40** (Chromium 20 + Pixel 7 20)
- Spec liên quan chạy lại **14/14**: `admin-accounts.smoke` (3+3 — nay xanh cả trên Pixel 7), `accessibility-responsive` (1+1), `student-class-responsive` (1+1), `student-results-responsive` (2+2)
- **Ảnh chụp DPR2** kiểm bằng mắt 6 màn — bắt được lỗi ô dính không đổi màu mà E2E bỏ qua

⛔ **CHƯA CHẠY XONG bộ E2E đầy đủ — ghi thật, không ghi "pass".** Đã khởi động **hai lần** và **dừng cả hai**: lượt đầu vì code còn đổi giữa chừng (kết quả sẽ trộn code cũ/mới, vô nghĩa), lượt hai vì nó tranh tài nguyên với chính các lượt kiểm chứng đang chạy — và tranh tài nguyên là nguyên nhân đã biết gây đỏ giả (`P17-T5`: 6 bài đỏ vì máy còn 0,35 GB RAM). **Đây là nợ, phải chạy một lượt đầy đủ trên máy rảnh trước khi coi `P18-T14` đóng.**

**Không** đổi schema, migration, query, server action, RPC, RLS, Storage, route, phân quyền, validation hay nhãn nghiệp vụ.

---

## 9. Còn treo — cần user quyết

> **Cập nhật 2026-07-23 (đợt 10):** cả ba mục dưới đã được user chốt. Xem
> `DS-047` (ghim cột định danh) và `DS-048` (Việt hoá nhãn).

| ID | Việc | Vì sao không tự làm |
|---|---|---|
| ~~`UX-UIUX-M11-001`~~ | ~~Nhãn **"Announcement"**~~ → ☑ **ĐÃ SỬA (`DS-048`).** User chốt Việt hoá. Soát lại ra **12 chỗ chứ không phải 4** như báo cáo này ghi ban đầu — 6 file, gồm cả thông báo của server action và message của Zod schema. Dùng chữ có sẵn `lib/domain/labels.ts` → "Thông báo chung". Giữ nguyên enum `"announcement"` + tên RPC (đó mới là thứ `DS-003` bảo vệ) | — |
| `UX-UIUX-M14-021` | `/teacher/classes/[id]` dùng `Tabs` mặc định nên **cũng dính lỗi contrast 4.07:1** trước khi sửa; nay đã hết nhờ sửa tầng dùng chung, nhưng dải **8 tab** ở đó chưa dùng `ScrollableNav` | M14 là module **đã đóng**, ngoài phạm vi `P18`. Chỉ ghi nhận |
| ~~—~~ | ~~Xác nhận **ghim cột định danh**~~ → ☑ **USER XÁC NHẬN (`DS-047`, 2026-07-23 đợt 10).** Giữ nguyên cách đợt 9 đã làm, không phải sửa gì | — |

---

## 10. Nợ `P18-T14` đã đóng — full E2E, kết quả THẬT

Chạy `npx playwright test --reporter=list` một lượt trên máy rảnh (đã dừng 7
container Supabase của dự án khác, user duyệt): **`205/210` · 5 đỏ · 25,3 phút**,
exit code **1**. Chạy lại riêng từng bài đỏ: **6/6 xanh**. Hai nhóm khác hẳn nhau:

| # | Bài | Lượt full | Chạy riêng | Kết luận |
|---|---|---|---|---|
| 1 | `admin-responsive › M05 Chi tiết lớp` (chromium) | ✘ `page.goto` hết giờ **90s** | ✅ **9,4s** | **ĐỎ GIẢ** — chênh ~10 lần |
| 2 | `student-review-responsive › Ôn câu sai` (mobile) | ✘ `page.goto` hết giờ **90s** | ✅ **8,4s** | **ĐỎ GIẢ** |
| 3 | `assessment-engine.smoke` (chromium) | ✘ `'Vào phòng chờ'` khớp **2 phần tử** | ✅ **2/2** | rác fixture chéo spec |
| 4 | `student-exams-responsive` (chromium) | ✘ thiếu `"1 sẵn sàng · 1 đang thi"` | ✅ **2/2** | hệ quả của #3 |
| 5 | `student-exams-responsive` (mobile) | ✘ thiếu heading phòng chờ | ✅ | hệ quả của #3 |

⚠️ **Suite CHƯA từng xanh trọn một lượt.** "Chạy riêng thì xanh" chỉ chứng minh
từng bài không hỏng khi đứng một mình — **không** chứng minh suite sạch.

**Nguyên nhân gốc của nhóm 2, đọc thẳng từ source (chắc chắn đúng):**
`assessment-engine.smoke.spec.ts:93` chỉ có `test.afterAll(purge)`, **không có
`beforeAll`**; spec cùng loại `student-exams-responsive.spec.ts:117-118` dọn ở
**cả hai**. Và `playwright.config.ts` **không có `globalSetup`** — mỗi spec chỉ
xoá rác của chính nó, nên rác của spec A vẫn phá spec B. Đây là lý do **một lượt
chạy bị dừng giữa chừng làm hỏng lượt chạy kế tiếp**.

⚠️ **Phần KHÔNG chứng minh được:** giả thuyết "fixture còn sót từ hai lượt chạy
bị dừng ở đợt 9" khớp mọi bằng chứng, nhưng các hàng đó **đã bị xoá** khi suite
chạy xong (`exam_deliveries=0` ngay sau đó) nên **không dựng lại được hiện
trường**. Ghi đúng mức độ chắc chắn, không nâng thành kết luận.

### 🔴 Bài `heading đúng cấp` CHẬP CHỜN — con số `<h2>` của §7 chưa phải kết luận chắc

Lượt kiểm chứng `DS-048` làm lộ bài `heading đúng cấp` báo
`M05 Chi tiết lớp: h2 = 0 dù có nhiều khối` trên **mobile**, ở một màn **không hề
bị đợt 10 sửa**.

⚠️ **Chẩn đoán đầu tiên SAI, đã tự bác bỏ bằng số đo.** Ban đầu kết luận do chạy
`npm run build` trong lúc `next dev` đang phục vụ Playwright (dùng chung `.next`).
Lượt chạy sạch **không có `build` nào** vẫn đỏ đúng chỗ đó → giả thuyết bị bác.

**Số đo thật, cùng một lệnh trên cùng một máy:**

| Lượt | Kết quả |
|---|---|
| chạy riêng lần 1 | ✅ xanh **13,2s** |
| `--repeat-each=3` | ✘ **3/3 ĐỎ** |
| chạy riêng lần 2 | ✅ xanh **27,1s** |
| trong file đầy đủ | ✘ đỏ **cả 2 lượt** |

✅ **Không phải lỗi sản phẩm.** `admin/classes/[id]/page.tsx:107` là
`<h2>Thông tin lớp</h2>` **vô điều kiện** — không sau `md:` nào, không phụ thuộc
dữ liệu. `h2 = 0` nghĩa là **trang chưa render xong lúc đo**.

**Nguyên nhân gốc:** `goToSurface()` (dòng 63–68) chờ `networkidle`, mà
`networkidle` kích hoạt khi **500ms không có request** — và giữa các đoạn stream
của RSC có đúng những khoảng lặng như vậy. Máy càng bận, khoảng lặng càng dễ vượt
500ms → đo lúc `<main>` đã hiện nhưng các `Card` chưa tới.

📌 **Hệ quả cho chính báo cáo này:** `DS-038` luật (1) ("chờ mạng lặng rồi mới
đếm") **chưa đủ**. Vì vậy con số **"13/13 màn đạt luật `<h2>`" ở §7 là đo được
trong điều kiện thuận lợi, chưa phải kết luận chắc** — phải đo lại sau khi đổi
cách chờ sang **chờ nội dung thật** (một section/heading đã biết). **Chưa sửa**,
ghi thành nợ trong `WORKLOG.md`.
