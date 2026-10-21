# 01 — Phân tích nghiệp vụ (Business Analysis)

## Giáo viên lưu dữ liệu, admin xem (2026-10-21)

User xác nhận không cần gửi admin hay duyệt: giáo viên B2C lưu dữ liệu của lớp mình thì admin xem cùng bản ghi trong màn tương ứng, gồm cả nhận xét tháng nháp. Quyền hiện tại vẫn quyết định ai được nhập gì; không tự cấp thêm quyền điểm/tài chính hoặc mở lớp ngoài phân công. Admin mở/tải lại dữ liệu để thấy bản mới, không mặc định có đẩy realtime giữa các trình duyệt.

## Chấm công theo lịch tuần (2026-10-21)

Theo yêu cầu mới, lớp active được phân công và đã khai giảng có lịch tuần đúng hôm nay, giờ rõ ràng, phải hiện tại Chấm công dù chưa tạo buổi theo ngày. Buổi theo ngày có sẵn được ưu tiên; hủy buổi sẽ chặn lịch tuần thay thế. Check-in có ảnh chỉ thành công trong cùng ngày từ 15 phút trước giờ bắt đầu đến trước giờ kết thúc; check-out từ giờ kết thúc đến hết ngày. Không tự đoán giờ thiếu, không tự ghi check-in hoặc tính tiền chỉ vì xem trang.

## B2C-STUDENT-SESSIONS-1 (2026-10-16)

Số buổi mỗi ghi danh: đã học gồm có mặt/đi muộn/học bù, học bù là tập con của đã học; nghỉ phép và không phép riêng. Chỉ điểm danh của buổi đã kết thúc, không hủy được tính. Còn lại = registered_sessions - đã học; null khi chưa nhập, âm hiển thị vượt đăng ký. Không trừ tiền hoặc suy công nợ.

Nhãn hình thức làm việc giáo viên trên giao diện và xuất Excel dùng Fulltime / Part-time (2026-10-16); giá trị full_time / part_time và cách tính tiền công giữ nguyên.

## Ngày kết thúc khóa học B2C (2026-10-16)

Lớp có ngày kết thúc khóa học tùy chọn, độc lập hạn học phí và lịch buổi học. Cho phép chưa biết ngày khai giảng; nếu có cả hai ngày thì kết thúc phải cùng hoặc sau khai giảng. Lớp cũ để null, không tự đổi trạng thái hay lịch.

## Zalo phụ huynh khi thêm học viên (2026-10-16)

Biểu mẫu tạo học viên mới có Số Zalo phụ huynh (không bắt buộc), để trống lưu null, nếu nhập dùng số10 chữ số như SĐT hệ thống. Không tự lấy từ SĐT liên hệ và không bắt buộc tên phụ huynh chỉ để lưu số Zalo. Khi chọn học viên đã có không ghi đè Zalo dùng chung. Trang Học viên tổng hiển thị Zalo dưới tên phụ huynh, có trong popup chi tiết và Excel; đọc thêm Zalo của phụ huynh đã liên kết, loại số trùng. Không tự đồng bộ sửa hồ sơ phụ huynh hoặc đoán dữ liệu cũ.

## Thêm học viên vào lớp B2C (2026-10-16)

Quản trị/giáo vụ mở popup hoặc trang lớp → Học viên → Thêm học viên. Chọn tạo mới (tên bắt buộc, mã B2C-HV tự sinh; ngày sinh/phụ huynh/liên hệ/nguồn tùy chọn) hoặc tìm hồ sơ đã có theo mã/tên/SĐT/phụ huynh,20 kết quả/trang. Tạo hồ sơ và ghi danh cùng transaction; chọn có sẵn giữ nguyên hồ sơ dùng chung. Người chốt/ngày nhập học bắt buộc; ngày học/hạn phí/mục tiêu/chứng chỉ/ghi chú thuộc ghi danh. Trạng thái ban đầu studying; không tạo account/phiếu thu/gói học phí tự động. Gói được lập tại mục Học phí của lớp sau ghi danh.

Không ghi danh trùng cùng lớp; có thể học nhiều lớp với cùng hồ sơ. Lớp completed/cancelled không nhận mới; sĩ số tối đa dựa số ghi danh chưa withdrawn/completed. Sau thêm, enrolled_count đồng bộ số ghi danh còn chiếm chỗ của lớp. Lưu lại cùng request/payload/actor không tạo trùng; khác nội dung cùng UUID bị chặn. Học viên có cùng tên/SĐT không tự gộp (có thể là anh/chị/em dùng liên hệ chung); người nhập dùng chế độ hồ sơ có sẵn để tránh tạo trùng. Quyền edit_students của giáo viên chưa bao gồm thêm ghi danh.

## Admin quản lý tài khoản giáo viên (2026-10-16)

Chỉ super_admin xem/quản lý tài khoản. B2C → Giáo viên có nút Tài khoản theo từng hồ sơ; trang Giáo viên chung có cột tên đăng nhập và menu Đặt lại mật khẩu dùng cùng popup. Popup hiển thị tên giáo viên, tên đăng nhập (email Auth thực tế nếu tài khoản cũ không có username), vai trò và trạng thái khóa; nhập mật khẩu mới8–72 ký tự và xác nhận. Không xem được mật khẩu hiện tại. Đổi mật khẩu không sửa username/email/role/is_active hoặc tự mở khóa. Không lưu mật khẩu vào profile/audit. B2C resolve bằng source_teacher_id → teachers.user_id, không đoán theo tên; chưa liên kết thì hướng dẫn Phân quyền B2C để chọn tài khoản đã có. Tạo tài khoản mới vẫn theo trang Giáo viên chung.

## Xử lý học phí B2C (2026-10-16)

Quản trị/giáo vụ vào Học phí → Xử lý học phí. Hủy dùng cho phiếu thu ghi nhầm, giữ nguyên chứng từ/số tiền gốc, đánh dấu đã hủy và loại khỏi tổng thu; khoản phải thu không đổi. Phiếu đã có hoàn tiền không được hủy. Hoàn tiền thực tế ghi riêng theo phiếu gốc, nhiều lần nhưng tổng không vượt số thu gốc; chọn giảm khoản phải thu tương ứng hoặc giữ khoản phải thu (phần hoàn trở thành nợ). Không tự chuyển tiền ngân hàng. Điều chỉnh phải thu bằng chiết khấu: không âm, không thấp hơn thu ròng, không vượt số buổi × đơn giá; tăng tạm tính qua sửa Gói học phí. Sửa gói đã tồn tại bắt buộc lý do, gồm cả thay đổi số buổi/đơn giá/chiết khấu.

Mọi xử lý bắt buộc lý do, ngày không tương lai; hủy/hoàn không trước ngày thu. Chứng từ gốc không bị xóa. Thu ròng = tổng phiếu chưa hủy trừ tiền đã hoàn; nợ = phải thu − thu ròng. Trang học phí, workspace quản lý/giáo viên và chỉ số GV dùng cùng thu ròng; báo cáo tháng nhập tay giữ nguyên. Quyền thu của giáo viên không bao gồm hủy/hoàn/điều chỉnh qua màn xử lý. Lịch sử xử lý manager xem theo gói, audit chung vẫn chỉ super_admin; actor thật từ auth.uid(). Gói có số dư thay đổi phải tải lại, retry cùng UUID/nội dung không tạo trùng.

## Điểm danh B2C trên điện thoại (2026-10-15)

Theo từng buổi: Có mặt, Vắng có phép, Vắng không phép, Học bù; giữ Đi muộn để không mất dữ liệu/chức năng cũ. Học bù là trạng thái tham dự trong buổi đang chọn, không tự xếp buổi khác hoặc trừ học phí. Giáo viên cần quyền Điểm danh học viên trong lớp được phân công. Điện thoại hiện thẻ từng học viên với trạng thái, ghi chú và nút điểm danh tối thiểu 44px; chọn trạng thái rồi lưu. Chưa nhập vẫn là Chưa điểm danh.

## Phân quyền giáo viên B2C (2026-10-15)

User chốt quyền theo từng giáo viên, dùng tài khoản đã có; cấp cả nhóm quản lý lớp/hồ sơ/học phí nhưng tách xem, sửa và thu.15 quyền: xem lớp, học viên, lịch, nhận xét; viết nhận xét; điểm danh; chấm công; xem giờ/đơn giá/tiền công; tạo lớp tự phân công; sửa lớp; sửa lịch; sửa hồ sơ; xem học phí/phiếu thu; thu học phí; sửa gói. Quyền dữ liệu chỉ trong lớp được phân công, không nâng role. Admin/giáo vụ quản lý quyền và vẫn giữ quyền quản lý theo role. Mặc định giữ6 quyền cũ; quyền ghi mới tắt. Quyền sửa tự kèm quyền xem liên quan, thu hồi xem bỏ quyền phụ thuộc. Hồ sơ học viên dùng chung nhiều lớp: tên/SĐT chỉ sửa khi có quyền ở tất cả lớp liên quan; trạng thái/ngày nhập học chỉ ghi danh hiện tại. User đã xác nhận, SQL20261015000001 đã áp production và verify quyền/RLS; code hiện ở local, chưa phát hành online.

## Lịch B2C có cấu trúc (2026-10-14)

Admin/giáo vụ mở chi tiết lớp → Lịch học → Lịch lặp & sinh buổi. Chọn nhiều thứ T2–CN, giờ bắt đầu/kết thúc cùng ngày (tối đa12h), từ/đến ngày (bao gồm hai đầu, tối đa366 ngày, không trước khai giảng), phòng tùy chọn. Hiện số buổi dự kiến; Lưu tự sinh buổi lịch học trong khoảng đó, không cần cron và không sinh công/lương/phiếu thu. Muốn mở rộng thời gian thì lưu thêm khoảng ngày.

Dữ liệu B2C đã nhập chỉ có thứ/giờ/cơ sở; chưa có phòng riêng, không có Excel gốc để xác minh cột nguồn. Phòng cho nhập tên gồm cơ sở; trống là Chưa xếp phòng. So tên phòng không phân biệt hoa/thường, gom khoảng trắng; không đoán các tên viết tắt là cùng phòng. Không tự chuyển chuỗi giờ cũ vì có dữ liệu nhiều khung/không rõ.

Lưu lịch và sinh buổi nguyên tử. Buổi có sẵn đúng giờ/phòng được bỏ qua; trùng lớp/phòng hoặc khác buổi cũ thì hủy cả lượt, không ghi đè. Bấm lại/new UUID không tạo buổi/rule trùng; buổi đã hủy không hồi sinh. Lịch lặp lưu bất biến; ngày/giờ gốc của buổi sinh tự động giữ nguyên để không tái tạo sai sau retry. Đổi lịch bằng hủy buổi và thêm buổi bù, theo quy tắc giữ lịch sử/điểm danh hiện hành.

Hôm nay của GV ưu tiên buổi cụ thể có giờ/phòng/trạng thái và bỏ lịch tuần dự kiến của cùng lớp/ngày; buổi hủy hiển thị Đã hủy, không cộng tổng đang học. Trong thời gian có lịch cấu trúc thì lịch tuần cũ không được dùng làm fallback. Lớp chưa có lịch cấu trúc/buổi cụ thể vẫn giữ fallback cũ. Chỉ lớp GV được phân công; không cấp thêm quyền học phí hoặc sửa điểm danh.

## Giáo viên xem lớp B2C (2026-10-14)

