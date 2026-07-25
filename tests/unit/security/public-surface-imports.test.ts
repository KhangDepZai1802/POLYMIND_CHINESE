import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * BỀ MẶT CÔNG KHAI KHÔNG ĐƯỢC PHÌNH RA — bài kiểm TĨNH (`D-36`).
 *
 * `/t/<mã>` là trang DUY NHẤT của sản phẩm mà người chưa đăng nhập vào được.
 * Nó phải giữ đúng ba tính chất, và cả ba đều là tính chất về **cấu trúc code**
 * nên khoá bằng bài kiểm tĩnh chứ không phải E2E:
 *
 *   1. Không đọc phiên đăng nhập (`requireUser`, `createClient` của `server.ts`);
 *   2. Không bao giờ chạm service role — đó là đường bypass RLS;
 *   3. Không kéo theo tính năng cá nhân (★, bảng `flashcard_starred_pages`).
 *
 * Vì sao TĨNH: một hồi quy kiểu này không làm trang gãy. Nó vẫn chạy, chỉ là
 * lặng lẽ đọc phiên hoặc lặng lẽ bypass RLS — E2E sẽ vẫn xanh. Bài kiểm tĩnh
 * chạy 5ms và đỏ ngay dòng import đầu tiên.
 *
 * Cùng khuôn với `tests/unit/rsc-aschild-trigger.test.ts` và
 * `tests/unit/flashcard-face-single-source.test.ts`.
 */

const ROOT = process.cwd();

/** Mọi file thuộc bề mặt công khai. */
const PUBLIC_SURFACE_DIRS = [join(ROOT, "src", "app", "(public)")];
const PUBLIC_SURFACE_FILES = [
  join(ROOT, "src", "features", "flashcards", "server", "public-queries.ts"),
  join(
    ROOT,
    "src",
    "features",
    "flashcards",
    "components",
    "public-flashcard-reader.tsx",
  ),
];

const FORBIDDEN: ReadonlyArray<{ needle: string; why: string }> = [
  {
    needle: "@/lib/auth/session",
    why: "trang công khai không có phiên để đọc — dùng nó là mở đường cho một requireUser() lọt vào",
  },
  {
    needle: "@/lib/supabase/admin",
    why: "service role bypass toàn bộ RLS (AGENTS.md §49)",
  },
  {
    needle: "@/lib/supabase/server",
    why: "client đọc cookie sẽ khiến người ĐANG đăng nhập quét mã QR bị mất ảnh/audio một cách im lặng — phải dùng createPublicClient()",
  },
  {
    needle: "setFlashcardStarAction",
    why: "★ là tính năng cá nhân, user đã chốt bỏ hẳn khỏi trang công khai",
  },
  {
    needle: "flashcard_starred_pages",
    why: "trang công khai là read-only tuyệt đối, không đụng bảng cá nhân nào",
  },
];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const surfaceFiles = [
  ...PUBLIC_SURFACE_DIRS.flatMap(collectFiles),
  ...PUBLIC_SURFACE_FILES,
];

describe("bề mặt công khai /t/<mã>", () => {
  it("quét được đủ file — bài kiểm này vô dụng nếu danh sách rỗng", () => {
    expect(surfaceFiles.length).toBeGreaterThanOrEqual(4);
  });

  it.each(surfaceFiles.map((file) => [relative(ROOT, file), file]))(
    "%s không import thứ bị cấm",
    (_label, file) => {
      const text = readFileSync(file, "utf8");
      for (const { needle, why } of FORBIDDEN) {
        expect(
          text.includes(needle),
          `${relative(ROOT, file)} chứa "${needle}" — ${why}`,
        ).toBe(false);
      }
    },
  );

  it("createPublicClient chỉ được dùng bởi đường đọc công khai", () => {
    const users = collectFiles(join(ROOT, "src")).filter((file) =>
      readFileSync(file, "utf8").includes("createPublicClient"),
    );
    expect(users.map((file) => relative(ROOT, file).replace(/\\/g, "/")).sort())
      .toEqual([
        "src/features/flashcards/server/public-queries.ts",
        "src/lib/supabase/public-client.ts",
      ]);
  });

  it("route công khai nằm NGOÀI (dashboard) — nếu không thì requireUser() của layout sẽ chặn", () => {
    const routes = collectFiles(join(ROOT, "src", "app", "(public)")).map(
      (file) => relative(ROOT, file).replace(/\\/g, "/"),
    );
    expect(routes).toContain("src/app/(public)/t/[token]/page.tsx");
    for (const route of routes) {
      expect(route.includes("(dashboard)")).toBe(false);
    }
  });

  it("layout công khai khai viewport-fit=cover — thiếu nó thì safe-area-inset luôn bằng 0 trên iOS", () => {
    const layout = readFileSync(
      join(ROOT, "src", "app", "(public)", "layout.tsx"),
      "utf8",
    );
    expect(layout).toContain('viewportFit: "cover"');
  });
});
