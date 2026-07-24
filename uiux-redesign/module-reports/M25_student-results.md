# M25 — Kết quả (Học viên)

| Field | Value |
| --- | --- |
| Module ID | `UIUX-M25` |
| Task | `P15-T6` |
| Route | `/student/results` |
| Agent | Claude |
| Ngày | 2026-07-22 |
| Trạng thái | **DONE — chờ xác minh độc lập** |

---

## 1. Phạm vi

Một route, ba tab: **Điểm** · **Đánh giá** · **Tiến độ**.

| File | Vai trò | Được sửa? |
| --- | --- | --- |
| `src/app/(dashboard)/student/results/page.tsx` | Toàn bộ giao diện M25 | ✅ viết lại phần trình bày |
| `src/features/student/server/result-queries.ts` | Truy vấn | ⛔ **không sửa một dòng nào** — đọc để đối chiếu ngữ nghĩa dữ liệu |
| `v_enrollment_assessment_progress` | View tính tiến độ | ⛔ không sửa; đọc `pg_get_viewdef` để biết công thức thật |

Không đổi route, query, action, RPC, RLS, nhãn nghiệp vụ hay công thức. Không thêm/bớt một trường dữ liệu nào.

---

## 2. Bằng chứng audit

| ID | Mức | Vấn đề | Bằng chứng (trước khi sửa) |
| --- | --- | --- | --- |
| `UX-M25-001` | High | **Cả trang không có một `<h2>` nào.** Ba tab là ba khu vực lớn nhưng trình đọc màn hình không nhảy được giữa chúng | `page.tsx:98,141,195` dùng `CardTitle` mặc định; `ui/card.tsx:44` — chỉ `asChild` mới ra heading thật |
| `UX-M25-002` | High | `text-xs` (12px) cho **nội dung thật**, 7 chỗ. Nặng nhất là chip xếp loại (là nội dung đánh giá, không phải chú thích) và nhãn "Điểm mạnh"/"Cần cải thiện" | `page.tsx:99,145,158,205,252,268,290` — mẫu `UX-M00-004` |
| `UX-M25-003` | High | Link "Xem chi tiết…" **không có focus ring** | `page.tsx:114` — `text-primary text-sm font-medium hover:underline`, không `focus-visible:*`. Mẫu lỗi lặp lần thứ 7 qua 5 module |
| `UX-M25-004` | High | **`attendance_rate` được truy vấn rồi bỏ không.** Trong khi trang lại viết "Điều kiện gồm **chuyên cần**…" — nhắc tới một con số học viên không được thấy | `result-queries.ts:45` lấy `attendance_rate`; `page.tsx` không dùng ở đâu. Cùng loại với `last_seen_at` ở M24 |
| `UX-M25-005` | Medium | Tab "Tiến độ" **không có một thanh tiến độ nào** — chỉ in phần trăm thành chữ | `page.tsx:224-228`. M22/M23/M24 đều đã có `role="progressbar"` |
| `UX-M25-006` | Medium | Điểm hiện `8/10` trần, không có tỉ lệ trực quan; học viên tự chia | `page.tsx:104-109` |
| `UX-M25-007` | Medium | Thanh tab trần: không icon, không semantic surface, số đếm nằm trong ngoặc đơn | `page.tsx:72-78` — lệch hẳn M21 và M24 (`review/page.tsx:30-54`) |
| `UX-M25-008` | Medium | Trang tổng hợp mà **không có tóm tắt ở đầu**; điểm trung bình bị chôn ở tab thứ ba | `page.tsx:71-78` — M20/M22/M23/M24 đều mở bằng bento |
| `UX-M25-009` | Low | Empty state không có lối đi tiếp | `page.tsx:85-89`, `125-129` |
| `UX-M25-010` | Low | 4 ô thống kê dùng chung `bg-muted` xám, không phân biệt được | `page.tsx:286-287` |

### Hai mục **không phải lỗi** — ghi rõ để agent sau không "sửa" nhầm

1. **`page.tsx:100` `{result.kind}` trông giống enum thô lọt ra giao diện** (mẫu `UX-M14-001`). **Không phải.** `result-queries.ts:64,73` gán sẵn chuỗi tiếng Việt `"Bài tập"` / `"Kỳ thi"`. Không sửa.
2. **`Tabs` đọc `?tab=` nhưng đổi tab không ghi lại URL** (`page.tsx:35-36`). Đây là hành vi navigation; `DS-024` chỉ mở ngoại lệ cho M14, `DS-012` vẫn cấm. **Cố ý không sửa trong M25.**

