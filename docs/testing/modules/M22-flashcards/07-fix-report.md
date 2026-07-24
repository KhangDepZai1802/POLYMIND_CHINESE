# Fix report — `BUG-P16-001`

> Người sửa: Codex — 2026-07-24. Trạng thái: **Fixed, chờ xác minh độc lập**.

## File sửa

- `supabase/seed.dev.sql`
- `tests/e2e/flashcard-responsive.spec.ts`
- `tests/unit/flashcard-seed-stability.test.ts`

## Kiểm tra đã chạy

- Trước sửa: `npm run db:reset` exit 0; `npm run db:seed:dev` exit 1 tại FK
  `flashcard_decks_course_id_fkey`.
- Sau sửa: cùng chuỗi `db:reset → db:seed:dev` exit 0.
- Kiểm UTF-8 sau seed: `Giáo viên Demo A`, `Buổi 1 — Ở ngân hàng`,
  `银行 | yín háng | Ngân hàng` hiển thị đúng, không thành dấu `?`.
- Playwright `flashcard-responsive.spec.ts` trên DB sạch vừa seed:
  Chromium `16/16`; Pixel 7 `16/16`.
- Bản URL admin trong log dùng UUID mới tra từ `VCB-BANK`, không phải UUID cũ.
- Regression/unit mục tiêu: `34/34`.
- Gate toàn repo: lint exit 0; typecheck exit 0; Vitest `256/256` trong 68 file;
  build exit 0.
- `git diff --check` exit 0.

## Việc còn chờ

- Codex là người sửa nên không tự ghi `Verified`; cần Claude/agent khác chạy lại
  kịch bản reset → seed và hai project Playwright.
- Cloud dry-run migrations 070–072 chưa chạy được: Supabase trả 403 do tài khoản
  thiếu quyền và yêu cầu `SUPABASE_DB_PASSWORD` (`BLK-4` trong `WORKLOG.md`).
