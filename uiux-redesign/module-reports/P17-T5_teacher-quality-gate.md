# P17-T5 — Quality gate liên module Giáo viên (M13 → M19)

| Field      | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Task ID    | `P17-T5`                                                                  |
| Phạm vi    | 13 bề mặt giáo viên thuộc M13, M14, M15, M16, M17, M18, M19               |
| Agent      | Claude                                                                    |
| Ngày       | 2026-07-23 (đợt 7)                                                        |
| Trạng thái | **DONE — chờ xác minh độc lập** (Claude viết code, không tự ghi Verified) |

---

## 1. Bốn quyết định user chốt đầu phiên

| # | Việc | Chốt |
|---|---|---|
| 1 | `UX-UIUX-M18-008` — 5 combobox vô danh, 4 chỗ nằm ở Admin (ngoài `D-27`) | **Sửa cả 5.** Cùng một nguyên nhân gốc, mỗi chỗ chỉ thêm tên gọi được |
| 2 | `UX-UIUX-M18-004` — có chặn sửa đánh giá sau khi gửi không | **Giữ nguyên luật, ghi `FROZEN`.** Đổi nghiệp vụ phải là task riêng ngoài `uiux-redesign` |
| 3 | `UX-UIUX-M19-008` — Vitest flaky | **Điều tra nguyên nhân từng file trước**, không nâng `testTimeout` ngay để khỏi giấu vấn đề thật |
| 4 | M14 đang `IMPLEMENTED — chờ đo` | **Có đo trong gate này** để đóng nợ |

---

## 2. Vì sao cần một lượt soát liên module

Bảy module được làm trong năm task, hai agent. Mỗi task đều xanh theo tiêu chí
của chính nó, nhưng tiêu chí đó **chỉ nhìn màn của mình**. Ba lớp lỗi lọt qua:

1. **Bề rộng nằm giữa hai mốc.** M13/M14/M15 đóng **trước** khi thang
   360/390/430/768/1024/1280 thành chuẩn — ba module này **chưa từng có spec
   responsive nào**.
2. **Lệch nhau giữa các màn.** Cùng một dữ liệu mà màn này hiện đủ, màn kia cắt cụt.
3. **Thứ chỉ lộ khi MỞ dialog** (bài học `UX-UIUX-M18-008`).

---

## 3. Kết quả soát — 5 lỗi thật

| ID | Module | Mức | Bằng chứng đo được | Xử lý |
| --- | --- | --- | --- | --- |
| `UX-UIUX-M13-010` | M13 | **High** | `/teacher` tràn ngang **31px** ở 360px. Phần tử gốc: `div.space-y-5` là **grid item**, `getComputedStyle().minWidth = auto` | `min-w-0` cho hai cột của grid |
| `UX-UIUX-M14-020` | M14 | **High** | `/teacher/classes` tràn **70px** ở 360px và **40px** ở 390px. Thẻ lớp đo được **414px** trong khung 360px — bề rộng **không đổi** giữa hai viewport, tức là bị min-content ghim | `min-w-0` cho grid item `<Link>` |
| `UX-UIUX-M14-021` | M14 | **High** | Dải **8 tab** `/teacher/classes/[id]` cuộn ngang ở 360px nhưng `tabindex=null`, số phần tử Tab tới được bên trong = **1** | `<nav aria-label>` + `tabIndex={0}` + vòng focus |
| `UX-UIUX-M14-022` | M14 | Medium | Tên lớp bị `truncate`: ở 360px ra `VCB — Đàm phán tài chính (Ban Gi…`, mất `(Ban Giám đốc)` / `(Lớp 02)` — đúng phần phân biệt hai lớp cùng khóa | Bỏ `truncate`, cho xuống dòng |
| `UX-UIUX-M00-019` | ALL | **High** — test integrity | **7 spec E2E** hard-code `CLASS_ID = '7dd9b79a-…'`. `seed.sql` insert `public.classes` **không chỉ định `id`** → UUID sinh mới sau **mỗi `db reset`**. Reset xong, cả 7 file **không nạp nổi** | Tra theo `code = 'LOP-02'` (khóa nghiệp vụ ổn định) |

