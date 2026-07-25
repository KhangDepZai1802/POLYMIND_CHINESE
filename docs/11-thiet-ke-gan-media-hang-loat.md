# 11 — Thiết kế: Gắn ảnh mặt trước + audio HÀNG LOẠT cho cả buổi

> **Trạng thái: ĐÃ CÀI ĐẶT** (Claude, 2026-07-24 đợt 18) — `P16-T11a…d` ở
> [`08-phase-plan.md`](08-phase-plan.md), **chờ xác minh độc lập**.
> Ba câu ở §9 đã được user chốt: (1) **tab thứ hai**; (2) **không làm mặt sau**;
> (3) trần 120 file/lượt giữ nguyên.
> ⛔ Migration `…077` **chưa push cloud**.
> **Nguồn yêu cầu:** user 2026-07-24 — *"mỗi lần thêm ghi âm cho tất cả các trang
> trong buổi, tôi phải vào chỉnh sửa từng trang, bấm lưu, đợi thoát ra, rồi vào
> tiếp trang sau"*.
> **Skill dùng để thiết kế:** `ui-ux-pro-max` (miền `ux` — Forms & Feedback,
> Bulk Actions, Progress, Accessibility).

---

## 1. Lời than gốc, dịch sang con số

Một buổi 20 thẻ, muốn gắn audio cho cả 20:

| Bản hiện tại | Số thao tác |
| --- | --- |
| Mở `PageDialog` của thẻ | 20 lần |
| Chọn file audio | 20 lần |
| Bấm Lưu | 20 lần |
| Đợi `createUploadTickets → upload → saveFlashcardPageAction → router.refresh()` | 20 chu kỳ |
| Đóng dialog | 20 lần |
| **Tổng cú bấm** | **≈ 100** |

Bản thiết kế này: **1 lần kéo thả + 1 lần bấm** cho cả buổi.

---

## 2. ⚠️ Ba ràng buộc kỹ thuật ĐỌC ĐƯỢC TỪ SOURCE — thiết kế phải né

Không phải suy đoán; đọc thẳng file, có số dòng.

### 2.1 🔴 Rate limit 20 lượt/giờ — cái bẫy lớn nhất

