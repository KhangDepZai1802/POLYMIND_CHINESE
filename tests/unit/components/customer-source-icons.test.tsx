import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CustomerSourceIcon, FacebookIcon, ZaloIcon, TikTokIcon } from "@/features/b2c/components/customer-source-icons";
import { B2C_CUSTOMER_SOURCES, B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";

describe("CustomerSourceIcons", () => {
  it("includes tiktok in B2C_CUSTOMER_SOURCES and labels", () => {
    expect(B2C_CUSTOMER_SOURCES).toContain("tiktok");
    expect(B2C_CUSTOMER_SOURCE_LABELS.tiktok).toBe("TikTok");
  });

  it("renders FacebookIcon, ZaloIcon, and TikTokIcon without errors", () => {
    const { container: fb } = render(<FacebookIcon />);
    expect(fb.querySelector("svg")).not.toBeNull();

    const { container: zalo } = render(<ZaloIcon />);
    expect(zalo.querySelector("svg")).not.toBeNull();

    const { container: tiktok } = render(<TikTokIcon />);
    expect(tiktok.querySelector("svg")).not.toBeNull();
  });

  it.each([
    ["facebook"],
    ["zalo"],
    ["tiktok"],
    ["referral"],
    ["walk_in"],
    ["school"],
    ["other"],
    ["unknown"],
    [null],
  ])("renders CustomerSourceIcon for source: %s", (source) => {
    const { container } = render(<CustomerSourceIcon source={source} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
