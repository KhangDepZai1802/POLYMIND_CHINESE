# Security review — Phase 7

> Ngày rà soát: 2026-07-15 · Phạm vi: P7-T1 · Trạng thái: đã xử lý các mục High trong phạm vi v1.

## Kết quả

| Mặt trận | Chốt chặn | Bằng chứng kiểm thử |
|---|---|---|
| IDOR | Page/action kiểm role; query dùng client JWT; RLS khoanh lớp/học viên; route export tự trả 401/403 | `student_isolation.test.sql`, `teacher-route-params.smoke.spec.ts`, `verify-codex-guards.spec.ts` |
| Upload abuse | Allowlist extension; giới hạn theo loại (Flashcard: ảnh 8 MB, audio 20 MB; các bucket khác 20/50 MB); server sinh path UUID; xác minh lại MIME/size từ Storage; private bucket | `files.test.ts`, `flashcard-media.test.ts`, pgTAP Storage/integrity, E2E submission |
| Rate limit | Supabase Auth: 30 sign-in/5 phút/IP. DB-backed counter: 20 upload/giờ/user/scope; 10 export/phút/user | `rate_limits.test.sql` (limit 20/21, scope độc lập, fail-closed) |
| Path traversal | Không nhận destination path từ client khi ký upload; register bắt buộc đúng số segment và root entity; trigger DB kiểm lại; tên download loại `/\\:*?"<>|` | `files.test.ts`, `assignment_integrity.test.sql`, `submission_grading.test.sql` |

Các header phòng thủ chung đã bật: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` và `Permissions-Policy`.

## Dependency audit

Lệnh thật: `npm audit --omit=dev` ngày 2026-07-15 báo **4 moderate**, không có high/critical:

- `postcss` nằm trong Next 16.2.10. `npm view next version` xác nhận 16.2.10 đang là bản mới nhất; đề xuất tự động lại hạ Next xuống 9.3.3 nên không áp dụng.
- `uuid <11.1.1` là dependency nội bộ của ExcelJS, advisory liên quan API UUID v3/v5/v6 khi caller truyền buffer. Ứng dụng chỉ dùng ExcelJS để ghi workbook từ dữ liệu đã escape và không gọi API UUID đó.

Theo dõi hai advisory ở mỗi lần nâng dependency. Không dùng `npm audit fix --force` khi nó đổi major/hạ framework ngoài review.

## Giới hạn còn lại

- CSP nghiêm ngặt cần nonce tương thích Next/React và regression test; chưa bật CSP nửa vời vì sẽ làm hỏng hydration hoặc phải cho `unsafe-inline`.
- Rate-limit production cần theo dõi false-positive để tinh chỉnh; counter hiện fail-closed nếu RPC lỗi.
- Antivirus/content scanning cho file Office/ZIP là hạng mục hạ tầng sau v1; v1 luôn tải file dưới dạng attachment từ bucket private, không render HTML/SVG inline.