Hôm nay bổ sung lớp B2C theo lịch tuần: ngày/thứ tính Asia/Ho_Chi_Minh, chỉ lớp active đã đến ngày khai giảng. Hiện trong tổng Lịch dạy hôm nay với nhãn Theo lịch tuần, giờ và link lịch lớp. Đây là lịch dự kiến đọc từ weekdays_text/time_text; không tạo buổi, điểm danh hay lương. Lịch theo ngày/nghỉ/đổi giờ xem tại lịch lớp, không suy ra trạng thái thực tế từ lịch tuần. Không thêm quyền hay truy vấn dữ liệu ngoài các lớp đã phân công.

Giáo viên và giáo vụ có phân công xem lớp trung tâm ngay tại /teacher và /teacher/classes. Mở lớp /teacher/b2c-classes/[classId] để đọc học viên (mã, tên, trạng thái, ngày nhập học), lịch buổi và nhận xét; tìm mã/tên, 25 dòng/trang. Chỉ lớp được phân công theo ID b2c_classes.teacher_id → b2c_teachers.source_teacher_id → teachers.user_id; tài khoản và hồ sơ teachers phải còn hoạt động. Không phụ thuộc có buổi chấm công hay đơn giá lương.

Không mở học phí, công nợ, liên hệ/phụ huynh hay sửa điểm danh/nhận xét trong thay đổi này. Chấm công B2C vẫn chỉ đúng buổi đã phân công bằng teaching_session.teacher_id. Lớp nhập tên GV được liên kết khi tên khớp duy nhất hồ sơ; tên không khớp/trùng không cấp quyền. Đổi tên hồ sơ GV không làm mất phân công theo ID; đổi tên GV của lớp sẽ cập nhật phân công.

## Nhật ký thay đổi B2C (2026-10-14)

Quản trị viên xem `/admin/b2c/history` hoặc mục Nhật ký thay đổi trong B2C; có liên kết theo ghi danh tại Học viên/Học phí. Giữ D-2: chỉ super_admin được đọc audit, giáo vụ không thấy menu và bị chặn cả route/server/RLS dù được sửa nghiệp vụ.

Ghi tự động tại DB khi tạo/sửa/xóa ghi danh, gói học phí hoặc phiếu thu; theo dõi trạng thái/lý do, ngày học/ngày hết phí, số buổi và dữ liệu ghi danh, đơn giá/chiết khấu/tổng phải thu, số tiền/ngày thu/hình thức/người thu khai báo. Actor là auth.uid() thật, chụp tên/vai trò cùng học viên/lớp tại thời điểm ghi; người thu khai báo khác với tài khoản thao tác. Không có phiên đăng nhập thì actor để trống, không bịa người sửa. Thời gian do DB ghi và hiển thị theo Việt Nam; trước/sau chỉ hiển thị trường thay đổi bằng nhãn tiếng Việt. Lưu không đổi giá trị hoặc retry phiếu thu không thêm log trùng.

Nhật ký không cho user insert/update/delete trực tiếp; ghi lỗi thì rollback cùng thay đổi nghiệp vụ. Tìm học viên/lớp, người sửa, loại thay đổi, khoảng ngày; 30 sự kiện/trang, có lọc theo ghi danh. Bắt đầu từ lúc bật tính năng; không khôi phục lịch sử cũ hoặc gán actor cho dữ liệu cũ. Chưa theo dõi sửa hồ sơ liên hệ học viên hay báo cáo tài chính tháng trong phạm vi này.

## Kết quả thi chứng chỉ B2C và tư liệu marketing (2026-10-17)

Quản trị/giáo vụ quản lý tại B2C → Kết quả chứng chỉ; mỗi dòng liên kết hồ sơ học viên B2C có sẵn, giữ khi chuyển lớp. Có loại chứng chỉ nhập linh hoạt (gợi ý Cambridge/IELTS/TOEIC/TOEFL/HSK/HSKK/YCT), cấp độ/bài thi tùy chọn, điểm/xếp loại bắt buộc và ngày thi thực tế không trong tương lai. Điểm giữ dạng chữ để bảo toàn thang điểm (6.5,180/200,Pass...), không tự quy đổi/trung bình/đánh giá đạt. Có nhiều kết quả cho một HV; chặn trùng cùng HV/loại/cấp độ/ngày thi, sửa kết quả đã có thay vì tạo trùng.

Quản lý chủ động chọn “Chọn làm tư liệu marketing”, mặc định tắt. Chỉ chọn sau khi trung tâm xác nhận được phép dùng thông tin HV; có ghi chú nội bộ. Lọc theo loại, ngày, mã/tên/điểm, học viên, trạng thái chọn marketing và lưu trữ. Các số tổng hợp theo bộ lọc gồm số kết quả, số HV phân biệt, số được chọn và số loại chứng chỉ; không gọi mọi kết quả là đỗ hoặc thành tích cao.

Xuất Excel marketing chỉ lấy bản đang sử dụng được chọn, theo bộ lọc học viên/loại/ngày/tìm kiếm, không phụ thuộc checkbox/lựa chọn giả từ client. File6cột: mãHV,tênHV,loại,cấp độ,điểm/nguyên bản,ngày thi. Không SĐT/email/ghi chú; không tự đăng lên kênh công khai. Tối đa5000kết quả một file, vượt thì yêu cầu thu hẹp bộ lọc, không cắt thầm. Lưu trữ không xóa, loại khỏi xuấtmarketing; khôi phục trả trạng thái chọn marketing đã lưu. Lịch sử tạo/sửa/chọn/lưu trữ/khôi phục có actor thật và trước/sau. Giáo viên/học viên không có quyền vào module marketing này.

## Nhận xét tháng và chia sẻ phụ huynh B2C (2026-10-17)

Tab Nhận xét tháng trong popup/trang lớp B2C, chọn tháng hiện tại hoặc trước đó, mỗi ghi danh một bản/tháng. Mẫu sáu mục: chuyên cần, thái độ học tập, nội dung/tiến bộ, điểm mạnh, cần cải thiện, kế hoạch tháng tới/phối hợp phụ huynh. GV tự viết, không tự sinh nhận xét hoặc suy dữ liệu điểm danh. Bản nháp cho phép thiếu mục; hoàn tất cần đủ sáu mục, tối đa1000ký tự/mục. Lưu giữ lịch sử sửa và người thực hiện thật. Lưu nội dung không đổi giữ nguyên phiên bản.

User chọn gửi thủ công: bản hoàn tất có nội dung soạn sẵn để sao chép sang Zalo hoặc mở mailto trong ứng dụng email của người dùng. Không có gửi tự động, không tự ghi đã gửi khi sao chép/mở email. Chỉ sau khi người dùng chọn phụ huynh, kênh và xác nhận đã gửi, DB lưu lịch sử xác nhận thủ công: người xác nhận, thời gian, người nhận/địa chỉ, bản nội dung và phiên bản. Không xác minh trạng thái giao/nhận/đọc từ Zalo/email. Sửa nhận xét sau gửi giữ nguyên bản gửi cũ, bảng cảnh báo nội dung đã đổi.

Người nhận lấy từ phụ huynh đã liên kết đúng học viên; Zalo phụ huynh đã nhập trực tiếp ở hồ sơ HV dùng như liên hệ guardian khi chưa trùng phụ huynh liên kết. Không suy email/SĐT HV là liên hệ phụ huynh. Bổ sung email tùy chọn vào hồ sơ phụ huynh và danh sách phụ huynh. Thiếu liên hệ kênh đã chọn thì không ghi nhận gửi.

Quản lý dùng ngay. GV lớp được phân công dùng view_comments để đọc, write_comments để nhập; share_monthly_comments opt-in (phụ thuộc write_comments) để xem liên hệ phụ huynh/chuẩn bị gửi/ghi nhận gửi. Không tự cấp quyền GV thật. Danh sách HV20/trang, lịch sử sửa/gửi20/trang; kết quả các tháng vẫn được giữ khi chuyển lớp. Chưa có mẫu tùy chỉnh qua UI hoặc nhắc tự động theo lịch.

## Kiểm tra giữa kỳ / cuối kỳ B2C (2026-10-17)

Tab Kiểm tra trong popup/trang lớp B2C là sổ điểm nhập tay, gồm tên bài, loại Giữa kỳ/Cuối kỳ, ngày kiểm tra và thang điểm dương tối đa 1000 (hai số lẻ). Mỗi học viên có điểm và nhận xét; điểm trống là chưa chấm, 0 là đã chấm. Không tự tạo đề thi online, tự chấm hoặc xếp loại đỗ/trượt. Chưa đến ngày kiểm tra thì chưa nhập kết quả. Có thể tạo nhiều bài cùng loại trong lớp.

Quản lý tạo/sửa bài và nhập/sửa kết quả. Giáo viên chỉ được xem khi có quyền `view_assessments` (phụ thuộc xem học viên/lớp), tạo bài/nhập điểm khi có thêm `grade_assessments`, luôn giới hạn lớp được phân công. Hai quyền mới mặc định tắt, quản lý cấp tại Phân quyền B2C. Học viên chưa có luồng tự xem sổ điểm B2C.

Danh sách lấy ghi danh của đúng lớp, ngày nhập học không sau ngày kiểm tra; học viên đã chuyển lớp chỉ có thể nhập mới cho bài trước ngày chuyển, học viên nghỉ không thêm kết quả mới. Các kết quả đã lưu luôn giữ trong danh sách dù sau này đổi trạng thái/chuyển lớp. Lưu điểm không thay đổi học phí, sĩ số hoặc điểm danh. Khi có bất kỳ kết quả đã lưu, không sửa ngày/thang điểm của bài; vẫn sửa tên/loại và lưu lịch sử. Sửa/đưa điểm về trống cần lý do; lịch sử lưu người thực hiện thật, giờ và điểm/nhận xét trước/sau. Không xóa bài/kết quả/lịch sử qua giao diện.

## Chuyển lớp và bảo lưu B2C (2026-10-17)

Quản trị và giáo vụ dùng nút “Chuyển lớp / Bảo lưu” ở danh sách học viên hoặc tab học viên của chương trình. Mỗi thao tác có ngày hiệu lực không trong tương lai, lý do bắt buộc, người thực hiện và thời điểm ghi nhận. Popup lịch sử hiển thị toàn bộ các lớp của cùng học viên, có phân trang; ghi chú cũ không tự chuyển thành lịch sử vì không biết người/ngày thực hiện thật.

Chuyển lớp chỉ đến lớp đang hoạt động hoặc sắp khai giảng, không vượt sức chứa hoặc trùng ghi danh đang mở. Ghi danh cũ được giữ với trạng thái “Đã chuyển lớp”, tạo ghi danh mới “Đang học”; có thể chuyển trở lại lớp cũ bằng ghi danh mới, không sửa/xóa lịch sử điểm danh cũ. Lớp cũ giảm một chỗ, lớp mới tăng một chỗ. Bảo lưu chuyển sang “Bảo lưu”, giữ chỗ và có ngày dự kiến học lại tùy chọn; “Đi học lại” chỉ dành cho ghi danh bảo lưu và lớp còn mở. Không tự học lại theo ngày dự kiến. Ngày hiệu lực không trước ngày ghi danh/lần xử lý gần nhất.

