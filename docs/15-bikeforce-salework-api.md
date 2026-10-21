# BikeForce SaleWork API

## Endpoint

`POST {APP_URL}/api/integrations/bikeforce/salework`

Headers:

```http
Content-Type: application/json
x-api-key: <BIKEFORCE_API_KEY>
```

Body:

```json
{
  "person": "co-le",
  "date": "2026-10-21",
  "snapshot": {
    "conversations": 12,
    "sentMessages": 30,
    "receivedMessages": 24,
    "incomingCalls": 7,
    "outgoingCalls": 9,
    "missedCalls": 2,
    "callDurationSeconds": 3660,
    "syncedAt": "2026-10-21T07:30:00Z"
  }
}
```

- `person`: chỉ nhận `co-le` hoặc `co-thy`.
- `date`: ngày SaleWork theo định dạng `YYYY-MM-DD`.
- `snapshot`: bắt buộc có đúng tám field trong ví dụ. Bảy chỉ số là số nguyên không âm; `syncedAt` là thời điểm ISO 8601 có múi giờ.
- Không gửi `telesaleCode`: hai người này không có mã Telesale và API từ chối field ngoài hợp đồng.
- Khóa lưu là `(person, date)`. Gửi lại cùng người và ngày sẽ thay toàn bộ `snapshot` cũ, không cộng dồn.

Phản hồi thành công (`200`):

```json
{
  "ok": true,
  "person": "co-le",
  "date": "2026-10-21",
  "mode": "snapshot",
  "receivedAt": "2026-10-21T07:00:00.000Z"
}
```

Lỗi xác thực trả `401`; JSON hoặc payload sai trả `400`; lỗi lưu trả `500`.
