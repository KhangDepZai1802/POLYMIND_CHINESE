# P16 — Flashcard dạng văn bản có cấu trúc

> **Đóng cả `P15-T5b` (M24 nửa Flashcard) và `P18-T7` (M06 Flashcard Admin).**
> Người làm ban đầu: Claude — 2026-07-23/24 (đợt 12). Codex xác minh độc lập
> 2026-07-24, dựng lại các kịch bản DB/UI và phát hiện `BUG-P16-001` ở `P16-T9`.
> Codex đã sửa bug này nên **toàn Phase 16 vẫn chờ agent khác xác minh độc lập**;
> người sửa không tự ghi Verified.

## Bối cảnh

Trước Phase 16, trang `vocabulary` của flashcard là **hai ảnh** — mặt trước và
mặt sau đều là ảnh do admin upload. User than "chữ khó nhìn / bị cắt": nguyên
nhân là mặt sau dùng `object-cover` nên phần dưới nội dung bị xén. Phase 16 đổi
hẳn `vocabulary` thành **bản ghi có cấu trúc** theo §7ter của
[`docs/10`](../../docs/10-yeu-cau-flashcard-quizlet.md) và dựng thẻ **bằng chữ**,
để chữ tự xuống dòng thay vì bị ảnh cắt.

## Cổng chặn `P16-T0` (đã mở)

User chạy 2 câu SQL đếm flashcard **trên cloud** (Claude không có credential
production): `decks/sections/pages = 0` ở mọi cột, không có bộ thẻ do người thật
soạn → điều kiện "xoá làm lại" của `Q2` được thoả. User cũng chốt vế chặn của
`P16-T1`: **giữ nguyên `flashcard_pages_distinct_media_check`, sửa §7ter** —
thẻ có ảnh thì hai mặt là hai file khác nhau.

## Mô hình dữ liệu (`DS-050`)

| Hạng mục | Chốt |
| --- | --- |
| 3 danh sách con (Tách nghĩa · Câu ví dụ · Cụm từ) | 3 cột `jsonb`, **Zod là chỗ cưỡng chế duy nhất** (`jsonb` không có FK/CHECK) |
| Ảnh trong câu ví dụ | `media_paths text[]` do **trigger** tổng hợp + **GIN**; policy đọc dùng `@>` |
| Hai cột ảnh | GIỮ `front_image_path`/`back_image_path`; `vocabulary` ảnh tuỳ chọn, `session_cover` bắt buộc đủ hai |
| Cột `term` | **Bỏ hẳn**, `hanzi` thay — không giữ hai nguồn sự thật (`BUG_M10_01`) |

### Hai chỗ làm khác câu chữ chốt cũ (cố ý, đã ghi chú trong code)

1. **`@>` thay `= any(...)`** trong `app.can_student_read_flashcard_media()`.
   `DS-050` ghi cả hai (`= any` + GIN) nhưng `= any` không dùng được GIN → index
   chết. `@>` nghĩa giống hệt, là dạng duy nhất khiến GIN có việc.
2. **Bỏ cột `term`** (thay bằng `hanzi`). `DS-050` không nói tới; giữ cả hai là
   hai nguồn sự thật cho cùng một dữ liệu.

## Lỗi thật đã sửa trong đợt (không phải soát lấy lệ)

1. 🔴 **Ảnh câu ví dụ bị RLS chặn** (`DS-049` điểm 1). Chính sách cũ liệt kê cứng
   3 cột nên ảnh trong `jsonb` khiến học viên nhận **403** trong khi admin vẫn
   xem được — không spec nào báo đỏ. `media_paths` + trigger + `@>` sửa gốc.
   **Kiểm ngược pgTAP:** khôi phục hàm cũ → đỏ đúng 2 bài.
2. 🔴 **`flashcard_pages_audio_kind_check` mâu thuẫn với nhập hàng loạt.** CHECK
   cũ ép **mọi** thẻ từ vựng phải có audio ngay lúc ghi, mà đường nhập hàng loạt
   không nhập audio. Chuyển luật từ **mức hàng** sang **mức công bố**
   (`validate_flashcard_section_publish`): thẻ thiếu audio tồn tại được khi buổi
   còn nháp, publish thì chặn. Lời hứa với học viên không đổi (buổi nháp không
   đọc được). Màn Quản trị thêm badge "Thiếu audio" để admin không phải đoán.
3. 🟡 **`isOwnedFlashcardMediaPath` cho mọi khe nhận cả 5 đuôi file** — một `.mp3`
   lọt vào ô ảnh và ngược lại. Siết cho khe và đuôi phải cùng loại.

## Bảng task