User chốt học phí xử lý riêng: gói học phí, phiếu thu, hạn phí, số buổi đăng ký cũ giữ nguyên tại ghi danh cũ; không tự chuyển tiền/quyền lợi hoặc gia hạn. Ghi danh đích chưa có gói phí, không tự sao chép số buổi đã mua. Trạng thái “Đã chuyển lớp” loại khỏi sĩ số hiện tại và nhắc tái phí, vẫn hiển thị trong hồ sơ/lịch sử. Các lượt ghi danh tổng cộng vẫn bao gồm lịch sử.

## Cảnh báo sĩ số lớp B2C (2026-10-17)

Tổng quan B2C có thẻ số liệu “Lớp dưới 5 học viên” cùng hàng với các thẻ tổng quan. Bấm thẻ mở popup danh sách các lớp đang hoạt động (`active`) có dưới 5 học viên, sắp xếp sĩ số tăng dần, kèm giáo viên, số học viên còn thiếu và liên kết mở lớp. Khi số lớp bằng 0, thẻ vẫn mở popup trạng thái trống. Không hiển thị cảnh báo trong các hàng danh sách lớp. Lớp 0 học viên vẫn được tính; lớp sắp khai giảng, tạm dừng, hoàn thành hoặc hủy không được tính. Giữ nguồn sĩ số Tổng quan hiện có, không đổi dữ liệu ghi danh. Ngưỡng 5 HV là quy ước quản lý, chưa phải điểm hòa vốn theo chi phí từng lớp; quản lý tự quyết định gộp/đóng, hệ thống không tự thay đổi trạng thái. Chưa có cấu hình ngưỡng riêng từng lớp.

## Lương và điểm hòa vốn B2C (2026-10-14)

Báo cáo tháng tách lương giáo viên và lương NV văn phòng, nhập Marketing bắt buộc (0 nếu xác nhận không phát sinh). payroll_cost là tổng hai thành phần và chỉ cộng một lần vào chi phí. Hai báo cáo lịch sử giữ nguyên số tiền, thành phần chưa biết để null; lưu qua biểu mẫu mới phải nhập rõ cả hai. Không tự phân chia hoặc cộng chồng tiền công từ chấm công vào số liệu tháng nhập tay.

User chọn điểm hòa vốn ước tính từ báo cáo tháng. Trên Tổng quan hiển thị HV cần, HV cuối tháng và còn thiếu, cùng kỳ và giả định. Toàn bộ lương GV coi là biến đổi, các khoản còn lại (gồm NV văn phòng, mặt bằng, Marketing/Quảng cáo, điện/nước/internet/khác) coi là cố định. HV cần = ceil(chi phí cố định × HV cuối tháng / (doanh thu − lương GV)). Chưa tách lương, không có HV hoặc đóng góp không dương thì hiện lý do. HV cuối tháng là tổng các chương trình theo báo cáo, chưa loại người học nhiều chương trình. Chưa mô hình hóa tăng bậc lớp/phòng/giá; số cần thêm không âm.

CAC chưa tính: chờ chốt Marketing có bao gồm quảng cáo hay cộng hai khoản; mẫu số là HV mới đã đóng học phí hay toàn bộ HV mới. Không tự coi số HV mới từng chương trình là khách hàng mới duy nhất.

## Dashboard Học viên B2C (2026-10-14)

`/admin/b2c/students` dùng bố cục theo ảnh user: bốn thẻ tổng học viên/đang học/sắp hết học phí/lớp hoạt động, biểu đồ vòng tình trạng, cột nguồn khách theo năm nhập học, thao tác nhanh và bảng gọn. Thẻ mở popup đúng nhóm, tìm kiếm/phân trang riêng, đóng X/Escape trả focus. Không bịa phần trăm tăng trưởng khi chưa có dữ liệu lịch sử.

Tổng học viên đếm hồ sơ duy nhất kể cả chưa ghi danh; đang học có ít nhất một ghi danh studying. Sắp hết phí đếm học viên có ghi danh chưa Nghỉ/Hoàn thành với hạn từ hôm nay đến ngày thứ 30, theo ngày Việt Nam. Lớp hoạt động có status active và ít nhất một học viên studying. Biểu đồ tình trạng mỗi người một nhóm, ưu tiên studying → overdue → awaiting_renewal → on_hold → withdrawn → completed → chưa ghi danh. Nguồn khách đếm hồ sơ duy nhất, lọc năm nếu có ghi danh trong năm đó; dùng đúng các nguồn hiện có và Chưa xác định.

Bảng hiển thị từng lượt ghi danh và hồ sơ chưa ghi danh, có tìm tên/mã/phụ huynh/SĐT/email/lớp, lọc trạng thái/lớp/nguồn/khoảng ngày nhập học, phân trang 10/20/50. Chọn dòng để xuất Excel, nếu không chọn thì xuất toàn bộ kết quả lọc. Bộ lọc bảng không đổi thẻ/biểu đồ. Chi tiết hồ sơ giữ các thông tin đã có ở bảng cũ; sửa ghi danh dùng dialog/RPC cũ. Nhắc học phí chỉ mở danh sách cần liên hệ, chưa gửi tin; tiếp nhận mới dẫn tới Tuyển sinh. Tạo hồ sơ/ghi danh mới qua Thêm học viên trong chi tiết lớp (2026-10-16). Đọc phân trang đầy đủ profiles/enrollments/classes B2C qua manager/RLS, không dùng bảng VCB.

## Chỉ số giáo viên B2C (2026-10-14)

Bốn thẻ tổng quan có thể bấm để mở popup: tổng giáo viên, giáo viên có lịch, giáo viên chưa có lịch và danh sách lớp phụ trách kèm giáo viên/sĩ số. Popup giữ bộ lọc chuyên môn của thẻ; nhóm có/chưa có lịch giữ tháng đang chọn. Bộ lọc tìm kiếm/tình trạng của bảng chính không làm đổi danh sách của thẻ. Popup có tìm kiếm riêng, 20 dòng/trang, trạng thái rỗng; đóng bằng nút X/Escape và trả tiêu điểm về thẻ đã bấm.

Trang Giáo viên B2C trình bày theo mẫu dashboard user gửi: bốn thẻ tổng quan, biểu đồ vòng theo lịch dạy, biểu đồ cột chuyên môn và bảng gọn. Tháng theo ngày giờ Việt Nam chỉ áp dụng trạng thái có/chưa có lịch dạy; không suy từ hình thức làm việc. Bộ lọc chuyên môn áp dụng thẻ/biểu đồ/bảng; tìm kiếm tên/SĐT/email và tình trạng áp dụng bảng. Phân trang 20 dòng, tải Excel toàn bộ kết quả đang lọc; in/lưu PDF qua hộp thoại trình duyệt, in mọi trang kết quả. Không bịa tăng/giảm so với tháng trước khi chưa có lịch sử hồ sơ. Không thay đổi menu hoặc shell của các trang khác.

Danh sách Giáo viên B2C hiển thị số lớp, sĩ số trung bình, tỷ lệ chuyên cần, hai tỷ lệ tái phí và chi phí GV/doanh thu lớp, lũy kế toàn bộ dữ liệu. Lớp phụ trách hiện đối chiếu tên giáo viên khớp chính xác sau chuẩn hóa khoảng trắng đầu/cuối và hoa/thường; tên hồ sơ trùng không tự gán chỉ số. Không dùng lớp doanh nghiệp. Sĩ số trung bình = tổng học viên duy nhất trong từng lớp / số lớp, dùng enrolled_count khi lớp chưa có ghi danh. Chi phí/doanh thu = tiền công đủ check-in/out của giáo viên ở các lớp phụ trách / tổng học phí thực thu của các lớp đó; đây là tỷ lệ lũy kế, chưa phải biên lợi nhuận theo kỳ. Không có tiền công đã xác nhận hoặc doanh thu dương thì hiện —. Chuyên cần chưa có điểm danh học viên B2C nên hiện —.

User chọn cả hai cách tính tái phí. “Hết hạn rồi đóng tiếp” = số học viên có phiếu thu sau hạn học phí / số học viên đã hết hạn. Chỉ so với tuition_end_date đang lưu, chưa có lịch sử đổi hạn nên không đại diện tỷ lệ gia hạn lịch sử. “Đóng từ 2 lần” = số học viên có ít nhất hai phiếu thu / số học viên có phiếu thu, bao gồm đóng nhiều đợt; cộng phiếu thu giữa các lớp phụ trách của cùng GV. Cả hai đếm học viên duy nhất, chỉ phiếu thu dương đến ngày hiện tại theo Asia/Ho_Chi_Minh, mẫu số rỗng hiện —. Hết hạn nghĩa là ngày kết thúc học phí nhỏ hơn hôm nay.

## Giờ dạy và tiền công B2C (2026-10-14)

User chốt: tính theo thời lượng trong lịch; check-in/out xác nhận đã dạy; đủ hai bước thì tự tính ngay, không cần quản lý duyệt. Quản lý vào `/admin/b2c/teaching` tạo buổi dạy theo ngày/giờ Việt Nam, lớp và giảng viên. Giảng viên cần hồ sơ B2C đã liên kết tài khoản teacher/academic_manager đang hoạt động và đơn giá/giờ đã nhập. Không tự sinh buổi từ chuỗi lịch lớp chưa chuẩn hóa.

Giảng viên vào `/teacher/b2c-teaching`, chỉ thấy buổi của mình; mỗi bước cần ảnh JPG/PNG/WebP tối đa 5 MB, điện thoại có nút mở camera. Check-in trong ngày trước giờ kết thúc, check-out cùng ngày sau giờ kết thúc và sau check-in. Thời gian do server ghi, ảnh private, liên kết xem ảnh hết hạn sau 5 phút. Buổi thiếu ảnh vào/ra chưa tính tiền; đủ thì giờ = thời lượng lịch, tiền công = làm tròn VNĐ(giờ × đơn giá chụp tại thời điểm tạo buổi). Tổng theo tháng dựa ngày lịch Việt Nam. Không có sửa giờ/checkpoint hay hoàn duyệt, không ghi nhận đã chi trả lương, không tính thuế/phụ cấp. Camera trực tiếp cần HTTPS hoặc localhost theo trình duyệt; file ảnh có thể được chọn nếu thiết bị không mở camera.

## Hồ sơ giáo viên (2026-10-14)

Theo yêu cầu bổ sung dữ liệu đã tạo, đã sao chép 8 giáo viên có tên khớp duy nhất với lớp B2C từ hồ sơ chung vào B2C. Giữ liên hệ/chuyên môn đã nhập, lưu liên kết nguồn, không đoán hình thức/đơn giá. Hồ sơ nguồn và tài khoản vẫn giữ nguyên; sửa trong B2C chỉ đổi hồ sơ B2C, không đồng bộ ngược. Hai giáo viên còn lại chưa có tên trong lớp B2C không tự đưa vào.

B2C có mục Giáo viên riêng tại `/admin/b2c/teachers`: quản lý thêm/sửa hồ sơ không cấp tài khoản, gồm họ tên, SĐT, email liên hệ, chuyên môn, hình thức cơ hữu/part-time và đơn giá nguyên VNĐ/giờ. Giáo vụ và super admin quản lý; giáo viên/học viên không truy cập. Không tự chuyển tên giáo viên từ lớp thành hồ sơ hoặc gộp người trùng tên. Chưa liên kết hồ sơ mới với lớp hay tự tính lương. Tìm theo tên, 50 hồ sơ/trang.

