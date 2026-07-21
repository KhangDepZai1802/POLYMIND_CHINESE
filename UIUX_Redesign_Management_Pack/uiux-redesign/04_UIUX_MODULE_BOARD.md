# UI/UX Module Board

## Active Task

| Field | Value |
|---|---|
| Active Module ID | NONE |
| Active Module | NONE |
| Current Screen/Subtask | NONE |
| Status | NOT_STARTED |
| Started At | — |
| Last Updated | — |
| Owner/Agent | — |
| Report File | — |
| Next Exact Action | Khởi tạo inventory và design system |

## Board

| Order | Module ID | Module | Audit | Proposal | Implementation | Responsive | Lint | Type-check | Build | Final Status |
|---:|---|---|---|---|---|---|---|---|---|---|
| 1 | M01 | TBD | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | NOT_STARTED |

Ký hiệu:

- `⬜` Chưa làm
- `🟨` Đang làm
- `✅` Hoàn thành
- `⛔` Bị chặn
- `➖` Không áp dụng, phải có lý do

## Quy tắc cập nhật

Cập nhật ngay khi:

- Bắt đầu module.
- Hoàn thành audit.
- Hoàn thành proposal.
- Hoàn thành từng màn hình.
- Phát hiện blocker.
- Chạy lint/type-check/build.
- Hoàn thành module.

Không đợi cuối session mới cập nhật.

## Module Completion Gate

Trước khi đổi `Final Status` sang `DONE`, xác nhận:

- [ ] Tất cả màn hình trong phạm vi đã hoàn thành.
- [ ] Báo cáo module đã cập nhật.
- [ ] Responsive đã kiểm tra.
- [ ] Loading/empty/error/disabled/success đã xử lý hoặc ghi N/A.
- [ ] Keyboard focus đã kiểm tra.
- [ ] Không thay business logic/API/route/database/permission.
- [ ] Lint pass.
- [ ] Type-check pass.
- [ ] Build pass.
- [ ] Changelog cập nhật.
- [ ] Checkpoint trỏ sang hành động kế tiếp.
