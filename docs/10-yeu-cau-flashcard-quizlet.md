# Yêu cầu Flashcard theo hướng Quizlet

> **Nguồn:** user cung cấp 2 ảnh chụp màn hình quizlet.com trong phiên **2026-07-22** kèm mô tả bằng lời.
> **Cập nhật 2026-07-22 (đợt 2):** user đã **trả lời đủ `Q1`–`Q6`** (xem **§7bis**) và gửi **ảnh mẫu thẻ thật của POLYMIND** kèm chỉ đạo *"làm theo mẫu này"* (xem **§7ter**).
> **Trạng thái:** ✅ **YÊU CẦU ĐÃ RÕ — CHƯA CHIA TASK, CHƯA VIẾT DÒNG CODE NÀO.** Phase 16 nằm ngoài phạm vi `uiux-redesign`; user đã yêu cầu tiếp tục các module UI/UX trước.
> **Người ghi:** Claude, phiên 2026-07-22.
>
> File này tồn tại vì yêu cầu này **không phải việc UI/UX** — nó đổi mô hình dữ liệu. Nó nằm ngoài `uiux-redesign` (`DS-003` cấm đổi database/API/validation) nên **không được lén làm trong một task UI/UX**. Ghi ở đây để không bị quên và để agent sau không tự ý triển khai.

---

## 1. User muốn gì — nguyên văn

> "hình 1 là giao diện tạo flashcard của giáo viên, hình 2 giao diện sử dụng flashcard của học viên. đây là giao diện của trang https://quizlet.com/ và đây cũng là kiểu giao diện, quy trình tạo và sử dụng flashcard tôi muốn hướng đến"
>
> "trang web hiện tại đang sử dụng hình ảnh flashcard luôn chứ không cần ghi từng dòng tiêu đề hay mô tả, thuật ngữ, định nghĩa,... nhưng nếu up hình lên như vậy sẽ rất khó responsive theo từng thiết bị"

**Vấn đề gốc user nêu ra, nói lại cho rõ:** thẻ hiện tại là **ảnh chụp nguyên trang**. Ảnh có tỉ lệ cố định. Màn hình thì không. Nên trên điện thoại chữ trong ảnh hoặc bé không đọc nổi, hoặc bị cắt — và không có cách nào sửa bằng CSS, vì chữ nằm *trong* file ảnh chứ không phải trong DOM. Chuyển sang thuật ngữ/định nghĩa dạng **văn bản thật** là cách duy nhất làm thẻ co giãn được theo thiết bị, đồng thời mở ra: chọn/copy được chữ, đọc màn hình đọc được, tìm kiếm được, TTS đọc được, và font tiếng Trung hiển thị sắc nét ở mọi mật độ điểm ảnh.

---

## 2. Phân tích ảnh 1 — màn hình TẠO bộ thẻ

URL trong ảnh: `quizlet.com/create-set`. Tiêu đề "Tạo một học phần mới".

### 2.1 Cấp bộ thẻ (đầu trang)

| Thành phần                    | Ghi nhận                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Nút **"Tạo"**                 | Góc phải trên, nổi bật, **luôn nhìn thấy** — không phải cuộn xuống đáy mới có |
| Ô **"Tiêu đề"**               | Một dòng, chữ lớn, không viền, nền xám nhạt                                  |
| Ô **"Thêm mô tả…"**           | Nhiều dòng, tùy chọn                                                         |

### 2.2 Thanh công cụ giữa trang

Từ trái sang: **"+ Nhập"** (dán hàng loạt từ Excel/Word), **"+ Thêm sơ đồ"** (có biểu tượng khóa 🔒 — tính năng trả phí của Quizlet), rồi nhóm bên phải: nhãn **"Gợi ý"** + công tắc bật/tắt (tự động gợi ý định nghĩa), nút **tìm kiếm**, nút **hoán đổi** (đảo toàn bộ thuật ngữ ↔ định nghĩa), nút **bàn phím đặc biệt** (nhập ký tự ngoài bàn phím thường), nút **xóa** màu đỏ.

### 2.3 Cấp thẻ — phần quan trọng nhất

Mỗi thẻ là **một hàng** trong danh sách đánh số `1`, `2`, `3`…, gồm:

- **Số thứ tự** bên trái.
- **Tay cầm kéo-thả `≡`** và **nút xóa 🗑** ở góc phải hàng.
- **Ô "THUẬT NGỮ"** — bên trái, khoảng 45% chiều rộng.
- **Ô "ĐỊNH NGHĨA"** — ở giữa, khoảng 45%.
- **Ô "Hình ảnh"** — ô vuông nhỏ ngoài cùng phải, viền đứt, có biểu tượng ảnh. **Tùy chọn**, đính kèm cho phần định nghĩa.
- Nhãn `THUẬT NGỮ` / `ĐỊNH NGHĨA` nằm **dưới** ô nhập, in hoa, cỡ nhỏ.

Cuối danh sách: nút **"Thêm thẻ"** rộng, căn giữa.

> 🔑 **Kết luận cốt lõi:** nội dung thẻ là **văn bản có cấu trúc**; ảnh chỉ là **phụ kiện tùy chọn**. Đây là điều ngược hoàn toàn với hệ hiện tại.

---

## 3. Phân tích ảnh 2 — màn hình HỌC của học viên

URL trong ảnh: `quizlet.com/<id>/flashcards`. Toàn màn hình, không có sidebar.

### 3.1 Thanh trên

| Vị trí | Thành phần                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------- |
| Trái   | **"Thẻ ghi nhớ ▾"** — dropdown đổi chế độ học (Thẻ ghi nhớ / Học / Kiểm tra / Ghép thẻ)        |
| Giữa   | Bộ đếm **"1 / 11"** trên, **tên học phần** dưới                                                |
| Phải   | Nút AI "Biến thuật ngữ thành câu hỏi", nút **cài đặt** ⚙, nút **đóng** ✕ (thoát chế độ tập trung) |

### 3.2 Thẻ

- Chiếm gần hết chiều cao màn hình, nền trắng, bo góc, viền mảnh.
- **"Hiển thị gợi ý"** (💡) góc trái trên.
- Nút **loa** 🔊 (đọc to) và nút **sao** ★ (đánh dấu thẻ khó) góc phải trên.
- Nội dung **căn giữa cả hai chiều, cỡ chữ rất lớn** (~40px), tự co theo lượng chữ.
- Dải màu đậm dưới đáy thẻ: **"Nhấp vào thẻ để lật"**.

### 3.3 Thanh dưới

- Trái: công tắc **"Theo dõi tiến độ"** — bật thì chuyển sang chế độ "đã biết / chưa biết".
- Giữa: nút **←** và **→** dạng tròn (nút ← mờ khi đang ở thẻ đầu).
- Phải: nút **phát tự động** ▶ và nút **xáo trộn** 🔀.

---

## 4. Hệ hiện tại đang làm gì — đọc từ source

| Điểm                | Thực tế trong repo                                                                                       | Bằng chứng                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Ai tạo              | **Chỉ Super Admin**, ở `/admin/flashcards`. **Giáo viên KHÔNG tạo được flashcard.**                        | `src/app/(dashboard)/admin/flashcards/page.tsx`; `lib/permissions/navigation.ts` |
| Phân cấp            | `deck` (1 bộ / 1 khóa học) → `section` (buổi, có `session_number`) → `page` (trang)                       | `flashcard_decks` / `_sections` / `_pages` trong `src/types/database.ts:1398+`  |
| Nội dung một thẻ    | **Hai file ảnh**: `front_image_path` + `back_image_path`, cả hai **NOT NULL**                             | `database.ts:1443-1458`; `schema.ts:22-23` (`.min(1)`)                          |
| Chữ trên thẻ        | Chỉ có `term` (nullable) — dùng làm **nhãn ngoài thẻ**, không vẽ lên thẻ. Không có trường "định nghĩa"    | `student-flashcard-reader.tsx:296-303`                                          |
| Ảnh                 | **Bắt buộc**, là toàn bộ nội dung                                                                         | `FlashcardFace` render `<Image fill>` phủ kín thẻ                              |
| Audio               | `audio_path` — bắt buộc với trang từ vựng, cấm với trang mở đầu                                          | `schema.ts:33-41`                                                               |
| Hai loại trang      | `session_cover` (trang mở đầu buổi) và `vocabulary`                                                       | enum `flashcard_page_kind`                                                      |
| Học viên dùng ở đâu | `/student/review` — tab Flashcard + tab Ôn câu sai                                                        | `src/app/(dashboard)/student/review/page.tsx`                                   |
| Lật thẻ             | Click/Enter/Space lật quanh trục **X** (trên↔dưới); chuyển trang lật quanh trục **Y**; có `reduced-motion` | `student-flashcard-reader.tsx:339-373`; chốt ở `P14-T9`                        |
| Điều hướng          | Vuốt, ← →, nút tròn hai bên, mục lục buổi dạng tab                                                        | cùng file                                                                       |
| Tốc độ audio        | `0.5× / 0.75× / 1×`, mặc định `1×` (`DS-019`, `P14-T12`)                                                 | `components/shared/student-audio-player.tsx`                                    |

