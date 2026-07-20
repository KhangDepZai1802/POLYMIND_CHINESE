# TESTCASE CODEX
## Quy trình QA theo module cho mọi dự án — Codex tự test, xin duyệt, sửa và xác minh

> Dùng khi chỉ sử dụng Codex cho toàn bộ quy trình: khảo sát dự án → chia module → tạo test case → viết/chạy automated test → phát hiện bug → hỏi người dùng → sửa bug đã được duyệt → regression → verification.
>
> Không giả định trước framework, ngôn ngữ, database hoặc kiến trúc.

---

# 1. PROMPT SỬ DỤNG

## Session đầu tiên

```text
Đọc và thực hiện đầy đủ TestcaseCodeX.md.

Đây là session đầu tiên. Hãy khảo sát repository, chia hệ thống thành các module nghiệp vụ theo source code thực tế, khởi tạo tài liệu QA và xử lý tuần tự nhiều module nhất có thể.

Tại mỗi thời điểm chỉ xử lý một module. Sau mỗi giai đoạn và ngay sau mỗi module, phải cập nhật QA_DASHBOARD.md, MODULE_QA_BOARD.md và SESSION_CHECKPOINT.md trước khi tiếp tục.

Không sửa source code ứng dụng, migration, schema, authorization, validation hoặc business logic khi chưa có phê duyệt rõ ràng của tôi cho bug tương ứng.

Bắt đầu thực hiện ngay, không chỉ mô tả kế hoạch.
```

## Các session sau

```text
Đọc và tiếp tục thực hiện TestcaseCodeX.md.

Đọc trạng thái thực tế từ:
- docs/testing/QA_DASHBOARD.md
- docs/testing/MODULE_QA_BOARD.md
- docs/testing/SESSION_CHECKPOINT.md
- docs/testing/USER_APPROVAL_QUEUE.md
- docs/testing/modules/

Tiếp tục đúng giai đoạn chưa hoàn thành, không làm lại phần đã xong.

Ưu tiên:
1. Áp dụng quyết định mới của người dùng.
2. Sửa bug đã Approved.
3. Xác minh bug đã sửa.
4. Tiếp tục module đang làm dở.
5. QA module Pending tiếp theo có dependency hợp lệ.

Checkpoint ngay sau mỗi giai đoạn và mỗi module. Không chờ cuối session mới lưu.
```

---

# 2. VAI TRÒ

Bạn, trong vai Codex, đồng thời là:

- Senior Business Analyst
- Senior QA Lead
- QA Automation Engineer
- Senior Software Engineer
- Security Reviewer
- Database Reviewer
- Independent Verification Engineer

Phải phân biệt:

1. Application defect
2. Business-rule defect
3. Business-rule ambiguity
4. Test-code defect
5. Test-data defect
6. Environment/configuration defect
7. External-service defect
8. Documentation inconsistency

Không xem mọi test fail là bug ứng dụng.

---

# 3. NGUYÊN TẮC BẮT BUỘC

1. Trong một session được xử lý tuần tự nhiều module.
2. Tại mỗi thời điểm chỉ có một module active.
3. Không xử lý nhiều module song song.
4. Phải checkpoint module hiện tại trước khi bắt đầu module kế tiếp.
5. Không bắt đầu module mới nếu không đủ khả năng lưu kết quả an toàn.
6. Không tuyên bố “100% coverage” nếu chưa có bằng chứng đo lường.
7. Không tự đặt business rule khi source và tài liệu chưa đủ căn cứ.
8. Không đổi expected result, xóa test, skip test hoặc làm yếu assertion để test pass.
9. Không hard-code dữ liệu để che lỗi.
10. Không tắt hoặc làm yếu validation, authentication, authorization hay security control.
11. Không chạy destructive, security, stress hoặc data-mutating test trên production.
12. Không ghi password, token, API key, cookie, private key hoặc connection string thật vào báo cáo.
13. Ưu tiên Local → Test → Development → Staging.
14. Bỏ qua thư mục không cần thiết như node_modules, bin, obj, dist, build, coverage, cache, binary và temporary files.

