# 12 — ĐẶC TẢ THIẾT KẾ LẠI MODULE BÁO CÁO (`REPORT-REDESIGN-1`)

> **Trạng thái:** Đã chốt yêu cầu với user 2026-08-04 (12 câu hỏi – 12 quyết định, xem §2).
> **Phạm vi:** `/admin/reports` đổi trọng tâm từ **học phí** sang **tiến độ học tập + điểm danh**;
> học phí giữ làm tab phụ. Nâng cấp cả trang tiến độ giáo viên dùng chung tầng chi tiết lớp.
> **Người dùng:** `super_admin`, `academic_manager` (toàn trung tâm) · `teacher` (lớp mình dạy).

---

## 1. Bối cảnh & vấn đề

Trang `/admin/reports` hiện tại chỉ trả lời được một câu hỏi: *"tiền học phí thu đến đâu?"*
Trong khi đó ba câu hỏi vận hành cốt lõi của trung tâm **không có màn hình nào trả lời**:

1. **Học viên nào đang đuối** (nghỉ nhiều · điểm thấp · thiếu bài) cần can thiệp?
2. **Lớp nào ổn, lớp nào chậm** so với các lớp còn lại?
3. **Số liệu tổng hợp kỳ này** để báo cáo cấp trên là gì?

Dữ liệu để trả lời đã có sẵn ở DB (5 view `security_invoker`: `v_class_assessment_progress`,
`v_enrollment_assessment_progress`, `v_student_attendance_summary`, `v_at_risk_assessment_students`
+ bảng điểm danh/điểm số gốc) — chỉ thiếu màn hình đứng trên nó.

## 2. Quyết định đã chốt với user (nguồn: phiên hỏi–đáp 2026-08-04)

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| D1 | Báo cáo học phí đi đâu? | **Giữ làm tab phụ** trong `/admin/reports`; tab "Học tập" là mặc định |
| D2 | Mục đích sử dụng | Cả ba: **giám sát ai đang đuối** · **báo cáo định kỳ cấp trên** · **đánh giá lớp/giáo viên** |
| D3 | Cấu trúc | **3 tầng: Trung tâm → Lớp → Học viên** |
| D4 | Chiều thời gian | **Khoảng ngày tự chọn + preset** (Tuần này / Tháng này / Toàn khóa); export giữ đúng filter (bài học `BUG_M16_01`) |
| D5 | Ngưỡng "cần chú ý" | **Theo cấu hình từng khóa học** (`completion_min_attendance_rate`, `completion_min_overall_score`, thiếu ≥ 2 bài) — tái dùng đúng view DB, admin và giáo viên nhìn cùng một danh sách |
| D6 | Hình thức báo cáo định kỳ | **Trang in đẹp (Ctrl+P → PDF) + export XLSX/CSV** |
| D7 | Chi tiết điểm danh tầng lớp | **Lưới buổi × học viên** (sổ điểm danh trực quan) |
| D8 | Trang giáo viên | **Nâng cấp cùng đợt** — tầng chi tiết lớp dùng chung component cho admin lẫn giáo viên |
| D9 | Khối tầng tổng quan | Cả bốn: **KPI** · **so sánh lớp** · **danh sách cần chú ý toàn trung tâm** · **xu hướng theo tuần** |
| D10 | Trình bày điểm | **Gộp một số ở tầng trung tâm/lớp, tách bài tập vs kiểm tra khi vào hồ sơ học viên** |
| D11 | Bố cục tổng quan | **KPI → thẻ lớp → danh sách cần chú ý** |
| D12 | Biểu đồ | **Tĩnh, render từ server (CSS/SVG)** — theo tiền lệ repo, in ra PDF nguyên vẹn, không thêm thư viện |

## 3. User stories & tiêu chí nghiệm thu