---

## 3. Hai lỗi nội dung do chính đợt này gây ra — bắt được bằng ảnh chụp, đã sửa

Đây là phần đáng ghi nhất của M25. Bản dựng đầu tiên **đọc tên cột rồi suy ra ý nghĩa**, và cả hai lần đều sai. Ảnh chụp thật ở 360/1280 phơi ra ngay vì hai con số cạnh nhau đá nhau.

| Lỗi | Bản dựng đầu (sai) | Sự thật, đọc từ `pg_get_viewdef` | Đã sửa thành |
| --- | --- | --- | --- |
| **Ý nghĩa `progress_percent`** | Chú thích "0/5 bài học đã hoàn thành" ngay dưới số **27%** — khẳng định đây là tỉ lệ bài học | Là **tổng hợp có trọng số**: `0.40×bài học + 0.30×chuyên cần + 0.15×bài nộp + 0.15×điểm TB` | Chú thích "Tổng hợp từ bài học, chuyên cần, bài đã nộp và điểm", và khối lớn nói rõ **"nên nó không bằng riêng tỉ lệ bài học"**. `aria-valuetext` cũng đổi theo |
| **Thang của `avg_score`** | In `formatScore(avg_score)` → **"80"** trần, đứng ngay trên các thẻ điểm dạng `8/10` | View đã **quy về thang 100** (`final_score/max_score*100`, hoặc `final_score_100`) | `formatAvgScore()` luôn kèm thang → **"80/100"**, có test khoá lại |

> **Bài học chung:** tên cột (`progress_percent`, `avg_score`) mô tả *kiểu dữ liệu*, không mô tả *cách tính*. Trước khi viết bất kỳ câu chú thích nào diễn giải một con số, phải đọc định nghĩa view/RPC sinh ra nó. Cùng họ với `UX-M14-002` (kết luận schema từ migration cũ) và `UX-M00-002` (kết luận token từ một dòng khai báo).

---

## 4. Đã làm

| # | Thay đổi | Đóng issue |
| --- | --- | --- |
| S01 | **Bento tổng quan 4 ô** ở đầu trang: Điểm trung bình (sky) · Tiến độ khóa học (cyan) · **Chuyên cần** (amber) · Bài đã nộp (coral). Mỗi ô có nhãn ≥14px, số lớn, một dòng giải thích | `-004`, `-008`, `-010` |
| S02 | **Thanh tab theo mẫu M21/M24**: `<nav>` có nhãn, semantic surface sky, focus ring cho vùng cuộn, icon + badge tròn đếm số | `-007` |
| S03 | **Heading thật cho mọi khu vực**: `<h2>` cho "Tổng quan học tập" / "Điểm đã công bố" / "Đánh giá học tập" / "Lời nhắn từ giáo viên" / "Chặng đường khóa học"; `CardTitle asChild` → `<h3>` cho từng thẻ | `-001` |
| S04 | **Thanh tỉ lệ điểm** cho mỗi kết quả, có `aria-valuenow`/`aria-valuetext`; **chặn chia cho 0** khi `maxScore ≤ 0` → không vẽ thanh thay vì vẽ `Infinity%` | `-006` |
| S05 | **Thanh tiến độ khóa học** trong tab Tiến độ, kẹp 0–100, `motion-reduce:transition-none` | `-005` |
| S06 | Link chi tiết có `focus-visible:ring-2` + `rounded-md` + `inline-flex` | `-003` |
| S07 | Gỡ **toàn bộ 7 chỗ** `text-xs` cho nội dung thật → `text-sm` + `text-text-secondary`; chip xếp loại dùng semantic sky, `leading-6` cho khối văn bản dài | `-002` |
| S08 | Empty state "chưa có điểm" có lối đi tiếp sang Bài tập | `-009` |
| S09 | Bỏ trùng lặp: tab Tiến độ không lặp lại "Điểm trung bình"/"Tiến độ" đã có ở bento, chỉ giữ chi tiết bài học + chuyên cần + điều kiện hoàn thành | — |

---

## 5. Impact map

**Không có.** Toàn bộ thay đổi nằm trong một file page. Không sửa `components/ui/*`, không sửa `components/shared/*`, không thêm token mới (dùng lại `student-sky/cyan/amber/coral` đã đo contrast ở `P15-T1`). Không có migration, query, action, RPC, RLS, Storage impact.