---

## 5. Khoảng cách giữa hai bên

| # | Hạng mục | Hiện tại | Quizlet | Mức độ |
|---|---|---|---|---|
| 1 | Nội dung thẻ | 2 file ảnh bắt buộc | 2 ô chữ + ảnh tùy chọn | 🔴 **Đổi schema** |
| 2 | Responsive | Ảnh tỉ lệ cứng, `object-cover` trên mobile → **cắt mất nội dung** | Chữ tự xuống dòng, tự co cỡ | 🔴 Chính là vấn đề user nêu |
| 3 | Người tạo | Chỉ Super Admin | (user nói "giáo viên") | 🔴 **Đổi phân quyền + RLS** |
| 4 | Nhập liệu | Upload từng file ảnh cho từng mặt | Gõ thẳng dạng bảng, nhiều thẻ một màn | 🔴 Làm lại màn tạo |
| 5 | Nhập hàng loạt | Không có | "+ Nhập" dán từ Excel | 🟡 Tính năng mới |
| 6 | Đảo mặt trước/sau | Không có | Nút hoán đổi | 🟡 Tính năng mới |
| 7 | Kéo-thả sắp xếp | Có (`reorder_flashcard_pages` RPC) | Có | 🟢 Đã có |
| 8 | Đếm thẻ khi học | "Trang 1/8" ở dưới | "1 / 11" giữa thanh trên | 🟢 Chỉ là bố cục |
| 9 | Chế độ tập trung | Không — nằm trong shell dashboard | Toàn màn hình, có nút ✕ | 🟡 UI |
| 10 | Xáo trộn | Không có | Có | 🟡 Tính năng mới |
| 11 | Phát tự động | Không có | Có | 🟡 Tính năng mới |
| 12 | Đánh dấu thẻ khó ★ | Không có | Có, lưu theo người học | 🔴 **Bảng mới + RLS** |
| 13 | Theo dõi tiến độ (biết/chưa biết) | Không có ở Flashcard (chỉ Ôn câu sai có mastery) | Có | 🔴 **Bảng mới + RLS** |
| 14 | Gợi ý (hint) | Không có | Có | 🟡 Thêm trường |
| 15 | Đọc to | Có, nhưng là **file audio người thật upload** | TTS máy đọc | 🟢 Cách hiện tại **tốt hơn** cho tiếng Trung — giữ nguyên |
| 16 | Phân cấp | deck → **buổi** → trang | set → thẻ (phẳng) | ⚠️ Ta có thêm một cấp; **cấp buổi là giá trị riêng của Polymind, không nên bỏ** |
| 17 | Trang mở đầu buổi | Có (`session_cover`) | Không có khái niệm này | ⚠️ Cần quyết định số phận |
| 18 | Gợi ý tự động / sơ đồ / AI | Không có | Có | ⚪ **Ngoài phạm vi** — không làm |

---

## 6. Điều phải giữ, không được đánh đổi

1. **Audio do người thật thu, không dùng TTS.** Đây là dạy phát âm tiếng Trung — thanh điệu máy đọc sai là dạy sai. `DS-019` và `P14-T12` đã chốt.
2. **Cấp "buổi" (`section`).** Quizlet phẳng vì nó là công cụ cá nhân; Polymind là trung tâm dạy học có giáo trình theo buổi, và học viên chỉ thấy buổi đã công bố. Bỏ cấp này là mất quyền kiểm soát tiến độ.
3. **Luồng `draft → published → archived`.** Học viên không được thấy nội dung chưa công bố.
4. **Hoạt ảnh lật đã chốt ở `P14-T9`** và `prefers-reduced-motion`.
5. **RLS + signed URL** cho mọi media.
6. **Tiếng Việt toàn bộ giao diện** (`D-12`), footer bản quyền (`D-17`).
7. **Ảnh không bị xóa khỏi hệ thống** — chuyển từ "bắt buộc" thành "tùy chọn", vì tiếng Trung có chữ tượng hình, thứ tự nét, ảnh minh họa đều đáng giá.

