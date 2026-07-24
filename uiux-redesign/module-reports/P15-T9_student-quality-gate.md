# P15-T9 — Quality gate liên module Học viên (M20 → M27)

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Task ID      | `P15-T9`                                                  |
| Phạm vi      | 8 bề mặt học viên M20–M27 (M24 chỉ nửa Ôn câu sai)        |
| Agent        | Claude                                                    |
| Ngày         | 2026-07-22                                                |
| Trạng thái   | **DONE — chờ xác minh độc lập** (Claude viết code, không tự ghi Verified) |

---

## 1. Vì sao cần một lượt soát liên module

Tám module được làm trong bảy task khác nhau, hai agent khác nhau. Mỗi task đều
xanh theo tiêu chí của chính nó, nhưng tiêu chí đó **chỉ nhìn màn của mình và
chỉ đo ba bề rộng 360/768/1280**. Hai lớp lỗi lọt qua được:

1. **Bề rộng nằm giữa hai mốc.** 390 và 430 là iPhone thật đang dùng, 1024 là
   iPad ngang — đúng chỗ `sm:`/`lg:` đổi số cột.
2. **Lệch nhau giữa các màn.** Cùng một mẫu giao diện mà màn này làm đủ, màn kia
   làm thiếu. Không spec nào của từng module bắt được, vì mỗi spec chỉ thấy một
   màn.

Lượt này tìm đúng hai lớp đó, không mở lại thiết kế của từng module.

---

## 2. Kết quả soát

### 2.1 Bề rộng — không tìm thấy lỗi mới

Chạy 8 màn × 6 bề rộng (360 · 390 · 430 · 768 · 1024 · 1280) trên Chromium và
Pixel 7: **không màn nào tràn ngang**, mọi màn đúng một `<h1>` khớp tên màn.
Hai mốc mới 390/430 và 1024 **không lộ thêm lỗi bố cục nào** — kết luận thật,
không phải chưa đo.

### 2.2 Lệch giữa các màn — tìm thấy 2 lỗi thật

| ID              | Mức        | Phát hiện                                                                                                                                                                                                                                             | Xử lý                                                                                             |
| --------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `UX-UIUX-M21-009` | **High**   | `/student/class` — dải 7 tab cuộn ngang ở 360px nhưng **không focus được**. Người dùng bàn phím không tới được ba tab cuối (Chuyên cần, Tài liệu, và một phần Tiến độ). axe `scrollable-region-focusable`. Ba dải tab học viên còn lại đã có `tabIndex={0}` từ trước — **chỉ màn này bị sót** | Thêm `tabIndex={0}` + vòng focus, đúng bằng cách ba màn kia đang làm                              |
| `UX-UIUX-M25-010` | **Medium** | Ô số liệu bento bị chép làm **ba bản** ở `/student`, `/student/results`, `student-tuition-overview.tsx`. Ba bản đã trôi khác nhau ở chỗ người dùng nhìn thấy: chỉ bản Học phí có `tabular-nums` nên cột số của nó thẳng hàng, hai màn kia thì không       | Gom vào `StudentStatCard` dùng chung; lấy **hợp** của cả ba (`tabular-nums` cho mọi ô, `hint` tuỳ chọn) nên không màn nào mất tính năng |

### 2.3 Đã soát và **không** phải lỗi

Ghi lại để lượt sau không mất công soát lại:

- **`text-xs` trên bề mặt học viên: 0.** Đếm trên cả 15 file trong phạm vi
  M20–M27 — `UX-M00-004` đã đóng hết phần học viên.
- **Footer bản quyền (`D-17`) dùng `text-foreground/70`** — đây đúng là mẫu
  `text-<token>/<số>` mà `DS-030` cảnh báo, nên đã đo lại: `#556477` trên
  `--surface-page` = **5.68:1**, dòng trên = **5.11:1**. Cả hai đạt AA. Không
  sửa gì.
- **Landmark:** cả 8 màn đều có đúng một `<main>` và một `<footer>` — do
  `(dashboard)/layout.tsx` cấp, không màn nào ghi đè.
- **`assessment-tabs.tsx` dùng `text-xs`** cho số thứ tự bước — component này
  **của giáo viên** (`/teacher/exercises`, `/teacher/exams`), ngoài phạm vi
  M20–M27. Chuyển sang M16/M17, không sửa lén trong task này.
- **`<nav>` mục lục buổi của Flashcard** (`student-flashcard-reader.tsx`,
  `flashcard-admin-manager.tsx`) cũng cuộn ngang mà không có `tabIndex`. ⛔
  **Không sửa** — Phase 16 sẽ viết lại chính component này (`DS-029`); ghi vào
  danh sách phải kiểm khi làm Phase 16.

---

## 3. File thay đổi

| File                                                | Thay đổi                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/components/shared/student-stat-card.tsx`       | **mới** — ô số liệu bento dùng chung                                     |
| `src/app/(dashboard)/student/page.tsx`              | bỏ bản sao, dùng `StudentStatCard`                                       |
| `src/app/(dashboard)/student/results/page.tsx`      | bỏ bản sao, dùng `StudentStatCard`                                       |
| `src/features/tuition/components/student-tuition-overview.tsx` | bỏ bản sao, dùng `StudentStatCard`                             |
| `src/app/(dashboard)/student/class/page.tsx`        | `tabIndex={0}` + vòng focus cho dải tab cuộn ngang                       |
| `tests/unit/components/student-stat-card.test.tsx`  | **mới** — 5 test, gồm guard nguồn chặn chép lại bản sao                  |
| `tests/e2e/student-cross-module.spec.ts`            | **mới** — 5 test liên module                                             |

**Không đổi:** query · server action · RPC · RLS · Storage · route · phân quyền
· validation · công thức · nhãn nghiệp vụ. Không có migration, không đụng dữ
liệu production.

---

## 4. Kiểm chứng

| Hạng mục                    | Kết quả                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| E2E liên module (mới)       | **10/10** — Chromium 5/5 + Pixel 7 5/5                             |
| Unit `StudentStatCard` (mới) | **5/5**                                                            |
| Vitest toàn bộ              | **209/209** (60 file) — baseline vào phiên 204, **+5**, không sửa/nới/skip test cũ nào |
| Lint                        | ✅                                                                 |
| Type-check                  | ✅                                                                 |
| Build                       | ✅                                                                 |

**Ghi chú về cách bắt được `UX-UIUX-M21-009`:** chạy riêng file spec thì test
axe **xanh**; chạy cả file thì **đỏ**. Nguyên nhân: `next dev` biên dịch route
theo yêu cầu, nên lần đầu vào `/student/class` dải tab chưa dựng xong lúc axe
đo. Tức **lượt chạy riêng mới là lượt sai**, không phải flake của lượt đỏ. Đã
sửa code rồi chạy lại đủ hai project, cả hai xanh.

---

## 5. Còn lại sau task này

- Cả M20→M27 **chờ xác minh độc lập** — Claude viết phần lớn code nên không tự
  ghi Verified.
- `P15-T5b` (M24 nửa Flashcard) vẫn hoãn tới sau Phase 16 (`DS-028`, `DS-029`).
- Hai hạng mục chuyển tiếp: `assessment-tabs.tsx` → M16/M17; `<nav>` mục lục
  Flashcard → Phase 16.