Màn `/admin/teachers` quản lý liên hệ SĐT/email, chuyên môn, hình thức cơ hữu hoặc part-time và đơn giá nguyên VNĐ/giờ (không âm). Hình thức và đơn giá chưa nhập hiển thị “Chưa cập nhật”, khác đơn giá 0. Không suy đoán dữ liệu hồ sơ cũ. Quản lý sửa chuyên môn/hình thức/đơn giá; quyền đổi tên/SĐT vẫn dành cho super admin, email liên hệ hiện chỉ nhập khi cấp tài khoản. Đơn giá là thông tin hồ sơ, chưa tự tính bảng lương.

> **POLYMIND CHINESE — Hệ thống quản lý học viên tiếng Trung.**
> Nguồn sự thật về **yêu cầu**. Khi code/migration khác tài liệu này → hoặc code sai, hoặc tài liệu phải được cập nhật cùng lúc với business change. Không để lệch âm thầm.

---

## 1. Mục tiêu

Xây dựng web app quản lý toàn bộ vòng đời học tập tại trung tâm tiếng Trung: từ thiết lập chương trình đào tạo, mở lớp, ghi danh học viên, vận hành từng buổi học (điểm danh, nhật ký giảng dạy), giao và chấm bài tập, kiểm tra – đánh giá tiến độ, cho đến quản lý học phí cơ bản, thông báo và báo cáo.

Ưu tiên thiết kế:

1. **Giáo viên dùng được trên điện thoại giữa buổi dạy.** Điểm danh phải xong trong vài chạm.
2. **Dữ liệu học viên được bảo vệ ở tầng database (RLS)**, không chỉ ẩn nút trên UI.
3. **Lịch sử không bị ghi đè.** Chuyển lớp, rút học, sửa điểm đều để lại vết.

Đây **không** phải hệ thống CRM tuyển sinh, không phải hệ thống kế toán tổng quát, và không liên quan gì tới xuất khẩu lao động.

---

## 2. Actors

| Actor                           | Mô tả                                                                                     | Cách có tài khoản                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Super Admin** (`super_admin`) | Chủ trung tâm / quản lý đào tạo. Toàn quyền nghiệp vụ, quản lý tài khoản, học phí, audit. | Seed lúc khởi tạo hệ thống                      |
| **Giáo vụ** (`academic_manager`) | Điều phối đào tạo: học viên, giáo viên, khóa/lớp, lịch, học phí, báo cáo, thông báo — và phân công giáo viên về lớp, **kể cả chính mình**. **KHÔNG** quản lý tài khoản, **KHÔNG** đọc audit, **KHÔNG** đụng Flashcard và Duyệt câu hỏi. | Super admin tạo ở trang Giáo viên, chọn vai trò *Giáo vụ* |
| **Giáo viên** (`teacher`)       | Dạy các lớp được phân công. Chỉ thấy lớp mình và học viên trong lớp đó.                   | Super admin tạo hồ sơ → gửi invite email        |
| **Học viên** (`student`)        | Người học. Chỉ thấy dữ liệu của chính mình.                                               | Super admin tạo hồ sơ → gửi invite email        |
| **Khách vãng lai** (anonymous)  | Chưa đăng nhập.                                                                           | Không đọc/ghi được bất kỳ dữ liệu nghiệp vụ nào |

⚠️ **Giáo vụ luôn có kèm một hàng `teachers`** ngay khi tạo tài khoản — nếu không thì `class_teachers.teacher_id` không trỏ vào đâu được và họ mất khả năng tự nhận lớp. Đây là lý do vai trò này được tạo ngay tại trang Giáo viên chứ không ở một màn riêng (`D-2` điểm 2).

🔴 **Hệ quả đã chốt của việc không cho đụng tài khoản:** giáo vụ **không thêm được giáo viên mới** và không cho giáo viên nghỉ được — `teachers.user_id` là `not null` nên tạo giáo viên luôn kéo theo tạo tài khoản. Hai việc đó vẫn qua super admin.

**Không có role phụ huynh.** Thông tin người giám hộ (`guardian_name`, `guardian_phone`, `guardian_relation`) chỉ là **trường liên hệ** trên hồ sơ học viên — không phải tài khoản đăng nhập. Đây là bài học rút từ hệ cũ, nơi phụ huynh là một role thật và kéo theo cả một ma trận phân quyền phức tạp.

**Không có public sign-up.** Mọi tài khoản đều do super admin khởi tạo và mời.

---

## 3. Glossary — phân biệt 3 khái niệm hay bị gộp

Đây là ranh giới quan trọng nhất của toàn hệ thống. Gộp nhầm ba khái niệm này là lỗi thiết kế phổ biến nhất của phần mềm quản lý đào tạo.

| Thuật ngữ                                        | Là gì                                                                                                                                                                                                 | Ví dụ                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Level** (`levels`)                             | Bậc năng lực, dùng để phân loại. Danh mục cấu hình được.                                                                                                                                              | HSK 1, HSK 2, … HSK 6                                                        |
| **Course** — Khóa học / chương trình (`courses`) | **Bản thiết kế** của một chương trình đào tạo: mục tiêu, đối tượng, giáo trình (module → bài học), điều kiện hoàn thành. Tồn tại độc lập với thời gian, **không có ngày bắt đầu, không có học viên**. | "Tiếng Trung Đàm Phán Tài Chính Chiến Lược"                                  |
| **Class** — Lớp triển khai (`classes`)           | **Một lần mở lớp cụ thể** từ một Course: có mã lớp, sĩ số tối đa, giáo viên, ngày bắt đầu, hình thức học, địa điểm, lịch học. Học viên ghi danh vào **Class**, không phải vào Course.                 | `LOP-02` — mở từ chương trình "Tiếng Trung ngân hàng", khai giảng 20/07/2026 |
| **Session** — Buổi học (`class_sessions`)        | **Một buổi học có thật** trên trục thời gian của một Class. Điểm danh gắn vào Session.                                                                                                                | Buổi số 5 của `LOP-02`, 08:00–09:30 ngày 03/08/2026                          |

Quan hệ: `Level ← Course → Module → Lesson` và `Course → Class → Session`, với `Student → Enrollment → Class`.

Hệ quả thiết kế bắt buộc:

- Một Course có thể mở **nhiều** Class (khóa "Tiếng Trung ngân hàng" mở cả `LOP-02` lẫn `LOP-03`).
- Điểm danh, bài nộp, điểm số đều gắn vào **Enrollment**, không gắn thẳng vào Student — vì một học viên qua nhiều lớp theo thời gian (HSK 1 → HSK 2 → …), và mỗi lớp có dữ liệu học tập riêng.
- Số buổi ở Course chỉ là **mặc định gợi ý** (`default_session_count`, có thể null). Số buổi thật chốt ở Class (`planned_session_count`) và phải có giá trị trước khi kích hoạt lớp.

Các thuật ngữ khác:

- **Enrollment** — bản ghi ghi danh, nối một Student vào một Class. Là "hộ chiếu" để học viên đó tồn tại trong lớp: mọi điểm danh, bài nộp, điểm số, đánh giá đều treo vào `enrollment_id`.
- **Assignment** — bài tập giáo viên giao cho lớp. **Submission** — bài nộp của học viên.
- **Assessment** — bài kiểm tra (quiz/giữa kỳ/cuối kỳ/thi thử HSK). **Assessment result** — kết quả của một học viên trong bài kiểm tra đó.
- **Learning evaluation** — nhận xét định kỳ (tuần/tháng) theo 6 mặt: nghe, nói, đọc, viết, từ vựng, ngữ pháp.
- **Publish** — hành động công bố. Dữ liệu chưa publish là **draft**, học viên không thấy. Áp dụng cho assignment, assessment result và learning evaluation.

---

## 4. Phạm vi v1

### 4.1 Trong phạm vi (in scope)

| #   | Module                 | Nội dung                                                                                |
| --- | ---------------------- | --------------------------------------------------------------------------------------- |
| 1   | Tài khoản & phân quyền | 3 role cố định, invite qua email, khóa/mở tài khoản, reset mật khẩu                     |
| 2   | Hồ sơ giáo viên        | CRUD, mã giáo viên, chuyên môn                                                          |
| 3   | Hồ sơ học viên         | CRUD, mã học viên, người giám hộ (thông tin liên hệ), level hiện tại/mục tiêu           |
| 4   | Chương trình đào tạo   | Level, Course, Module/Chương, Lesson/Bài học, tài liệu khóa học                         |
| 5   | Lớp học                | Mở lớp, sĩ số, hình thức, địa điểm, phân công một giáo viên phụ trách                   |
| 6   | Lịch & buổi học        | Lịch lặp theo thứ, sinh buổi học tự động, nghỉ/đổi lịch/học bù                          |
| 7   | Ghi danh               | Ghi danh, tạm dừng, chuyển lớp, rút học, hoàn thành khóa (giữ lịch sử)                  |
| 8   | Điểm danh              | Có mặt / Đi muộn / Vắng / Có phép; thao tác hàng loạt theo roster                       |
| 9   | Bài tập                | Ngân hàng câu hỏi, bộ có version, làm trực tiếp/autosave, chấm auto + thủ công, release |
| 10  | Kiểm tra & đánh giá    | Thi cùng ngày có timer/finalizer, điểm 0–100, xếp loại; nhận xét định kỳ giữ riêng      |
| 11  | Tiến độ                | Tổng hợp từ bài học hoàn thành + chuyên cần + bài tập + điểm; điều kiện hoàn thành khóa |
| 12  | Học phí cơ bản         | Hóa đơn, khoản mục, thanh toán, phiếu thu, số dư còn phải thu                           |
| 13  | Thông báo              | In-app một chiều + announcement toàn hệ thống/lớp                                       |
| 14  | Báo cáo & export       | Dashboard 3 role, báo cáo, export CSV/XLSX theo đúng filter đang chọn                   |
| 15  | Audit                  | Nhật ký mutation nhạy cảm, append-only, chỉ super admin đọc                             |
| 16  | Cổng lớp học học viên  | “Lớp của tôi” gộp tổng quan, lịch/buổi, bài tập, kiểm tra, tiến độ, chuyên cần, tài liệu ở chế độ chỉ đọc |
| 17  | Ôn tập                 | Flashcard theo khóa/buổi do Super Admin quản trị; học viên làm lại câu máy chấm từng sai và lưu lịch sử |

### 4.2 Ngoài phạm vi (out of scope) — không tạo route/table/enum/menu/code chết

Xóa hoàn toàn, không "để dành":

- **CRM tuyển sinh:** Lead, nguồn lead, timeline chăm sóc, convert lead. Luồng bắt đầu thẳng từ tạo hồ sơ học viên.
- **Toàn bộ domain xuất khẩu lao động:** ứng viên XKLĐ, đơn hàng tuyển dụng, workflow 20 bước, COE, visa, phỏng vấn, chuyến bay, xuất cảnh, hộ chiếu, nghiệp đoàn, quốc gia đến, phí xuất cảnh.
- **Đại lý & hoa hồng:** đại lý, cộng tác viên, cây đại lý, bảng thi đua, cấu hình/tính/duyệt/chi hoa hồng.
- **Vay & thu nợ:** hỗ trợ vay, vay ngân hàng, nợ công ty, lịch trả góp, thu nợ.
- **Kế toán tổng quát:** khoản chi, duyệt chi, báo cáo lợi nhuận.
- **Chat/tin nhắn hai chiều:** messaging 1-1, audio message, thu hồi tin. Thông báo là **một chiều**.
- **Role phụ huynh** như một tài khoản đăng nhập.
- **AI** (Gemini, OCR CV/hộ chiếu, phân tích hồ sơ) — chuyển sang backlog phase 2.