---

## 7. Câu hỏi phải có câu trả lời của user trước khi làm

| # | Câu hỏi | Vì sao chặn |
|---|---|---|
| **Q1** | **Ai được tạo flashcard?** User gọi ảnh 1 là "giao diện tạo flashcard của giáo viên", nhưng hệ hiện tại **chỉ Super Admin** tạo được. Đây là thay đổi phân quyền thật, không phải nhầm chữ? | Đổi vai trò = viết lại RLS policy + nav + kiểm thử 3 role. Không được đoán. |
| **Q2** | **Bộ thẻ ảnh đang có xử lý sao?** (a) Giữ song song hai kiểu thẻ; (b) chuyển hết sang thẻ chữ rồi bỏ kiểu ảnh — cần nhập tay lại nội dung vì máy không đọc được chữ trong ảnh; (c) chưa có dữ liệu thật nên xóa sạch làm lại. | Quyết định migration. Sai một bước là mất nội dung đã soạn. |
| **Q3** | **Một thẻ từ vựng gồm những trường nào?** Tiếng Trung thường cần: **Hán tự · Pinyin · Nghĩa tiếng Việt · Ví dụ · Audio · Ảnh (tùy chọn)**. Quizlet chỉ có 2 ô nên phải dồn Pinyin vào chung ô. Ta có nên tách riêng trường Pinyin không? | Đây là schema. Sửa sau khi đã có dữ liệu thì rất đắt. |
| **Q4** | **"Theo dõi tiến độ" và "đánh dấu thẻ khó" có làm không?** Đây là **tính năng mới**, cần bảng mới + RLS, không phải trang trí. `DS-027` đang cấm tự thêm gamification. | Quyết định phạm vi. |
| **Q5** | **Trang mở đầu buổi (`session_cover`) giữ hay bỏ?** Quizlet không có khái niệm này; ta vừa làm 2 task cho nó (`P14-T10`, `P14-T11`). | Ảnh hưởng migration và cả `publish_flashcard_section`. |
| **Q6** | **Xáo trộn / phát tự động / nhập hàng loạt / đảo mặt — có làm không?** Bốn tính năng mới độc lập nhau. | Phạm vi và khối lượng. |

---

## 8. Ảnh hưởng tới `uiux-redesign` — phải xử lý ngay

**`P15-T5` / `UIUX-M24` (Ôn tập = Flashcard + Ôn câu sai) là task kế tiếp trên board, và nó đụng đúng file sắp bị viết lại.**

Nếu thiết kế lại `student-flashcard-reader.tsx` theo Learning Journey Bento bây giờ, rồi sau đó đổi mô hình dữ liệu sang thuật ngữ/định nghĩa, thì **toàn bộ phần Flashcard của M24 phải làm lại lần hai** — kể cả test và E2E. Đây đúng loại lãng phí mà `P14-T12` đã được làm trước M20 để tránh.

**Cách xử lý đã chọn (Claude, 2026-07-22):** tách `P15-T5` làm hai nửa.

- **Nửa "Ôn câu sai"** (`wrong-answer-review.tsx`) — **không** phụ thuộc mô hình flashcard → làm bình thường.
- **Nửa "Flashcard"** (`student-flashcard-reader.tsx`) — **hoãn** cho tới khi Q1–Q6 có câu trả lời. Không đánh dấu M24 `DONE` khi còn treo nửa này; ghi rõ `PARTIAL`.
- Tiếp tục `P15-T6` → `P15-T8` (M25, M26, M27) vì không module nào trong đó chạm flashcard.

---

## 7bis. CÂU TRẢ LỜI CỦA USER — phiên 2026-07-22 (đợt 2)

> Sáu câu `Q1`–`Q6` **đã có câu trả lời**. Phần dưới là nguyên trạng câu chốt; §7 giữ lại làm lịch sử, không xoá.

