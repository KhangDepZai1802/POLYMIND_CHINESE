# 09 — Module Xuất khẩu lao động

Nguồn yêu cầu: ảnh người dùng cung cấp ngày 14/10/2026, mục 5 và 6. Đây là yêu cầu xây mới trong POLYMIND_CHINESE, thay thế giới hạn chỉ làm nút ở MODULE-XKLD-BUTTON-1. Không sửa hoặc nhập dữ liệu từ repo POLYMIND APP.

## 1. Phạm vi nghiệp vụ

| Nhóm | Dữ liệu cần quản lý |
| --- | --- |
| Ứng viên | Mã UV, họ tên, ngày sinh, SĐT/Zalo, quê quán, trình độ, nghề, sức khỏe đạt/không, nguồn CTV/nhân viên/quảng cáo, người phụ trách. |
| Thị trường và đơn hàng | Quốc gia (ví dụ Singapore, Nhật, Đài Loan), chủ sử dụng, ngành nghề, số lượng tuyển, lương, điều kiện, hạn tuyển, đối tác. |
| Pipeline | Lead → Tư vấn → Đăng ký/đặt cọc → Đào tạo ngoại ngữ (liên kết lớp B2C) → Hoàn thiện hồ sơ → Phỏng vấn → Trúng tuyển → Visa/giấy phép → Xuất cảnh → Hậu xuất cảnh. |
| Hồ sơ giấy tờ | Checklist theo thị trường, ngày nộp, ngày hết hạn, file đính kèm; phân quyền chặt. |
| Tài chính | Phí dịch vụ theo đợt, đã thu, còn nợ, hoàn phí, hoa hồng CTV, phí thu từ đối tác/chủ sử dụng. |
| Hậu xuất cảnh | Liên hệ định kỳ, tình trạng làm việc, vấn đề phát sinh, về nước sớm và lý do. |

Mã UV cần sinh ở DB, unique; không dùng số thứ tự trên trang làm mã. Các bảng XKLĐ tách khỏi B2B/B2C; liên kết lớp ngoại ngữ bằng ID lớp B2C. Không sao chép tài chính/ghi danh B2C để làm dữ liệu XKLĐ.

## 2. Dashboard theo vai trò trong ảnh

| Vai trò nghiệp vụ | Mở ra thấy | Tần suất |
| --- | --- | --- |
| MS Thương | Doanh thu ghi nhận và thực thu, chi phí, lãi/lỗ, điểm hòa vốn, HV đang học, tỷ lệ lấp đầy, công nợ quá hạn, dự báo dòng tiền 30 ngày, pipeline XKLĐ. | Tuần/tháng |
| Quản lý trung tâm | Lớp dưới ngưỡng, chuyên cần theo lớp, HV vắng hai buổi liên tiếp, danh sách tái phí, năng suất GV và tư vấn. | Hằng ngày |
| Tư vấn/CSKH | Lead cần gọi hôm nay, HV sắp hết phí, phụ huynh cần phản hồi, công nợ cần nhắc, chỉ tiêu cá nhân tháng. | Hằng ngày |
| Giáo viên | Lịch dạy, điểm danh, HV cần chú ý, nhận xét đến hạn. | Mỗi buổi |
| Nhân viên XKLĐ | Ứng viên theo từng giai đoạn, giấy tờ sắp hết hạn, lịch phỏng vấn, công nợ ứng viên. | Hằng ngày |

Ảnh yêu cầu nhân viên XKLĐ nhìn thấy công nợ ứng viên; cần xác nhận phạm vi ứng viên và quyền đọc/ghi tài chính trước khi triển khai quyền mới. Không tự coi vai trò nghiệp vụ này tương đương academic_manager hoặc teacher.

## 3. Các quyết định cần chốt

1. Mapping MS Thương, Quản lý trung tâm, Tư vấn/CSKH và Nhân viên XKLĐ với tài khoản/quyền hiện có hoặc nhóm quyền mới.
2. Nhân viên XKLĐ được xem toàn bộ hay chỉ ứng viên được phân công; được đọc công nợ hay cả phiếu thu/hoàn phí/hoa hồng; ai có quyền sửa và duyệt các khoản này.
3. Đơn vị tiền cho lương đơn hàng, phí ứng viên và khoản thu từ đối tác; không cộng các đồng tiền khác nhau vào cùng tổng nếu chưa có chính sách tỷ giá.
4. Trường hợp không đạt sức khỏe, rút hồ sơ, trượt phỏng vấn hoặc hủy đơn: trạng thái và lý do, quy tắc quay lại giai đoạn trước.
5. Ngưỡng lớp ít học viên, khoảng sắp hết hạn giấy tờ/học phí, chu kỳ liên hệ hậu xuất cảnh và nguồn dữ liệu dự báo dòng tiền. Dashboard không hiển thị số 0 thay cho chỉ số chưa đủ dữ liệu.

