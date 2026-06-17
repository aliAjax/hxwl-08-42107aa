export interface WineCard {
  id: string;
  region: string;
  country: string;
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
    country: "法国",
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
    country: "法国",
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
    country: "西班牙",
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
    country: "美国",
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
    country: "意大利",
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
    country: "意大利",
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
    country: "阿根廷",
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
    country: "澳大利亚",
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
    country: "法国",
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
    country: "法国",
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

export interface RegionScopeOption {
  value: string;
  label: string;
  countries: string[];
}

export const regionScopes: RegionScopeOption[] = [
  { value: "all", label: "全部产区", countries: [] },
  { value: "france", label: "法国", countries: ["法国"] },
  { value: "italy", label: "意大利", countries: ["意大利"] },
  { value: "spain", label: "西班牙", countries: ["西班牙"] },
  { value: "new-world", label: "新世界", countries: ["美国", "阿根廷", "澳大利亚"] },
];

export interface WineComparison {
  id: string;
  wines: [string, string];
  wineIds: [string, string];
  similarities: string[];
  distinguishingClues: {
    wine: string;
    clues: string[];
  }[];
  misjudgmentReasons: string[];
  difficulty: "high" | "medium" | "low";
}

export const wineComparisons: WineComparison[] = [
  {
    id: "bordeaux-vs-burgundy",
    wines: ["波尔多左岸混酿", "勃艮第黑皮诺"],
    wineIds: ["bordeaux-left-bank", "bourgogne-village"],
    similarities: [
      "均为法国经典产区红葡萄酒",
      "都具有较强的陈年潜力",
      "酸度都处于中高到高水平",
      "陈年后均可发展出皮革和森林地表气息"
    ],
    distinguishingClues: [
      {
        wine: "波尔多左岸混酿",
        clues: [
          "颜色深邃，呈深宝石红甚至深紫红",
          "单宁含量高，口感紧实",
          "黑色水果为主：黑醋栗、黑樱桃",
          "典型的雪松、铅笔芯气息",
          "酒体饱满，酒精度通常13.5%-14.5%"
        ]
      },
      {
        wine: "勃艮第黑皮诺",
        clues: [
          "颜色较浅，呈浅宝石红甚至砖红色",
          "单宁含量低，口感细腻丝滑",
          "红色水果为主：红樱桃、覆盆子",
          "典型的蘑菇、湿叶等森林地表气息",
          "酒体中等，酒精度通常13%-14%"
        ]
      }
    ],
    misjudgmentReasons: [
      "陈年较久的波尔多颜色会变浅，接近黑皮诺",
      "优质黑皮诺也可能有较高的单宁质感",
      "两者都可能出现紫罗兰、甘草等花香和香料气息",
      "新手容易被'法国红酒'这一共性迷惑"
    ],
    difficulty: "high"
  },
  {
    id: "rioja-vs-bordeaux",
    wines: ["里奥哈珍藏", "波尔多左岸混酿"],
    wineIds: ["rioja-reserva", "bordeaux-left-bank"],
    similarities: [
      "都经过橡木桶陈酿，橡木气息明显",
      "单宁含量中高到高",
      "酒体中等偏饱满到饱满",
      "陈年后均可发展出烟草、皮革气息",
      "酒精度范围接近（13.5%-14.5%）"
    ],
    distinguishingClues: [
      {
        wine: "里奥哈珍藏",
        clues: [
          "美国橡木桶带来的香草、椰子气息更突出",
          "果味偏成熟的红李子、熟李子",
          "单宁更加柔顺圆润",
          "典型的烟草、雪茄盒气息",
          "酸度中等，比波尔多偏低"
        ]
      },
      {
        wine: "波尔多左岸混酿",
        clues: [
          "法国橡木桶带来的雪松、烟熏气息",
          "黑色水果为主：黑醋栗、黑樱桃",
          "单宁更加紧实有力",
          "典型的铅笔芯、石墨气息",
          "酸度中高，结构感更强"
        ]
      }
    ],
    misjudgmentReasons: [
      "两者都有明显的橡木桶影响",
      "陈年里奥哈的颜色可能与波尔多相似",
      "都可能出现皮革、甘草等陈年风味",
      "丹魄与赤霞珠都能酿出饱满酒体的酒"
    ],
    difficulty: "medium"
  },
  {
    id: "napa-vs-bordeaux",
    wines: ["纳帕谷赤霞珠", "波尔多左岸混酿"],
    wineIds: ["napa-cabernet", "bordeaux-left-bank"],
    similarities: [
      "主要葡萄品种均为赤霞珠",
      "都有黑醋栗、黑樱桃的黑色水果香气",
      "单宁含量高，酒体饱满",
      "都经过橡木桶陈酿",
      "都具有优秀的陈年潜力"
    ],
    distinguishingClues: [
      {
        wine: "纳帕谷赤霞珠",
        clues: [
          "果味更加成熟浓郁，甚至有果酱感",
          "酒精度更高，通常14.5%-15.5%",
          "常带有薄荷、桉树叶的草本气息",
          "新橡木桶带来的香草、烟熏更明显",
          "单宁更加成熟柔和"
        ]
      },
      {
        wine: "波尔多左岸混酿",
        clues: [
          "果味更加清新克制，带有黑醋栗的酸甜感",
          "酒精度中等偏高，通常13.5%-14.5%",
          "典型的雪松、铅笔芯气息",
          "酸度更加突出，结构感更强",
          "常带有品丽珠带来的草本和紫罗兰花香"
        ]
      }
    ],
    misjudgmentReasons: [
      "主要品种都是赤霞珠，香气轮廓相似",
      "都有黑醋栗+橡木的经典组合",
      "高端纳帕酒也会追求波尔多风格的优雅",
      "温暖年份的波尔多果味也会更加成熟"
    ],
    difficulty: "medium"
  },
  {
    id: "barolo-vs-burgundy",
    wines: ["巴罗洛", "勃艮第黑皮诺"],
    wineIds: ["barolo", "bourgogne-village"],
    similarities: [
      "均为意大利和法国的顶级红葡萄酒",
      "都有玫瑰、樱桃的花香和红色果香",
      "酸度都很高",
      "陈年后均可发展出松露、皮革气息",
      "都具有极强的陈年潜力"
    ],
    distinguishingClues: [
      {
        wine: "巴罗洛",
        clues: [
          "单宁含量极高，被称为'单宁之王'",
          "典型的焦油、柏油气息",
          "酒体饱满，结构感极强",
          "酸度极高但与单宁平衡",
          "陈年潜力可达数十年，颜色呈砖红色"
        ]
      },
      {
        wine: "勃艮第黑皮诺",
        clues: [
          "单宁含量低，口感细腻",
          "典型的蘑菇、湿叶等森林地表气息",
          "酒体中等，优雅细腻",
          "红色水果更加清新活泼",
          "顶级酒款有陈年潜力，但村级酒适合较早饮用"
        ]
      }
    ],
    misjudgmentReasons: [
      "都有玫瑰花香和樱桃果味",
      "陈年巴罗洛颜色变浅，可能接近黑皮诺",
      "顶级黑皮诺也会有较好的结构感",
      "两者都被视为红酒中的'优雅派'代表"
    ],
    difficulty: "high"
  },
  {
    id: "chianti-vs-rioja",
    wines: ["基安蒂经典", "里奥哈珍藏"],
    wineIds: ["chianti-classico", "rioja-reserva"],
    similarities: [
      "均为旧世界传统产区红葡萄酒",
      "都有樱桃等红色水果香气",
      "都经过橡木桶陈酿",
      "陈年后均可发展出皮革、烟草气息",
      "酒体中等，适合搭配食物"
    ],
    distinguishingClues: [
      {
        wine: "基安蒂经典",
        clues: [
          "典型的酸樱桃果香，酸度极高",
          "独特的番茄叶、灌木丛草本气息",
          "单宁中高，口感偏干瘦",
          "酒精度偏低，通常12.5%-13.5%",
          "常带有紫罗兰花香"
        ]
      },
      {
        wine: "里奥哈珍藏",
        clues: [
          "熟李子的成熟果味，酸度中等",
          "美国橡木桶带来的香草、椰子甜香料",
          "单宁柔顺圆润，口感甜美",
          "酒精度中等偏高，通常13.5%-14.5%",
          "典型的烟草、雪茄盒气息"
        ]
      }
    ],
    misjudgmentReasons: [
      "都有樱桃等红色水果",
      "都可能出现皮革、甘草风味",
      "酒色都呈宝石红色",
      "都是传统旧世界风格，容易混淆产区"
    ],
    difficulty: "medium"
  },
  {
    id: "malbec-vs-shiraz",
    wines: ["门多萨马尔贝克", "巴罗萨谷西拉"],
    wineIds: ["malbec-mendoza", "shiraz-barossa"],
    similarities: [
      "均为新世界饱满型红葡萄酒",
      "颜色都非常深邃，呈深紫黑色",
      "都有黑莓等浓郁黑色水果香气",
      "酒精度都偏高（14%-15.5%）",
      "酒体饱满，单宁中高到高"
    ],
    distinguishingClues: [
      {
        wine: "门多萨马尔贝克",
        clues: [
          "典型的黑李子果香，比西拉更甜润",
          "常带有紫罗兰花香",
          "单宁更加柔和，口感圆润",
          "巧克力、可可粉的甜感更明显",
          "酸度中等，比西拉偏低"
        ]
      },
      {
        wine: "巴罗萨谷西拉",
        clues: [
          "黑莓、黑醋栗的浓郁黑色水果",
          "标志性的黑胡椒辛香料气息",
          "单宁更加强劲有力",
          "常带有烟熏、培根等咸鲜风味",
          "酸度中低，但酒精度更高（14.5%-15.5%）"
        ]
      }
    ],
    misjudgmentReasons: [
      "颜色都极为深邃，外观难以区分",
      "都是新世界温暖产区的饱满风格",
      "都有黑莓、巧克力等浓郁风味",
      "酒精度都偏高，口感都很厚重"
    ],
    difficulty: "medium"
  }
];
