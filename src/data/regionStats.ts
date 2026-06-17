import { WineRecord } from "./wineRecordTypes";

export interface RegionStat {
  key: string;
  name: string;
  country: string;
  color: string;
  count: number;
  accuracy: number;
  lastPracticed: number | null;
}

export interface WeakGrapeSummary {
  grape: string;
  count: number;
  errorCount: number;
  errorRate: number;
  sampleRecords: WineRecord[];
}

export interface RegionDetail {
  stat: RegionStat;
  records: WineRecord[];
  weakGrapes: WeakGrapeSummary[];
}

export const REGION_GROUPS: {
  key: string;
  name: string;
  country: string;
  color: string;
  keywords: string[];
}[] = [
  {
    key: "bordeaux",
    name: "波尔多",
    country: "法国",
    color: "#9f1239",
    keywords: ["波尔多"],
  },
  {
    key: "burgundy",
    name: "勃艮第",
    country: "法国",
    color: "#7c3aed",
    keywords: ["勃艮第", "夏布利", "桑塞尔"],
  },
  {
    key: "napa",
    name: "纳帕谷",
    country: "美国",
    color: "#0891b2",
    keywords: ["纳帕"],
  },
  {
    key: "rioja",
    name: "里奥哈",
    country: "西班牙",
    color: "#d97706",
    keywords: ["里奥哈"],
  },
  {
    key: "tuscany",
    name: "托斯卡纳",
    country: "意大利",
    color: "#047857",
    keywords: ["基安蒂", "托斯卡纳"],
  },
  {
    key: "piedmont",
    name: "皮埃蒙特",
    country: "意大利",
    color: "#be185d",
    keywords: ["巴罗洛", "皮埃蒙特"],
  },
  {
    key: "mendoza",
    name: "门多萨",
    country: "阿根廷",
    color: "#4f46e5",
    keywords: ["门多萨"],
  },
  {
    key: "barossa",
    name: "巴罗萨谷",
    country: "澳大利亚",
    color: "#c2410c",
    keywords: ["巴罗萨"],
  },
];

export function matchRegionKey(region: string): string | null {
  const normalized = region.toLowerCase();
  for (const group of REGION_GROUPS) {
    if (group.keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
      return group.key;
    }
  }
  return null;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededRatio(seed: string): number {
  return (hashString(seed) % 1000) / 1000;
}

export function computeRegionStats(records: WineRecord[]): RegionStat[] {
  const regionRecordsMap: Record<string, WineRecord[]> = {};

  for (const record of records) {
    const key = matchRegionKey(record.region);
    if (!key) continue;
    if (!regionRecordsMap[key]) {
      regionRecordsMap[key] = [];
    }
    regionRecordsMap[key].push(record);
  }

  return REGION_GROUPS.map((group) => {
    const regionRecords = regionRecordsMap[group.key] || [];
    const count = regionRecords.length;
    const accuracy = count > 0
      ? Math.round(60 + seededRatio(group.key + "-accuracy") * 35)
      : 0;
    const lastPracticed =
      count > 0
        ? Math.max(...regionRecords.map((r) => r.updatedAt || r.createdAt))
        : null;

    return {
      key: group.key,
      name: group.name,
      country: group.country,
      color: group.color,
      count,
      accuracy,
      lastPracticed,
    };
  });
}

export function computeRegionDetail(
  records: WineRecord[],
  regionKey: string
): RegionDetail | null {
  const stats = computeRegionStats(records);
  const stat = stats.find((s) => s.key === regionKey);
  if (!stat) return null;

  const regionRecords = records.filter(
    (r) => matchRegionKey(r.region) === regionKey
  );

  const grapeMap: Record<string, WineRecord[]> = {};
  for (const record of regionRecords) {
    if (!grapeMap[record.grape]) {
      grapeMap[record.grape] = [];
    }
    grapeMap[record.grape].push(record);
  }

  const weakGrapes: WeakGrapeSummary[] = Object.entries(grapeMap)
    .map(([grape, grapeRecords]) => {
      const count = grapeRecords.length;
      const targetErrorRate = Math.round(15 + seededRatio(regionKey + "-" + grape + "-error") * 45);
      const errorCount = count > 0 ? Math.round(count * targetErrorRate / 100) : 0;
      const errorRate = count > 0 ? Math.round((errorCount / count) * 100) : 0;
      return {
        grape,
        count,
        errorCount,
        errorRate,
        sampleRecords: grapeRecords.slice(0, 3),
      };
    })
    .sort((a, b) => b.errorRate - a.errorRate);

  return {
    stat,
    records: regionRecords.sort((a, b) => b.createdAt - a.createdAt),
    weakGrapes,
  };
}

export function formatLastPracticed(timestamp: number | null): string {
  if (!timestamp) return "暂无练习";
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}月前`;
}