| # | Chốt | Ghi chú bắt buộc nhớ |
|---|---|---|
| **Q1** | **Giữ nguyên — chỉ Super Admin tạo flashcard.** | Ảnh 1 của Quizlet chỉ là tham khảo **bố cục**, không phải yêu cầu đổi vai trò. ⛔ **Không đụng RLS, không mở nav flashcard cho giáo viên.** Phase 16 nhẹ đi đáng kể. |
| **Q2** | **Chưa có dữ liệu thật → xoá làm lại.** | ⚠️ **Điều kiện kèm theo do Claude đặt ra và user chấp nhận khi chọn:** trước khi viết migration phải **đếm dữ liệu thật trong DB**. Nếu có bộ thẻ do người thật soạn → **dừng, báo lại**, không tự xoá. |
| **Q3** | **Tách Pinyin thành trường riêng** — nhưng xem **§7ter**, ảnh mẫu user gửi sau đó **mở rộng lớn** phạm vi câu này. | Câu trả lời "tách Pinyin" vẫn đúng và vẫn giữ; nhưng thẻ còn nhiều trường khác nữa. |
| **Q4** | **Chỉ làm ★ đánh dấu thẻ khó. Hoãn "theo dõi tiến độ (biết/chưa biết)".** | Một bảng nhỏ `(student_id, page_id)` + RLS. Không đụng mastery của Ôn câu sai — tránh hai nguồn sự thật. |
| **Q5** | **Bắt buộc có trang mở đầu buổi.** Trang mở đầu **chỉ upload ảnh, đúng 2 mặt, không nhập chữ, không có mp3.** | Nguyên văn user: *"phải có trang mở đầu, trang mở đầu thì chỉ cần up ảnh lên, 2 mặt, không cần nhập chữ gì hết nếu admin chọn edit trang mở đầu, không có file mp3 luôn"*. → `session_cover` **giữ nguyên mô hình ảnh hiện tại**. Chỉ `vocabulary` mới chuyển sang dạng chữ. Đây là điểm rất quan trọng: **hai loại trang sẽ có hai mô hình dữ liệu khác nhau**, migration phải phân biệt. |
| **Q6** | Làm **3**: nhập hàng loạt · xáo trộn · phát tự động. **Không làm** đảo mặt trước/sau. | Chi tiết ràng buộc ở bảng dưới. |

### Ràng buộc chi tiết của `Q6`

| Tính năng | Chốt |
|---|---|
| **Nhập hàng loạt ("+ Nhập")** | ✅ Làm. |
| **Xáo trộn 🔀** | ✅ Làm, **cho tài khoản học viên**. Phạm vi xáo trộn = **chỉ buổi đang được chọn**, không xáo cả bộ. **Đăng xuất → đăng nhập lại phải trở về thứ tự gốc.** → Nghĩa là **không lưu vào DB**, chỉ giữ trong bộ nhớ phiên; đăng xuất là mất. Không dùng `localStorage` bền qua phiên. |
| **Phát tự động ▶** | ✅ Làm, cho tài khoản học viên. |
| **Đảo mặt trước/sau** | ⛔ **Không làm.** User đã được giải thích cả hai kiểu (admin ghi đè DB / học viên đổi hiển thị tạm) và chọn bỏ hẳn. Không tự thêm lại. |

---

## 7ter. Thẻ mẫu thật của POLYMIND — user gửi 2 ảnh, "làm theo mẫu này"

> **Đây mới là đặc tả thẻ, không phải Quizlet.** Quizlet chỉ đóng góp *cách nhập liệu dạng bảng* và *cách học*. Nội dung thẻ đi theo mẫu này.

Thẻ mẫu: từ `胡萝卜` (củ cà rốt).

### Mặt trước

| Thành phần | Trong ảnh | Kết luận |
| --- | --- | --- |
| Logo PolyMind | Trên cùng, căn giữa | **Chrome cố định của template, KHÔNG phải dữ liệu nhập.** Không tạo trường cho nó. |
| Pinyin | `hú   luó   bǔ` — **tách theo âm tiết, mỗi âm căn thẳng trên đúng chữ Hán bên dưới** | Bắt buộc. Xem "Hai dạng pinyin" bên dưới. |
| Hán tự | `胡萝卜` — cỡ rất lớn, đậm nhất trang | Bắt buộc. |
| Nghĩa tiếng Việt | `Củ cà rốt` — **màu cam thương hiệu**, dưới Hán tự | Bắt buộc. |
| Ảnh minh họa | Hình cà rốt, chiếm nửa dưới thẻ | **Tuỳ chọn** nhưng mẫu có → mặc định nên có. |