**Ranh giới dễ trượt:** "Còn phải thu học phí" là **số dư của hóa đơn** (`total − đã thanh toán`), tính từ `tuition_invoices` và `tuition_payments`. Nó **không** được phép mọc thành module vay/nợ/thu hồi nợ như hệ cũ. Không có bảng "công nợ" riêng.

### 4.3 Backlog phase 2

AI hỗ trợ soạn bài và nhận xét · Email notification nghiệp vụ · Chứng chỉ hoàn thành · CSV import dữ liệu học viên cũ · Đa cơ sở/đa tenant · PWA.

---

## 5. Role matrix

Ký hiệu: **C** tạo · **R** đọc · **U** sửa · **D** xóa/hủy · **—** không truy cập · **(own)** chỉ dữ liệu của chính mình · **(assigned)** chỉ lớp được phân công.

| Tài nguyên                               | Super Admin         | Teacher                               | Student                                                            |
| ---------------------------------------- | ------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Tài khoản, role, invite, khóa/mở         | CRUD                | —                                     | —                                                                  |
| Hồ sơ giáo viên                          | CRUD                | R (own)                               | —                                                                  |
| Hồ sơ học viên                           | CRUD                | R (assigned: học viên trong lớp mình) | R (own)                                                            |
| Level, Course, Module, Lesson            | CRUD                | R (assigned: course của lớp mình)     | R (course của lớp mình)                                            |
| Tài liệu khóa học                        | CRUD                | R (assigned)                          | R (assigned + đã publish)                                          |
| Lớp học                                  | CRUD                | R (assigned)                          | R (lớp mình học)                                                   |
| Phân công giáo viên vào lớp              | CRUD                | — (không tự gán mình vào lớp)         | —                                                                  |
| Lịch lặp                                 | CRUD                | R (assigned)                          | R (lớp mình học)                                                   |
| Buổi học                                 | CRUD                | R + U (assigned: nhật ký, trạng thái) | R (lớp mình học)                                                   |
| Ghi danh / chuyển lớp / rút học          | CRUD                | R (assigned)                          | R (own)                                                            |
| Điểm danh                                | CRUD                | CRU (assigned)                        | R (own)                                                            |
| Tiến độ bài học                          | CRUD                | CRU (assigned)                        | R (own)                                                            |
| Câu hỏi/bộ bài tập/bộ đề                 | CRUD + duyệt global | CRUD own/share                        | DENY                                                               |
| Delivery/attempt/answer bài tập          | CRUD + chấm         | CRUD + chấm (assigned)                | Làm/nộp own; không sửa điểm/feedback                               |
| Kỳ thi/attempt/kết quả                   | CRUD + regrade      | CRUD + chấm (assigned)                | Làm own; chỉ xem kết quả đã công bố                                |
| Thang xếp loại                           | CRUD                | R                                     | R                                                                  |
| Đánh giá định kỳ                         | CRUD                | CRUD (assigned)                       | R (own + đã publish + `visible_to_student`)                        |
| Ghi chú học viên                         | CRUD                | CRUD (assigned)                       | R (own + `student_visible`) — **tuyệt đối không đọc `staff_only`** |
| Học phí (hóa đơn, thanh toán, phiếu thu) | CRUD                | **—** (không đọc)                     | R (own); **không** tự ghi nhận thanh toán                          |
| Thông báo                                | CRUD                | R (own)                               | R (own)                                                            |
| Announcement                             | CRUD                | R                                     | R                                                                  |
| Báo cáo                                  | R (toàn trung tâm)  | R (assigned)                          | R (own)                                                            |
| Audit log                                | R                   | **—**                                 | **—**                                                              |
| Flashcard theo khóa/buổi                 | CRUD + publish      | —                                     | R (khóa của lớp mình, section đã publish)                           |
| Hàng đợi/lịch sử ôn câu sai              | R hỗ trợ            | —                                     | R own; chấm lại qua RPC, không đọc answer key trực tiếp             |

Nguyên tắc bất di bất dịch:

1. **Fail-closed.** Thiếu mapping (giáo viên chưa được gán lớp, học viên chưa có enrollment) → **từ chối**, không phải "cho qua".
2. **Ẩn menu không phải là phân quyền.** Mỗi mutation phải kiểm quyền ở server **và** được RLS chặn ở database. Đổi UUID trên URL hoặc gọi thẳng Supabase client từ trình duyệt đều không được vượt scope.
3. **Service role chỉ dùng cho admin flow server-only** (invite, khóa tài khoản, đổi role). Không bao giờ dùng service role để phục vụ request thường của teacher/student — làm vậy là vô hiệu hóa toàn bộ RLS.
4. **Không tin `user_metadata`.** Client sửa được nó. Role đọc từ bảng `profiles`.
5. **Xác minh JWT không thay thế kiểm quyền sống.** Request thường dùng `getClaims()`/ES256 để tránh gọi Auth server lặp lại, nhưng role và `is_active` vẫn phải đọc từ `profiles`; RLS/`app.is_active()` vẫn là chốt cuối. Không dùng `getSession()` để phân quyền.

---

## 6. Business rules

### BR-1 — Danh mục khóa học

- Trung tâm có **hai dòng chương trình song song**:
  - **Dòng cốt lõi** (luôn giảng dạy): HSK 1–6, Tiếng Trung giao tiếp, Tiếng Trung thiếu nhi, Luyện thi HSK.
  - **Dòng tùy chỉnh/B2B**: chương trình thiết kế riêng theo đối tác (hiện có 2 chương trình cho Vietcombank).
- Khi tạo Course, Super admin chọn `program = core | business`. Chỉ `core` mới có và bắt buộc chọn `course_type = hsk | communication | kids | exam_prep | custom`; `business` luôn có `course_type = null`.
- Các lớp Vietcombank **không phải** toàn bộ danh mục của trung tâm. Đừng nhầm dữ liệu đối tác thành catalog.
- Super admin tạo được biến thể mới (giao tiếp cơ bản/nâng cao, thiếu nhi theo độ tuổi, luyện thi theo target level) **mà không cần sửa code** → `course_type` phải đủ mở và level là bảng danh mục, không phải enum cứng.
- Mã khóa học, lớp, giáo viên và học viên là mã hệ thống: người dùng **không nhập tay**; DB tự sinh tuần tự và UNIQUE để an toàn khi tạo đồng thời. Mã hóa đơn, thanh toán và phiếu thu tiếp tục do RPC tự sinh. Mã tham chiếu giao dịch ngân hàng là dữ liệu bên ngoài nên vẫn được phép nhập nếu có.
- Trường chưa có nguồn dữ liệu (học phí, số buổi, giáo trình) để **nullable**. Không bịa số.

### BR-2 — Lớp học

- `capacity > 0`. Kiểm tra sĩ số **trong transaction** khi kích hoạt enrollment, không kiểm ở tầng UI (2 người đăng ký đồng thời sẽ lọt).
- Mỗi lớp **tối đa 1 giáo viên phụ trách**; một giáo viên được phụ trách nhiều lớp. Ràng buộc bằng UNIQUE `class_teachers.class_id` ở DB.
- Hình thức: `offline | online | hybrid | in_house`. Địa điểm phải cho phép **mô tả tự do** (`location_note`) — lớp `in_house` của Ban Giám đốc VCB có thể học ở bất kỳ đâu khách hàng chỉ định, không được ép chọn một cơ sở cố định.
- Trước khi chuyển lớp sang `active`: phải có đủ `planned_session_count`, `session_duration_minutes` và giáo viên chính.

### BR-3 — Lịch và buổi học

- Lịch lặp theo thứ trong tuần (ISO 1–7 = Thứ Hai → Chủ Nhật), có `start_time`/`end_time` với `end > start`.
- **Lớp linh hoạt được phép không có lịch lặp** (`LOP-01` — theo lịch Ban Giám đốc). Không ép mọi lớp phải có recurrence.
- Sinh buổi học từ lịch lặp phải **idempotent**: chạy lại không tạo buổi trùng, và dừng đúng ở `planned_session_count`.
- Nghỉ có ngày học bù dùng **đổi chuỗi time slot trên chính các session hiện hữu**: bỏ mốc nghỉ, thêm mốc bù rồi dời thời gian từ buổi bị nghỉ tới cuối khóa. Tổng row, `id`, `session_number`, bài học/nội dung và điểm danh không đổi; mọi lần đổi được ghi ở `class_session_schedule_changes` kèm actor, lý do và ảnh chụp trước/sau. Hủy hẳn một buổi và xóa buổi sinh nhầm là hai thao tác riêng, không dùng để xếp học bù.
- `session_number` luôn nằm trong `1..classes.planned_session_count`; DB chặn tạo “Buổi N+1” ngay cả khi client cũ gọi thẳng API.
- Mọi thời điểm lưu **UTC**. Hiển thị và sinh recurrence theo `Asia/Ho_Chi_Minh`.
- Card Buổi học mặc định hiển thị **thời khóa biểu tuần** (Thứ Hai → Chủ Nhật), có lùi/tiến tuần và về hôm nay. Admin, giáo viên trong tab `Lịch / Buổi` của lớp và học viên tại `Lịch học` đều chuyển được giữa `Tối giản` (danh sách đánh số buổi), `Tuần` và `Tháng`; tuần/tháng gom buổi theo ngày Việt Nam, không theo múi giờ máy người dùng.

### BR-4 — Ghi danh

- **Một học viên chỉ học MỘT lớp tại một thời điểm** _(user chốt 2026-07-13 — đảo ngược yêu cầu ban đầu trong đặc tả gốc §4.13)_.
  - "Một thời điểm" = tối đa **một** enrollment đang mở (`pending` / `active` / `paused`).
  - Enrollment đã đóng (`completed` / `withdrawn` / `transferred`) **không tính** → học xong HSK 1 vẫn đăng ký được HSK 2, và lịch sử lớp cũ giữ nguyên.
  - Chuyển lớp vẫn hoạt động: lớp cũ thành `transferred` (đã đóng), lớp mới `active` → vẫn chỉ một lớp đang mở.
  - Cưỡng chế bằng **partial unique index** ở DB (`ux_enrollments_one_open_per_student`), không phải bằng `if` ở tầng app — hai admin ghi danh đồng thời sẽ cùng đọc thấy "học viên chưa có lớp" rồi cùng insert.
- Vòng đời: `pending → active → (paused) → completed | withdrawn | transferred`.
- **Không bao giờ xóa enrollment.** Chuyển lớp = đánh dấu enrollment cũ `transferred` + tạo enrollment mới, **trong cùng một transaction**, ghi `enrollment_status_history` + audit.
- Chuyển lớp **không** tự động mang điểm/điểm danh sang lớp mới. Nếu cần quy đổi thì đó là một thao tác riêng, có audit.

### BR-5 — Điểm danh

- Trạng thái: `present | late | absent | excused`.
- Điểm chuyên cần cá nhân bắt đầu từ **10** và được tính từ dữ liệu điểm danh: mỗi buổi `absent` trừ **0,5 điểm**; `present`, `late`, `excused` không làm giảm điểm; kết quả không thấp hơn 0. Đây là giá trị tính ra, không phải ô điểm nhập tay.
- UNIQUE `(session_id, enrollment_id)` → điểm danh hàng loạt phải **upsert theo key này**, chạy 2 lần không sinh bản ghi trùng.
- Chỉ tạo được điểm danh cho enrollment **thuộc đúng lớp của session đó** (chặn ở DB, không chỉ ở app).
- `marked_by` phải là **actor đang đăng nhập thật**, không phải "user đầu tiên tìm thấy" (lỗi attribution đã gặp ở hệ cũ).

