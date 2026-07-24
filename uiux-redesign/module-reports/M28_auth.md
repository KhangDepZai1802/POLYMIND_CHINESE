# M28 — Xác thực & trang gốc

| | |
| --- | --- |
| **Task** | `P18-T1` |
| **Ngày** | 2026-07-23 (đợt 8) |
| **Agent** | Claude — **là người sửa, KHÔNG tự ghi Verified** |
| **Bề mặt** | `/login` · `/forgot-password` · `/reset-password` · `/accept-invite` · `/` |
| **Ràng buộc** | Không đổi query · server action · RPC · RLS · route · phân quyền · validation · nhãn nghiệp vụ |

---

## 1. Phạm vi thật sự có gì

`03_UIUX_MODULE_INVENTORY.md` ghi M28 có **5 màn**. Đọc source thì:

| Màn | Dòng | Ghi chú |
| --- | ---: | --- |
| `/login` | 23 + `login-form.tsx` | |
| `/forgot-password` | 10 + `forgot-password-form.tsx` | |
| `/reset-password` | 10 + `reset-password-form.tsx` | |
| `/accept-invite` | 22 | dùng lại `ResetPasswordForm`, chỉ đổi chữ |
| `/` (trang gốc) | **11** | **`redirect("/login")`, không render giao diện nào** |

**Trang gốc là `N/A` có bằng chứng**, không phải bỏ sót: `RootPage` chỉ có một câu `redirect`. Ghi rõ trong `tests/e2e/auth-responsive.spec.ts` để phiên sau không đi tìm.

---

## 2. Baseline đo được TRƯỚC khi sửa

Chromium + Pixel 7, 6 bề rộng 360/390/430/768/1024/1280, axe `wcag2a/2aa/21a/21aa`.

```
=== cả 4 màn ===
axe vi phạm: 0
heading: ["H1:POLYMIND CHINESE"]          ← giống hệt nhau ở CẢ BỐN màn
landmark: {"main":0,"footer":1}           ← không màn nào có <main>
ngoài landmark: [DIV.card, DIV.card-header, FORM.space-y-4]
tràn ngang: 0px ở cả 6 bề rộng
```

```
=== trạng thái lỗi /login ===
focus TRƯỚC khi bấm Đăng nhập : INPUT#password
focus SAU khi hiện lỗi        : BODY          ← mất tiêu điểm
số lần Tab để quay lại ô mật khẩu : 5
aria-invalid trên ô nhập      : null
giá trị #identifier sau lỗi   : ""            ← mất chữ đã gõ
```

Cỡ chữ đo được: `"Chưa có tài khoản?…"` **12px** · `"Ít nhất 8 ký tự."` **12px**.
Link `"Quên mật khẩu?"` đo được **111×20px** trên desktop.

---

## 3. Bảy lỗi thật