Mục 1–2 quyết định chính sách truy cập dữ liệu cá nhân, giấy tờ và tài chính. Chưa tạo role, grant, policy hoặc gán quyền cho tài khoản khi chưa có câu trả lời.

Cập nhật từ user: chưa có tài khoản cho MS Thương, Quản lý trung tâm, Tư vấn/CSKH; user yêu cầu tạo mới. Đã xác nhận nhân viên XKLĐ cần thấy ứng viên theo giai đoạn, giấy tờ sắp hết hạn, lịch phỏng vấn và công nợ ứng viên. Phạm vi ứng viên toàn bộ/theo phân công và quyền ghi tài chính vẫn chưa xác định. Đang hỏi tên đăng nhập/số lượng tài khoản. Luồng cấp tài khoản hiện tại yêu cầu mật khẩu tối thiểu 8 ký tự (src/features/users/schema.ts); yêu cầu mật khẩu ngắn hơn chưa được áp dụng, không tự đổi chính sách toàn hệ thống. Không lưu mật khẩu tài khoản vào tài liệu hoặc repository.

## 4. Thứ tự triển khai và tiêu chí nghiệm thu

1. Chốt phân quyền; thiết kế dữ liệu ứng viên/đơn hàng và lịch sử chuyển bước. Mọi bảng public bật RLS; guard server và RLS nhất quán. Test chéo tài khoản, vai trò, ứng viên ngoài phân công.
2. Bật module thật từ nút hiện có, sidebar/mobile riêng, danh sách tìm kiếm/lọc/phân trang và thêm/sửa hồ sơ; hiển thị trạng thái rỗng từ dữ liệu thật.
3. Pipeline và liên kết lớp B2C. Lưu actor thật và thời điểm đổi bước; không tự thay đổi trạng thái lớp/ghi danh B2C.
4. Checklist giấy tờ và storage private. Tải xuống qua route kiểm session/role/RLS trên hồ sơ; không dùng public URL.
5. Phí theo đợt, phiếu thu/hoàn phí và hoa hồng. Phân biệt khoản phải thu và dòng tiền; chống ghi trùng ở DB; không xóa phiếu lịch sử; thống nhất tiền tệ trước khi tổng hợp.
6. Theo dõi hậu xuất cảnh, liên hệ tiếp theo và lý do về nước sớm.
7. Dashboard theo vai trò sau khi có mapping và dữ liệu nguồn. Kiểm thử quyền từng chỉ số, công thức và cảnh báo thiếu dữ liệu.

Migration mới phải có pgTAP, thử rollback trước khi áp cloud và xác minh history. Không tự chạy lại 15 migration B2C cũ đang thiếu migration history. Kiểm tra lint/typecheck/Vitest/build trước khi bàn giao implementation; chưa commit/push khi user chưa yêu cầu trong lượt đó.

## 5. Tài khoản và phạm vi đã chốt (cập nhật)

User giao tự đặt tên: một tài khoản mỗi vai trò — ms.thuong/executive, quanly.trungtam/center_manager, tuvan.cskh/consultant, nhanvien.xkld/xkld_staff. Nhân viên XKLĐ xem toàn bộ ứng viên, chỉ xem công nợ, không nhập/sửa khoản thu. Mật khẩu khởi tạo 6 ký tự được user cho phép riêng bốn tài khoản này; không lưu giá trị vào repo.

Đã tạo bốn tài khoản Auth/profiles trên cloud, xác minh đăng nhập và cô lập quyền. SQL07 thêm enum, không mở quyền quản trị/B2C. Code local có /workspace và thông báo theo role; các dashboard nghiệp vụ vẫn chờ xây. Website online cần bản phát hành hỗ trợ role mới.

## 6. Trạng thái module nghiệp vụ