### Mặt sau — 5 khối, mỗi khối một màu viền

| # | Khối | Trong ảnh | Cấu trúc dữ liệu |
| --- | --- | --- | --- |
| 1 | **Đầu thẻ** (nền be) | `胡萝卜 — húluóbo` | Hán tự + pinyin **viết liền**, không phải trường mới — dẫn xuất từ mặt trước. |
| 2 | **Nghĩa** (viền xanh lá) | `Củ cà rốt` + ảnh nhỏ | Dùng lại **nghĩa** của mặt trước, nhưng **ảnh là ảnh RIÊNG của mặt sau** — xem ghi chú ⬇️. |

> ⚠️ **Sửa 2026-07-23 (user chốt ở `P16-T1`) — trước đây ô này ghi "dùng lại ảnh của mặt trước".**
> Câu đó **trái với ràng buộc DB** `flashcard_pages_distinct_media_check`, vốn ép
> `front_image_path <> back_image_path`. User đã được trình bày ba phương án
> (để trống ảnh mặt sau · nới CHECK cho `vocabulary` · sửa mô tả này) và **chọn giữ
> nguyên CHECK, sửa mô tả**. Vì vậy: **thẻ từ vựng có ảnh thì mặt trước và mặt sau là
> HAI FILE KHÁC NHAU.** Ảnh vẫn là **tuỳ chọn** — thẻ không có ảnh nào vẫn hợp lệ, và
> hai cột ảnh độc lập nhau; chỉ khi cả hai cùng có mặt thì DB mới bắt chúng phải khác file.
| 3 | **Tách nghĩa** (viền xanh dương) | `胡 (hú): từ chỉ nguồn gốc bên ngoài` · `萝卜 (luóbo): củ cải, rau củ` | **Danh sách 0..n**, mỗi mục = `{ thành tố Hán tự, pinyin, nghĩa }`. ⚠️ Thành tố **không phải luôn 1 chữ** — `萝卜` là 2 chữ. Nên đây là **chuỗi con do người soạn tự cắt**, máy không tự tách được. |
| 4 | **Câu ví dụ** (viền tím) | `我喜欢吃胡萝卜。` / `Wǒ xǐhuan chī húluóbo` / `Tôi thích ăn cà rốt.` + ảnh | **Danh sách 0..n**, mỗi mục = `{ câu Hán, pinyin câu, nghĩa tiếng Việt, ảnh (tuỳ chọn) }`. |
| 5 | **Cụm từ thường dùng** (viền cam) | 4 dòng: `吃胡萝卜 — chī húluóbo — ăn cà rốt` … | **Danh sách 0..n**, mỗi mục = `{ cụm Hán tự, pinyin, nghĩa tiếng Việt }`. |

### Ba phát hiện phải xử lý, không được bỏ qua

**1. Hai dạng pinyin, không phải một.**
Mặt trước cần pinyin **tách rời từng âm tiết** để căn thẳng trên từng chữ Hán (`hú` `luó` `bo`). Mặt sau cần pinyin **viết liền đúng chính tả** (`húluóbo`). Cách an toàn: **lưu dạng tách** (`"hú luó bo"`), mặt sau **bỏ dấu cách khi hiển thị**. Chiều ngược lại không làm được — máy không tự cắt `húluóbo` thành 3 âm tiết một cách chắc chắn.

**2. Ảnh mẫu có lỗi dấu thanh — ✅ ĐÃ ĐÓNG, user chốt KHÔNG xét (2026-07-23, `DS-050`).**
Mặt trước ghi `bǔ` (thanh 3), mặt sau ghi `bo` (thanh nhẹ); trong `萝卜` chữ `卜` đọc **thanh nhẹ `bo`** nên mặt trước sai. **User chốt không xử lý**: hai ảnh `胡萝卜` chỉ là **mẫu bố cục**, dùng thật sẽ thay ảnh khác.
⛔ **Hệ quả phải nhớ:** ảnh mẫu là chuẩn cho **CÁCH DỰNG thẻ**, **không** phải chuẩn cho **nội dung thẻ** — không được nhân bản nội dung của nó vào `seed.dev.sql` ở `P16-T9`.

