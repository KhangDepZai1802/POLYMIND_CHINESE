import { expect, test } from "@playwright/test";

test.describe("bộ nghe Bài 3 công khai", () => {
  test("khách chưa đăng nhập mở danh sách và trang có audio", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    const indexResponse = await page.goto("/nghe");
    expect(indexResponse?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Bài nghe Bài 3 – Thời gian" }),
    ).toBeVisible();
    await expect(page.locator("ol > li")).toHaveCount(22);

    const pageResponse = await page.goto("/nghe/trang-12");
    expect(pageResponse?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Trang 12", level: 1 }),
    ).toBeVisible();
    await expect(page.locator("audio")).toHaveCount(2);
    await expect(page.locator("figure img")).toHaveCount(2);
    await expect(
      page.getByRole("button", { name: "Tốc độ 1.25x" }),
    ).toHaveCount(2);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("trang bài tập không có audio vẫn có đường quay lại", async ({
    page,
  }) => {
    const response = await page.goto("/nghe/trang-3");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Trang này không có audio" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Về trang bài nghe" }),
    ).toHaveAttribute("href", "/nghe");
  });

  test("file audio trả đúng kiểu media, không bị chuyển sang đăng nhập", async ({
    request,
  }) => {
    const response = await request.get("/audio/bai-3/trang-12-phan-1.m4a");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("audio");
    expect((await response.body()).byteLength).toBeGreaterThan(100_000);
  });
});
