import { describe, it, expect } from "vitest";
import { checkRegionAnswer, checkGrapeAnswer } from "./answerChecker";

describe("checkRegionAnswer - 产区答题判定", () => {
  describe("标准答案匹配", () => {
    it("中文标准答案完全匹配", () => {
      const result = checkRegionAnswer("波尔多左岸", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
      expect(result.canonicalName).toBe("波尔多左岸");
    });

    it("英文标准答案完全匹配", () => {
      const result = checkRegionAnswer("Napa Valley", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
      expect(result.canonicalName).toBe("纳帕谷");
    });

    it("标准答案匹配 - 勃艮第村级", () => {
      const result = checkRegionAnswer("勃艮第村级", "勃艮第村级");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
    });
  });

  describe("别名匹配", () => {
    it("中文别名匹配 - 左岸 -> 波尔多左岸", () => {
      const result = checkRegionAnswer("左岸", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
      expect(result.matchedText).toBe("左岸");
      expect(result.canonicalName).toBe("波尔多左岸");
    });

    it("英文别名匹配 - Left Bank -> 波尔多左岸", () => {
      const result = checkRegionAnswer("Left Bank", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 里奥哈的英文别名 Rioja", () => {
      const result = checkRegionAnswer("Rioja", "里奥哈");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
      expect(result.canonicalName).toBe("里奥哈");
    });

    it("别名匹配 - 右岸 -> 波尔多右岸", () => {
      const result = checkRegionAnswer("右岸", "波尔多右岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Chianti Classico -> 基安蒂经典", () => {
      const result = checkRegionAnswer("Chianti Classico", "基安蒂经典");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Barolo -> 巴罗洛", () => {
      const result = checkRegionAnswer("Barolo", "巴罗洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });
  });

  describe("父产区/子产区匹配", () => {
    it("父产区匹配 - 法国（专属父产区名）-> 波尔多左岸", () => {
      const result = checkRegionAnswer("法国", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
      expect(result.matchedText).toBe("法国");
      expect(result.canonicalName).toBe("波尔多左岸");
    });

    it("父产区匹配 - 波尔多 -> 波尔多右岸（波尔多同时是别名，sourceType为alias）", () => {
      const result = checkRegionAnswer("波尔多", "波尔多右岸");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 西班牙（专属父产区名）-> 里奥哈", () => {
      const result = checkRegionAnswer("西班牙", "里奥哈");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("子产区匹配 - 玛歌 -> 波尔多左岸（玛歌同时是别名，匹配正确即可）", () => {
      const result = checkRegionAnswer("玛歌", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.matchedText).toBe("玛歌");
    });

    it("子产区匹配 - 波亚克 -> 波尔多左岸（匹配正确即可）", () => {
      const result = checkRegionAnswer("波亚克", "波尔多左岸");
      expect(result.correct).toBe(true);
    });

    it("子产区匹配 - 圣埃米利永 -> 波尔多右岸（匹配正确即可）", () => {
      const result = checkRegionAnswer("圣埃米利永", "波尔多右岸");
      expect(result.correct).toBe(true);
    });

    it("子产区匹配 - 金丘 -> 勃艮第村级（匹配正确即可）", () => {
      const result = checkRegionAnswer("金丘", "勃艮第村级");
      expect(result.correct).toBe(true);
    });

    it("子产区专属名匹配 - 夏隆内丘（仅在subRegions）-> 勃艮第村级", () => {
      const result = checkRegionAnswer("夏隆内丘", "勃艮第村级");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("subRegion");
    });

    it("子产区专属名匹配 - 马贡（仅在subRegions）-> 勃艮第村级", () => {
      const result = checkRegionAnswer("马贡", "勃艮第村级");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("subRegion");
    });

    it("子产区匹配 - 上里奥哈 -> 里奥哈（匹配正确即可）", () => {
      const result = checkRegionAnswer("上里奥哈", "里奥哈");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 加州（专属父产区名）-> 纳帕谷", () => {
      const result = checkRegionAnswer("加州", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("父产区匹配 - 美国（专属父产区名）-> 纳帕谷", () => {
      const result = checkRegionAnswer("美国", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("父产区匹配 - 新世界（专属父产区名）-> 纳帕谷", () => {
      const result = checkRegionAnswer("新世界", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("子产区匹配 - 奥克维尔 -> 纳帕谷（匹配正确即可）", () => {
      const result = checkRegionAnswer("奥克维尔", "纳帕谷");
      expect(result.correct).toBe(true);
    });

    it("子产区匹配 - 鹿跃 -> 纳帕谷（匹配正确即可）", () => {
      const result = checkRegionAnswer("鹿跃", "纳帕谷");
      expect(result.correct).toBe(true);
    });

    it("子产区匹配 - 蒙塔尔奇诺 -> 基安蒂经典（匹配正确即可）", () => {
      const result = checkRegionAnswer("蒙塔尔奇诺", "基安蒂经典");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 托斯卡纳 -> 基安蒂经典（托斯卡纳同时是别名）", () => {
      const result = checkRegionAnswer("托斯卡纳", "基安蒂经典");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 意大利（专属父产区名）-> 基安蒂经典", () => {
      const result = checkRegionAnswer("意大利", "基安蒂经典");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("子产区匹配 - 巴巴莱斯科 -> 巴罗洛（匹配正确即可）", () => {
      const result = checkRegionAnswer("巴巴莱斯科", "巴罗洛");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 皮埃蒙特 -> 巴罗洛（皮埃蒙特同时是别名）", () => {
      const result = checkRegionAnswer("皮埃蒙特", "巴罗洛");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 意大利（专属父产区名）-> 巴罗洛", () => {
      const result = checkRegionAnswer("意大利", "巴罗洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("父产区匹配 - 卢瓦尔河谷 -> 桑塞尔（卢瓦尔河谷同时是别名）", () => {
      const result = checkRegionAnswer("卢瓦尔河谷", "桑塞尔");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 法国（专属父产区名）-> 桑塞尔", () => {
      const result = checkRegionAnswer("法国", "桑塞尔");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("子产区匹配 - 普伊-富美 -> 桑塞尔（匹配正确即可）", () => {
      const result = checkRegionAnswer("普伊-富美", "桑塞尔");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 罗讷河谷 -> 北罗讷河谷（罗讷河谷同时是别名）", () => {
      const result = checkRegionAnswer("罗讷河谷", "北罗讷河谷");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 法国（专属父产区名）-> 北罗讷河谷", () => {
      const result = checkRegionAnswer("法国", "北罗讷河谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("子产区匹配 - 罗第丘 -> 北罗讷河谷（匹配正确即可）", () => {
      const result = checkRegionAnswer("罗第丘", "北罗讷河谷");
      expect(result.correct).toBe(true);
    });

    it("子产区匹配 - 教皇新堡 -> 南罗讷河谷（匹配正确即可）", () => {
      const result = checkRegionAnswer("教皇新堡", "南罗讷河谷");
      expect(result.correct).toBe(true);
    });

    it("父产区匹配 - 阿根廷（专属父产区名）-> 门多萨", () => {
      const result = checkRegionAnswer("阿根廷", "门多萨");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });

    it("父产区匹配 - 澳大利亚（专属父产区名）-> 巴罗萨谷", () => {
      const result = checkRegionAnswer("澳大利亚", "巴罗萨谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("parentRegion");
    });
  });

  describe("大小写和空格归一化", () => {
    it("全部大写 - LEFT BANK -> 波尔多左岸", () => {
      const result = checkRegionAnswer("LEFT BANK", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("全部小写 - left bank -> 波尔多左岸", () => {
      const result = checkRegionAnswer("left bank", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("前后空格 - '  左岸  ' -> 波尔多左岸", () => {
      const result = checkRegionAnswer("  左岸  ", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("中间多个空格 - 'Left   Bank' -> 波尔多左岸", () => {
      const result = checkRegionAnswer("Left   Bank", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("制表符和换行 - '\\t左岸\\n' -> 波尔多左岸", () => {
      const result = checkRegionAnswer("\t左岸\n", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("大小写混合 + 空格 - '  NaPa   VaLlEy  ' -> 纳帕谷", () => {
      const result = checkRegionAnswer("  NaPa   VaLlEy  ", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("连字符忽略 - 'Haut-Medoc' -> 波尔多左岸", () => {
      const result = checkRegionAnswer("Haut-Medoc", "波尔多左岸");
      expect(result.correct).toBe(true);
    });

    it("不同长度的破折号 - 'Pessac—Leognan'（长破折号）-> 波尔多左岸", () => {
      const result = checkRegionAnswer("Pessac—Leognan", "波尔多左岸");
      expect(result.correct).toBe(true);
    });

    it("圣朱利安大小写空格归一化", () => {
      const result = checkRegionAnswer("SAINT  JULIEN", "波尔多左岸");
      expect(result.correct).toBe(true);
    });

    it("中文全角空格归一化", () => {
      const result = checkRegionAnswer("左\u3000岸", "波尔多左岸");
      expect(result.correct).toBe(true);
    });
  });

  describe("空答案判定", () => {
    it("空字符串", () => {
      const result = checkRegionAnswer("", "波尔多左岸");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
      expect(result.sourceLabel).toBe("未作答");
    });

    it("仅空格", () => {
      const result = checkRegionAnswer("     ", "波尔多左岸");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
      expect(result.sourceLabel).toBe("未作答");
    });

    it("仅制表符和换行", () => {
      const result = checkRegionAnswer("\t\n   \r", "纳帕谷");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });
  });

  describe("部分匹配", () => {
    it("用户答案包含标准答案子集 - '波尔多左岸产区'", () => {
      const result = checkRegionAnswer("波尔多左岸产区", "波尔多左岸");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("标准答案包含用户答案 - '纳帕' 匹配 '纳帕谷'（已在别名中，这里用其他测试）", () => {
      const result = checkRegionAnswer("勃艮第村", "勃艮第村级");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("部分匹配 - '里奥哈产'", () => {
      const result = checkRegionAnswer("里奥哈产", "里奥哈");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("部分匹配 - '门多萨省'（标准答案是门多萨）", () => {
      const result = checkRegionAnswer("门多萨省", "门多萨");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("英文部分匹配 - 'Napa Vall' -> 纳帕谷", () => {
      const result = checkRegionAnswer("Napa Vall", "纳帕谷");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("部分匹配 - 用户答案是正确答案加后缀", () => {
      const result = checkRegionAnswer("巴罗洛村", "巴罗洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });
  });

  describe("错误答案", () => {
    it("完全不相关的产区", () => {
      const result = checkRegionAnswer("香槟区", "波尔多左岸");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });

    it("完全不相关的文字", () => {
      const result = checkRegionAnswer("这是一个测试", "里奥哈");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });

    it("完全不同产区的正确名 - 纳帕谷 vs 巴罗洛（无共享词）", () => {
      const result = checkRegionAnswer("纳帕谷", "巴罗洛");
      expect(result.correct).toBe(false);
    });

    it("完全不同产区的正确名 - 里奥哈 vs 桑塞尔（无共享词）", () => {
      const result = checkRegionAnswer("里奥哈", "桑塞尔");
      expect(result.correct).toBe(false);
    });
  });
});

describe("checkGrapeAnswer - 葡萄品种答题判定", () => {
  describe("标准答案匹配", () => {
    it("中文标准答案完全匹配 - 赤霞珠", () => {
      const result = checkGrapeAnswer("赤霞珠", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
      expect(result.canonicalName).toBe("赤霞珠");
    });

    it("中文标准答案完全匹配 - 黑皮诺", () => {
      const result = checkGrapeAnswer("黑皮诺", "黑皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
    });

    it("中文标准答案完全匹配 - 霞多丽", () => {
      const result = checkGrapeAnswer("霞多丽", "霞多丽");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
    });
  });

  describe("别名匹配", () => {
    it("英文别名匹配 - Cabernet Sauvignon -> 赤霞珠", () => {
      const result = checkGrapeAnswer("Cabernet Sauvignon", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
      expect(result.canonicalName).toBe("赤霞珠");
    });

    it("中文别名匹配 - 卡本内苏维翁 -> 赤霞珠", () => {
      const result = checkGrapeAnswer("卡本内苏维翁", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 解百纳 -> 赤霞珠", () => {
      const result = checkGrapeAnswer("解百纳", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Pinot Noir -> 黑皮诺", () => {
      const result = checkGrapeAnswer("Pinot Noir", "黑皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 黑比诺 -> 黑皮诺", () => {
      const result = checkGrapeAnswer("黑比诺", "黑皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Chardonnay -> 霞多丽", () => {
      const result = checkGrapeAnswer("Chardonnay", "霞多丽");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 莎当妮 -> 霞多丽", () => {
      const result = checkGrapeAnswer("莎当妮", "霞多丽");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Sauvignon Blanc -> 长相思", () => {
      const result = checkGrapeAnswer("Sauvignon Blanc", "长相思");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 白苏维翁 -> 长相思", () => {
      const result = checkGrapeAnswer("白苏维翁", "长相思");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Riesling -> 雷司令", () => {
      const result = checkGrapeAnswer("Riesling", "雷司令");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Tempranillo -> 丹魄", () => {
      const result = checkGrapeAnswer("Tempranillo", "丹魄");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Syrah -> 西拉", () => {
      const result = checkGrapeAnswer("Syrah", "西拉");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Shiraz -> 西拉（澳洲叫法）", () => {
      const result = checkGrapeAnswer("Shiraz", "西拉");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 设拉子 -> 西拉", () => {
      const result = checkGrapeAnswer("设拉子", "西拉");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Sangiovese -> 桑娇维塞", () => {
      const result = checkGrapeAnswer("Sangiovese", "桑娇维塞");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Nebbiolo -> 内比奥罗", () => {
      const result = checkGrapeAnswer("Nebbiolo", "内比奥罗");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Malbec -> 马尔贝克", () => {
      const result = checkGrapeAnswer("Malbec", "马尔贝克");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Cabernet Franc -> 品丽珠", () => {
      const result = checkGrapeAnswer("Cabernet Franc", "品丽珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Grenache -> 歌海娜", () => {
      const result = checkGrapeAnswer("Grenache", "歌海娜");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Mourvedre -> 慕合怀特", () => {
      const result = checkGrapeAnswer("Mourvedre", "慕合怀特");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Gamay -> 佳美", () => {
      const result = checkGrapeAnswer("Gamay", "佳美");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Carmenere -> 佳美娜", () => {
      const result = checkGrapeAnswer("Carmenere", "佳美娜");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Gewurztraminer -> 琼瑶浆", () => {
      const result = checkGrapeAnswer("Gewurztraminer", "琼瑶浆");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Pinot Gris -> 灰皮诺", () => {
      const result = checkGrapeAnswer("Pinot Gris", "灰皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Pinot Grigio -> 灰皮诺（意大利叫法）", () => {
      const result = checkGrapeAnswer("Pinot Grigio", "灰皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Chenin Blanc -> 白诗南", () => {
      const result = checkGrapeAnswer("Chenin Blanc", "白诗南");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Viognier -> 维欧尼", () => {
      const result = checkGrapeAnswer("Viognier", "维欧尼");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - Merlot -> 梅洛", () => {
      const result = checkGrapeAnswer("Merlot", "梅洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 美乐 -> 梅洛", () => {
      const result = checkGrapeAnswer("美乐", "梅洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("别名匹配 - 梅鹿辄 -> 梅洛", () => {
      const result = checkGrapeAnswer("梅鹿辄", "梅洛");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });
  });

  describe("大小写和空格归一化", () => {
    it("全部大写 - CABERNET SAUVIGNON -> 赤霞珠", () => {
      const result = checkGrapeAnswer("CABERNET SAUVIGNON", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("全部小写 - pinot noir -> 黑皮诺", () => {
      const result = checkGrapeAnswer("pinot noir", "黑皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("前后空格 - '  霞多丽  ' -> 霞多丽", () => {
      const result = checkGrapeAnswer("  霞多丽  ", "霞多丽");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("canonical");
    });

    it("中间多个空格 - 'Cabernet   Sauvignon' -> 赤霞珠", () => {
      const result = checkGrapeAnswer("Cabernet   Sauvignon", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("大小写混合 + 空格 - '  PINOT   grigio  ' -> 灰皮诺", () => {
      const result = checkGrapeAnswer("  PINOT   grigio  ", "灰皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("全角空格归一化", () => {
      const result = checkGrapeAnswer("解\u3000百\u3000纳", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });

    it("制表符换行包裹 - '\\tShiraz\\n' -> 西拉", () => {
      const result = checkGrapeAnswer("\tShiraz\n", "西拉");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("alias");
    });
  });

  describe("空答案判定", () => {
    it("空字符串", () => {
      const result = checkGrapeAnswer("", "赤霞珠");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
      expect(result.sourceLabel).toBe("未作答");
    });

    it("仅空格", () => {
      const result = checkGrapeAnswer("    ", "黑皮诺");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
      expect(result.sourceLabel).toBe("未作答");
    });

    it("仅制表符和换行", () => {
      const result = checkGrapeAnswer("\t\n\r   ", "霞多丽");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });
  });

  describe("部分匹配", () => {
    it("用户答案包含标准答案子集 - '赤霞珠红葡萄品种'", () => {
      const result = checkGrapeAnswer("赤霞珠红葡萄品种", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("标准答案包含用户答案 - '霞多' 匹配 '霞多丽'", () => {
      const result = checkGrapeAnswer("霞多", "霞多丽");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("部分匹配 - '黑皮' -> 黑皮诺", () => {
      const result = checkGrapeAnswer("黑皮", "黑皮诺");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("英文部分匹配 - 'Cabernet' -> 赤霞珠", () => {
      const result = checkGrapeAnswer("Cabernet", "赤霞珠");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("英文部分匹配 - 'Sauvignon' 被正确部分匹配", () => {
      const result = checkGrapeAnswer("Sauvignon", "长相思");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });

    it("部分匹配 - 用户答案加前缀后缀", () => {
      const result = checkGrapeAnswer("我喜欢雷司令葡萄", "雷司令");
      expect(result.correct).toBe(true);
      expect(result.sourceType).toBe("partial");
    });
  });

  describe("错误答案", () => {
    it("完全不相关的品种", () => {
      const result = checkGrapeAnswer("龙眼葡萄", "赤霞珠");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });

    it("完全不相关的文字", () => {
      const result = checkGrapeAnswer("随便写的答案", "黑皮诺");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });

    it("不同品种 - 梅洛 vs 赤霞珠", () => {
      const result = checkGrapeAnswer("梅洛", "赤霞珠");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });

    it("不同品种 - 雷司令 vs 长相思", () => {
      const result = checkGrapeAnswer("雷司令", "长相思");
      expect(result.correct).toBe(false);
      expect(result.sourceType).toBe("none");
    });
  });
});
