# 13 — Thiết kế: Video bài giảng qua liên kết YouTube

> **Trạng thái: ĐÃ CÀI ĐẶT** (Claude, 2026-08-05, `VIDEO-1a…1f`) — **chờ xác minh
> độc lập**. Claude viết code nên không tự ghi `Verified`.
> Cổng đã chạy thật: lint **0** · typecheck **0** · Vitest **553/553** (521 → +32)
> · build **exit 0** · pgTAP `lesson_videos` **24/24**.
> ⛔ Migration `…090` **mới chỉ áp local**, chưa push cloud.
> **Nguồn yêu cầu:** user 2026-08-05 — *"tôi quyết định đăng youtube tất cả những
> vid này rồi dán link youtube từng vid này lên web để học viên bấm vào là chuyển
> hướng thẳng sang youtube coi vid đó luôn (…) chỉ để tiêu đề vid và icon youtube,
> mà phải nhỏ gọn cẩn thận giao diện điện thoại học viên"*.
> **Skill dùng để thiết kế:** `ui-ux-pro-max` (miền `ux` — Forms & Feedback,
> Navigation, Touch & Interaction, Accessibility).

---

## 1. Vì sao hướng này đúng, và cái giá phải trả

User đổi từ tự lưu trữ sang YouTube với lý do: *"lỡ sau này có những vid lớn hơn
thì sao"*. **Lý do đó đúng về mặt số học** — bản thiết kế trước định dùng
Cloudflare R2 free tier trần **10 GB**, mà đo thật thư mục `VIDEO_GIAOTRINH/` đã là
**2,03 GB cho 15 buổi** (suy ra 4,73 GB cho 35 buổi). Thêm hai khóa nữa là vỡ trần,
rồi phải di dời toàn bộ — đúng thứ nên tránh.

**Những gì biến mất khỏi phạm vi nhờ quyết định này:**

| Không còn phải làm | Vì sao |
|---|---|
| Nén video bằng ffmpeg | YouTube tự transcode |
| Cài ffmpeg lên máy | hết cần |
| Upload resumable cho file 315 MB | không upload gì qua web nữa |
| Cloudflare R2 + 4 biến môi trường | không cần nhà cung cấp thứ hai |
| Presigned URL, hạn dùng, ký lại | không có file để ký |
| Bucket, quota, egress | YouTube chịu, miễn phí, không trần |
| Băng thông 4G của học viên | YouTube tự hạ chất lượng theo mạng |

**Cái giá, nói thẳng một lần:** liên kết YouTube thì **ai có link đều xem được**.
Yêu cầu *"chỉ học viên thuộc khóa đó mới coi được"* mà user nêu trước đó **bị bỏ**
khi chọn hướng này. Đây là đánh đổi có ý thức, không phải sơ suất — ghi vào đây để
sau này không ai tưởng là lỗi.

### 1.1 🔴 Chế độ đăng trên YouTube: **Không công khai (Unlisted)**

Đây là thao tác của user trên YouTube, không phải code, nhưng chọn sai thì hỏng cả
tính năng nên phải ghi rõ:

| Chế độ | Kết quả | Dùng? |
|---|---|---|
| **Công khai** (Public) | Ai cũng tìm thấy qua tìm kiếm, hiện trên kênh | ❌ Giáo trình thành tài sản công |
| **Không công khai** (Unlisted) | **Không** tìm được, **không** hiện trên kênh, chỉ ai có link mới vào | ✅ **Đúng lựa chọn** |
| **Riêng tư** (Private) | Chỉ tài khoản Google được mời mới xem | ❌ **Học viên sẽ KHÔNG xem được** |

→ **Đăng ở chế độ "Không công khai".** Đây là mức bảo vệ thực tế tốt nhất mà hướng
YouTube cho phép: video không lọt vào tìm kiếm Google/YouTube, không ai vô tình
gặp; chỉ rò khi có người chủ động chuyển link ra ngoài.

---

## 2. Mô hình dữ liệu — chỉ còn một chuỗi 11 ký tự

Toàn bộ tính năng thu về việc lưu **video ID** của YouTube cho mỗi buổi.