**3. Ba danh sách con → ✅ ĐÃ CHỐT: 3 cột `jsonb` + Zod (2026-07-23, `DS-050`).**
Chọn hướng (b) — 3 cột `jsonb` trên `flashcard_pages` (`sense_breakdown`, `example_sentences`, `common_phrases`), không tách bảng con: ba danh sách luôn được đọc/ghi **cùng lúc với thẻ**, không truy vấn độc lập, không phân quyền riêng.
⚠️ **Trách nhiệm đi kèm:** `jsonb` **không có FK và không có CHECK hình dạng ở tầng DB**, nên **Zod là chỗ cưỡng chế DUY NHẤT** — mọi đường ghi phải đi qua nó (`BUG_M10_01`). DB chỉ giữ một cái sàn (`flashcard_pages_sublists_array_check`: ba cột luôn là mảng).

**4. Ảnh trong câu ví dụ phải đi qua `media_paths` (2026-07-23, `DS-050` điểm 2).**
Ảnh của khối 4 nằm trong `jsonb` nên chính sách cũ — vốn liệt kê cứng ba cột `front_image_path`/`back_image_path`/`audio_path` — **không thấy nó**, khiến học viên nhận **403** trong khi admin vẫn xem được. Nay `flashcard_pages.media_paths text[]` do **trigger** tổng hợp mọi nguồn media, có index GIN, và `app.can_student_read_flashcard_media()` kiểm bằng `media_paths @> array[<path>]`. Khoá bằng pgTAP `flashcard_structured_vocabulary.test.sql` (đã kiểm ngược: khôi phục hàm cũ → đỏ đúng 2 bài).

### Hệ quả lớn nhất: hai loại trang, hai mô hình dữ liệu

| Loại trang | Mô hình sau Phase 16 |
| --- | --- |
| `session_cover` | **Giữ nguyên 2 file ảnh, không chữ, không audio** (chốt `Q5`) |
| `vocabulary` | **Bản ghi có cấu trúc** theo §7ter, ảnh tuỳ chọn, audio người thật giữ nguyên |

→ Migration **không được** drop `front_image_path`/`back_image_path` một cách vô điều kiện; hai cột đó vẫn là nội dung chính của `session_cover`. Ràng buộc NOT NULL phải chuyển thành **ràng buộc theo `kind`** (CHECK constraint).

✅ **Đã thực hiện ở migration `20260723000070_flashcard_structured_vocabulary.sql` (`P16-T1`):** hai cột được giữ nguyên và chuyển sang nullable, kèm `flashcard_pages_image_kind_check` ép `session_cover` vẫn phải đủ hai ảnh. Cột `term` bị `hanzi` thay hẳn (không giữ hai nguồn sự thật cho cùng một dữ liệu — `BUG_M10_01`).

---

## 9. Việc **không** được làm khi chưa có duyệt

> ✅ **Cập nhật 2026-07-23:** cổng `P16-T0` đã mở (user đếm dữ liệu trên cloud: `decks/sections/pages = 0`, không có bộ thẻ do người thật soạn) và `DS-050` đã chốt đủ 4 điểm mô hình. **Bốn gạch đầu dòng đầu nay ĐÃ ĐƯỢC DUYỆT** trong phạm vi Phase 16 (`P16-T1`…`P16-T7`).

- ✅ ~~Không viết migration đổi `flashcard_pages`.~~ → đã duyệt, làm ở `P16-T1`.
- ✅ ~~Không sửa `schema.ts`, `actions.ts`, `queries.ts` của flashcard.~~ → đã duyệt, làm ở `P16-T2`.
- ✅ ~~Không đổi RLS policy hay quyền tạo flashcard.~~ → chỉ đổi **policy đọc media** sang `media_paths`; ⛔ **quyền tạo vẫn là Super Admin, tuyệt đối không đổi** (`Q1`).
- ✅ ~~Không thêm bảng tiến độ/đánh dấu thẻ.~~ → chỉ ★ **thẻ khó** ở `P16-T7`; ⛔ **không** làm theo dõi biết/chưa biết (`Q4` hoãn).
- ⛔ **VẪN HIỆU LỰC:** không "tiện tay" làm một phần trong task UI/UX — `DS-003` cấm đổi database/API/validation trong đợt redesign. Từ `P16-T8` trở đi ràng buộc này áp lại đầy đủ: mọi thay đổi query/action/RPC/RLS/route/phân quyền/validation/nhãn phải đã xong ở `P16-T1`…`P16-T7`.
