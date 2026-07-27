# Bug report — Phase 16 Flashcard

## `BUG-P16-001` — Flashcard seed/E2E ghim UUID sinh động của Course

- Phát hiện: Codex, xác minh độc lập Phase 16, 2026-07-24.
- Severity: **High** — chặn dựng môi trường sạch và làm bằng chứng E2E không tái lập được.
- Phạm vi: `P16-T9`, M22/M06, test infrastructure.
- Trạng thái: **VERIFIED độc lập bởi Claude — 2026-07-24 (đợt 15).** Dựng lại đúng repro trên DB sạch: `db:reset → db:seed:dev` **exit 0, hết FK error**; UUID cũ `7f1469bc…` không còn trong `seed.dev.sql` lẫn E2E (chỉ còn ở bug report + regression test làm giá trị cấm); seed tra `courses.code='VCB-BANK'`. Regression `flashcard-seed-stability.test.ts` là guard tĩnh thật (Vitest 256/256). flashcard E2E **32/32** (Chromium 16 + Pixel 7 16) trên DB reset+seed. pgTAP toàn bộ **460/460** trên DB sạch. Người sửa (Codex) ≠ người xác minh (Claude) — đúng mô hình hai-agent.

### Cách tái tạo trước khi sửa

1. Chạy `npm run db:reset`.
2. Chạy `npm run db:seed:dev`.
3. Seed dừng tại `supabase/seed.dev.sql:285`:

```text
ERROR: insert or update on table "flashcard_decks" violates foreign key constraint
DETAIL: Key (course_id)=(7f1469bc-900b-405a-9e4e-501cd4c23c67) is not present in table "courses".
```

DB sạch đo được Course `VCB-BANK` có một UUID khác. `seed.sql` không chỉ định
`courses.id`, nên Postgres sinh UUID mới sau mỗi reset. Cùng UUID cũ còn bị ghim
trong URL của `tests/e2e/flashcard-responsive.spec.ts`; vì vậy con số E2E cũ chỉ
tái lập được trên đúng database chưa reset.

### Mong đợi

`db:reset → db:seed:dev` phải chạy được trên mọi DB sạch. Seed và E2E phải tra
Course bằng khóa nghiệp vụ ổn định `courses.code = 'VCB-BANK'` theo `DS-040`.

### Nguyên nhân gốc

Phase 16 tái đưa vào đúng lớp lỗi `UX-UIUX-M00-019`: ghim UUID của một hàng do
seed sinh động, dù repo đã có quyết định `DS-040` cấm cách này.

### Bản sửa

- `supabase/seed.dev.sql`: lấy `course_id` bằng subquery theo code `VCB-BANK`.
- `tests/e2e/flashcard-responsive.spec.ts`: `requiredCourseId("VCB-BANK")` tra
  ID ở runtime trước khi mở trang quản trị.
- `tests/unit/flashcard-seed-stability.test.ts`: khóa tĩnh hai bề mặt, chặn UUID
  cũ quay lại và bắt buộc khóa nghiệp vụ.

Xem số đo sau sửa tại `07-fix-report.md`. Người sửa không tự ghi Verified.

---

## `BUG-P17-002` — Trang QR `/t/<mã>`: mất hẳn nút mũi tên ▶ trên điện thoại

- Phát hiện: **user**, trên máy thật (Chrome Android, màn 1080px), 2026-07-25, kèm ảnh chụp.
- Severity: **High** — học sinh không lướt tiếp được bằng nút; chỉ còn cử chỉ vuốt, mà cử chỉ vốn được thiết kế là đường **bổ sung** chứ không phải đường duy nhất (`gesture-alternative`).
- Phạm vi: `P17-T1`, M22, trang công khai (không ảnh hưởng màn học viên / Quản trị).
- Trạng thái: **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 24). Claude là người sửa nên **không tự ghi Verified**.

### Cách tái tạo trước khi sửa

1. Mở `/t/qr7dem3k5np2` ở viewport rộng **360px**.
2. Bấm "Thẻ tiếp theo" một lần → sang thẻ 2, tức thẻ **có audio**.
3. Đo nút "Thẻ tiếp theo": `boundingBox().x + width` = **`488.1875`** trong màn `360px`.

Nút nằm ngoài màn 128px và bị `overflow-hidden` của khung ngoài cắt đứt. Thẻ 1
(trang mở đầu, `audio_path = null`) **không** tái hiện được lỗi — đó là lý do nó
sống sót qua nghiệm thu: trình phát chỉ dựng ra khi thẻ có audio.

### Nguyên nhân gốc

Thanh điều khiển xếp bốn thứ vào MỘT hàng `flex`: `[◀] [Lật thẻ] [StudentAudioPlayer] [▶]`.
`StudentAudioPlayer` không phải một nút — nó là khối `flex-wrap` gồm nút phát
`min-w-32`, chữ "Tốc độ" và ba nút `min-w-16`, rộng tối thiểu ~390px và **không co
nhỏ hơn được**. Hai nút mũi tên mang `shrink-0`, "Lật thẻ" đã co hết cỡ, nên phần
dư tràn sang phải.

### Bản sửa

