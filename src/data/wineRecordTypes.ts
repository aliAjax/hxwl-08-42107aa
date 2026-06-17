export interface WineRecord {
  id: string;
  name: string;
  region: string;
  country: string;
  grape: string;
  year?: string;
  acidity: string;
  tannin: string;
  body: string;
  color?: string;
  alcohol?: string;
  aromas: string[];
  characteristic: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type WineRecordInput = Omit<WineRecord, "id" | "createdAt" | "updatedAt">;

export const seedRecords: WineRecordInput[] = [
  {
    name: "左岸混酿",
    region: "波尔多左岸",
    country: "法国",
    grape: "赤霞珠",
    year: "2018",
    acidity: "中高",
    tannin: "高",
    body: "饱满",
    color: "深宝石红",
    alcohol: "13.5%-14.5%",
    aromas: ["黑醋栗", "雪松", "铅笔芯", "黑樱桃", "甘草"],
    characteristic: "高单宁",
    notes: "经典波尔多左岸风格，单宁紧实，黑色水果为主。"
  },
  {
    name: "勃艮第村级",
    region: "勃艮第",
    country: "法国",
    grape: "黑皮诺",
    year: "2020",
    acidity: "高",
    tannin: "低",
    body: "中等",
    color: "浅宝石红",
    alcohol: "13%-14%",
    aromas: ["红樱桃", "蘑菇", "湿叶", "覆盆子", "皮革"],
    characteristic: "中等酒体",
    notes: "优雅的黑皮诺，红色水果和森林地表气息。"
  },
  {
    name: "里奥哈珍藏",
    region: "里奥哈",
    country: "西班牙",
    grape: "丹魄",
    year: "2016",
    acidity: "中等",
    tannin: "中高",
    body: "中等偏饱满",
    color: "石榴红",
    alcohol: "13.5%-14.5%",
    aromas: ["香草", "椰子", "熟李子", "烟草", "皮革"],
    characteristic: "橡木明显",
    notes: "美国橡木桶陈酿，香草和椰子气息突出。"
  }
];