### 3.1 Hai lỗi tràn ngang là **một** nguyên nhân gốc

Không phải hai lỗi bố cục rời rạc. Grid item mặc định `min-width: auto`, tức
**không co được dưới bề rộng min-content** của nội dung. Tên khóa dài và địa chỉ
(`Tại doanh nghiệp · Trụ sở Vietcombank`) đẩy item rộng hơn track.

Kiểm chứng trực tiếp trong trình duyệt trước khi sửa — đặt `min-width: 0` cho mọi
con của grid/flex rồi đo lại:

| Màn | Tràn trước | Sau khi đặt `min-width: 0` |
| --- | --- | --- |
| `/teacher` @360px | **31px** | **0px** |
| `/teacher/classes` @360px | **70px** | **0px** |

Sửa xong đo lại trên code thật: cả hai **0px**.

### 3.2 `UX-UIUX-M00-019` là lỗi nghiêm trọng nhất của lượt này

Nó không làm hỏng giao diện, nhưng nó làm **mọi con số "E2E xanh" của các phiên
trước không tái lập được**: 7 spec đó chỉ chạy trên DB chưa reset. Cùng loại với
`UX-UIUX-M18-007` (smoke test chưa từng thực thi assertion nào).

Phát hiện được vì gate này **reset DB rồi mới chạy**, chứ không chạy nối tiếp
trên DB cũ.

---

## 4. Đã soát và **không** phải lỗi — ghi lại để lượt sau khỏi soát lại

- **`text-xs` trên bề mặt giáo viên: 1 chỗ duy nhất** (`teacher/evaluations/[id]`),
  không phải thông tin nghiệp vụ.
- **Màu thô (`emerald-`/`amber-`/`rose-`…) trên bề mặt giáo viên: 0.** M17 đã dọn hết.
- **Bảng số liệu:** chỉ `/teacher/progress` có `<table>`, và nó đã có `<caption>`
  + `scope` đủ 7 cột từ M19.
- **Landmark:** cả 13 màn đúng một `<main>`, một `<footer>`, một `<h1>`.
- **`SelectTrigger` toàn `src/`: 32 call site, 0 chỗ vô danh** sau khi sửa
  (khớp con số M18 ghi: 32 tổng, 6 vô danh, 1 đã sửa ở M18 + 5 lượt này).

### 4.1 Hai lần suýt báo động giả — cả hai là **lỗi đo**, không phải lỗi sản phẩm

Ghi lại vì đây là bẫy sẽ gặp lại:

| Hiện tượng | Kết luận sai suýt ghi | Sự thật |
| --- | --- | --- |
| `M14 Chi tiết lớp` và `M17 Ngân hàng câu hỏi (thi)` đếm được **`h1=0`** | "Hai màn thiếu `<h1>`" | Cả hai **đều gọi `PageHeader`**, mà `PageHeader` luôn render `<h1>`. Test đếm khi `<main>` (do layout cấp) đã hiện nhưng phân đoạn trang còn đang stream. Sửa **phép đo** (`waitForLoadState("networkidle")`), không sửa sản phẩm |
| axe báo placeholder `<Select>` trong dialog contrast **4.45:1** (`serious`) | "Lỗi tương phản tầng dùng chung, phải sửa token" | Đo **giữa lúc dialog fade-in**. Nền báo `#efefef` thay vì trắng và màu chữ lệch khỏi token thật `--muted-foreground: #5b6b80` chính là dấu hiệu. Chờ `document.getAnimations()` dừng → **sạch** |

Nếu tin lượt đo đầu, lượt này đã sửa nhầm token dùng chung ảnh hưởng toàn app.

---

## 5. `UX-UIUX-M19-008` — Vitest flaky: đã điều tra, **không có file nào là thủ phạm**

Theo đúng quyết định #3 của user: đo trước, không nâng `testTimeout`.

**Đo từng file (chạy riêng 3 file hay đỏ):**