- `public-flashcard-reader.tsx`: thanh điều khiển thành **hai hàng** — audio ở
  trên, `[◀] [Lật thẻ] [▶]` ở dưới (CTA chính sát đáy, chỗ ngón tay với dễ nhất).
  Mũi tên `size-12` (48px ≥ 44px) trên điện thoại, `sm:size-14` như cũ.
- `student-audio-player.tsx`: thêm `density?: "comfortable" | "compact"`. `compact`
  bỏ `min-w` nút phát, thu ba nút tốc độ về 44px và **ẩn chữ "Tốc độ"** — `role="group"`
  vẫn giữ `aria-label` "Tốc độ phát …" nên trình đọc màn hình không mất gì. Mặc
  định là `comfortable`, nên **màn học viên không đổi một pixel**.

---

## `BUG-P17-003` — Trang QR `/t/<mã>`: trang mở đầu (thẻ 1) TRẮNG TINH

- Phát hiện: **user**, cùng lượt với `BUG-P17-002`, kèm ảnh chụp.
- Severity: **High** — thẻ đầu tiên học sinh thấy sau khi quét mã là một trang trắng; ấn tượng đầu là "sản phẩm hỏng".
- Phạm vi: `P17-T1`, M22, chỉ trang công khai (`kind = 'session_cover'`).
- Trạng thái: **FIXED, chờ xác minh độc lập** — Claude 2026-07-25 (đợt 24).

### Cách tái tạo trước khi sửa

1. Mở `/t/qr7dem3k5np2` (thẻ 1 của seed là `session_cover`).
2. Đo `[data-face-side="front"]`: chiều cao = **`2px`**.

Đúng hai đường viền 1px của thẻ — chính là đường kẻ mảnh trong ảnh user gửi.
**Không phải lỗi tải ảnh:** URL vẫn được ký, `<img>` vẫn có `src`; nó chỉ nằm
trong một cái hộp cao 0px.

### Nguyên nhân gốc

Trang mở đầu là mặt thẻ duy nhất còn dựng bằng ẢNH (chốt `Q5`), và `next/image`
với `fill` là `position:absolute` — **không đẩy được chiều cao nào**. Chiều cao
vốn đến từ `--fc-face-min-h` (360/560px ở màn học viên và Quản trị), nhưng trang
công khai **cố ý** đặt biến đó về `0px`: sàn cứng 360px là thứ làm vỡ máy màn
ngắn và chế độ nằm ngang. Hai quyết định đúng riêng lẻ, gặp nhau thành lỗi.

### Bản sửa

- `flashcard-face.tsx`: khung ảnh mang `data-fc-image-face` làm mỏ neo (không neo
  theo cấu trúc DOM `div > img` — hỏng ngay lần ai đó bọc thêm một lớp).
- `public-flashcard.css`: `aspect-ratio: 4 / 5` + trần `max-height: 55dvh` cấp lại
  chiều cao. Chọn `aspect-ratio` chứ không phải `min-height` cứng vì nó **giữ chỗ
  sẵn theo bề rộng** ⇒ CLS = 0; trần `dvh` là vế chống vỡ máy màn ngắn và nằm
  ngang (667×375: thẻ rộng 576px mà trần chỉ 206px nên vẫn nằm trọn trong màn).
  Kèm `object-contain` **chỉ trong `.fc-frame`** để không cắt chữ trên trang dạy
  học — phần dư là nền trắng của thẻ nên nhìn ra thành khoảng đệm.
- ⚠️ Tỉ lệ `4/5` là **phỏng đoán**: kích thước thật của ảnh trang mở đầu không
  biết được lúc build. Ảnh lệch tỉ lệ sẽ có dải nền trắng ở hai đầu — không cắt
  nội dung. Muốn phủ kín thì phải chốt một tỉ lệ chuẩn cho ảnh trang mở đầu.

### 🔴 Bài học chung của cả hai bug: bài kiểm cũ không sai, nó đo sai thứ

`tests/e2e/public-flashcard.spec.ts` đã có bài "không cuộn ngang" ở đủ **6 bề rộng
điện thoại** và **vẫn xanh suốt** trong khi nút ▶ mất hẳn — vì khung ngoài có
`overflow-hidden` nên phần tràn bị **cắt** chứ không sinh cuộn ngang, và
`scrollWidth` vẫn bằng `clientWidth`. Bài "media được ký" thì soi `src` của `<img>`
nên không thể thấy ảnh đang nằm trong một cái hộp 0px.

**Đo bố cục phải đo toạ độ/kích thước của chính phần tử** (`boundingBox()`), chứ
không đo `scrollWidth` của tài liệu. Hai bài mới đã bổ sung đúng hai phép đo đó,
và kiểm ngược cho ra đúng hai con số user nhìn thấy: `488.1875` và `2`.

> 📌 **Ghi chú tên lớp CSS (đợt 25):** hai bug trên sửa trong khối `.fc-public` của `src/app/(public)/public-flashcard.css`. Đợt 25 khối đó đổi tên thành **`.fc-frame`** và chuyển về `src/app/globals.css` để màn Ôn tập của học viên dùng chung khung đọc thẻ. Luật không đổi, chỉ đổi tên và chỗ ở — văn bản trên đã cập nhật theo tên mới.