| Task | Kết quả |
| --- | --- |
| `T0` cổng chặn | ☑ mở (user đếm cloud = 0 + chốt §7ter) |
| `T1` migration mô hình + `media_paths` + RLS | ☑ `…070`; pgTAP **28/28** + kiểm ngược; cũ **34/34** |
| `T2` schema/action/query + pinyin/sublists | ☑ unit **21/21**; `gen:types` |
| `T3` màn soạn Admin | ☑ code + E2E soạn thẻ thật đọc DB |
| `T4` nhập hàng loạt | ☑ `…072`: unique `(section_id, hanzi, pinyin_syllables)` + `ON CONFLICT`; pgTAP **15/15**; parser unit **6/6**; E2E |
| `T5` template học viên bằng chữ | ☑ code + E2E "chữ không bị cắt" |
| `T6` xáo trộn + phát tự động | ☑ code + E2E đăng xuất/đăng nhập về thứ tự gốc |
| `T7` ★ thẻ khó | ☑ `…071`: khoá chính ghép + RPC `set` (không toggle); pgTAP **18/18** gồm IDOR hai chiều; E2E |
| `T8` pass uiux-redesign | ☑ đo 6 bề rộng × 2 project trong `flashcard-responsive.spec.ts` |
| `T9` seed + docs + gate | ◐ phát hiện và sửa `BUG-P16-001`; chờ xác minh độc lập bản sửa |

## Bằng chứng xác minh độc lập — Codex 2026-07-24

- DB sạch: `npm run db:reset && npm run db:test` → **27 file / 460 test**.
- Catalog đo trực tiếp trước khi sửa guard: bảng public `57`, RLS `57/57`, thiếu
  RLS `0`; RPC public `67`; hai RPC mới `anon=false`, `authenticated=true`.
- Kịch bản RLS/IDOR/import tự dựng trong một transaction:
  - trigger gom đủ 4 path gồm ảnh câu ví dụ; own+published `true/1 object`,
    own+draft và other-course `false/0`;
  - ★ gọi hai lần còn 1 hàng; không SELECT được star của B; hai INSERT IDOR bị
    RLS từ chối;
  - import lần đầu `3 created`, lần hai `3 duplicate`; 行 có 2 thẻ; order
    `{1,2,3,4}`; student/published-section bị chặn; thiếu 3 audio chặn publish.
- `EXPLAIN` cho `media_paths @> array[path]` → `Bitmap Index Scan on
  ix_flashcard_pages_media_paths`.
- Sau fix `BUG-P16-001`: `db:reset → db:seed:dev` exit 0; UTF-8 đúng.
- `flashcard-responsive`: Chromium **16/16**, Pixel 7 **16/16** trên DB vừa
  reset/seed; gồm chữ không bị cắt và context mới trở về thứ tự gốc.
- Gate hiện tại: lint exit 0 · typecheck exit 0 · Vitest **256/256 (68 file)** ·
  build exit 0. Full E2E toàn suite **314/314** là số Claude đã chạy ở đợt 13;
  Codex không nhận đó là số tự chạy lại.
- Cloud dry-run: **chưa chạy được**; CLI trả 403 thiếu quyền và yêu cầu
  `SUPABASE_DB_PASSWORD`.

### `BUG-P16-001` — seed/E2E không sống qua DB reset

Ngay sau reset sạch, `db:seed:dev` từng đỏ FK vì ghim UUID cũ của Course
`VCB-BANK`; E2E cũng ghim UUID đó. Sửa seed và spec tra theo
`courses.code = 'VCB-BANK'`, thêm `flashcard-seed-stability.test.ts`. Chi tiết:
`docs/testing/modules/M22-flashcards/06-bug-report.md`.

### 🔴 E2E bắt được một lỗi sản phẩm thật

Thẻ **chữ thuần** (không ảnh, không audio) không tạo được: `handleSubmit` chỉ
sinh `pageId` trong luồng upload; không upload thì `pageId` rỗng → "Không tạo
được mã trang flashcard". Đúng thứ Phase 16 sinh ra để làm mà lại hỏng. Không
unit/pgTAP nào bắt được (nằm ở luồng client soạn thẻ). Sửa: `pageId ??=
crypto.randomUUID()`.

### Bài học đo lường (bộ E2E 7/16 → 16/16 qua 8 lượt)

Chỉ **2** lỗi là "đỏ giả do tải"; còn lại là lỗi test/sản phẩm thật, truy từng
cái: `goto` chờ `"load"` treo vì ảnh seed không byte (→ `domcontentloaded` + chặn
`**/storage/v1/**`); cleanup `DELETE` bị trigger chặn (→ `session_replication_role
=replica`); axe login hai lần trong loop; 🔴 `readCardOrder` kiểm `isDisabled`
**giữa transition** (nút disabled theo thiết kế) → **đỏ cả khi chạy riêng**, đây
là minh chứng vì sao "chạy riêng xanh" KHÔNG mặc nhiên là đỏ giả; race hydrate cú
click đầu (→ `toPass`); `/logout` không phải route (→ context mới); hai bài nặng
vượt 90s (→ `setTimeout` 150–180s).

## Ràng buộc đã tôn trọng

- Quyền tạo **vẫn chỉ Super Admin** (`Q1`) — không đổi RLS deck/section.
- Xáo trộn giữ **state React**, không `localStorage`/`sessionStorage`/DB (`Q6`).
- ★ **không** đụng mastery của Ôn câu sai, **không** làm theo dõi biết/chưa biết
  (`Q4` hoãn).
- Nội dung seed **không** nhân bản thẻ mẫu 胡萝卜 (`DS-050` điểm 4).