`StudentStat` là helper cục bộ của trang, cùng khuôn với helper cùng tên trong `student/page.tsx` (M20). **Cố ý không tách ra shared** — tách là đổi shared component, phải có impact map riêng; để dành cho `P15-T9`.

---

## 6. Kỹ thuật mới: cách đợi transition thay cho cách của M24

M24 chống báo động giả contrast bằng cách **đợi tab vừa nhả trở về nền trong suốt**. Ở M25 cách đó **vẫn lọt**: tab *vừa được chọn* còn đang chuyển màu **vào** nền primary, axe đọc trúng màu pha `#3c78b6` → báo `3.51:1` (lần chạy đầu đã fail đúng như vậy).

Cách mới, tổng quát hơn và không giòn theo token:

```ts
await expect.poll(() =>
  page.getByRole("tablist").evaluate((list) =>
    Array.from(list.querySelectorAll('[role="tab"]'))
      .every((tab) => tab.getAnimations().length === 0),
  ),
).toBe(true);
```

Đợi thẳng vào nguyên nhân — **không còn transition nào đang chạy** — thay vì đoán màu đích. Đổi token cũng không phải sửa test. Đã chứng minh hết flake: chạy `--repeat-each=2` trên cả Chromium lẫn Pixel 7 → **8/8 xanh**.

---

## 7. Completion gate

| Mục | Lệnh / cách đo | Kết quả |
| --- | --- | --- |
| Tất cả màn trong phạm vi | 3 tab của `/student/results` | ✅ |
| Component test M25 | `tests/unit/components/student-results-page.test.tsx` | ✅ **7/7 PASS** |
| E2E responsive/a11y | Chromium + Pixel 7, 360/768/1280, axe `wcag2a/2aa/21a/21aa`, không overflow | ✅ **4/4 PASS**; `--repeat-each=2` → **8/8** |
| Visual inspection | 3 ảnh Chromium 360/768/1280 | ✅ — **và chính nó bắt được 2 lỗi nội dung ở §3** |
| Loading/empty/error | Empty: chưa xếp lớp · chưa có điểm · chưa có đánh giá. Error: `error.tsx` của `(dashboard)` (`DS-018`) | ✅ |
| Keyboard focus | Vùng tab cuộn có `tabIndex={0}` + ring; link chi tiết có ring | ✅ |
| Không đổi nghiệp vụ | Không sửa query/action/RPC/RLS/nhãn/route | ✅ |
| Sửa shared component | Không có | ➖ |
| Lint | `npm run lint` | ✅ PASS |
| Type-check | `npm run typecheck` | ✅ PASS |
| Test | `npm test -- --maxWorkers=4` | ✅ **191/191 PASS** (57 file, +7 so với baseline 184) |
| Build | `npm run build` | ✅ PASS |
| Changelog | `06_UIUX_CHANGELOG.md` | ✅ |
| Checkpoint | trỏ sang `P15-T7` / M26 | ✅ |

**Fixture E2E tự dọn** (`test.afterAll(purgeFixture)`): 1 question + version + options + answer key, 1 set + version + item, 1 delivery `results_published`, 1 attempt `graded`, 1 answer, 1 `learning_evaluations` (published + `visible_to_student`), 1 `student_notes` (`student_visible`). Không đụng dữ liệu seed.

> **Claude là người viết code này** → theo `CLAUDE.md`, **không tự ghi Verified**. Cần Codex/user xác minh độc lập.

### Cần xác minh độc lập, ưu tiên theo thứ tự

1. **Hai con số ở §3** — mở `/student/results`, đối chiếu "Điểm trung bình x/100" và "Tiến độ y%" với `select avg_score, progress_percent from v_enrollment_assessment_progress where enrollment_id = …`. Đây là chỗ đã sai một lần.
2. **Chuyên cần** — số hiện ở bento phải khớp `attendance_rate` của chính học viên đó.
3. **Bàn phím** — Tab vào vùng thanh tab phải thấy ring; mũi tên trái/phải đổi tab; link "Xem chi tiết" phải thấy ring và dẫn đúng trang kết quả.
4. **Thẻ điểm không có thang** — nếu có delivery `max_score = 0`, thanh tỉ lệ phải **không hiện** chứ không phải hiện thanh đầy.