### BR-6 — Bài tập

- Câu hỏi và bộ dùng version; version đã khóa/được giao là bất biến. Có đủ 11 dạng Q1–Q11, không có hint ở v1.
- Giáo viên thao tác bằng nút **Chỉnh sửa** trên cùng câu hỏi; hệ thống vẫn tạo version bất biến ở tầng dữ liệu để đề đã giao không đổi nội dung.
- Một bộ giao nhiều lớp tạo delivery riêng; giáo viên chỉ giao lớp mình phụ trách.
- Học viên chỉ start/save/submit attempt cho enrollment của chính mình, trong window và còn lượt; autosave/submit idempotent. Ngay khi bấm bắt đầu Bài tập/Thi, UI phải hiện spinner + trạng thái đang mở và khóa nút cho tới khi tạo attempt rồi chuyển trang, tránh cảm giác đứng màn hình và bấm lặp.
- Khi nộp, UI phải khóa nút, báo đang xử lý, báo kết quả và chuyển thẳng sang nhóm **Đã nộp**; lỗi lưu cuối phải chặn submit và cho thử lại.
- Bản ghi câu Nói phải tự tải lên ngay khi học viên dừng thu; nút nộp toàn bài/toàn bài thi bị khóa cho tới khi server xác nhận đã lưu. MIME có tham số codec (ví dụ `audio/webm;codecs=opus`) phải được chuẩn hóa trước khi whitelist.
- Lượt làm có câu Nói phải có bước xin/kiểm tra quyền micro ngay trên trang; ứng dụng không được giả định có thể tự vượt quyền bảo mật của trình duyệt.
- Điểm objective do DB chấm, essay/rubric chờ giáo viên; late penalty, grading method và release mode được cưỡng chế ở DB.
- Màn chấm dành cho giáo viên phải dùng ngôn ngữ nghiệp vụ tiếng Việt, không lộ JSON/trạng thái kỹ thuật. Câu thủ công chưa nhập điểm hiển thị **Chưa chấm**; giáo viên lưu toàn bộ điểm đã nhập bằng một nút, được cảnh báo nếu còn sót và không thể công bố khi chưa chấm đủ.
- Danh sách bài tập đã giao được chia theo lớp và trình bày dạng dòng gọn. Kết quả học viên phải hiển thị câu hỏi, bài làm, đáp án và nhận xét ở dạng đọc được, không hiển thị khóa lựa chọn hay dữ liệu kỹ thuật.
- Preview bộ bài tập/bộ đề phải dùng signed URL của media private như renderer học viên. Audio đề phải nghe được xuyên suốt ở preview, lượt làm, màn giáo viên chấm và kết quả đã công bố; bản ghi câu Nói phải nghe lại được ở lượt làm, màn chấm và kết quả học viên. Trang kết quả và trang chấm phải có lối quay lại danh sách nguồn; phân trang ngân hàng câu hỏi không được tạo link vượt trang cuối và phải giữ bộ lọc hiện tại.
- MP3/M4A khi soạn hoặc chỉnh sửa câu hỏi phải upload thẳng từ trình duyệt vào bucket private bằng vé do server ký (không đi qua giới hạn body của Server Action). Server xác minh object path, MIME và kích thước từ Storage trước khi gắn `question_media`; mở lại màn Chỉnh sửa phải phát được audio hiện tại bằng signed URL ngắn hạn.
- Answer key không xuất hiện trong client payload hoặc quyền student trước thời điểm release.

### BR-7 — Kiểm tra, xếp loại và đánh giá

- Khung thi có thể kéo dài nhiều ngày; deadline = `min(started_at + duration, closes_at)`. `pg_cron` finalize attempt hết hạn kể cả browser đóng.
- Điểm thi thang **0–100**; kết quả chỉ hiện sau khóa/công bố. Copy/cut/paste/drop bị chặn nhưng không phá Chinese IME.
- Phòng chờ phải kiểm tra micro trước khi timer chạy nếu bộ đề có câu Nói. Trong lượt thi, dashboard ẩn điều hướng, cảnh báo khi rời/tải lại trang và ghi integrity event; không tuyên bố có thể khóa tuyệt đối tab, hệ điều hành hay trình duyệt của học viên.
- Website chỉ cấp quyền micro cho chính origin (`microphone=(self)`); không được gửi Permissions Policy chặn toàn bộ micro. Danh sách kỳ thi đã giao và màn chấm/kết quả dùng cùng quy tắc UX như Bài tập.
- **Xếp loại được tính từ `grading_scale_rules`**, không hard-code label rải rác trong UI và không cho client tự gửi lên. Các ngưỡng **không chồng lấn** và phủ kín 0–100.
- Lưu draft và **publish là hai hành động tách biệt**. Học viên chỉ thấy bản ghi có `published_at IS NOT NULL`.
- Đánh giá định kỳ có thêm cờ `visible_to_student` — giáo viên chủ động chọn nhận xét nào cho học viên xem.
- **Không có tiêu chí "tài chính" trong đánh giá học tập.** Học phí và học lực là hai chuyện tách rời.

### BR-8 — Học phí

- Số dư = `invoice.total − SUM(payments)`. Là **giá trị tính ra**, không lưu thành cột "công nợ" rời (sẽ lệch).
- Trạng thái hóa đơn: `draft | issued | partial | paid | overdue | cancelled | refunded`.
- `amount > 0` cho mọi payment. Tổng thanh toán hợp lệ **không vượt** số phải thu, trừ khi đi qua flow hoàn tiền/điều chỉnh rõ ràng.
- Chỉ ghi nhận payment cho hóa đơn đã phát hành (`issued | partial | overdue`); draft, paid, cancelled, refunded đều bị từ chối ở RPC.
- Mỗi payment sinh **đúng một** receipt — ràng buộc bằng UNIQUE trên `tuition_receipts.payment_id`, không dựa vào app-level check (bài học từ lỗi thu-trùng ở hệ cũ).
- **Giáo viên không đọc được bảng học phí.** Học viên chỉ đọc hóa đơn **đã phát hành**/thanh toán của chính mình, không thấy draft và **không tự ghi nhận thanh toán**.
- Hóa đơn + khoản mục được lưu nguyên tử; `subtotal`, `line_total`, `total` do DB tính. Hóa đơn đã phát hành không sửa hoặc hard-delete.

### BR-9 — Hoàn thành khóa

- Hệ thống **tính** readiness từ: chuyên cần, tiến độ bài học, bài tập và điểm kiểm tra, theo rule cấu hình trên Course.
- Mặc định đề xuất: **chuyên cần ≥ 80%**, **điểm tổng ≥ 50/100**. Super admin chỉnh được **trước khi lớp bắt đầu**; không sửa hồi tố âm thầm cho lớp đang chạy.
- Hệ thống chỉ hiển thị "đủ / chưa đủ điều kiện". **Người xác nhận hoàn thành là super admin hoặc giáo viên được phân công**, có audit. Máy không tự động tốt nghiệp học viên.

### BR-10 — Thông báo

- Một chiều, không reply, không thread.
- Mỗi notification có link nội bộ hợp lệ; **kiểm authorization khi click** (link không phải là quyền).
- Người nhận chỉ được đổi `read_at`; không được sửa tiêu đề, nội dung, link hay chủ sở hữu notification. Tùy chọn `in_app_enabled` được trigger DB áp dụng cho **mọi** nguồn sinh notification; thiếu preference = mặc định bật.
- Announcement có hai phạm vi: toàn hệ thống (`class_id = null`) hoặc một lớp. Super admin soạn draft → publish riêng; sau publish khóa nội dung, chỉ được kết thúc hiệu lực. Giáo viên/học viên chỉ đọc bản đã publish, còn hiệu lực và thuộc audience của mình.
- Cron sinh nhắc lịch phải dùng `dedupe_key` để chạy lại không tạo thông báo trùng.

### BR-11 — Audit

- Append-only. Role app **không** update/delete được. **Chỉ super admin đọc.**
- Bắt buộc audit: đổi role/khóa tài khoản, sửa hồ sơ, sửa khóa/lớp/lịch, ghi danh/chuyển lớp, điểm danh, publish điểm, học phí/thanh toán, đổi visibility file.

### BR-12 — “Lớp của tôi” cho học viên

- `/student/class` là nơi duy nhất tổng hợp lớp đang mở của học viên: **Tổng quan · Lịch/Buổi · Bài tập · Kiểm tra · Tiến độ · Chuyên cần · Tài liệu**. Route cũ `/student/schedule` chỉ redirect để link thông báo cũ không gãy.
- Đây là màn **chỉ đọc**. Học viên không thấy roster/bạn cùng lớp, ghi chú giáo viên, dữ liệu draft, answer key hoặc hành động quản trị/chấm điểm.
- Dữ liệu lấy từ enrollment đang mở của chính học viên; thiếu mapping → empty state, không tự chọn lớp/user khác. Mỗi tab vẫn dựa vào RLS tương ứng, không gom dữ liệu bằng service role.
- Bài tập/kiểm tra trong lớp là bản tóm tắt và dẫn về module chuyên biệt; không tạo đường ghi thứ hai cho assessment engine.

### BR-13 — Flashcard và ôn câu sai

- Mỗi Course có tối đa một deck flashcard; nội dung chia theo **buổi số 1…N**. Mỗi buổi có đúng một trang mở đầu và các trang từ vựng theo thứ tự. Trang mở đầu bắt buộc có **hai ảnh** và không có chữ/audio. Trang từ vựng là bản ghi có cấu trúc: **Hán tự + Pinyin tách âm tiết + nghĩa tiếng Việt + audio người thật**, ba danh sách con (Tách nghĩa · Câu ví dụ · Cụm từ thường dùng) và hai ảnh tuỳ chọn; nếu có đủ hai ảnh thì phải là hai file khác nhau. Import hàng loạt được phép tạo thẻ nháp thiếu audio, nhưng DB chặn publish cho tới khi mọi thẻ từ vựng có audio. Mô tả ảnh (alt) do server sinh, admin không nhập. Media nằm trong bucket private; ảnh câu ví dụ đi qua `media_paths` do trigger tổng hợp.
- Super Admin chọn khóa và buổi khi quản trị, có thể chuẩn bị nháp từng buổi rồi publish. Học viên chỉ thấy buổi đã publish của Course thuộc lớp mình học; teacher/anonymous không có quyền.
- Ở buổi **nháp**, Super Admin lưu trữ (xóa mềm) được **mọi trang, kể cả trang mở đầu** — thao tác qua cùng một RPC `archive_flashcard_page`. Bỏ trang mở đầu để lại chỗ trống ở vị trí 0 (trang từ vựng giữ nguyên thứ tự, không dồn về 0); buổi thiếu trang mở đầu vẫn sửa được nhưng **không publish được** cho tới khi thêm trang mở đầu mới.
- Trên màn học viên, trang 1 là trang mở đầu; mũi tên phải lật **toàn bộ flashcard** hiện tại từ phải → trái quanh tâm để sang trang kế, mũi tên trái chạy chiều ngược lại. Đây là hiệu ứng lật flashcard, **không phải lật trang sách và không có gáy làm điểm xoay**. Bấm trực tiếp thẻ lật mặt trước/sau từ dưới → trên quanh tâm; bấm lại quay về mặt trước. Mặt đang xem được lưu riêng theo từng trang: đang ở mặt sau vẫn sang/lùi trang được, và đổi trang không tự ép mặt về trước. Bookmark buổi là các tab đánh dấu trang sách, không dùng dropdown.
- Học viên có thể ★ thẻ khó của chính mình; khóa chính ghép `(student_id, page_id)` và RPC nhận trạng thái mong muốn bảo đảm idempotent. Xáo trộn chỉ áp dụng cho buổi đang chọn và chỉ giữ trong state React; đăng xuất/đăng nhập lại trở về thứ tự gốc, không ghi DB/`localStorage`/`sessionStorage`.
- Animation phải dùng được bằng bàn phím/touch, có focus rõ, live text cho screen reader và tắt chuyển động khi `prefers-reduced-motion`.
- Ôn câu sai chỉ nhận answer có `is_correct = false` từ loại câu **máy chấm được**. `essay_translation` và `speaking` không vào hàng đợi; Nghe/Đọc vẫn vào nếu chính dạng câu đó được DB chấm tự động.
- Mỗi cặp `(student_id, question_version_id)` có một hàng đợi. Sai thêm thì tăng số lần và mở lại nếu đã thành thạo; làm đúng trong màn ôn thì ghi lịch sử và rời danh sách. Làm sai vẫn ở lại để thử tiếp.
- Học viên không SELECT trực tiếp Question Bank/answer key. RPC lấy prompt/options đã lọc và chấm trên DB; answer key không đi xuống client. Queue/history chỉ đọc own qua RLS.

