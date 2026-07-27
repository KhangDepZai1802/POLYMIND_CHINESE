import { describe, expect, it } from "vitest";

import {
  flashcardFrontInitialScale,
  isSentenceLikeFlashcardFront,
} from "@/features/flashcards/domain/front-typography";

describe("flashcard front typography", () => {
  it("giữ từ/cụm ở scale 1 dù nghĩa hoặc pinyin dài", () => {
    expect(isSentenceLikeFlashcardFront("您")).toBe(false);
    expect(isSentenceLikeFlashcardFront("越南外贸银行")).toBe(false);
    expect(isSentenceLikeFlashcardFront("与护照上的签名一致")).toBe(false);

    expect(
      flashcardFrontInitialScale({
        hanzi: "营业执照",
        pinyin: "yíng yè zhí zhào",
        meaningVi:
          "Giấy phép kinh doanh, giấy chứng nhận đăng ký doanh nghiệp",
      }),
    ).toBe(1);
  });

  it("nhận diện đủ 5 câu trong dữ liệu thật 35 buổi", () => {
    for (const hanzi of [
      "您好！欢迎光临越南外贸银行！",
      "请问您办理个人业务还是公司业务？",
      "也就是说……对吗？",
      "提前支取要按活期利率计息",
      "谢谢您！欢迎下次再来！",
    ]) {
      expect(isSentenceLikeFlashcardFront(hanzi), hanzi).toBe(true);
    }
  });

  it("câu càng nặng thì scale khởi đầu càng nhỏ nhưng không dưới sàn", () => {
    const shortSentence = flashcardFrontInitialScale({
      hanzi: "也就是说……对吗？",
      pinyin: "yě jiù shì shuō duì ma",
      meaningVi: "Tức là... đúng không ạ?",
    });
    const screenshotSentence = flashcardFrontInitialScale({
      hanzi: "您好！欢迎光临越南外贸银行！",
      pinyin: "nín hǎo huān yíng guāng lín Yuè nán Wài mào Yín háng",
      meaningVi: "Xin chào! Chào mừng quý khách đến với Vietcombank!",
    });
    const longestSentence = flashcardFrontInitialScale({
      hanzi: "请问您办理个人业务还是公司业务？",
      pinyin:
        "qǐng wèn nín bàn lǐ gè rén yè wù hái shì gōng sī yè wù",
      meaningVi:
        "Xin hỏi quý khách giao dịch cá nhân hay giao dịch doanh nghiệp?",
    });

    expect(shortSentence).toBeGreaterThan(screenshotSentence);
    expect(screenshotSentence).toBeGreaterThan(longestSentence);
    expect(longestSentence).toBe(0.62);
  });
});