| # | ID | Mức | Lỗi | Bằng chứng |
| --- | --- | --- | --- | --- |
| 1 | `UX-UIUX-M28-001` | 🔴 High | **Không màn nào có landmark `<main>`**; `<form>` nằm ngoài mọi landmark | `main: 0` ở cả 4 màn. Khu đã đăng nhập có `<main>` từ lâu — auth bị bỏ sót |
| 2 | `UX-UIUX-M28-002` | 🔴 High | **Cả 4 màn dùng chung một `<h1>`** "POLYMIND CHINESE"; tên màn thật là `<div>` | Điều hướng bằng heading nghe y hệt nhau ở 4 trang khác nhau. `CardTitle` mặc định là `<div>` |
| 3 | `UX-UIUX-M28-003` | 🔴 High | **Tiêu điểm biến mất sau khi submit lỗi** → phải bấm **5 lần Tab** mới quay lại ô mật khẩu | `INPUT#password` → `BODY`, đo ở cả 2 project. Nguyên nhân: nút gửi `disabled={isPending}`, trình duyệt không giữ tiêu điểm trên phần tử vừa disabled, và không tự trả lại |
| 4 | `UX-UIUX-M28-004` | 🟡 Medium | **Form xoá sạch tên đăng nhập sau mỗi lần sai mật khẩu** | React 19 gọi `form.reset()` sau mỗi form action. **Đã kiểm chứng ngược bằng `git stash`: code gốc cũng mất → lỗi có sẵn, không phải hồi quy** |
| 5 | `UX-UIUX-M28-005` | 🟡 Medium | Link "Quên mật khẩu?" cao **20px** trên desktop, hụt ngưỡng 24px của WCAG 2.5.8 AA (`DS-034`) | Trên Pixel 7 luật `pointer: coarse` đã nâng sẵn 44px nên chỉ hỏng ở chuột |
| 6 | `UX-UIUX-M28-006` | 🟡 Medium | `"Ít nhất 8 ký tự."` là **12px** và **không ô nhập nào `aria-describedby` trỏ tới** | Trình đọc màn hình đọc tới ô mật khẩu là không nghe yêu cầu. `/student/profile` đã làm đúng từ M27 → hai chỗ cùng loại thông tin, hai cách xử lý |
| 7 | `UX-UIUX-M28-007` | 🟡 Medium | Ô nhập không có `aria-invalid` khi lỗi; ô tên đăng nhập thiếu `autoCapitalize="none"` | Bàn phím di động viết hoa "gv.an" thành "Gv.an". Server đã `.toLowerCase()` nên đăng nhập vẫn chạy — vấn đề là người dùng tưởng mình gõ sai |

---

## 4. Đã đo, KHÔNG phải lỗi — ghi ra để không ai đi sửa nhầm

| Nghi vấn | Kết quả đo |
| --- | --- |
| **Tương phản chữ trên nền gradient** | **Suýt báo động giả.** Tính từ hai đầu gradient ra **4.05:1** (hụt AA) cho `text-white/70`. Nhưng đo **điểm ảnh thật sau chữ** (ẩn chữ → chụp → lấy pixel → giải mã PNG bằng chính Chromium): nền là `rgb(18,75,138)` chứ không phải `#1a5fa8`, vì chữ nằm giữa trang còn đầu sáng của gradient ở góc dưới-phải. Kết quả thật: tagline **5.18:1**, footer **4.64:1** và **5.53:1**, `h1` **8.87:1** — **tất cả đạt AA** |
| axe ở cả 4 màn, kể cả lúc có lỗi | **0 vi phạm** trước và sau khi sửa |
| Tràn ngang | **0px** ở cả 6 bề rộng, cả trước và sau |
| Bẫy `justify-center` + `min-h-screen` ở màn ngang | Đo 740×360: `maxScroll` 239–349, `logoTop` 27 → **cuộn được, không bị cắt** |
| `Alert` có đọc lên không | **Có** `role="alert"` sẵn từ trước — lỗi vẫn được trình đọc màn hình thông báo, chỉ mất tiêu điểm |
| Footer 12px | Là component dùng chung với khu đã đăng nhập, **giữ nguyên** — không sửa lệch một bên |
| `loginIdentifierToEmail` | Đã `.trim().toLowerCase()` → viết hoa không làm sai đăng nhập |

---

## 5. Đã sửa gì

**File mới**
- `src/components/ui/password-input.tsx` — ô mật khẩu có nút hiện/ẩn. `fieldLabel` là **bắt buộc trong kiểu dữ liệu**: màn Đặt lại mật khẩu có hai ô, nhãn cố định sẽ tạo hai nút icon **trùng tên gọi được** — đúng lỗi `UX-UIUX-M18-003`. Chặn bằng kiểu dữ liệu, cùng cách `native-select.tsx` bắt buộc `id`.
- `src/features/auth/components/auth-form-feedback.tsx` — khối thông báo có trả lại tiêu điểm. Bám theo chuyển trạng thái `isPending: true → false`, **không** bám theo nội dung thông báo: câu lỗi đăng nhập là chuỗi cố định (`GENERIC_LOGIN_ERROR`), nếu bám theo chuỗi thì từ lần sai thứ hai effect không chạy lại và tiêu điểm lại mất.
- `tests/e2e/auth-responsive.spec.ts` — **32/32** (Chromium 16 + Pixel 7 16).

