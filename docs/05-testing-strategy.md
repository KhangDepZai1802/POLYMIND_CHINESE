# 05 — Chiến lược kiểm thử

> Nguyên tắc: **không ghi "pass" khi chưa chạy thật.** Mỗi kết quả test ghi vào WORKLOG phải kèm lệnh đã chạy và số pass/fail thật.

---

## 1. Tầng test

| Tầng | Công cụ | Kiểm cái gì | Chạy bằng |
|---|---|---|---|
| **Unit / domain** | Vitest | Business rule thuần trong `lib/domain/` — không đụng DB | `npm test` |
| **Component / UI** | Vitest + React Testing Library | Form, validation, state loading/empty/error | `npm test` |
| **Database / integration** | pgTAP (SQL) | Constraint, trigger, transaction, RPC, idempotency | `npx supabase test db` |
| **RLS / IDOR** | pgTAP | **Quan trọng nhất** — ma trận phân quyền ở DB | `npx supabase test db` |
| **E2E** | Playwright | 6 kịch bản 3 role, gồm negative path | `npm run test:e2e` |

**Vì sao RLS test quan trọng nhất:** nó là chốt chặn cuối. Nếu server có bug mà RLS đúng → dữ liệu vẫn an toàn. Nếu RLS sai → mọi lớp trên vô nghĩa.

---

## 2. Unit / domain (Vitest)

Hàm thuần trong `lib/domain/`, **không phụ thuộc DB** → test nhanh, chạy mỗi lần lưu file.

| Nhóm | Test case |
|---|---|
| Sinh buổi học | Sinh đúng 35 buổi từ lịch "T2 + T4" · đúng weekday · đúng start/end · **chạy 2 lần không sinh trùng** · lớp không có lịch → 0 buổi (không lỗi) · tăng `planned_session_count` → sinh tiếp, không đụng buổi cũ |
| Sĩ số lớp | Đủ chỗ → cho ghi danh · đầy → từ chối · `capacity` phải > 0 |
| Enrollment transitions | Bảng chuyển trạng thái hợp lệ (docs/03 §3) · chuyển sai → từ chối · `completed`/`withdrawn`/`transferred` là trạng thái cuối |
| Chuyên cần | Tỷ lệ = (present + late) / tổng buổi đã diễn ra · buổi `cancelled` **không** tính vào mẫu số |
| Bài tập | Nộp sau `due_at` → `is_late` · `allow_late_submission = false` → chặn · `max_attempts` |
| Điểm & xếp loại | `0 ≤ score ≤ max_score` · điểm trung bình có trọng số · **xếp loại tra từ `grading_scale_rules`** (không hard-code) |
| Hoàn thành khóa | Đủ chuyên cần + đủ điểm → "đủ điều kiện" · thiếu một trong hai → "chưa đủ" + nêu rõ thiếu gì |
| Số dư hóa đơn | `balance = total − SUM(payments)` · partial / paid / overdue / refund |
| Thông báo | `dedupe_key` đúng format · link nội bộ hợp lệ |
| Ngày giờ | Quy đổi `Asia/Ho_Chi_Minh` ↔ UTC · **ranh giới ngày** (buổi 23:00 giờ VN thuộc ngày nào theo UTC) |

---

## 3. Database / integration (pgTAP)

| Nhóm | Test case |
|---|---|
| Constraint | FK · UNIQUE · CHECK (`amount > 0`, `score 0..100`, `capacity > 0`, `end > start`) |
| Trigger | `updated_at` tự cập nhật · `score ≤ max_score` · điểm danh phải khớp class của session · `classification` được tính từ grading scale (client gửi lên bị ghi đè) |
| Transaction | RPC hỏng giữa chừng → **rollback sạch**, không để lại dữ liệu rác |
| **Idempotency** | Chạy `bulk_mark_attendance` 2 lần → **không sinh bản ghi trùng** · chạy `generate_class_sessions` 2 lần → **không sinh buổi trùng** |
| **Concurrency** | 2 `enroll_student` đồng thời vào lớp còn 1 chỗ → **đúng 1 thành công** · 2 `record_tuition_payment` đồng thời → **đúng 1 receipt** |
| Grading scale | Ngưỡng chồng lấn → EXCLUDE constraint từ chối |
| Views | `v_enrollment_progress`, `v_tuition_balance`, `v_student_attendance_summary` tính đúng từ dữ liệu biết trước |

---

## 4. RLS / IDOR (pgTAP) — ma trận bắt buộc

Kiểm **đủ** SELECT / INSERT / UPDATE / DELETE cho mỗi bảng, cộng RPC và Storage.

