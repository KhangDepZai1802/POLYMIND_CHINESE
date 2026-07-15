# 07 — Product Backlog

> Những gì **cố tình** không làm ở v1. Ghi ở đây để không ai "tiện tay làm luôn" và cũng để không quên.

---

## Phase 2 (sau khi v1 chạy ổn định)

| # | Tính năng | Vì sao hoãn | Lưu ý khi làm |
|---|---|---|---|
| B-1 | **AI hỗ trợ** soạn bài, gợi ý nhận xét, luyện tiếng Trung | v1 phải chắc nền nghiệp vụ + bảo mật trước | Phải có **scope dữ liệu an toàn** — AI chỉ thấy đúng dữ liệu mà user gọi nó được phép thấy. Hệ cũ dính đúng lỗi này (`BUG_M15_01`: AI trả dữ liệu ngoài scope của user). **Không** port Gemini/OCR của web XKLĐ sang |
| B-2 | **Email notification nghiệp vụ** (nhắc lịch, nhắc hạn nộp, nhắc học phí) | Cần SMTP provider thật; SMTP mặc định của Supabase có rate limit thấp | v1 đã có in-app + `notification_preferences.email_enabled` — chỗ mở sẵn. **Không** thêm SMS/Zalo giả lập |
| B-3 | **Chứng chỉ hoàn thành** (PDF) | Không blocker cho vận hành | v1 đã có bản in thân thiện cho báo cáo tiến độ. Sinh PDF server-side để sau |
| B-4 | **CSV import** dữ liệu học viên cũ | Chưa có file nguồn từ trung tâm | Phải validate + dry-run + báo cáo dòng lỗi trước khi ghi. Không import mù |
| B-5 | **Đa cơ sở / đa tenant** | v1 chỉ một trung tâm | Sẽ đụng toàn bộ RLS — thiết kế lại `app.*` helper. Đừng "chuẩn bị sẵn" ở v1, sẽ phức tạp vô ích |
| B-6 | **PWA / native app** | Web responsive đã đủ cho giáo viên dùng trên điện thoại | Chỉ làm khi có yêu cầu riêng |

---

## Đã cân nhắc và **quyết định không làm** (không phải backlog)

Những thứ này **sẽ không bao giờ** vào sản phẩm. Đừng đề xuất lại.

| Không làm | Lý do |
|---|---|
| CRM tuyển sinh (Lead, nguồn lead, timeline chăm sóc) | Ngoài phạm vi nghiệp vụ. Luồng bắt đầu từ hồ sơ học viên |
| Toàn bộ domain XKLĐ (ứng viên, đơn hàng, workflow 20 bước, visa, chuyến bay, COE, hộ chiếu) | Sản phẩm khác |
| Đại lý, cộng tác viên, hoa hồng | Sản phẩm khác |
| Vay, nợ, thu nợ, lịch trả góp | Sản phẩm khác. **"Còn phải thu học phí" là số dư hóa đơn, không phải công nợ** |
| Khoản chi, duyệt chi, kế toán tổng quát | Ngoài phạm vi |
| Chat / tin nhắn hai chiều | Thông báo **một chiều** là quyết định chốt (D-5). Chat kéo theo cả ma trận "ai được nhắn ai" — hệ cũ tốn rất nhiều công vì nó |
| Role phụ huynh (tài khoản đăng nhập) | Guardian chỉ là **field liên hệ** trên hồ sơ học viên |

---

## Nợ kỹ thuật / hardening đã biết (theo dõi ở `MODULE_QA_BOARD.md`)

| # | Hạng mục | Mức |
|---|---|---|
| T-1 | Tinh chỉnh rate limit theo telemetry production. v1 đã có DB-backed limit cho upload/export và Supabase Auth limit cho đăng nhập. | Medium |
| T-2 | Dọn object Storage mồ côi (xóa metadata nhưng object còn lại) — cần job đối soát định kỳ | Medium |
| T-3 | Retention cho `audit_logs` (bảng sẽ phình theo thời gian) | Low |
| T-4 | Nhiều lần nộp bài (`submission_attempts`) — v1 chỉ giữ bản hiện hành khi `max_attempts = 1` | Low |
| T-5 | Sinh PDF server-side cho báo cáo (v1 dùng bản in của trình duyệt) | Low |