Ứng viên đã triển khai thêm/sửa/danh sách tìm-lọc-phân trang và RLS tại /workspace/xkld/candidates, SQL08 đã áp cloud; code chưa phát hành online. Nút XKLĐ dẫn tới trang ứng viên thật. super_admin/xkld_staff thêm/sửa, executive đọc. Thị trường/đơn hàng đã triển khai tại /workspace/xkld/orders với SQL09 cloud; thêm/sửa quốc gia, đơn hàng đủ trường, lương kèm tiền tệ/kỳ, tìm-lọc-phân trang và RLS theo ứng viên. Cả hai phần code chưa phát hành online. Pipeline10 bước đã triển khai tại /workspace/xkld/pipeline với SQL10 cloud: board/search/page, chuyển bước/rollback, link đơn/lớp B2C và lịch sử bất biến. Hồ sơ giấy tờ đã triển khai theo mục dưới; tài chính đã triển khai theo mục dưới; theo dõi hậu xuất cảnh chi tiết và dashboard tổng hợp chưa triển khai. Các câu hỏi về tiền tệ, quy tắc trạng thái và ngưỡng cảnh báo vẫn cần xác định khi làm chức năng tương ứng.


### Chi tiết thị trường/đơn hàng đã chốt bằng implementation

Lương lưu nguyên số tiền dương, tối đa2 số thập phân, mã tiền tệ3 chữ và kỳ giờ/ngày/tháng/năm; không tự quy đổi, không tự coi lương là doanh thu/chi phí trung tâm. Market có mã quốc gia2 chữ và tiền tệ mặc định; ba ví dụ Singapore/Nhật Bản/Đài Loan là danh mục tham chiếu, không phải đơn hàng thật. Chỉ tiêu tuyển nguyên dương; hạn tuyển bao gồm ngày hôm nay. Có trạng thái đang tuyển/tạm dừng/đóng và ngừng sử dụng thị trường, không xóa lịch sử.


### Pipeline đã triển khai

Mỗi ứng viên có một bước hiện tại; tiến tuần tự và quay lại có lý do. Từ bước đào tạo phải gắn lớp B2C; từ phỏng vấn phải có đơn hàng. Lớp/đơn tra theo metadata phân trang, không mở quyền hồ sơ B2C. UUID/phiên bản và lịch sử DB đảm bảo thao tác không trùng, không ghi đè hoặc thiếu event. Đặt cọc/ghi danh/thu phí không tự sinh từ chuyển bước. Bước Hậu xuất cảnh hiện là trạng thái, chưa có module liên hệ hậu xuất cảnh chi tiết.


### Hồ sơ giấy tờ đã triển khai

Routes /workspace/xkld/documents, /checklists và /[candidateId]. Checklist cấu hình theo thị trường, không seed yêu cầu pháp lý chưa được cung cấp. Ngày nộp/hết hạn, ghi chú và cảnh báo30 ngày theo giờ VN. Thị trường lấy mặc định từ đơn hàng hoặc chọn rõ; dữ liệu cũ không bị mất khi đổi đơn/thị trường. Metadata/checklist25 trang, file20 trang. Nhiều file PDF/PNG/JPG10 MB lưu private, phiên bản mới không ghi đè/xóa bản cũ. Staff/admin cập nhật, executive chỉ đọc/download, role khác deny. App download qua route kiểm session/role/RLS, không cấp public URL; file upload không tự xác nhận hợp lệ. SQL11 cloud, UI local cổng3105; chưa phát hành online.


### Tài chính — user chốt 14/10/2026

Chỉ VNĐ. Quản trị viên và MS Thương (super_admin/executive) xem và chỉnh sửa tài chính. Nhân viên XKLĐ chỉ xem công nợ ứng viên, không có khoản thu/hoàn/hoa hồng hoặc tài chính đối tác. Triển khai từng đợt nghĩa vụ phải thu/phải chi, giao dịch bất biến có hủy lý do, lịch sử sửa. Hoàn tiền chọn rõ giảm phí phải thu hoặc giữ nguyên phí để công nợ tăng lại; không tự suy chính sách hoàn phí.


### Tài chính đã triển khai

/workspace/xkld/finance và /[candidateId]: phí ứng viên/đối tác theo đợt, công nợ, phiếu thu/hoàn; hoa hồng phải chi/đã chi. Chỉ VNĐ, admin/executive ghi/sửa, staff chỉ projection công nợ ứng viên (kể cả cố đổi kind hoặc gọi RPC). Không mở khoản thu/CTV/đối tác/audit cho staff. Hoàn có lựa chọn giảm phí hoặc giữ phí; hủy có lý do và lịch sử, không hard delete. SQL12 cloud; code local chưa phát hành online.
