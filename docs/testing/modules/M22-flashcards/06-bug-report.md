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