[`actions.ts:340`](../src/features/flashcards/server/actions.ts#L340) gọi
`consumeRateLimit(supabase, "material_upload")` **một lần cho mỗi LƯỢT GỌI**
action, và [`…034_rate_limits.sql:34`](../supabase/migrations/20260715000034_rate_limits.sql#L34)
đặt `material_upload` = **20 lượt / 3600 giây**.

> **Hệ quả:** nếu bản hàng loạt gọi `createFlashcardUploadTicketsAction` một lần
> cho mỗi thẻ, thì buổi 21 thẻ trở lên **không bao giờ chạy xong** — và admin bị
> khoá upload **cả tiếng đồng hồ**, kể cả đường soạn thẻ thường.

→ **Luật cứng của thiết kế: cả buổi = ĐÚNG MỘT lượt gọi xin vé.** Đây là lý do
phải có action mới chứ không gọi lặp action cũ. Đây cũng là lý do UI phải gom
toàn bộ file trước rồi mới bấm một nút, chứ không thể là "mỗi hàng một nút tải".

### 2.2 🟡 Vé upload hiện tại bị khoá vào MỘT trang

[`schema.ts:202-218`](../src/features/flashcards/schema.ts#L202-L218):
`flashcardUploadRequestSchema` có **một** `pageId` và `.max(MAX_FLASHCARD_UPLOAD_FILES)`
= `3 + 8` = **11 file**. Đường dẫn sinh ở
[`actions.ts:336`](../src/features/flashcards/server/actions.ts#L336) là
`actor/deck/section/**pageId**/slot-uuid.ext`.

→ Cần schema mới cho **nhiều trang trong một lượt**. Quy ước đường dẫn **giữ
nguyên** (mỗi file vẫn nằm trong thư mục trang của nó), nên
`isOwnedFlashcardMediaPath` và policy Storage **không phải sửa một dòng nào**.

### 2.3 🔴 Hai CHECK ở DB sẽ chặn nếu ghi ẩu

- `flashcard_pages_alt_pairing_check` — **có ảnh thì phải có alt**. Xem
  [`actions.ts:451-454`](../src/features/flashcards/server/actions.ts#L451-L454).
  Bản hàng loạt ghi `front_image_path` mà quên `front_alt` sẽ **bị DB từ chối
  toàn bộ**, không phải cảnh báo.
- `flashcard_pages_distinct_media_check` — hai mặt phải là **hai file khác nhau**.

→ Bản hàng loạt **bắt buộc** gọi lại `flashcardAltText({kind, face:"front", hanzi,
meaningVi, sectionTitle})` cho từng thẻ. Không được viết bản sinh alt thứ hai
(`BUG_M10_01`).

---

## 3. Quyết định UI gốc: **tab thứ hai của "Nhập hàng loạt"**, không phải nút mới

Cụm nút của `SectionWorkspace` hiện đã có: *Sửa buổi · Thêm trang · Nhập hàng
loạt · Công bố buổi*. Thêm nút thứ 5 vi phạm hai luật của skill: `primary-action`
(mỗi màn một CTA chính — ở đây là **Công bố buổi**) và `overflow-menu` (hết chỗ
thì gom lại, đừng nhồi).

```
┌ Buổi 3 · Bài 12 — Rau củ            [Bản nháp] ────────────────────────┐
│ 21 trang · trang mở đầu luôn ở vị trí đầu tiên                         │
│                                                                        │
│        [Sửa buổi] [+ Thêm trang] [⭱ Nhập hàng loạt] [ Công bố buổi ]  │
│                                    └─ outline ────┘  └─ CTA chính ──┘  │
└────────────────────────────────────────────────────────────────────────┘
```

Bấm **Nhập hàng loạt** → dialog có **2 tab**:

| Tab | Việc | Trạng thái |
| --- | --- | --- |
| **Danh sách chữ** | dán text → **TẠO** thẻ mới | đã có (`P16-T10b`), giữ nguyên 100% |
| **Ảnh & Audio** | thả file → **GẮN** vào thẻ đã có | **mới** |

Lý do gộp chứ không tách nút: hai việc này là **hai bước liên tiếp của cùng một
quy trình** — dán chữ xong thì đi gắn media. Tab đặt đúng thứ tự đó thì bản thân
giao diện đã dạy người dùng quy trình, không cần chữ hướng dẫn.

> ⚠️ Đánh đổi phải nói rõ: một tab **tạo** thẻ, một tab **sửa** thẻ — hai động từ
> khác nhau dưới một nhãn. Chặn nhầm lẫn bằng câu mô tả ngay dưới mỗi tab
> ("Tạo thẻ mới từ danh sách chữ" / "Gắn file vào **{n} thẻ đã có**").
> Nếu user thấy vẫn rối → phương án B là nút riêng `[🖼 Gắn ảnh & audio]`, đổi
> đúng một chỗ, phần còn lại của thiết kế không phụ thuộc quyết định này.

---

## 4. Trái tim của thiết kế: **ghép file ↔ thẻ**

Thả 40 file vào thì máy phải biết `huluobo.mp3` là của thẻ nào. Ba tầng khoá,
**hit đầu tiên thắng**:

| # | Khoá | Ví dụ tên file | Ghép với |
| --- | --- | --- | --- |
| 1 | **Hán tự** | `胡萝卜.mp3`, `01-胡萝卜.jpg` | `hanzi` khớp đúng |
| 2 | **Pinyin bỏ dấu** | `huluobo.mp3`, `hu-luo-bo.mp3`, `hu_luo_bo.mp3` | `pinyin_syllables` sau khi chuẩn hoá |
| 3 | **Số thứ tự** | `03.mp3`, `03.jpg` | **số hiện trên màn hình** (ô xám bên trái hàng) |

**Khe media suy từ ĐUÔI FILE**, không cần người dùng khai:
`jpg/jpeg/png/webp` → ảnh mặt trước · `mp3/m4a` → audio. Đây là chỗ dùng lại
nguyên `flashcardMediaFormat()` ở [`media.ts:77`](../src/features/flashcards/domain/media.ts#L77),
vốn đã ép **khe và đuôi phải cùng loại**.

> 📌 Quy tắc này chạy được **chỉ vì phạm vi có đúng một khe ảnh** (mặt trước).
> Nếu sau này thêm mặt sau thì phải có hậu tố (`huluobo-sau.jpg`) — và đó chính
> là lý do bản này **cố ý không làm mặt sau**, đúng phạm vi user yêu cầu.

### 4.1 🔴 Trùng khoá → KHÔNG ĐOÁN

Pinyin bỏ dấu có va chạm thật: `是 shì` và `事 shì` cùng ra `shi`. Luật:

> **Một khoá khớp ≥ 2 thẻ, hoặc một thẻ bị ≥ 2 file cùng khe tranh nhau → cả
> đám rơi vào "Chưa khớp", tuyệt đối không gán bừa.**

Gán sai audio cho thẻ là lỗi **im lặng** — admin không nghe lại từng thẻ thì
không đời nào phát hiện, học viên học sai phát âm cả buổi. Fail-closed đúng tinh
thần `AGENTS.md`.

### 4.2 🔴 Số thứ tự: lấy số ĐANG HIỆN, không tự dồn lại

Danh sách admin đánh số gồm cả trang mở đầu (`index + 1` ở
[`flashcard-admin-manager.tsx:833`](../src/features/flashcards/components/flashcard-admin-manager.tsx#L833)),
nên trang mở đầu là số **1** và thẻ từ vựng đầu tiên là số **2**.

Cám dỗ là "dồn lại cho đẹp": coi thẻ từ vựng đầu tiên là số 1. **Không làm.**
Dồn lại thì `01.mp3` của admin (đếm theo thẻ) và `01` của hệ thống (đếm theo
màn hình) lệch nhau đúng 1 → **mọi thẻ nhận nhầm audio của thẻ liền kề**, và
đây lại là kiểu lỗi không ai nhìn thấy. Lấy đúng số đang hiện thì `1.mp3` rơi
vào trang mở đầu và bị từ chối **rõ ràng bằng chữ**:

> *"Số 1 là trang mở đầu — trang mở đầu không nhận audio."*

Lệch **thấy được** luôn tốt hơn lệch **im lặng**.

### 4.3 Sửa tay khi máy ghép sai

Mỗi hàng có nút ✎ mở `Select` liệt kê các file **chưa khớp** cùng khe → gán tay.
Mỗi ô đã gán có nút ✕ để gỡ ra. Luật skill `error-recovery`: đường thoát không
được là *"đổi tên file rồi làm lại từ đầu"*.

---

## 5. Giao diện tab "Ảnh & Audio"

### 5.1 Trạng thái chọn file

```
┌─ Nhập hàng loạt — Buổi 3 · Bài 12 ─────────────────────────────── ✕ ─┐
│  ╭──────────────╮╭──────────────╮                                     │
│  │ Danh sách chữ││ Ảnh & Audio  │  ← tab đang chọn                    │
│  ╰──────────────╯╰──────────────╯                                     │
│  Gắn file vào 20 thẻ đã có trong buổi. Không tạo thẻ mới.             │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │        ⭱   Kéo thả file vào đây,  hoặc  [ Chọn file… ]        │   │
│  │                                                                │   │
│  │   JPG · PNG · WEBP  →  ảnh mặt trước   (mỗi ảnh ≤ 8 MB)       │   │
│  │   MP3 · M4A         →  audio phát âm   (mỗi file ≤ 20 MB)     │   │
│  │                                                                │   │
│  │   Đặt tên file theo Hán tự (胡萝卜.mp3), pinyin không dấu     │   │
│  │   (huluobo.mp3) hoặc số thứ tự đang hiện (03.mp3)             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  38 file · khớp 34 · chưa khớp 4          ☐ Ghi đè media thẻ đã có   │
│                                                                       │
│  ┌─ Bảng đối chiếu ────────────────────────────────────────────────┐ │
│  │ #  Thẻ              Ảnh mặt trước      Audio           Tình trạng│ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │ 2  胡萝卜 hú luó bo  huluobo.jpg   ✎   huluobo.mp3  ✎  Sẽ thêm  │ │
│  │ 3  苹果   píng guǒ   — giữ nguyên      pingguo.mp3  ✎  Sẽ thêm  │ │
│  │ 4  你好   nǐ hǎo     nihao.jpg     ✎   ⚠ đã có         Bỏ qua   │ │
│  │ 5  行     xíng       —                 —               Giữ nguyên│ │
│  │ 6  是     shì        —                 ⚠ trùng khoá    Chưa khớp │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─ 4 file chưa khớp thẻ nào ──────────────────────────────────────┐ │
│  │  • IMG_2931.jpg      [ Gán cho thẻ… ▾ ]                         │ │
│  │  • shi.mp3           trùng khoá với 是 / 事  [ Gán cho thẻ… ▾ ] │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                            [ Huỷ ]      [ Gắn cho 34 thẻ ]           │
└───────────────────────────────────────────────────────────────────────┘
```

**Bảng đối chiếu là bắt buộc, không phải trang trí.** Nó là bản sao đúng của
mô hình đã dùng ở tab "Danh sách chữ" ([`flashcard-import-dialog.tsx:128-177`](../src/features/flashcards/components/flashcard-import-dialog.tsx#L128-L177)):
*dán vào → xem trước từng dòng có trạng thái → mới bấm chạy*. Người dùng đã học
mô hình này một lần rồi; dùng lại đỡ phải học lần hai.

### 5.2 Năm trạng thái, mỗi trạng thái một CHỮ (không chỉ màu)

| Trạng thái | Nghĩa | Tông |
| --- | --- | --- |
| **Sẽ thêm** | thẻ đang trống, có file khớp | `success` |
| **Sẽ thay** | thẻ đã có, và ô Ghi đè đang bật → **xoá hẳn file cũ** | `warning` |
| **Bỏ qua** | thẻ đã có, ô Ghi đè đang tắt | `neutral`, chữ xám |
| **Giữ nguyên** | không file nào khớp | `neutral`, chữ xám |
| **Chưa khớp** | trùng khoá / file không đọc được | `warning` + lý do |

Luật skill `color-not-only`: trạng thái đọc được **bằng chữ**, màu chỉ là phụ.
Và như đã làm ở tab chữ ([dòng 158-162](../src/features/flashcards/components/flashcard-import-dialog.tsx#L158-L162)):
**"Bỏ qua" / "Giữ nguyên" KHÔNG tô đỏ** — chúng là kết quả bình thường, tô đỏ
sẽ đẩy admin đi tìm chỗ hỏng không tồn tại.

### 5.3 🔴 Ô "Ghi đè" MẶC ĐỊNH TẮT

[`actions.ts:588-591`](../src/features/flashcards/server/actions.ts#L588-L591) —
đường lưu hiện tại **xoá hẳn** file cũ khỏi bucket khi trang không còn trỏ tới
nó nữa. Tức **thay = mất vĩnh viễn, không undo được**.

Skill có luật `undo-support`, nhưng ở đây undo là **không thể thực hiện thật** —
làm nút "Hoàn tác" giả sẽ tệ hơn không có. Thay bằng phòng thủ ở đầu vào:

- Mặc định **tắt** → những thẻ đã có media rơi vào "Bỏ qua", không ai mất gì.
- Bật lên → các hàng đó chuyển sang **"Sẽ thay"** tông cảnh báo, và nút xác nhận
  đổi chữ thành **"Gắn cho 34 thẻ · thay 6 file"** — con số đứng ngay trên nút,
  không giấu trong tooltip (`destructive-emphasis`, `confirmation-dialogs`).
- Đúng nhu cầu gốc của user: buổi vừa nhập hàng loạt thì **thẻ nào cũng trống**,
  nên đường mặc định chạy trơn mà không cần chạm vào ô này.

### 5.4 Trạng thái đang chạy và trạng thái kết quả

Dialog **không đóng**, đổi sang màn tiến độ (`progress-indicators`, `loading-states`):

```
│  Đang tải file 14/38…                                                │
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░  37%                         │
│  胡萝卜 ✓   苹果 ✓   你好 ✓   行 ✓   是 ⟳                            │
```

Xong thì thành bảng kết quả:

```
│  ✅ 33 thẻ đã gắn media                                              │
│  ⚠️  1 thẻ lỗi                                                        │
│      行 — tải file thất bại (mất kết nối)      [ Thử lại 1 thẻ ]     │
```

### 5.5 🔴 Nguyên tử theo TỪNG THẺ, không theo cả lô

Đường một thẻ hiện tại ([`flashcard-admin-manager.tsx:1127-1176`](../src/features/flashcards/components/flashcard-admin-manager.tsx#L1127-L1176))
lỗi ở đâu là `discard()` **xoá sạch mọi file đã tải**. Đúng cho 1 thẻ, **sai cho 38 thẻ**:
mất mạng ở file 37 mà vứt cả 36 thẻ đã xong là bắt admin làm lại từ đầu — chính
là cái mệt mà tính năng này sinh ra để xoá bỏ.

→ **Thẻ nào xong thì ghi thẻ đó.** Chỉ dọn file rác của **riêng thẻ hỏng**.
Nút *"Thử lại 1 thẻ"* chỉ chạy lại phần đỏ.

---

## 6. Phía máy chủ

### 6.1 Hai action mới

**(a) `createFlashcardBulkUploadTicketsAction`**

```ts
{ sectionId, items: Array<{ pageId, slot: "front" | "audio",
                            fileName, mimeType, sizeBytes }> }
→ { tickets: Array<{ pageId, slot, path, token, contentType }> } | { error }
```

- **GỌI ĐÚNG MỘT LẦN cho cả lô** → tốn đúng **1** đơn vị rate limit (§2.1).
- `requireRole("super_admin")` · buổi phải `draft` · **mọi `pageId` phải thuộc
  đúng `sectionId`** và `kind = 'vocabulary'` (trang mở đầu bị loại).
- Định dạng + dung lượng: dùng lại `flashcardMediaFormat` / `flashcardMediaSizeLimit`.
- Trần mới `MAX_FLASHCARD_BULK_UPLOAD_FILES = 120` (60 thẻ × 2 khe). Dialog tự
  chặn trước và nói số, không để người dùng biết giới hạn qua thông báo lỗi.

**(b) `attachFlashcardSectionMediaAction`**

```ts
{ sectionId, allowOverwrite: boolean,
  assignments: Array<{ pageId, frontImagePath?, audioPath? }> }
→ { outcomes: Array<{ pageId, status: "attached" | "skipped" | "error",
                      message?: string }> }
```

- ⛔ **KHÔNG đi qua `flashcardPageSchema`.** Schema đó là payload **cả trang**;
  dùng nó ở đây thì một lượt gắn audio có thể **ghi đè rỗng** `example_sentences`
  / `common_phrases` — đúng mẫu hỏng mà `…074` vừa phải viết cả migration để
  tránh. Chỉ ghi đúng cột được gắn.
- Bắt buộc sinh `front_alt` bằng `flashcardAltText` (§2.3).
- Verify từng object bằng `storage.info()` y như đường một thẻ
  ([`actions.ts:525-541`](../src/features/flashcards/server/actions.ts#L525-L541)).
- Xoá file cũ **chỉ khi** `allowOverwrite`.
- `logAudit` mỗi thẻ, action `flashcard.page.media.bulk_attach`.

### 6.2 Ghi DB bằng **RPC**, không bằng update trực tiếp

Ba việc hàng loạt trước của Flashcard đều là RPC: `create_flashcard_sections`,
`archive_flashcard_section_pages` ([`…076`](../supabase/migrations/20260724000076_flashcard_section_bulk_ops.sql)),
`import_flashcard_vocabulary` ([`…072`](../supabase/migrations/20260723000072_flashcard_bulk_import.sql)).
Đi RPC thì luật fail-closed (`super_admin` + chỉ `draft`) nằm **trong DB** và
được **pgTAP** phủ, chứ không chỉ Vitest.

→ Migration mới `…077_flashcard_bulk_media_attach.sql`:
`public.attach_flashcard_section_media(p_section_id uuid, p_assignments jsonb, p_allow_overwrite boolean)`,
`security definer`, `set search_path = ''`, trả bản kê **từng thẻ**.
Không thêm cột nào; trigger `app.sync_flashcard_media_paths()` tự cập nhật
`media_paths` như cũ.

### 6.3 Logic ghép để ở `domain/`, thuần và test được

`src/features/flashcards/domain/bulk-media.ts` — **không import React, không
import Supabase**, đúng mẫu `domain/bulk-import.ts`:

```ts
normalizePinyinKey(raw: string): string          // NFD → bỏ dấu → thường → [a-z0-9]
matchFilesToPages(files, pages, { allowOverwrite }): {
  rows: Array<{ page, front: Assignment, audio: Assignment, status }>
  unmatched: Array<{ fileName, reason: "no-key" | "collision" | "bad-format" }>
}
```

Hàm thuần ⇒ unit test chạy được **mọi ca trùng khoá và lệch số** mà không cần
dựng DOM hay DB. Đây là điều `CLAUDE.md` đòi: *business rule ở domain, có unit test*.

---

## 7. Bảng kiểm khả dụng (skill `ui-ux-pro-max`, miền `ux`)

| Luật | Áp dụng ở đây |
| --- | --- |
| `gesture-alternative`, `keyboard-nav` | Kéo–thả chỉ là **bổ trợ**. Luôn có `<input type="file" multiple>` thật kèm `<label>` nhìn thấy được |
| `data-table` (a11y) | Dùng `DataTable` sẵn có: `caption` + `scope="col"` + khung cuộn ngang riêng |
| `horizontal-scroll` | Bảng cuộn ngang **trong khung của nó**; thân trang không bao giờ cuộn ngang ở 375px |
| `color-not-only` | 5 trạng thái đều có **chữ**; màu chỉ phụ trợ |
| `touch-target-size` | Nút ✎ / ✕ mỗi hàng `size-11` (44px) — đúng cỡ cụm nút hiện có |
| `error-placement` + `error-summary` | Lỗi hiện **ngay hàng hỏng**, kèm dòng tổng ở đầu có số lượng |
| `aria-live-errors` | Vùng kết quả `role="alert"`; dòng tiến độ `aria-live="polite"` |
| `progress-indicators` | `role="progressbar"` + `aria-valuenow/min/max`, kèm chữ **"14/38"** — thanh màu không đủ |
| `sheet-dismiss-confirm` | Đang tải: **chặn** đóng dialog. Đã chọn file mà chưa chạy: hỏi lại trước khi đóng |
| `escape-routes` | Luôn có Huỷ + Esc (trừ lúc đang tải) |
| `destructive-emphasis` | "Sẽ thay" tông cảnh báo; số file bị xoá in **trên nút xác nhận** |
| `reduced-motion` | Chỉ thanh tiến độ có transition; không stagger hàng bảng |
| `primary-action` | CTA chính của màn buổi vẫn là **Công bố buổi**; mọi nút hàng loạt là `outline` |

⚠️ **Thiếu component:** `src/components/ui/` **chưa có `progress.tsx`**. Cần thêm
một cái tối giản (~20 dòng, `role="progressbar"`) — nằm trong phạm vi task này.

---

## 8. Definition of Done đề xuất (`P16-T11`)

| Hạng mục | Điều kiện |
| --- | --- |
| Unit | `tests/unit/domain/flashcard-bulk-media.test.ts`: pinyin có `ü/ǖ/ǚ`; khớp Hán tự; khớp số **theo số đang hiện**; **trùng khoá → `unmatched`, không đoán**; Ghi đè tắt → `skipped`; trang mở đầu bị loại |
| pgTAP | `flashcard_bulk_media_attach.test.sql`: fail-closed 3 vai (`teacher`/`student`/`anon`) · buổi `published` bị từ chối · `pageId` của buổi khác bị từ chối · `front_alt` được ghi · `media_paths` cập nhật · file cũ chỉ bị xoá khi `allow_overwrite` |
| E2E | Nối dài `flashcard-responsive.spec.ts`: thả 3 audio cho 3 thẻ seed → 3 badge **"Thiếu audio" biến mất** → **"Công bố buổi" chạy được**. Đây mới là vòng khép kín của lời than gốc |
| Kiểm ngược | Tắt guard trùng khoá → bài trùng khoá phải **đỏ**; bỏ `front_alt` → pgTAP alt phải **đỏ** |
| Rate limit | Có bài chứng minh buổi **38 file** tiêu đúng **1** đơn vị `material_upload` |
| Docs | `08-phase-plan.md` thêm hàng `P16-T11`; `02-database-design.md` thêm RPC `…077` |

---

## 9. Câu cần user chốt trước khi code

1. **Tab thứ hai hay nút riêng?** (§3 — khuyến nghị: tab thứ hai)
2. **Có làm luôn ảnh MẶT SAU không?** Bản này cố ý **không** — vì quy tắc
   "đuôi file quyết định khe" chỉ chạy sạch khi có đúng một khe ảnh (§4). Muốn
   có mặt sau thì phải chốt hậu tố đặt tên (`huluobo-sau.jpg`).
3. **Trần 120 file/lượt** có đủ cho buổi dài nhất thực tế không?