| Test chậm nhất | Thời gian |
| --- | --- |
| `question-wizard-edit` › upload MP3 khi soạn câu mới | **1144ms** |
| `course-form-dialog` › dropdown Loại | 561ms |
| `question-wizard-edit` › nạp lại đáp án cũ | 391ms |
| 7 test còn lại | 18–300ms |

Cách ngưỡng 5000ms tới **4,4 lần**. **Không file nào chậm bất thường.**

**Đo toàn suite ở ba điều kiện:**

| Điều kiện | Kết quả | Wall | `tests` cộng dồn | `environment` cộng dồn |
| --- | --- | --- | --- | --- |
| Máy rảnh | **220/220** | 34,25s | — | 238,40s |
| Chạy song song với Playwright | **220/220** | 49,64s | 42,84s | 379,77s |
| `--maxWorkers=4` | **220/220** | 85,75s | **23,68s** | **135,91s** |

**Kết luận:** máy có **20 CPU** nên Vitest mở tới 20 worker, mỗi worker dựng
riêng một jsdom. `environment` cộng dồn 379,77s so với 49,64s thực tế cho thấy
chi phí nằm ở **dựng môi trường**, không nằm ở assertion. Khi RAM trống chỉ còn
~1GB, các worker tranh nhau và một test 1,1s vượt 5s — đúng kiểu "file đỏ đổi mỗi
lượt".

**Khuyến nghị (chưa áp — user quyết):** giới hạn `maxWorkers` thay vì nâng
`testTimeout`. Số đo cho thấy `--maxWorkers=4` làm **wall chậm hơn** (85,75s) nhưng
thời gian chạy test thực **giảm 45%** (42,84s → 23,68s) — tức mỗi test được nhiều
CPU hơn hẳn, đó mới là thứ tạo khoảng an toàn cho ngưỡng 5000ms. Nâng
`testTimeout` chỉ nới ngưỡng chứ không làm test chạy nhanh hơn.

⚠️ **Không sửa `vitest.config.ts` trong lượt này** — user chọn "điều tra trước".

---

## 6. M14 — đóng hai ô gate còn mở

| Ô gate | Trước | Sau |
| --- | --- | --- |
| Responsive đo bằng trình duyệt thật | ⛔ chưa đo (phiên đó không có Docker) | ✅ đo đủ **6 bề rộng** × 4 màn, Chromium + Pixel 7. Tìm ra **3 lỗi thật** (`M14-020`, `-021`, `-022`) |
| Tốc độ đổi tab sau `DS-024` | ⛔ chưa đo | ✅ đổi tab là điều hướng **phía client** (dấu trên `window` sống sót), không nạp lại tài liệu |

---

## 7. File thay đổi

| File | Thay đổi |
| --- | --- |
| `src/app/(dashboard)/teacher/page.tsx` | `min-w-0` cho 2 cột grid (`M13-010`) |
| `src/app/(dashboard)/teacher/classes/page.tsx` | `min-w-0` cho grid item; bỏ `truncate` tên lớp + tên khóa (`M14-020`, `M14-022`) |
| `src/app/(dashboard)/teacher/classes/[id]/page.tsx` | dải tab `<div>` → `<nav aria-label>` + `tabIndex={0}` + vòng focus (`M14-021`) |
| `src/features/question-bank/components/question-actions.tsx` | thêm `<Label htmlFor>` + `id` cho combobox Chia sẻ (`M18-008`) |
| `src/features/announcements/components/announcement-manager.tsx` | `htmlFor`/`id` cho combobox Nơi nhận (`M18-008`) |
| `src/features/tuition/components/invoice-manager.tsx` | `htmlFor`/`id` cho **3** combobox (`M18-008`) |
| `tests/e2e/teacher-cross-module.spec.ts` | **mới** — 8 bài kiểm liên module |
| 7 × `tests/e2e/*-responsive.spec.ts` | tra lớp theo `code` thay vì UUID ghim (`M00-019`) |

**Không đổi:** query · server action · RPC · RLS · Storage · route · phân quyền ·
validation · công thức · nhãn nghiệp vụ. **Không có migration.**

---

## 8. Kiểm chứng