```
video_collections            (bộ video — nhiều bộ/khóa ngay từ đầu)
  id, course_id → courses
  title, description
  position           int
  visibility         enum('draft','published')
  created_by         uuid     -- LUÔN auth.uid() (bài học BUG_M06_01)
  created_at, updated_at

video_items                  (1 buổi = 1 link)
  id, collection_id → video_collections on delete cascade
  session_number     int      -- số buổi
  title              text     -- mặc định 'Buổi N', admin sửa được
  youtube_video_id   text     -- 🔴 lưu ID (11 ký tự), KHÔNG lưu URL đầy đủ
  visibility         enum('draft','published')
  created_by         uuid
  unique (collection_id, session_number)
```

🔴 **Lưu ID chứ không lưu URL** — quyết định quan trọng, ba lý do:

1. **Cùng một video có hàng chục dạng URL** (`youtu.be/…`, `watch?v=…`,
   `m.youtube.com/…`, `/shorts/…`, kèm `&t=90`, kèm `&list=…`). Lưu URL thô thì
   không cách nào biết hai hàng có trùng video không.
2. **Chống dán nhầm**: ép về ID buộc phải qua bước bóc tách + kiểm định dạng
   `[A-Za-z0-9_-]{11}`. Dán nhầm link Facebook vào là **bị chặn ngay lúc nhập**,
   không phải lúc học viên bấm.
3. **Dựng được nhiều thứ từ ID**: link xem, link nhúng, và **ảnh thumbnail miễn
   phí** (`https://img.youtube.com/vi/{ID}/mqdefault.jpg`) — không cần API key.

🔴 **`unique (collection_id, session_number)`** đặt ở **tầng DB**, đúng bài học
`BUG_M09_01`: nhập lại lần hai không được đẻ ra hai hàng buổi 1. Ghi bằng
`on conflict … do update`.

⚠️ **Không có bảng `video_progress`.** Học viên xem trên YouTube nên hệ thống
**không thể biết** họ đã xem hay chưa. Làm dấu ✓ tự động ở đây là **bịa số liệu**.
Nếu user muốn có tiến độ thì phải là **ô tự đánh dấu bằng tay** — xem §5.4.

---

## 3. Màn admin: dán cả danh sách, không dán từng cái

Đặt tại `/admin/flashcards` (nơi user đang thiết kế nội dung), thêm một cấp chuyển:

```
┌ Nội dung khóa: Tiếng Trung Đàm Phán Tài Chính Chiến Lược ──────────────┐
│   ╭─────────────────╮╭───────────────────╮                             │
│   │  Bộ thẻ (2)     ││  Video bài giảng  │   ← tab đang chọn           │
│   ╰─────────────────╯╰───────────────────╯                             │
└────────────────────────────────────────────────────────────────────────┘
```

Dùng **tab** chứ không nút thứ 5: cụm nút của `SectionWorkspace` đã có 4 nút, thêm
nữa là tràn ở 375px (luật `primary-action` + `overflow-menu`, và đúng tiền lệ
[`docs/11 §3`](11-thiet-ke-gan-media-hang-loat.md)).

### 3.1 Dán hàng loạt — dùng lại đúng mô hình user đã quen

Repo đã có mô hình **dán text → xem trước từng dòng → mới bấm chạy** ở
[`flashcard-import-dialog.tsx`](../src/features/flashcards/components/flashcard-import-dialog.tsx).
User đã học nó một lần rồi; dùng lại đỡ phải học lần hai.

```
┌─ Nhập video hàng loạt ──────────────────────────────────────────── ✕ ─┐
│  Mỗi dòng một buổi.  Dán trực tiếp link YouTube.                      │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 1 | https://youtu.be/dQw4w9WgXcQ | Chào hỏi trong đàm phán      │ │
│  │ 2 | https://www.youtube.com/watch?v=abc12345678                 │ │
│  │ 3 | https://youtu.be/xyz98765432 | Giới thiệu công ty           │ │
│  │                                                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  Dạng:  số buổi | link | tiêu đề (tiêu đề bỏ trống → "Buổi N")       │
│                                                                       │
│  15 dòng · hợp lệ 14 · lỗi 1          ☐ Ghi đè buổi đã có link       │
│                                                                       │
│  ┌─ Xem trước ─────────────────────────────────────────────────────┐ │
│  │ Buổi  Tiêu đề                    Video ID       Tình trạng      │ │
│  ├─────────────────────────────────────────────────────────────────┤ │
│  │  1    Chào hỏi trong đàm phán    dQw4w9WgXcQ    Sẽ thêm         │ │
│  │  2    Buổi 2                     abc12345678    Sẽ thêm         │ │
│  │  3    Giới thiệu công ty         xyz98765432    Sẽ thay         │ │
│  │  4    —                          —              ⚠ Không đọc     │ │
│  │       (dòng 4: "buoi4 chưa quay" — thiếu link)   được link      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│                        [ Huỷ ]      [ Lưu 14 buổi ]                   │
└───────────────────────────────────────────────────────────────────────┘
```