### BR-14 — Tốc độ phát audio cho học viên

- Mọi audio do **giáo viên hoặc Super Admin tải lên** và được phát cho học viên trong **Bài tập, Kiểm tra/Thi và Ôn tập (Flashcard + câu sai)** phải cho học viên chọn đúng ba tốc độ: **0.5×, 0.75×, 1×**; mặc định **1×**. Không hiển thị 1.25× hoặc 1.5×.
- Điều chỉnh tốc độ chỉ diễn ra ở trình phát phía client bằng `HTMLMediaElement.playbackRate`, ưu tiên giữ nguyên cao độ giọng nói (`preservesPitch`). Không tạo bản sao, không chuyển mã và không sửa file gốc trong Storage.
- Quy tắc áp dụng tại mọi bề mặt học viên nghe lại audio nguồn: lượt làm Bài tập/Thi, kết quả đã công bố, Flashcard và Ôn câu sai. **Không áp dụng cho bản ghi câu Nói do học viên tự thu**, vì đó không phải audio do giáo viên/admin tải lên.
- Bộ chọn tốc độ phải dùng được bằng bàn phím và cảm ứng, có nhãn truy cập rõ, trạng thái đang chọn nhìn thấy được và touch target tối thiểu 44×44 px trên thiết bị cảm ứng.

---

## 7. Dữ liệu thực tế phải có trong seed

### 7.1 Level

HSK 1 → HSK 6 (framework `HSK`, `order_index` 1–6).

### 7.2 Course catalog — dòng cốt lõi (`status = active`)

| Code          | Tên                   | `program` | `course_type`   | Level                                 |
| ------------- | --------------------- | --------- | --------------- | ------------------------------------- |
| `HSK1`…`HSK6` | Tiếng Trung HSK 1…6   | `core`    | `hsk`           | HSK 1…6                               |
| `GT`          | Tiếng Trung giao tiếp | `core`    | `communication` | null                                  |
| `TN`          | Tiếng Trung thiếu nhi | `core`    | `kids`          | null                                  |
| `LT-HSK`      | Luyện thi HSK         | `core`    | `exam_prep`     | null (cấu hình target level theo lớp) |

Số buổi / thời lượng / học phí: **để null** ở catalog (trung tâm chưa cung cấp). Chốt ở từng Class.

### 7.3 Chương trình B2B — Vietcombank (2 chương trình, 3 lớp)

**Chương trình A — Tiếng Trung Đàm Phán Tài Chính Chiến Lược** (`Business Chinese for Executives`)

- Đối tượng: Ban Giám đốc · Chương trình: `business` · Loại: `null` · 35 buổi × 90 phút.

| Lớp      | Sĩ số | Khai giảng | Hình thức  | Địa điểm                                                 | Lịch                                                                                 |
| -------- | ----- | ---------- | ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `LOP-01` | 3     | 20/07/2026 | `in_house` | Trụ sở VCB hoặc địa điểm riêng tư do khách hàng chỉ định | **Linh hoạt** theo lịch Ban Giám đốc — chưa sinh lịch lặp cho tới khi admin cấu hình |

**Chương trình B — Tiếng Trung ngân hàng**

- Đối tượng: Lãnh đạo phòng / Cán bộ nhân viên · Chương trình: `business` · Loại: `null` · 35 buổi × 90 phút · Sĩ số tối đa 26 · `offline` tại `108 Tây Thạnh, Phường Tây Thạnh, TP. HCM`.

| Lớp      | Khai giảng | Lịch                                        |
| -------- | ---------- | ------------------------------------------- |
| `LOP-02` | 20/07/2026 | 08:00–09:30, **Thứ Hai & Thứ Tư** hằng tuần |
| `LOP-03` | 21/07/2026 | 08:00–09:30, **Thứ Ba & Thứ Năm** hằng tuần |

### 7.4 Quy tắc dữ liệu demo

- **Không bịa tên thật** của giáo viên hoặc học viên. Danh tính demo phải rõ ràng là giả (ví dụ `gv.demo1@polymind.test`, "Giáo viên Demo A").
- **Production không có user demo và không có mật khẩu mặc định.**
- Seed phải **idempotent**: chạy lại không nhân đôi dữ liệu.

---

## 8. Acceptance criteria (v1)

| #     | Tiêu chí                                                                                                                          | Cách nghiệm thu               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| AC-1  | 3 role đăng nhập và về đúng khu vực của mình; anonymous bị chặn                                                                   | E2E Playwright                |
| AC-2  | Super admin đi trọn: Course → Class → Schedule → sinh buổi → phân công GV → ghi danh → kích hoạt                                  | E2E                           |
| AC-3  | Giáo viên chỉ thấy lớp được phân công — kể cả khi gõ thẳng UUID lớp khác lên URL, gọi server action, hay query trực tiếp Supabase | pgTAP + E2E negative          |
| AC-4  | Học viên không thấy bất kỳ dữ liệu nào của học viên khác (roster, điểm, bài nộp, hóa đơn, ghi chú `staff_only`)                   | pgTAP + E2E negative          |
| AC-5  | Giáo viên **không đọc được** bảng học phí và audit log                                                                            | pgTAP                         |
| AC-6  | Điểm danh hàng loạt chạy 2 lần → không sinh bản ghi trùng                                                                         | Integration test              |
| AC-7  | Sinh buổi học chạy 2 lần → không sinh buổi trùng, dừng đúng `planned_session_count`                                               | Unit + integration            |
| AC-8  | Ghi nhận 1 payment → sinh đúng **1** receipt (kể cả gọi đồng thời)                                                                | Integration test              |
| AC-9  | Điểm chưa publish → học viên **không** thấy; publish xong mới thấy                                                                | pgTAP + E2E                   |
| AC-10 | Chuyển lớp giữ nguyên enrollment cũ (`transferred`) + tạo enrollment mới + ghi history                                            | Integration + E2E             |
| AC-11 | Ghi danh đồng thời không vượt `capacity`                                                                                          | Integration test (concurrent) |
| AC-12 | Export giữ đúng filter/date range đang chọn                                                                                       | Integration test              |
| AC-13 | Seed: HSK 1–6 + catalog cốt lõi + 2 chương trình B2B + 3 lớp VCB; `supabase db reset` sạch                                        | `supabase db reset`           |
| AC-14 | Không còn bất kỳ thuật ngữ/route/table XKLĐ nào                                                                                   | grep + review                 |
| AC-15 | Học viên vào “Lớp của tôi” thấy đúng lớp/7 tab nhưng không thấy roster hoặc dữ liệu học viên khác                               | pgTAP + E2E negative          |
| AC-16 | Student/teacher ngoài Course không đọc/ký được flashcard media; section nháp không hiện                                          | pgTAP Storage + E2E           |
| AC-17 | Flashcard lật trang/lật mặt độc lập bằng chuột, touch, phím; reduced-motion và touch target 44px                                 | Component + Playwright a11y   |
| AC-18 | Câu objective sai tự vào queue; submit đúng qua RPC thì rời queue; answer key không xuất hiện trong payload/quyền direct client | pgTAP + integration + E2E     |

---

## 9. Tham chiếu

- Đặc tả gốc: [`POLYMIND_CHINESE_BUILD_PROMPT.md`](../POLYMIND_CHINESE_BUILD_PROMPT.md)
- Thiết kế DB + RLS matrix: [`02-database-design.md`](02-database-design.md)
- Workflow: [`03-workflow.md`](03-workflow.md)
- Kiến trúc: [`04-system-architecture.md`](04-system-architecture.md)


### Bổ sung theo yêu cầu 2026-10-14 — Nút module Xuất khẩu lao động

Ngoại lệ giới hạn cho quy tắc loại domain XKLĐ: bộ chọn module có thêm thẻ Xuất khẩu lao động, biểu tượng máy bay, trạng thái Sắp triển khai. Bấm hiện thông báo chờ; chi tiết nghiệp vụ do user cung cấp sau. Chỉ giao diện, không tạo route/table/workflow XKLĐ ở bước này.


### Yêu cầu mở rộng XKLĐ ngày 14/10/2026

User đã cung cấp đặc tả xây mới module XKLĐ và dashboard theo vai trò. Phạm vi mới tại [09-xkld-requirements.md](09-xkld-requirements.md) thay thế giới hạn chỉ làm nút và yêu cầu loại XKLĐ đối với module mới này. Chưa thay đổi quyền hiện có, chưa gán vai trò nghiệp vụ trong ảnh vào bốn role hiện tại; đang chờ xác nhận phạm vi dữ liệu/nhân viên.


### Tài khoản nghiệp vụ mới — user chốt 14/10/2026

Tạo một tài khoản mỗi nhóm: ms.thuong → executive (Ban điều hành), quanly.trungtam → center_manager, tuvan.cskh → consultant, nhanvien.xkld → xkld_staff. Đây là nhóm quyền riêng, không tự gán super_admin/academic_manager. Nhân viên XKLĐ được xem toàn bộ ứng viên và chỉ đọc công nợ; không nhập/sửa khoản thu. Ngoại lệ mật khẩu khởi tạo 6 ký tự chỉ áp dụng bốn tài khoản do user chỉ định; validation cấp/đặt lại mật khẩu chung vẫn tối thiểu 8 ký tự. Không lưu mật khẩu vào docs/script/migration.

Bốn role mới đăng nhập tới /workspace; giao diện theo vai trò ghi rõ chức năng đang xây, không hiển thị số liệu giả. /workspace/notifications dùng luồng thông báo hiện hữu. Chưa triển khai dashboard nghiệp vụ và module XKLĐ từ đặc tả, các quyền dữ liệu tương ứng chưa được mở. Tài khoản Auth đã tạo cloud; cần phát hành code trước khi đăng nhập bốn role trên website online.


