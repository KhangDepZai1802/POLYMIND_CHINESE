---
name: rsc-icon-serialization-prod-only
description: Passing Lucide icon components from a Server to Client Component 500s only in prod, not next build/dev
metadata:
  type: feedback
---

Trong repo Polymind Chinese, một Server Component **không được** truyền dữ liệu có chứa **component** (ví dụ `icon: LucideIcon` trong `NavItem` từ `lib/permissions/navigation.ts`) sang một Client Component qua prop — RSC ném `Error: Functions cannot be passed directly to Client Components ... {$$typeof, render, displayName}`.

**Why:** Component (kể cả forwardRef như icon Lucide) không serialize được qua ranh giới server→client. Lỗi này **CHỈ lộ ở production runtime**, `npm run build` và `next dev` KHÔNG bắt được (route dashboard là động, render theo request). Từng làm **sập toàn bộ trang dashboard trên prod** sau khi deploy (digest 1621801304), phát hiện qua `npx vercel logs <deployment-url>`.

**How to apply:** Component nào nhận `items` chứa icon (như `NavLinks`) phải nằm trong một **client island**: hoặc component cha cũng `"use client"` và gọi `getNavigation()` phía client (xem `mobile-nav.tsx` — mẫu đúng), hoặc `sidebar-nav.tsx` phải có `"use client"`. Đừng để một Server Component gọi `getNavigation()` rồi truyền thẳng `items` xuống client. Khi debug prod 500 mà build xanh, kéo log bằng `npx vercel logs` (đã đăng nhập sẵn) thay vì đoán.
