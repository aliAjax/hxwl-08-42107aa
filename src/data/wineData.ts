export interface WineCard {
  id: string;
  region: string;
  grape: string;
  acidity: string;
  tannin: string;
  body: string;
  aromas: string[];
  color?: string;
  alcohol?: string;
  explanation: string;
}

export const wineCards: WineCard[] = [
  {
    id: "bordeaux-left-bank",
    region: "波尔多左岸",
    grape: "赤霞珠",
    acidity: "中高",
    tannin: "高",
    body: "饱满",
    aromas: ["黑醋栗", "雪松", "铅笔芯", "黑樱桃", "甘草"],
    color: "深宝石红",
    alcohol: "13.5%-14.5%",
    explanation: "波尔多左岸以赤霞珠为主的混酿，单宁紧实、酸度明亮，带有典型的黑醋栗和雪松气息，陈年后发展出铅笔芯和皮革风味。"
  },
  {
    id: "bourgogne-village",
    region: "勃艮第村级",
    grape: "黑皮诺",
    acidity: "高",
    tannin: "低",
    body: "中等",
    aromas: ["红樱桃", "蘑菇", "湿叶", "覆盆子", "皮革"],
    color: "浅宝石红",
    alcohol: "13%-14%",
    explanation: "勃艮第黑皮诺以优雅著称，酸度清新、单宁细腻，红色水果为主，带有明显的森林地表和蘑菇气息。"
  },
  {
    id: "rioja-reserva",
    region: "里奥哈",
    grape: "丹魄",
    acidity: "中等",
    tannin: "中高",
    body: "中等偏饱满",
    aromas: ["香草", "椰子", "熟李子", "烟草", "皮革"],
    color: "石榴红",
    alcohol: "13.5%-14.5%",
    explanation: "里奥哈珍藏级丹魄经美国橡木桶陈酿，香草和椰子气息明显，果味成熟，单宁柔顺，带有烟草和皮革的陈年风味。"
  },
  {
    id: "napa-cabernet",
    region: "纳帕谷",
    grape: "赤霞珠",
    acidity: "中等",
    tannin: "高",
    body: "饱满",
    aromas: ["黑醋栗", "黑樱桃", "薄荷", "香草", "烟熏"],
    color: "深紫",
    alcohol: "14.5%-15.5%",
    explanation: "纳帕谷赤霞珠果味浓郁成熟，酒体饱满，酒精度偏高，常带有薄荷和桉树叶的特征，新橡木桶带来香草和烟熏气息。"
  },
  {
    id: "chianti-classico",
    region: "基安蒂经典",
    grape: "桑娇维塞",
    acidity: "高",
    tannin: "中高",
    body: "中等",
    aromas: ["酸樱桃", "番茄叶", "皮革", "紫罗兰", "甘草"],
    color: "宝石红",
    alcohol: "12.5%-13.5%",
    explanation: "托斯卡纳桑娇维塞高酸度、高单宁是标志性特征，红色酸樱桃和番茄叶的气息独特，带有皮革和甘草的陈年风味。"
  },
  {
    id: "barolo",
    region: "巴罗洛",
    grape: "内比奥罗",
    acidity: "高",
    tannin: "极高",
    body: "饱满",
    aromas: ["玫瑰", "樱桃", "焦油", "松露", "甘草"],
    color: "砖红",
    alcohol: "13.5%-15%",
    explanation: "皮埃蒙特巴罗洛被誉为'酒中之王'，内比奥罗单宁极为强劲，酸度高，带有典型的玫瑰花香和焦油气息，陈年潜力巨大。"
  },
  {
    id: "malbec-mendoza",
    region: "门多萨",
    grape: "马尔贝克",
    acidity: "中等",
    tannin: "中高",
    body: "饱满",
    aromas: ["黑李子", "黑莓", "紫罗兰", "巧克力", "烟熏"],
    color: "深紫黑",
    alcohol: "14%-15%",
    explanation: "阿根廷门多萨马尔贝克颜色深邃，果味浓郁，单宁柔和，带有黑李子和黑莓的成熟果香，以及巧克力和紫罗兰花香。"
  },
  {
    id: "shiraz-barossa",
    region: "巴罗萨谷",
    grape: "西拉",
    acidity: "中低",
    tannin: "中高",
    body: "饱满",
    aromas: ["黑莓", "黑胡椒", "巧克力", "烟熏", "皮革"],
    color: "深紫黑",
    alcohol: "14.5%-15.5%",
    explanation: "澳洲巴罗萨谷西拉酒体饱满，果味成熟浓郁，标志性的黑胡椒辛香料气息，搭配巧克力和烟熏风味，酒精度偏高。"
  },
  {
    id: "sancerre",
    region: "桑塞尔",
    grape: "长相思",
    acidity: "极高",
    tannin: "无",
    body: "轻盈",
    aromas: ["醋栗", "青草", "猫尿", "西柚", "矿物"],
    color: "浅柠檬黄",
    alcohol: "12.5%-13.5%",
    explanation: "卢瓦尔河谷桑塞尔长相思以高酸度和浓郁的青草、猫尿气息著称，带有明显的矿物感和柑橘类水果风味。"
  },
  {
    id: "chablis",
    region: "夏布利",
    grape: "霞多丽",
    acidity: "高",
    tannin: "无",
    body: "轻盈到中等",
    aromas: ["青苹果", "柠檬", "矿物", "白桃", "燧石"],
    color: "浅金黄",
    alcohol: "12.5%-13.5%",
    explanation: "勃艮第夏布利霞多丽未经橡木桶或仅轻微橡木影响，高酸度、矿物感突出，带有青苹果和燧石的冷凉气候特征。"
  }
];