| Hạng mục | Kết quả |
| --- | --- |
| Lint | ✅ |
| Type-check | ✅ |
| Build | ✅ |
| Vitest | **220/220** (62 file) — xanh ở **cả 4 lượt** chạy trong phiên |
| Spec gate mới `teacher-cross-module` | **16/16** (Chromium 8 + Pixel 7 8) |
| Full E2E | **127/138** (50,1 phút) — xem phân tích 11 đỏ bên dưới |

**11 test đỏ của lượt full đã truy từng cái, không gộp chung:**

| Nhóm | Số | Kết luận | Bằng chứng |
| --- | --- | --- | --- |
| Timeout 90s ở `page.goto` | 6 | **Không phải lỗi sản phẩm** — máy kiệt RAM (còn **0,35 GB** sau 50 phút chạy) | Chạy lại đúng các spec đó trên máy rảnh: **19/21 trong 2,0 phút**. Chromium chạy y hệt assertion đó thì xanh; chỉ project `mobile` (chạy sau) đỏ |
| Lỗi spec, **đã sửa** | 3 | `phase7-critical-flows` dùng `page.once("dialog")` cho AlertDialog Radix — **đúng `UX-UIUX-M18-007` lặp lại**, nên `issueTuitionInvoiceAction` chưa từng chạy. `admin-accounts.smoke` dùng `.first()` nên trúng ô `<td>` của bảng desktop đang `display:none` ở Pixel 7 (`accounts-view.tsx` render bảng `hidden md:block` + danh sách thẻ `md:hidden`) — **lỗi test, sản phẩm hiển thị đúng** | Chạy lại sau khi sửa: **12/12** cả hai project |
| Còn đỏ | 2 | `assessment-engine.smoke` ở cả hai project = **`UX-UIUX-M00-020`**, lỗi có sẵn từ trước phiên này | Xem §9 |

⚠️ **Chưa chạy lại full suite sau 3 sửa spec cuối** — các con số trên đến từ một
lượt full cộng các lượt chạy lại có mục tiêu. Ghi đúng như đã chạy.

**Cách bắt được `UX-UIUX-M14-022`:** E2E **14/14 xanh** rồi mới **nhìn ảnh chụp**
360px và thấy tên lớp cụt đuôi — đúng bài học `UX-UIUX-M19-007`. Đã khoá lại bằng
assertion **đo bề rộng thật** (`scrollWidth > clientWidth`), vì `toContainText`
không bao giờ bắt được lỗi CSS cắt chữ.

---

## 9. Còn lại sau task này

- ⛔ **`UX-UIUX-M00-020` — CHƯA SỬA.** `assessment-engine.smoke.spec.ts:62` bấm
  "Tạo câu hỏi" rồi đòi ngay `getByLabel("Tiêu đề nội bộ")`, nhưng
  `question-wizard.tsx` là wizard **4 bước** và ô đó chỉ có ở **bước 3**; nút lưu
  nay là **"Lưu & công bố"** chứ không phải `"Lưu & sẵn sàng"` spec chờ.
  `git status` xác nhận **cả spec lẫn wizard đều là code đã commit** — hỏng từ
  trước phiên này, nên mọi assertion phía sau (gồm câu đọc DB kiểm
  `status='ready'`) **chưa từng chạy**. Không sửa vì phải đọc lại `submit()` xem
  wizard thật sự ghi `status` nào rồi mới viết được assertion đúng; viết vội thì
  lại đúng cái bẫy "test xanh mà không kiểm gì".

- Cả M13→M19 **chờ xác minh độc lập** — Claude viết phần lớn code nên không tự
  ghi Verified.
- `UX-UIUX-M18-004` — `FROZEN` theo quyết định user; mở lại thành task nghiệp vụ
  riêng nếu cần.
- `UX-UIUX-M19-008` — đã có số đo và khuyến nghị, **chờ user quyết** có giới hạn
  `maxWorkers` không.
- Admin M01–M12 và M28 vẫn tạm dừng theo `D-27`; lượt này chỉ chạm 4 combobox ở
  M10/M11 đúng theo quyết định #1, **không** mở lại thiết kế hai module đó.