### US-1 — Giám sát toàn trung tâm (giáo vụ / super admin)
> Là giáo vụ, tôi mở Báo cáo và **trong một màn hình đầu tiên** thấy: trung tâm có bao nhiêu học
> viên đang học, chuyên cần trung bình kỳ này, điểm trung bình, và **bao nhiêu em đang cần chú ý** —
> để biết hôm nay phải gọi điện cho ai.

- **AC1.1** Mở `/admin/reports` không kèm tham số → tab **Học tập**, kỳ mặc định **Tháng này**.
- **AC1.2** Dãy KPI: *Đang học* · *Chuyên cần TB* · *Điểm TB* · *Cần chú ý* — tính theo kỳ đang lọc
  (riêng *Cần chú ý* theo định nghĩa lũy kế của khóa học — D5).
- **AC1.3** Mỗi lớp một thẻ: sĩ số đang học, thanh chuyên cần, điểm TB, tiến độ %, số em cần chú ý;
  bấm thẻ → tầng lớp, **giữ nguyên khoảng ngày đang lọc** trên URL.
- **AC1.4** Danh sách "Cần chú ý" gộp mọi lớp, mỗi em kèm **lý do chữ** ("Chuyên cần thấp"…);
  bấm tên → hồ sơ học viên. Không có em nào → khối hiện trạng thái rỗng tích cực, không biến mất.
- **AC1.5** Biểu đồ xu hướng chuyên cần theo tuần trong kỳ lọc; < 2 tuần dữ liệu → ẩn biểu đồ,
  hiện ghi chú thay vì vẽ 1 điểm.
- **AC1.6** Đổi khoảng ngày/preset → mọi khối (KPI, thẻ lớp, xu hướng) tính lại theo kỳ mới.

### US-2 — Soi một lớp (giáo vụ / super admin / giáo viên)
> Là giáo vụ hoặc giáo viên, tôi mở một lớp và thấy **sổ điểm danh trực quan** cùng bảng chỉ số
> từng học viên — để thấy mẫu vắng liên tiếp mà tỉ lệ % không bao giờ lộ ra.

- **AC2.1** Lưới điểm danh: hàng = học viên, cột = buổi trong kỳ lọc; ô có **ký hiệu chữ + màu**
  (✓ có mặt · M muộn · V vắng · P có phép) — màu không bao giờ là kênh thông tin duy nhất.
- **AC2.2** Bảng chỉ số mỗi học viên: buổi có mặt/muộn/vắng, chuyên cần %, điểm TB (gộp — D10),
  bài đã nộp/tổng, tiến độ %; em thuộc danh sách cần chú ý có nhãn chữ "Cần chú ý".
- **AC2.3** Cùng component, hai ngữ cảnh: admin (`/admin/reports/[classId]`, mọi lớp qua
  `requireManager`) và giáo viên (trang tiến độ hiện có, chỉ lớp mình — RLS tự khoanh, **không**
  thêm `where teacher_id` ở app).
- **AC2.4** Lưới cuộn ngang trong container riêng (`overflow-x-auto`), cột tên học viên dính trái;
  **trang không bao giờ tràn ngang** ở 375px.

### US-3 — Hồ sơ một học viên
> Là giáo vụ, khi một em bị nêu tên, tôi mở hồ sơ và thấy **vì sao** em đó cần chú ý: lịch sử
> điểm danh, điểm từng bài (tách bài tập / bài kiểm tra), tiến độ — đủ để trao đổi cụ thể.

- **AC3.1** Khối tóm tắt: chuyên cần % · điểm bài tập TB · điểm kiểm tra TB (tách — D10) · tiến độ
  % · trạng thái cần-chú-ý kèm lý do.
- **AC3.2** Lịch sử điểm danh trong kỳ lọc: ngày, buổi, trạng thái, ghi chú (nếu có).
- **AC3.3** Bảng điểm: từng bài tập/bài kiểm tra **đã công bố kết quả** — tên, ngày, điểm; bài chưa
  nộp hiện "Chưa nộp". Chỉ đọc qua RLS/view — không lộ bài chưa công bố.