### XKLD-CANDIDATES-1 — Quản lý ứng viên (2026-10-14)

Route /workspace/xkld/candidates có danh sách 25 hồ sơ/trang, tìm mã/tên/SĐT/Zalo/quê quán/trình độ/nghề và lọc nguồn/sức khỏe/người phụ trách. Thêm/sửa gồm họ tên, ngày sinh, SĐT/Zalo, quê quán, trình độ, nghề, sức khỏe đạt/không, nguồn CTV/nhân viên/quảng cáo, người phụ trách. Mã UV do DB tự sinh; Zalo tùy chọn, các trường còn lại bắt buộc. Ngày sinh từ 1900 đến hôm nay theo giờ VN; SĐT 10 số bắt đầu 0 hoặc +84 và 9 số. Không tự gộp người trùng tên/SĐT.

Super admin và xkld_staff thêm/sửa, xem toàn bộ; executive chỉ đọc; các role khác/anonymous bị chặn ở server và RLS. Người phụ trách là super admin hoặc nhân viên XKLĐ đang hoạt động; giữ tên phụ trách cũ khi tài khoản dừng hoạt động. Không có xóa hồ sơ. UUID yêu cầu tạo unique chống tạo trùng khi retry; updated_at kiểm tra trước update để tránh ghi đè bản mới. Actor thật do trigger auth.uid(), không lấy từ dữ liệu form. Phần tài chính/công nợ không nằm trong thay đổi này.


### XKLD-ORDERS-1 — Thị trường và đơn hàng (2026-10-14)

Trang /workspace/xkld/orders quản lý danh mục quốc gia (tên/mã hai chữ, tiền tệ mặc định, đang/ngừng sử dụng) và đơn hàng có mã DH DB tự sinh, quốc gia, chủ sử dụng, ngành nghề, số lượng tuyển, lương, tiền tệ/kỳ lương, điều kiện, hạn tuyển, đối tác, trạng thái đang tuyển/tạm dừng/đóng. Có sẵn ba quốc gia tham chiếu SG/Singapore/SGD, JP/Nhật Bản/JPY, TW/Đài Loan/TWD; thêm/sửa được thị trường khác. Không tạo đơn hàng hay mức lương mẫu.

Danh sách25/trang, tìm mã/chủ sử dụng/nghề/đối tác/điều kiện, lọc quốc gia/trạng thái/hạn. Hạn tuyển tính theo ngày VN, hôm nay còn trong hạn; nhãn đã qua hạn chỉ cho đơn đang tuyển, không tự đóng đơn. Số lượng là số nguyên dương; lương dương tối đa2 chữ số thập phân; nhập rõ mã tiền tệ3 chữ và kỳ giờ/ngày/tháng/năm, không quy đổi hoặc cộng lẫn tiền tệ. Đơn đã có giữ nguyên tiền tệ khi đổi mặc định thị trường.

Super admin/xkld_staff thêm/sửa và đọc toàn bộ, executive chỉ đọc; role khác bị chặn server/RLS. Ngừng thị trường chặn đơn mới nhưng giữ và cho sửa đơn cũ; không hard delete. UUID tạo unique chống retry; cập nhật kiểm tra updated_at để tránh ghi đè. Actor do auth.uid() từ trigger. Các biểu mẫu giữ dữ liệu đã nhập khi server báo lỗi.


### XKLD-PIPELINE-1 — Pipeline10 bước (2026-10-14)

Trang /workspace/xkld/pipeline có bảng10 cột đúng thứ tự user: Lead, Tư vấn, Đăng ký/đặt cọc, Đào tạo ngoại ngữ, Hoàn thiện hồ sơ, Phỏng vấn, Trúng tuyển, Visa/giấy phép, Xuất cảnh, Hậu xuất cảnh. Mỗi ứng viên có một tiến trình hiện tại, một đơn hàng và một lớp B2C tùy giai đoạn. Hồ sơ mới vào Lead tự động; hồ sơ có trước SQL10 được mặc định Lead nhưng không dựng lịch sử/người thao tác giả.

Super admin/xkld_staff cập nhật; executive xem và đọc lịch sử; role khác chặn server/RPC/RLS. Chỉ tiến tới bước kế tiếp, quay lại bước cũ phải có lý do; có thể cập nhật liên kết tại bước hiện tại. Từ đào tạo cần lớp B2C; từ phỏng vấn cần đơn hàng. Liên kết mới chỉ nhận lớp planned/active và đơn đang tuyển, còn hạn, thị trường hoạt động; liên kết cũ được giữ khi lớp/đơn ngừng nhận mới. Không tự ghi danh hoặc đổi học phí B2C; đăng ký/đặt cọc không tự tạo phiếu thu.

Bảng tải tối đa20 hồ sơ/cột, chọn một giai đoạn để phân trang20. Tìm mã/tên/SĐT và lọc người phụ trách. Popup có tra lớp/đơn phân trang20; chỉ trả metadata lớp, không mở hồ sơ/học phí B2C. Lịch sử bất biến lưu từ-bước/đến-bước, liên kết trước-sau, người/thời gian VN/ghi chú; đây là lịch sử tiến trình nghiệp vụ, không mở audit hệ thống. UUID chống retry, updated_at chống ghi đè, ghi lịch sử và chuyển bước chung transaction.


### XKLD-DOCUMENTS-1 — Hồ sơ giấy tờ

Checklist do trung tâm cấu hình theo thị trường: tên, bắt buộc, theo dõi hết hạn, thứ tự và ngừng sử dụng. Không tự điền yêu cầu pháp lý. Mỗi ứng viên chọn thị trường (mặc định từ đơn hàng nếu có), lưu ngày nộp thực tế/ngày hết hạn/ghi chú; cảnh báo 30 ngày. Giữ hồ sơ thị trường/checklist cũ. Super admin và xkld_staff cập nhật toàn bộ; executive chỉ xem/tải xuống; các role khác không truy cập. File PDF/PNG/JPG tối đa10 MB, nhiều phiên bản không ghi đè/xóa lịch sử. Upload không tự xác nhận nộp/hợp lệ; không tự chặn pipeline hoặc ghi danh/thu phí.


### XKLD-FINANCE-1 — Tài chính VNĐ

User chốt chỉ VNĐ, super_admin và executive cùng xem/ghi/sửa; xkld_staff chỉ đọc công nợ ứng viên. Ba nhóm nghĩa vụ gắn ứng viên: phí dịch vụ phải thu, phí đối tác/chủ sử dụng phải thu, hoa hồng CTV phải chi. Mỗi đợt có tên/đối tượng/số tiền/hạn/ghi chú. Có thể thu/chi từng phần, không vượt còn phải thu/chi. Hoàn gắn phiếu thu gốc, không vượt số chưa hoàn, có lý do và chọn giảm phí tương ứng hay giữ phí để mở lại công nợ. Phiếu đã ghi không sửa/xóa trực tiếp; hủy có lý do rồi lập đúng, giữ lịch sử actor thật. Phí sửa không thấp hơn thực thu/đã chi ròng; phí0 có thể dùng khi đã hủy hoặc hoàn hết. Hủy phiếu hoàn giảm phí khôi phục mức phí cũ; không cho hủy nếu làm thu vượt phí. Không tự coi nghĩa vụ là doanh thu ghi nhận, không quy đổi hoặc lấy dữ liệu tài chính B2C.


### B2C-CLASS-DETAIL-1 — Xem chi tiết lớp

Tại chương trình B2C, bấm tên lớp hoặc con mắt mở popup gồm mã/tên/chương trình/giáo viên/cấp độ/trạng thái/lịch/khai giảng/hình thức/cơ sở/sĩ số ghi nhận/ghi chú. Roster chỉ lấy ghi danh có classCode khớp lớp đang chọn, có mã/tên/trạng thái/phụ huynh/SĐT/ngày nhập học/hết học phí/số buổi; tìm kiếm và20 hồ sơ/trang. Sĩ số ghi nhận và số hồ sơ ghi danh hiển thị riêng, không tự coi bằng nhau. Dùng dữ liệu hiện có trên trang chương trình qua requireManager/RLS, không đổi quyền hoặc schema.


### B2C-CLASS-WORKSPACE-1 — Trang chi tiết đủ5 mục

Trang /admin/b2c/classes/[classId] có Học viên, Lịch học từng buổi, Điểm danh, Học phí, Nhận xét; mở từ5 nút trong popup lớp. Quyền super_admin/academic_manager theo requireManager + app.is_manager/RLS, không mở quyền giáo viên/nhóm XKLĐ ở bước này. Lịch học độc lập công/lương: nhập ngày/giờ/giáo viên/trạng thái/ghi chú, không tạo tiền công. Lịch dạy đã có được mirror giữ nguồn/creator; lịch mới từ giờ dạy tự liên kết, không nhập trùng cùng lớp/giờ. Điểm danh từng ghi danh/buổi gồm có mặt/đi muộn/vắng/vắng phép; chưa nhập là Chưa điểm danh, không tự coi vắng. Chặn tương lai, nhầm lớp, buổi hủy, ghi đè stale; buổi có điểm danh/nhận xét không đổi giờ hoặc hủy. Nhận xét chung hoặc theo buổi giữ nội dung/actor/thời điểm, bổ sung mới thay vì xóa lịch sử. Học phí dùng gói/phiếu thu hiện có của đúng ghi danh, có thêm/sửa gói và thu tiền; chưa có gói hiện rõ, không coi miễn phí. Điểm danh không tự trừ học phí hoặc cập nhật lương.


### B2C-PARENT-NPS-1 — Khảo sát hài lòng phụ huynh

Mỗi lớp B2C đại diện một khóa khảo sát NPS. Quản trị/giáo vụ tạo, đóng/mở/gia hạn tối đa 90 ngày. Một phụ huynh đã liên kết với học viên của lớp chỉ có một phiếu, kể cả nhiều con; không suy liên hệ từ ghi chú. Phụ huynh chấm 0–10, góp ý lý do/giáo viên/chăm sóc. NPS = 100 × (số điểm 9–10 trừ số điểm 0–6) / toàn bộ phản hồi, làm tròn một chữ số; 7–8 trung lập, chưa có phản hồi là chưa có NPS. Chỉ quản lý đọc góp ý, không sửa/xóa phản hồi; đóng/thu hồi không loại kết quả cũ.


### B2C-TUITION-DESIGN-1

Trang Học phí theo mẫu user: tổng phải thu/đã thu/còn phải thu theo bộ lọc, học viên cần xử lý đếm hồ sơ duy nhất đang có ít nhất một ghi danh nợ tiền hoặc đến hạn tái phí. Chưa có gói tách riêng, không tự coi miễn phí hay nợ. Tái phí theo trạng thái awaiting_renewal hoặc ngày hết học phí đã đến, loại bảo lưu/nghỉ/hoàn thành/chuyển lớp khỏi nhắc tái phí; nợ tiền cũ vẫn theo dõi. Không suy ngưỡng2buổi.


### B2C-PARENT-DESIGN-1

Trang Phụ huynh theo ảnh:4thẻ Tổng/Có SĐT/Có Zalo/Thiếu thông tin, đếm hồ sơ duy nhất không theo số con. Thiếu là SĐT hoặc Zalo trống, email vẫn tùy chọn; không đổi sang yêu cầu2SĐT hoặc tự bổ sung liên hệ. KPI dùng toàn bộ danh sách, bộ lọc chỉ thay bảng/số hồ sơ.