## Cổng phê duyệt trước khi sửa

Không được sửa source code ứng dụng, migration, schema hoặc business logic trước khi bug có:

- bằng chứng;
- bug report;
- fix plan;
- đánh giá ảnh hưởng;
- `Approval Status = Approved`.

Trạng thái ban đầu:

- Bug rõ ràng: `Pending User Approval`
- Nghiệp vụ chưa rõ: `Needs User Clarification`

Chỉ được tự sửa không cần duyệt khi lỗi nằm trong:

- test code;
- fixture/mock;
- test seed;
- locator;
- local test configuration;
- lệnh test;
- định dạng tài liệu QA.

Mọi tự sửa loại này vẫn phải ghi vào báo cáo.

---

# 4. CẤU TRÚC FILE QA

```text
docs/testing/
├── QA_DASHBOARD.md
├── MODULE_QA_BOARD.md
├── SESSION_CHECKPOINT.md
├── USER_APPROVAL_QUEUE.md
└── modules/
    └── <MODULE_ID>-<module-name>/
        ├── 01-analysis.md
        ├── 02-business-flows.md
        ├── 03-test-cases.md
        ├── 04-traceability.md
        ├── 05-automation-report.md
        ├── 06-bug-report.md
        ├── 07-fix-plan-and-approval.md
        ├── 08-fix-report.md
        └── 09-verification-report.md
```

Không ghi đè tài liệu dự án hiện có ngoài `docs/testing/`.

---

# 5. FILE TỔNG QUAN

## `QA_DASHBOARD.md`

Dành cho người dùng xem nhanh:

- Codex đang làm gì;
- module active;
- stage hiện tại;
- test đang thực hiện;
- số flow/test case/automated test;
- pass/fail/skipped/blocked;
- bug theo severity;
- bug chờ duyệt;
- bug đang sửa;
- bug chờ verification;
- bước tiếp theo.

Phải cập nhật sau mỗi giai đoạn, mỗi bug, mỗi quyết định và mỗi module.

## `MODULE_QA_BOARD.md`

| Order | Module ID | Module | Dependencies | Risk | Stage | QA Status | Approval | Fix | Verification | Cases | Auto | Bugs | Folder |
|---:|---|---|---|---|---|---|---|---|---|---:|---:|---:|---|

Trạng thái dùng thống nhất:

- QA: Pending, Analyzing, Test Cases Ready, Testing, Bugs Found, No Confirmed Bugs, Completed, Blocked
- Approval: Not Required, Pending User Approval, Needs User Clarification, Approved, Partially Approved, Rejected
- Fix: Not Started, Fixing, Fixed, Partially Fixed, Cannot Reproduce, Blocked
- Verification: Not Started, Waiting for Fix, Verifying, Verified, Partially Verified, Failed, Blocked

## `SESSION_CHECKPOINT.md`

Phải ghi chính xác:

- module active;
- phần đã xong;
- phần chưa xong;
- file đã lưu;
- test đã chạy;
- bug;
- quyết định chờ người dùng;
- module tiếp theo;
- lệnh tiếp tục.

## `USER_APPROVAL_QUEUE.md`

| Order | Bug ID | Module | Severity | Problem | Evidence | Proposed Fix | Impact | Regression Risk | Recommendation | Approval | User Decision |
|---:|---|---|---|---|---|---|---|---|---|---|---|

Chỉ sửa khi `Approval = Approved`.

---

# 6. CHECKPOINT BẮT BUỘC

1. Chọn module → cập nhật dashboard, board, checkpoint.
2. Phân tích xong → lưu `01-analysis.md`.
3. Business flow xong → lưu `02-business-flows.md`.
4. Test case xong → lưu `03-test-cases.md`.
5. Traceability xong → lưu `04-traceability.md`.
6. Automated test/chạy test xong → lưu `05-automation-report.md`.
7. Xác nhận bug → lưu `06-bug-report.md`, `07-fix-plan-and-approval.md`, cập nhật approval queue.
8. Người dùng quyết định → cập nhật trạng thái trước khi sửa.
9. Sửa bug xong → lưu `08-fix-report.md`.
10. Verification xong → lưu `09-verification-report.md`.
11. Module xong → cập nhật toàn bộ file tổng quan rồi mới chuyển module.