### US-4 — Báo cáo định kỳ (super admin / giáo vụ)
> Là giáo vụ, cuối tháng tôi bấm **In** ra bản PDF gọn cho cấp trên, hoặc **Xuất XLSX** dữ liệu
> chi tiết — đúng kỳ đang lọc.

- **AC4.1** Nút In → print stylesheet: ẩn nav/bộ lọc/nút, hiện tiêu đề "Báo cáo học tập", kỳ báo
  cáo, ngày xuất; KPI + bảng lớp + danh sách cần chú ý vừa khổ A4, biểu đồ tĩnh in nguyên vẹn.
- **AC4.2** Export XLSX/CSV **giữ đúng filter đang chọn** (D4); route `/api/export/reports` nhận
  `report=learning|tuition` — mặc định cũ (`tuition`) giữ nguyên để không gãy link cũ.
- **AC4.3** File XLSX học tập: sheet "Theo lớp" + sheet "Theo học viên" (mỗi em một dòng đủ chỉ số).

## 4. Kiến trúc thông tin & route

```
/admin/reports?tab=hoc-tap|hoc-phi&from&to          ← Tầng 1 (tab Học tập mặc định)
/admin/reports/[classId]?from&to                    ← Tầng 2 — chi tiết lớp
/admin/reports/[classId]/[enrollmentId]?from&to     ← Tầng 3 — hồ sơ học viên
/teacher/…(trang tiến độ hiện có)                   ← dùng chung component tầng 2 + 3
/api/export/reports?report=learning|tuition&…       ← export giữ filter
```

- Breadcrumb tầng 2/3: `Báo cáo → LOP-02 → Nguyễn Văn A` — drill-down luôn có đường về (D3).
- Mọi state nằm trên **URL** (deep-link, back giữ nguyên filter — chuẩn `state-preservation`).
- Kỳ mặc định: **admin = Tháng này** (AC1.1); **giáo viên = Toàn khóa** — giữ đúng hành vi số liệu
  lũy kế mà `tests/e2e/report.smoke.spec.ts` đang đo (KPI khớp `count(*)` DB), giáo viên vẫn lọc
  kỳ được khi cần. Route hồ sơ học viên phía giáo viên: `/teacher/progress/[enrollmentId]`.

## 5. Nguồn dữ liệu

| Khối | Nguồn | Ghi chú |
|------|-------|---------|
| Cần chú ý (mọi tầng) | `v_at_risk_assessment_students` | Lũy kế toàn khóa theo ngưỡng khóa học (D5) — **không** tự đặt ngưỡng ở app |
| Tiến độ % / bài nộp | `v_enrollment_assessment_progress`, `v_class_assessment_progress` | Lũy kế (bản chất tiến độ) |
| Chuyên cần **theo kỳ lọc** | Query mới trên `class_sessions` + `attendance_records` (RLS) | Lọc theo **`starts_at`** (timestamptz UTC — `class_sessions` KHÔNG có cột `session_date`), quy về ngày giờ VN bằng `lib/dates`; chỉ đếm buổi `status in (completed, scheduled)` và `starts_at <= now()` — đúng công thức `v_student_attendance_summary`; nhóm theo lớp / học viên / tuần ISO |
| Điểm **theo kỳ lọc** | Query mới trên `exercise_attempts` + `exam_attempts` (đã công bố) | Cùng công thức thang 100 như view; tách loại ở tầng 3 (D10) |
| Học phí (tab phụ) | Giữ nguyên `getAdminTuitionReport` | Không đụng nghiệp vụ |

Nguyên tắc: **không migration mới** — mọi query mới đi qua RLS bằng `security_invoker`/bảng gốc;
admin thấy mọi lớp, giáo viên tự bị khoanh về lớp mình (đúng mô hình `teacher-queries.ts` hiện có).
Nếu khi triển khai buộc phải thêm view/index → viết migration forward + pgTAP theo luật AGENTS.md.

## 6. Đặc tả giao diện (theo design system hiện có — không thêm token/thư viện mới)