**File sửa**
- `src/app/(auth)/layout.tsx` — thêm `<main>`; hạ `<h1>` thương hiệu xuống `<p>` (`DS-042`).
- `login-form.tsx` / `forgot-password-form.tsx` / `reset-password-form.tsx` — `CardTitle asChild` → `<h1>` tên màn; `AuthFormFeedback`; `aria-invalid`/`aria-describedby`; `text-xs` → `text-sm`; ô tên đăng nhập có điều khiển để giữ giá trị; `autoCapitalize`/`autoCorrect`/`spellCheck`.

---

## 6. Hai lỗi do CHÍNH đợt này gây ra, test bắt được trước khi giao

1. **Nút hiện/ẩn ban đầu đặt nhãn cố định "Hiện mật khẩu"** → hai nút trùng tên trên màn Đặt lại mật khẩu. Chính `getByLabel("Mật khẩu")` khớp 2 phần tử mới lộ ra. Sửa bằng `fieldLabel` bắt buộc.
2. **`min-h-6` cho link "Quên mật khẩu?" làm hụt touch target trên Pixel 7** — 44px tụt còn **24px**. Nguyên nhân đo được: khối `@media (pointer: coarse)` nằm trong `@layer base`, class Tailwind nằm ở `@layer utilities`, **layer sau thắng bất kể độ đặc hiệu**. Sửa bằng `py-1` (padding, không đụng `min-height`) để `globals.css` vẫn là nơi duy nhất ép 44px, đúng kiến trúc `DS-013`.

---

## 7. Việc kéo theo ngoài phạm vi

- **21 chỗ `getByLabel("Mật khẩu")` ở 19 spec** phải thành `{ exact: true }`: nhãn nút hiện/ẩn chứa chữ "mật khẩu" nên locator lỏng khớp 2 phần tử. Đây là locator lỏng chứ không phải "sửa test cho xanh" — cùng bài học `UX-UIUX-M18` và `DS-038`. Ghi `DS-041`.
- **`brand-logo-responsive.spec.ts`** đòi `<h1>POLYMIND CHINESE</h1>`. Đã đổi sang kiểm **chữ thương hiệu vẫn đọc được** (điều bài đó thật sự canh, vì `alt=""` chỉ hợp lệ khi có chữ) và thêm kiểm `<h1>` nay là tên màn.
- **`question-wizard.tsx`** — hai nhãn "Nội dung câu hỏi" và "Giải thích" lơ lửng, không nối vào ô nhập nào. Chỉ thêm `htmlFor`/`id`, cùng loại với 4 chỗ Admin user đã duyệt ở `P17-T5`.

---

## 8. Completion gate

| Mục | Kết quả |
| --- | --- |
| Mọi màn trong phạm vi | ✅ 4 màn + `/` ghi N/A có bằng chứng |
| Responsive 3 tầng | ✅ 6 bề rộng × 2 project |
| Keyboard focus | ✅ có bài khoá riêng |
| Không đổi nghiệp vụ/API/route/DB/quyền/validation/nhãn | ✅ |
| Lint | ✅ |
| Typecheck | ✅ |
| Vitest | ✅ **220/220** |
| Build | ✅ |
| E2E M28 | ✅ **32/32** |
| Spec liên quan chạy lại | ✅ `accessibility-responsive` · `brand-logo` · `student-profile` · `teacher-progress` · `phase7-critical-flows` · `admin-accounts` · `assessment-engine` — **74/74** |