### Anonymous
- [ ] Đọc bất kỳ bảng nghiệp vụ nào → **denied**
- [ ] Ghi bất kỳ bảng nào → **denied**
- [ ] Truy cập object trong Storage → **denied**

### Student
- [ ] Student A đọc hồ sơ / điểm / bài nộp / hóa đơn của Student B → **denied**
- [ ] Đọc **roster** lớp mình (danh sách học viên khác) → **denied**
- [ ] Đọc `student_notes` có `visibility = 'staff_only'` → **denied**
- [ ] Đọc `assessment_results` **chưa publish** → **denied**
- [ ] Đọc `learning_evaluations` chưa publish hoặc `visible_to_student = false` → **denied**
- [ ] Đọc `assignments` chưa publish → **denied**
- [ ] Tự sửa `score` / `feedback` trên submission của mình → **denied**
- [ ] Tự sửa `attendance_records` → **denied**
- [ ] INSERT `tuition_payments` (tự ghi nhận đã trả tiền) → **denied**
- [ ] Sửa `profiles.role` hoặc `profiles.is_active` của chính mình → **denied**
- [ ] Đọc `audit_logs` → **denied**

### Teacher
- [ ] Teacher A đọc/sửa lớp **không được phân công** → **denied**
- [ ] Chấm submission của **lớp khác** → **denied**
- [ ] INSERT/UPDATE `class_teachers` (tự gán mình sang lớp khác) → **denied**
- [ ] Đọc **bất kỳ bảng tuition nào** (4 bảng) → **denied**
- [ ] Đọc `audit_logs` → **denied**
- [ ] Đổi `role` của bất kỳ ai → **denied**
- [ ] Đọc học viên **không có enrollment** trong lớp mình → **denied**

### Super Admin
- [ ] Có đúng quyền nghiệp vụ trên mọi bảng
- [ ] Nhưng **invite/khóa user/đổi role vẫn phải qua server-only flow** (service role), không qua RLS thường

### IDOR nói chung
- [ ] Đổi UUID trực tiếp trên URL / server action / query → **không vượt scope**
- [ ] Đổi `object_path` trong signed URL sang class/student khác → **denied**
- [ ] User `is_active = false` → **mọi truy cập bị chặn** (cả UI lẫn data path)

---

## 5. E2E (Playwright) — 6 kịch bản

1. **Super admin:** login → tạo teacher + student → tạo course → tạo class → cấu hình lịch → sinh buổi → gán GV → ghi danh → kích hoạt lớp.
2. **Teacher:** login → **chỉ thấy lớp mình** → điểm danh (bulk) → tạo bài tập → publish → chấm → publish điểm.
3. **Student:** login → xem lịch → nộp bài (text + file) → **chỉ thấy điểm sau khi publish**.
4. **Học phí:** super admin tạo invoice → ghi nhận payment → sinh receipt → student **chỉ xem của mình**, không ghi nhận được payment.
5. **Lifecycle:** transfer / pause / withdraw / completion → **giữ nguyên lịch sử** (enrollment cũ vẫn còn, status `transferred`).
6. **Negative paths:**
   - Gõ thẳng URL lớp/học viên không thuộc scope → chặn
   - Stale form (mở form, admin đổi quyền, submit) → chặn
   - Bấm submit 2 lần → không sinh dữ liệu trùng
   - Upload file sai định dạng / quá lớn → từ chối
   - Tài khoản bị disable → không đăng nhập được

---

## 6. Component / UI

Form validation + error + loading + empty state · attendance roster bulk action · assignment submission + upload state · grade draft/publish · responsive navigation theo role · unsaved changes warning · confirmation cho mutation nhạy cảm.

---

## 7. Cổng CI

Mỗi PR phải xanh:

```bash
npm run lint
npm run typecheck
npm test                    # Vitest: unit + component
npx supabase db reset       # migration chạy sạch từ đầu + seed idempotent
npx supabase test db        # pgTAP: constraint + RLS + IDOR
npm run build               # production build
npm run test:e2e            # Playwright critical suite
```

Trước deploy production: **Vercel preview smoke** → **production smoke** sau khi deploy.

---

## 8. Ghi kết quả test vào WORKLOG

Đúng:
> `npm test` → **47/47 pass**. `npx supabase test db` → **23/23 pass**. `npm run build` → xanh.

Sai (tuyệt đối không):
> ~~"Đã test, mọi thứ hoạt động tốt."~~ — không có lệnh, không có số, không kiểm chứng được.

Nếu chưa chạy được (thiếu Docker, thiếu credential…) → ghi **blocker thật**, đừng đoán.