**Vì sao dán text chứ không phải 35 ô nhập:** 35 ô là 35 lần bấm chuột + 35 lần
`Ctrl+V`. Dán một khối là **một** lần. Đây đúng lời than gốc mà `docs/11` đã giải
quyết cho flashcard, chỉ đổi loại dữ liệu.

### 3.2 Bóc tách video ID — phải nhận mọi dạng người ta hay dán

Logic thuần ở `src/features/videos/domain/youtube-url.ts` (**không** import React,
**không** import Supabase — đúng mẫu `domain/bulk-import.ts`):

```ts
parseYoutubeId(raw: string): string | null
```

Phải nhận đúng tất cả các dạng sau, vì người dùng copy từ đủ chỗ:

| Dán vào | ID bóc ra |
|---|---|
| `https://youtu.be/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=90s` | `dQw4w9WgXcQ` |
| `https://www.youtube.com/embed/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://www.youtube.com/shorts/dQw4w9WgXcQ` | `dQw4w9WgXcQ` |
| `https://youtu.be/dQw4w9WgXcQ?si=xxx` (nút Chia sẻ) | `dQw4w9WgXcQ` |
| `dQw4w9WgXcQ` (dán mỗi ID) | `dQw4w9WgXcQ` |
| `https://facebook.com/...` | `null` → báo lỗi |

🔴 **Kiểm định dạng cuối cùng luôn là `^[A-Za-z0-9_-]{11}$`.** Không khớp thì trả
`null`, **không đoán**. Fail-closed đúng tinh thần `AGENTS.md`.

⚠️ **Không kiểm tra video có tồn tại thật không.** Muốn biết chắc thì phải gọi
YouTube từ máy chủ — thêm một phụ thuộc mạng có thể hỏng, mà vẫn không chặn được
việc user gỡ video sau đó. Thay vào đó: nút **"Mở thử"** ngay cạnh mỗi hàng xem
trước, để admin tự bấm kiểm bằng mắt. Rẻ hơn và đáng tin hơn.

### 3.3 Bốn ca lỗi, mỗi ca một câu chữ

| Ca | Thông báo |
|---|---|
| Không đọc được link | *"Dòng 4: không tìm thấy link YouTube hợp lệ."* |
| Trùng số buổi | *"Buổi 3 xuất hiện ở 2 dòng. Bỏ bớt một dòng."* |
| Số vượt phạm vi | *"Buổi 40 — khóa này chỉ có 35 buổi."* |
| Cùng một video cho 2 buổi | *"Buổi 5 và buổi 9 cùng một video. Có nhầm không?"* — **cảnh báo, không chặn** (có thể cố ý) |

