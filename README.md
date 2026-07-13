# POLYMIND CHINESE

**Web app quản lý học viên tiếng Trung** — khóa học, lớp, lịch/buổi học, điểm danh, bài tập, kiểm tra, đánh giá tiến độ, học phí, thông báo và báo cáo.

> Đây là sản phẩm **độc lập**, không liên quan tới POLYMIND OLMS (web xuất khẩu lao động). Repo đó chỉ được dùng làm tham chiếu **bài học UX/QA**, không port code.

---

## 🤖 Nếu bạn là AI agent

**Đọc [`AGENTS.md`](AGENTS.md) trước khi gõ dòng code đầu tiên.** Rồi đọc [`WORKLOG.md`](WORKLOG.md) để biết đang ở đâu và phải làm task nào tiếp theo.

---

## Stack

| | |
|---|---|
| Framework | Next.js (App Router) · TypeScript `strict` |
| UI | Tailwind CSS · shadcn/ui · Lucide · Recharts · TanStack Table |
| Form | React Hook Form + Zod |
| Backend | Supabase — Auth · PostgreSQL (**RLS trên mọi bảng**) · Storage (private buckets) |
| Test | Vitest · React Testing Library · Playwright · pgTAP |
| Deploy | Vercel + Supabase |

---

## Chạy local

**Cần:** Node 20+, npm, Docker (cho Supabase local).

```bash
npm install

npx supabase start        # Docker daemon phải đang chạy
                          # → in ra API URL + anon key + service_role key

cp .env.example .env.local        # điền các giá trị vừa in ra

npx supabase db reset             # áp migration + seed
npx supabase gen types typescript --local > src/types/database.ts

npm run dev                       # http://localhost:3000
```

Supabase Studio local: http://localhost:54323

---

## Lệnh

```bash
npm run dev          # dev server
npm run build        # production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (unit + component)
npm run test:e2e     # Playwright (E2E 3 role)

npx supabase db reset    # reset DB + chạy lại migration + seed
npx supabase test db     # pgTAP: constraint + RLS + IDOR
```

**Trước khi commit:** `npm run lint && npm run typecheck && npm test && npm run build` phải xanh.

---

## 3 role

| Role | Thấy gì |
|---|---|
| `super_admin` | Toàn trung tâm: tài khoản, khóa học, lớp, học phí, báo cáo, audit |
| `teacher` | **Chỉ lớp được phân công** + học viên trong các lớp đó. **Không** thấy học phí, audit, lớp khác |
| `student` | **Chỉ dữ liệu của chính mình.** Không thấy học viên khác, không thấy ghi chú nội bộ |

**Không có public sign-up.** Super admin tạo hồ sơ và gửi invite email.

Phân quyền được cưỡng chế bằng **Row Level Security ở database**, không phải bằng cách ẩn nút trên UI.

---

## Tài liệu

| File | Nội dung |
|---|---|
| [`docs/01-business-analysis.md`](docs/01-business-analysis.md) | Nghiệp vụ, actors, role matrix, business rules, acceptance criteria |
| [`docs/02-database-design.md`](docs/02-database-design.md) | ERD, schema chi tiết, **RLS matrix**, views, RPC, Storage, seed |
| [`docs/03-workflow.md`](docs/03-workflow.md) | Luồng nghiệp vụ + failure path |
| [`docs/04-system-architecture.md`](docs/04-system-architecture.md) | Kiến trúc, 3 Supabase client, quy tắc code |
| [`docs/05-testing-strategy.md`](docs/05-testing-strategy.md) | Chiến lược test, ma trận RLS/IDOR, 6 kịch bản E2E |
| [`docs/06-deployment-vercel-supabase.md`](docs/06-deployment-vercel-supabase.md) | Deploy, backup/restore, rollback |
| [`docs/07-product-backlog.md`](docs/07-product-backlog.md) | Backlog phase 2 + những gì **cố tình không làm** |
| [`docs/08-phase-plan.md`](docs/08-phase-plan.md) | **Task ledger** — toàn bộ công việc P0 → P7 |
| [`WORKLOG.md`](WORKLOG.md) | **Trạng thái hiện tại** + next action + blocker + nhật ký |

---

## Trạng thái

**Phase 0 xong** (khảo sát + docs nền). Phase 1 (scaffold) chưa bắt đầu.

**Chưa deploy** — thiếu credential Supabase cloud và Vercel. Xem `BLOCKERS` trong [`WORKLOG.md`](WORKLOG.md).