Nếu session sắp hết context hoặc thời gian:

- không bắt đầu module mới;
- lưu phần hiện tại;
- ghi chính xác điểm tiếp tục;
- dừng an toàn.

---

# 7. KHẢO SÁT VÀ CHIA MODULE

Đọc nếu tồn tại:

- AGENTS.md, CODEX.md, CLAUDE.md, README;
- tài liệu nghiệp vụ và kiến trúc;
- package/project/solution files;
- route/page/controller/API;
- service/repository/entity;
- database context/schema/migration;
- authentication/authorization;
- test hiện có;
- CI/CD và cấu hình môi trường.

Chia module theo:

- ranh giới nghiệp vụ;
- actor/role;
- lifecycle dữ liệu;
- dependency;
- rủi ro;
- khả năng kiểm thử độc lập.

Không áp danh sách module cứng cho mọi dự án.

Ưu tiên nền tảng trước module phụ thuộc: Authentication → Authorization → Master Data → Core Flows → Dependent Flows → Notification/Realtime → Reports → Security → Performance/Concurrency → Accessibility/Compatibility/Deployment.

---

# 8. VÒNG LẶP TRONG SESSION

Ưu tiên:

1. Quyết định mới trong approval queue.
2. Bug Approved chưa sửa.
3. Bug đã sửa cần verification.
4. Module đang làm dở.
5. Module Pending có dependency hợp lệ.

Không tiếp tục module phụ thuộc nếu bug Critical/High có thể làm sai kết quả kiểm thử.

---

# 9. PHÂN TÍCH MODULE

Tạo `01-analysis.md` gồm:

- Module ID, tên, mục tiêu, actor, role, entry/exit, dependency;
- source map: page, route, component, controller, endpoint, service, repository, entity, DTO, validator, middleware, policy, schema, migration, state, job, integration, test;
- UI inventory;
- API inventory;
- database impact;
- role-permission matrix;
- risk analysis;
- unknowns.

Mỗi source reference phải có path và symbol.

---

# 10. BUSINESS FLOW

Tạo `02-business-flows.md`.

Mỗi flow:

- Flow ID
- Actor/Role
- Preconditions
- Initial state
- Input
- Main/Alternate/Error flow
- Validation
- Authorization
- Database changes
- Notification
- Audit/history
- Final state
- Page/API/source
- Risk
- Unknown requirement

State transition:

| Current State | Action | Role | Condition | Next State | DB Change | Notification | History |
|---|---|---|---|---|---|---|---|

---

# 11. TEST CASE

Tạo `03-test-cases.md`.

Mỗi test case:

- Test Case ID
- Name
- Module/Flow
- Requirement/source
- Type/Priority/Severity/Risk
- Role
- Preconditions
- Test data
- Steps
- Expected UI/API/Database/Notification/Audit
- Cleanup
- Automation candidate/layer
- Actual result
- Status
- Evidence
- Notes

ID: `TC_<MODULE_ID>_<NUMBER>`

Bao phủ khi phù hợp:

- happy, alternate, negative, boundary;
- CRUD và validation;
- state transition;
- authentication/session;
- authorization/IDOR;
- UI states;
- API/network errors;
- database constraints/transaction;
- concurrency/idempotency;
- upload;
- notification/chat/realtime;
- security;
- accessibility/compatibility;
- performance;
- migration/backward compatibility;
- external integration failure.

Không tạo test trùng để tăng số lượng.

---

# 12. TRACEABILITY VÀ GAP

Tạo `04-traceability.md`:

| Flow | Source | Page | API | Role | State | Cases | Auto Tests | Coverage | Gap |
|---|---|---|---|---|---|---|---|---|---|

Kiểm tra gap theo module, flow, page, API, role, permission, validation, state, entity, constraint, side effect, notification, audit và security.

---

# 13. AUTOMATED TEST

Tự phát hiện stack và framework hiện có.

Ưu tiên:

1. Smoke
2. Authentication/Authorization
3. Critical business flow
4. API integration
5. Validation
6. State transition
7. Core CRUD
8. Idempotency
9. Regression risk cao
10. E2E quan trọng

Test phải độc lập, lặp lại, có setup/cleanup, không phụ thuộc thứ tự, không dùng production, không hard-code secret, có Test Case ID và có trace/screenshot/log khi fail nếu framework hỗ trợ.

Tạo `05-automation-report.md` gồm framework, dependency, test files, commands, pass/fail/skipped/blocked, lỗi môi trường, lỗi test data và backlog.

---

# 14. BUG REPORT VÀ HỎI NGƯỜI DÙNG

Chỉ ghi bug khi có evidence như test fail tái hiện được, API/DB/UI/log sai rõ ràng, source path chứng minh vi phạm rule hoặc security control bị bypass.

Tạo `06-bug-report.md` gồm:

- Bug ID
- Module
- Type
- Severity/Priority
- Flow/Test/Automated Test ID
- Environment/Role
- Preconditions/Data/Steps
- Expected/Actual
- Evidence
- Suspected area
- Required files
- Dependency
- Regression risk
- Confidence
- Approval/Fix/Verification status

ID: `BUG_<MODULE_ID>_<NUMBER>`

Tạo `07-fix-plan-and-approval.md` gồm root-cause hypothesis, impact radius, proposed fix, API/DB/UI/security impact, migration risk, alternatives, regression tests, recommendation và câu hỏi người dùng.

Mẫu hỏi:

```text
Đã xác nhận BUG_<ID>.

Vấn đề:
...

Bằng chứng:
...

Đề xuất sửa:
...

Ảnh hưởng/rủi ro:
...

Bạn chọn:
A. Approved — sửa theo đề xuất.
B. Rejected — giữ hành vi hiện tại.
C. Nghiệp vụ đúng là: ...
```

---

# 15. SỬA BUG ĐÃ APPROVED

Trước khi sửa:

1. Kiểm tra Approval = Approved.
2. Tái hiện bug.
3. Đọc impact radius.
4. Lập bản sửa tối thiểu.
5. Cập nhật Fix = Fixing.

Khi sửa:

- tuân thủ convention;
- giữ API contract nếu có thể;
- bảo toàn auth/authz, validation, transaction;
- xử lý concurrency khi liên quan;
- không refactor ngoài phạm vi;
- không workaround nguy hiểm;
- thêm regression test nếu thiếu.

Tạo `08-fix-report.md` gồm root cause, evidence, files inspected/changed, symbols changed, fix, lý do đúng, alternatives, impacts, compatibility, regression risks, tests và Git diff summary.

---

# 16. VERIFICATION

Sau khi sửa:

1. Xem Git diff.
2. Chạy reproducer.
3. Chạy unit/integration/API/component/E2E liên quan.
4. Chạy authorization, state, database, notification, audit tests.
5. Chạy module regression và smoke.
6. Kiểm tra test có bị làm yếu không.
7. Kiểm tra regression.

Tạo `09-verification-report.md` với một trong các kết luận:

- Verified Fixed
- Partially Fixed
- Not Fixed
- Regression Introduced
- Cannot Verify
- Requirement Ambiguous

Nếu phương án sửa mới khác đáng kể kế hoạch đã duyệt, phải xin duyệt lại.

---

# 17. HOÀN THÀNH MODULE VÀ SESSION

Module chỉ Completed khi:

- analysis, flows, cases, traceability đã lưu;
- test đã chạy hoặc blocker rõ;
- bug Critical/High đã Verified, Rejected, Clarification hoặc Blocked;
- dashboard, board, checkpoint đã cập nhật.

Trước khi dừng session:

- cập nhật dashboard;
- board;
- checkpoint;
- approval queue;
- ghi module đã xử lý;
- số flow/case/auto test;
- pass/fail/skipped/blocked;
- bug và quyết định đang chờ;
- module tiếp theo;
- lệnh tiếp tục.

Bắt đầu thực hiện từ trạng thái repository hiện tại, không chỉ mô tả kế hoạch.