- **Bố cục tầng 1 (D11):** PageHeader + thanh kỳ lọc (DatePicker ×2 + preset + In + Xuất) →
  4 KPI (`Card` + `<dl>`, số `tabular-nums`) → lưới thẻ lớp (1/2/3 cột theo 375/768/1280) →
  biểu đồ xu hướng tuần (SVG server-render, đường + vùng mờ, nhãn giá trị trực tiếp) →
  danh sách cần chú ý (xếp nặng → nhẹ).
- **Thẻ lớp:** tên + mã lớp, sĩ số, thanh chuyên cần (pattern `AttendanceBars` — rãnh nền đủ 100%),
  điểm TB, tiến độ %, badge "⚠ N cần chú ý" (`text-warning` + chữ). Cả thẻ là link.
- **Lưới điểm danh (D7):** ô ≥ 28px, ký hiệu chữ trong ô, chú giải cố định trên lưới; hàng chẵn
  `bg-muted/50`; cột tên `sticky left-0`; tổng kết cuối hàng. Tối đa ~40 buổi/kỳ lọc — SVG/HTML
  thuần đủ nhanh, không virtualize.
- **Biểu đồ:** chỉ CSS/SVG server-render (D12). Line chart tuần: trục nhãn "T27", "T28"…, điểm có
  giá trị % in trực tiếp (`direct-labeling` — dataset nhỏ), `aria-label` một câu kết luận (pattern
  `AttendanceBars` hiện có). Không animation (in ấn + `prefers-reduced-motion` an toàn).
- **Màu:** token sẵn có — `--chart-*`, `--warning`, `--success`, `--destructive`; trạng thái điểm
  danh: có mặt `success` · muộn `warning` · vắng `destructive` · có phép `muted` — luôn kèm ký hiệu
  chữ (`color-not-only`). ⚠️ **KHÔNG viết class `dark:`** — repo đã gỡ dark mode (`DS-016`,
  `globals.css:186-190`): không có ThemeProvider nên biến thể `dark:` không bao giờ khớp.
- **In (D6, AC4.1):** `@media print` — ẩn `[data-noprint]`, bỏ nền tối, thẻ không đổ bóng, lưới
  điểm danh và bảng ngắt trang theo hàng (`break-inside-avoid`).
- **A11y:** bảng dữ liệu luôn là bản thay thế đầy đủ cho mọi biểu đồ; heading tuần tự; focus ring
  giữ nguyên; touch target ≥ 44px cho control lọc.

## 7. Ngoài phạm vi đợt này

- Gửi báo cáo tự động qua email/thông báo định kỳ.
- Màn hình cho phụ huynh/học viên xem báo cáo (portal học viên đã có trang riêng).
- Chỉnh ngưỡng at-risk ngay trên màn báo cáo (ngưỡng sửa ở cấu hình khóa học — D5).
- PDF sinh theo mẫu đóng dấu/chữ ký (D6 đã chọn trang in).

## 8. Definition of Done

- [ ] 4 US với đầy đủ AC ở §3 chạy thật trên local (đo bằng trình duyệt, cả 375px và 1280px).
- [ ] Tab Học phí giữ nguyên hành vi + export cũ (`report=tuition` mặc định) — không gãy link cũ.
- [ ] Giáo viên chỉ thấy lớp mình (kiểm bằng đăng nhập giáo viên thật local); giáo vụ/super admin
      thấy mọi lớp; học viên bị chặn.
- [ ] Export giữ đúng filter (test như bài học `BUG_M16_01`).
- [x] Vitest cho: schema filter (kỳ lọc), gom tuần ISO, công thức chuyên cần/điểm, export BOM +
      formula-injection + 2 sheet (`tests/unit/learning-report.test.ts`, `learning-export.test.ts`).
- [x] `npm run lint && npm run typecheck && npm test && npm run build` xanh (2026-08-04,
      Vitest 521/521).
- [x] Docs cập nhật cùng bộ thay đổi (file này + `docs/08-phase-plan.md` + WORKLOG).