Luật `color-not-only`: mọi trạng thái đọc được **bằng chữ**, màu chỉ phụ. Và như
[`flashcard-import-dialog.tsx:158-162`](../src/features/flashcards/components/flashcard-import-dialog.tsx#L158-L162):
**"Giữ nguyên" / "Bỏ qua" KHÔNG tô đỏ** — đó là kết quả bình thường.

### 3.4 Ghi đè mặc định TẮT

Khác với bản R2, ghi đè ở đây **không mất dữ liệu vĩnh viễn** (video vẫn nằm trên
YouTube, chỉ là đổi ID lưu trong DB). Nhưng vẫn để mặc định tắt cho nhất quán với
đường flashcard, và vì admin thường dán bổ sung buổi mới chứ không sửa buổi cũ.
Bật lên → hàng đó thành **"Sẽ thay"** tông cảnh báo, nút đổi chữ thành
**"Lưu 14 buổi · thay 3 link"**.

---

## 4. Phía máy chủ — nhẹ hơn hẳn

### 4.1 Một action duy nhất

```ts
saveLessonVideosAction({
  collectionId,
  allowOverwrite: boolean,
  items: Array<{ sessionNumber: number; youtubeVideoId: string; title?: string }>
}) → { outcomes: Array<{ sessionNumber, status: "saved"|"skipped"|"error", message? }> }
```

- `requireRole("super_admin")` · bộ video phải `draft`
- **Bóc ID và kiểm `^[A-Za-z0-9_-]{11}$` LẠI Ở SERVER.** Client đã kiểm rồi nhưng
  client không đáng tin — đây là cửa ghi vào DB.
- `sessionNumber` phải nằm trong phạm vi buổi của khóa
- Ghi qua **RPC** `public.save_lesson_videos(...)`, `security definer`,
  `set search_path = ''` — luật fail-closed nằm **trong DB** và được **pgTAP** phủ,
  không chỉ Vitest (đúng tiền lệ `…072`, `…076`, `…077`)
- `on conflict (collection_id, session_number)` → idempotent ở tầng DB
- `logAudit` mỗi buổi, action `video.item.save`

🟢 **Không dính bẫy rate limit.** `material_upload` (20 lượt/giờ,
[`…034_rate_limits.sql:34`](../supabase/migrations/20260715000034_rate_limits.sql#L34))
chỉ áp cho đường xin vé upload file. Ở đây không upload gì, nên **không tiêu đơn vị
nào** — khác hẳn ràng buộc đã trói bản flashcard ở [`docs/11 §2.1`](11-thiet-ke-gan-media-hang-loat.md).

### 4.2 Học viên đọc — RLS như mọi bảng khác

Không có signed URL, không có presigned key. Học viên đọc `video_items` qua **RLS
thường**:

```sql
-- fail-closed, KHÔNG có nhánh `return true` mặc định (bài học CR-M14-3)
enrollment active vào lớp thuộc course của collection
  AND collection.visibility = 'published'
  AND item.visibility      = 'published'
```

⚠️ **RLS ở đây bảo vệ *danh sách*, không bảo vệ *nội dung*.** Học viên không thuộc
khóa sẽ không thấy link; nhưng ai đã có link thì RLS không ngăn được — video nằm
trên YouTube. Đây chính là đánh đổi §1 đã ghi. Nói rõ để không ai nhầm rằng RLS
đang bảo vệ nhiều hơn thực tế.

---

## 5. 🎨 Màn học viên — phần user yêu cầu kỹ nhất

> *"chỉ để tiêu đề vid và icon youtube, mà phải nhỏ gọn cẩn thận giao diện điện
> thoại học viên"*

### 5.1 Tab thứ ba, không phải card rời

`/student/review` hiện có 2 tab. Thêm tab thứ ba, **dùng lại nguyên khuôn** đã có ở
[`page.tsx`](<../src/app/(dashboard)/student/review/page.tsx>):

```
╭────────────────────╮╭──────────────────╮╭───────────────────╮
│ ▤ Flashcard Từ Vựng││ ⟳ Ôn Tập Câu Sai ││ ▶ Video Bài Giảng │
╰────────────────────╯╰──────────────────╯╰───────────────────╯
```

Thanh tab hiện đã có `overflow-x-auto` — thêm tab thứ ba **không làm vỡ ở 375px**,
nó cuộn ngang trong khung của chính nó. Đây là lý do dùng lại khuôn có sẵn thay vì
dựng mới.

### 5.2 Hàng liên kết — thiết kế chi tiết

Dùng lại **đúng ngôn ngữ thị giác** của
[`student-flashcard-deck-picker.tsx`](../src/features/flashcards/components/student-flashcard-deck-picker.tsx)
để hai tab trông như một hệ, không phải hai người làm:

```
┌─ Video Bài Giảng ────────────────────────────────────────────┐
│  Tiếng Trung Đàm Phán Tài Chính Chiến Lược · 15 buổi          │
│  Video mở ở YouTube trong tab mới.                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ▶  Buổi 1 · Chào hỏi trong đàm phán                 ↗  │ │  56px
│  ├─────────────────────────────────────────────────────────┤ │
│  │ ▶  Buổi 2 · Giới thiệu công ty                      ↗  │ │
│  ├─────────────────────────────────────────────────────────┤ │
│  │ ▶  Buổi 3 · Đàm phán lãi suất                       ↗  │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

Ở **375px** (điện thoại học viên — chỗ user dặn cẩn thận):

```
┌───────────────────────────────┐
│ ▶  Buổi 1 · Chào hỏi tro…  ↗ │  ← tiêu đề TRUNCATE, không đẩy ↗ ra ngoài
├───────────────────────────────┤
│ ▶  Buổi 2 · Giới thiệu cô…  ↗ │
└───────────────────────────────┘
```

**Bảy quyết định, mỗi cái có lý do:**

1. 🔴 **`min-w-0 flex-1` + `truncate` cho khối chữ.** Đây là **cái bẫy đã cắn repo
   này ba lần** — [`WORKLOG` ghi](../WORKLOG.md): *"`shrink-0` cạnh một khối
   `min-w-0 flex-1` là cái bẫy cố định — khối co được sẽ co tới 0 chứ khối
   `shrink-0` không nhường"* (`UX-UIUX-M16-002`, và lặp lại ở `UX-STUDENTS-1` khiến
   **tên lớp bị cắt còn 0 ký tự** ở 375px). Tiêu đề video dài hơn tên lớp nhiều, nên
   không có `min-w-0` là **chắc chắn** vỡ.

2. **`<a href>` chứ không `<button onClick={window.open}>`.** Thẻ `<a>` cho sẵn:
   bấm giữa chuột, nhấn giữ để hiện menu trên điện thoại, "mở ở tab mới", và trình
   đọc màn hình đọc đúng là *liên kết*. Dùng `button` là tự tay vứt hết.

3. **`target="_blank"` + `rel="noopener noreferrer"`.** `noopener` là **bắt buộc về
   an ninh** — thiếu nó thì trang YouTube vừa mở giữ được tham chiếu `window.opener`
   trỏ ngược về web của trung tâm.

4. **Icon YouTube đặt trên chip trắng `bg-card`**, không đặt thẳng lên nền xanh.
   Lý do là tương phản đo được: đỏ YouTube `#FF0000` trên nền `--student-sky-surface`
   `#eaf6ff` chỉ đạt **3,64:1** — qua ngưỡng 3:1 của đồ họa nhưng sát mép; đặt trên
   nền trắng lên **4,0:1**. Và chip trắng `size-10` chính là khuôn deck picker đang
   dùng, nên được cả hai việc.

5. **Mũi tên chéo ↗ (`ArrowUpRight`) chứ không phải ▸ (`ChevronRight`).** Deck picker
   dùng `ChevronRight` vì nó đi *vào trong* web. Đây đi **ra ngoài** — hai việc khác
   nhau thì phải khác dấu hiệu, nếu không học viên bấm mà không ngờ bị nhảy sang app
   khác (`nav-label-icon`). Kèm chữ ẩn cho trình đọc màn hình:
   `<span className="sr-only">(mở ở YouTube, tab mới)</span>`.

6. **Cả hàng là vùng bấm, cao 56px** (`min-h-14`) — vượt ngưỡng 44px của
   `touch-target-size`, mà vẫn "nhỏ gọn" như user muốn (deck picker hiện là 64px).
   35 hàng × 56px ≈ 1.960px ≈ **2,4 màn điện thoại** — chấp nhận được vì các hàng
   đồng dạng và đánh số, mắt lướt rất nhanh.

7. **`Buổi N · Tiêu đề`** trên **một dòng**, không phải hai dòng như deck picker.
   Deck picker cần dòng hai vì có metadata thật ("8 buổi · mô tả"). Ở đây dòng hai sẽ
   trống hoặc lặp lại — mà mỗi dòng thừa nhân với 35 hàng là gần một màn hình trôi đi.

### 5.2.1 🔴 Chống lặp "Buổi 1 · Buổi 1." (user báo 2026-08-05)

User báo giữa lúc cài đặt: *"bên youtube tôi sẽ đặt tiêu đề có chữ buổi luôn, ví
dụ buổi 1 sẽ là: `Buổi 1. chào hỏi và mở đầu đàm phán`. Nếu bên Web mình cũng để
sẵn buổi 1 luôn thì sẽ bị trùng 2 chữ buổi 1 buổi 1"*.

**Đã chọn: giữ badge số, cắt tiền tố khỏi tiêu đề.** `stripSessionPrefix()` ở
`domain/youtube-url.ts`, áp **ở tầng query** (`toView`) chứ không ở component —
để admin và học viên nhìn thấy y hệt nhau; tính ở component thì kiểu gì cũng có
chỗ quên, đúng mẫu hỏng `BUG_M10_01`.

| | Trước | Sau |
|---|---|---|
| Hiển thị | `Buổi 1 · Buổi 1. Chào hỏi và mở đầu đàm phán` | `Buổi 1 · Chào hỏi và mở đầu đàm phán` |

**Vì sao giữ badge từ DB chứ không giữ chữ trong tiêu đề:** badge lấy từ
`session_number` nên **luôn đúng và luôn đều** — admin quên gõ "Buổi" cho một
video thì hàng đó vẫn có số như mọi hàng khác. Ở 375px, phần lặp còn ăn mất ~60px
quỹ chữ vốn đã phải cắt bằng `…`.

Nhận `Buổi 1.` · `Buoi 01 -` · `BUỔI 7:` · `Bài 3)` · cả chuỗi ở dạng tổ hợp NFD.
**Hai lối thoát an toàn:**

1. **Số không khớp thì KHÔNG cắt.** YouTube ghi "Buổi 10" mà DB là buổi 1 là dấu
   hiệu đặt nhầm link — để hiện cả hai cho **lộ ra**, đừng lặng lẽ giấu.
2. **Cắt xong mà rỗng thì trả lại bản gốc.** Tiêu đề đúng bằng `"Buổi 5"` vẫn
   phải còn chữ để đọc.

📌 Màn admin cũng hiện `displayTitle` — tức **đúng chuỗi học viên sẽ thấy**. Bày
tiêu đề thô ở đó thì admin không bao giờ biết học viên thật sự đọc được gì.

### 5.3 Buổi chưa công bố: hiện mờ + ổ khóa, KHÔNG ẩn

```
│ 🔒  Buổi 16 · Chưa mở                                    │  ← mờ, không bấm được
```

Luật `empty-nav-state`: *"khi một đích đến không khả dụng, hãy giải thích vì sao
thay vì im lặng giấu nó"*. Giấu đi thì học viên tưởng khóa chỉ có 15 buổi; hiện ổ
khóa thì các em thấy còn 20 buổi phía trước — đó là động lực chứ không phải phiền.

### 5.4 ⚠️ Không có dấu "Đã xem" tự động — và vì sao

Học viên xem trên YouTube nên hệ thống **không có cách nào biết**. Ba lựa chọn:

| | Được | Mất |
|---|---|---|
| **A. Không có tiến độ** (đề xuất) | trung thực, không có gì để hỏng | học viên tự nhớ mình xem tới đâu |
| **B. Ô tự đánh dấu bằng tay** | học viên tự quản được | thêm 1 bảng + 1 action; số liệu là *tự khai*, admin **không được** dùng để chấm chuyên cần |
| **C. Nhúng iframe + YouTube IFrame API** | đo được thật | trái yêu cầu "chuyển hướng thẳng sang YouTube" của user |

**Đề xuất A cho bản đầu.** Tuyệt đối không làm dấu ✓ tự động dựa trên "đã bấm vào
link" — bấm không phải là xem, và đó là **bịa số liệu**, đúng thứ `AGENTS.md` cấm.

### 5.5 📌 Một lựa chọn để ngỏ (không làm bây giờ)

User nói *"đường link nhìn có vẻ thô kệch"*. Nếu sau này thấy phiền, YouTube cho
**nhúng iframe** ngay trong web — học viên xem tại chỗ, không rời trang, video vẫn
ở chế độ Không công khai, và **không tốn băng thông của trung tâm**. Đổi đúng một
component, dữ liệu (`youtube_video_id`) **không phải sửa một dòng nào** — đó chính
là lý do §2 quyết định lưu ID thay vì URL.

Ghi ra để user biết cửa đó vẫn mở, **không làm trong task này** vì user đã chốt
hướng chuyển thẳng sang YouTube.

### 5.6 Bảng kiểm khả dụng (skill `ui-ux-pro-max`)

| Luật | Áp dụng ở đây |
|---|---|
| `truncation-strategy` | `min-w-0 flex-1` + `truncate`; tiêu đề đầy đủ ở `title=` |
| `touch-target-size` | Cả hàng 56px, vượt ngưỡng 44px |
| `nav-label-icon` | ↗ báo hiệu ra ngoài, khác ▸ đi vào trong |
| `color-not-only` | "Chưa mở" có **chữ + ổ khóa**, không chỉ làm mờ |
| `empty-nav-state` | Buổi chưa công bố hiện mờ kèm lý do, không ẩn |
| `empty-states` | Chưa có video → *"Khóa này chưa có video bài giảng."* |
| `horizontal-scroll` | Không cuộn ngang ở 375px — nhờ `min-w-0` ở (1) |
| `focus-states` | `focus-visible:ring-2` như deck picker |
| `color-accessible-pairs` | Icon đỏ trên chip trắng: **4,0:1** (đo, §5.2 điểm 4) |
| `deep-linking` | Tab giữ được ở URL để chia sẻ |
| `reduced-motion` | Chỉ `transition-colors` khi hover, không hiệu ứng vào |

---

## 6. Định tuyến và điều hướng

Không cần route mới cho màn xem — bấm là ra YouTube. Chỉ cần tab giữ được trạng
thái ở URL để chia sẻ được và để nút Back hoạt động đúng (`deep-linking`,
`back-behavior`):

```
/student/review?tab=videos
```

---

## 7. Definition of Done đề xuất

| Hạng mục | Điều kiện |
|---|---|
| **Unit** | `youtube-url.test.ts`: đủ **8 dạng URL** ở §3.2 · link không phải YouTube → `null` · ID sai độ dài → `null` · trùng số buổi → lỗi · số vượt phạm vi → lỗi |
| **pgTAP** | `lesson_videos.test.sql`: fail-closed 3 vai (`teacher`/`student`/`anon`) · HV **không** thuộc lớp → **0 hàng** · collection `draft` → 0 hàng · item `draft` → 0 hàng · `on conflict` chạy 2 lần ra **1 hàng** |
| **Kiểm ngược** | Bỏ điều kiện enrollment ⇒ bài pgTAP fail-closed phải **đỏ**. Không đỏ nghĩa là bài test vô dụng |
| **E2E** | Dán 3 link → 3 hàng hiện ở tab HV → thẻ `<a>` có đúng `href`, `target="_blank"`, `rel="noopener noreferrer"` |
| **Đo thật** | Chromium **375px**: `horizontalOverflow = 0`; tiêu đề dài 60 ký tự **không** đẩy ↗ ra ngoài thẻ (đây là bài ghim cho lỗi đã lặp 3 lần) |
| **Cổng** | `lint` · `typecheck` · `test` · `build` xanh thật |
| **Docs** | `08-phase-plan.md` thêm task ID; `02-database-design.md` thêm 2 bảng + RPC |

---

## 8. 🔴 Câu cần user chốt trước khi code

1. **Đã đăng YouTube ở chế độ "Không công khai" chưa?** (§1.1 — *Riêng tư* thì học
   viên **không xem được**, *Công khai* thì ai cũng tìm ra giáo trình.)

2. **Tiêu đề lấy từ đâu?** Đề xuất: admin gõ trong ô dán (`1 | link | tiêu đề`), bỏ
   trống thì tự thành *"Buổi N"*. Muốn tự lấy tiêu đề từ YouTube được không — nhưng
   thêm một lời gọi mạng có thể hỏng lúc nhập.

3. **Tiến độ xem: A, B hay C?** (§5.4 — khuyến nghị **A**, không có tiến độ, vì
   YouTube không trả tín hiệu nào về.)

4. **Buổi thi có video không?** `P16-T13` ghi flashcard **bỏ buổi thi 14/28/35**,
   nhưng thư mục của bạn **có `buoi14.mp4`**. Nếu số video khác số mục lục flashcard
   thì cần biết trước, không thì hai bên lệch buổi.

5. **Một bộ video hay nhiều bộ?** Thiết kế đã chừa sẵn nhiều bộ (§2), nhưng màn học
   viên bản đầu sẽ **vào thẳng bộ duy nhất**, không bắt bấm qua màn chọn — đúng cách
   `MULTIDECK-1f` đã làm cho flashcard.
