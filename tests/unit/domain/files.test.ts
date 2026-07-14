import { describe, expect, it } from "vitest";

import {
  fileExtension,
  formatFileSize,
  sanitizeDownloadName,
} from "@/lib/domain/files";

describe("fileExtension", () => {
  it("lấy đuôi sau dấu chấm CUỐI CÙNG, không phân biệt hoa thường", () => {
    expect(fileExtension("giao-trinh.pdf")).toBe("pdf");
    expect(fileExtension("bao-cao.final.DOCX")).toBe("docx");
  });

  it("từ chối đuôi ngoài allowlist — allowlist, không phải blocklist", () => {
    // Đây là lớp chặn upload abuse: server sinh path từ đuôi này.
    expect(fileExtension("shell.php5")).toBeNull();
    expect(fileExtension("payload.exe")).toBeNull();
    // svg/html chạy được script khi mở inline → cố tình không nhận.
    expect(fileExtension("logo.svg")).toBeNull();
    expect(fileExtension("trang.html")).toBeNull();
  });

  it("từ chối tên không có đuôi hợp lệ", () => {
    expect(fileExtension("khong-co-duoi")).toBeNull();
    expect(fileExtension("ket-thuc-bang-cham.")).toBeNull();
    expect(fileExtension(".pdf")).toBeNull(); // toàn bộ tên là đuôi → không hợp lệ
  });
});

describe("sanitizeDownloadName", () => {
  /**
   * Vì sao phải ASCII hóa: Supabase Storage percent-encode HAI LẦN phần non-ASCII
   * của `Content-Disposition`. Để nguyên tiếng Việt có dấu thì người dùng tải về
   * được file tên `Gi%C3%A1o tr%C3%ACnh.pdf`. Đã dính thật khi smoke test P3-T3.
   */
  it("bỏ dấu tiếng Việt, giữ khoảng trắng (khoảng trắng không bị lỗi mã hóa)", () => {
    expect(sanitizeDownloadName("Giáo trình HSK 1", "pdf")).toBe(
      "Giao trinh HSK 1.pdf",
    );
    expect(sanitizeDownloadName("Đề luyện tập", "docx")).toBe(
      "De luyen tap.docx",
    );
  });

  it("bỏ chữ Hán (non-ASCII) — không để lọt mojibake vào tên file", () => {
    // Dấu `:` cũng bị bỏ vì là ký tự đường dẫn (ổ đĩa trên Windows) → "Bai 1".
    expect(sanitizeDownloadName("Bài 1: 你好", "mp3")).toBe("Bai 1.mp3");
  });

  it("tiêu đề toàn chữ Hán → vẫn ra tên dùng được, không ra tên rỗng", () => {
    expect(sanitizeDownloadName("你好世界", "pdf")).toBe("tai-lieu.pdf");
  });

  it("bỏ ký tự đường dẫn — tên file không được trèo ra thư mục khác", () => {
    expect(sanitizeDownloadName("../../etc/passwd", "txt")).toBe(
      ".. .. etc passwd.txt",
    );
    expect(sanitizeDownloadName('a/b\\c:d*e?f"g<h>i|j', "pdf")).toBe(
      "a b c d e f g h i j.pdf",
    );
  });

  it("cắt tiêu đề quá dài", () => {
    const name = sanitizeDownloadName("A".repeat(300), "pdf");
    expect(name).toBe(`${"A".repeat(100)}.pdf`);
  });
});

describe("formatFileSize", () => {
  it("hiển thị theo đơn vị dễ đọc, dùng dấu phẩy thập phân kiểu VN", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5,0 MB");
  });

  it("không có kích thước → gạch ngang, không phải '0 B'", () => {
    // "chưa biết" khác "bằng 0".
    expect(formatFileSize(null)).toBe("—");
  });
});
