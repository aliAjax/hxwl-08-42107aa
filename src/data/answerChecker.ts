import {
  regionAliases,
  grapeAliases,
  RegionAliasEntry,
  GrapeAliasEntry,
} from "./answerAliases";

export type MatchSourceType =
  | "canonical"
  | "alias"
  | "parentRegion"
  | "subRegion"
  | "partial"
  | "none";

export interface MatchResult {
  correct: boolean;
  sourceType: MatchSourceType;
  matchedText: string;
  canonicalName: string;
  sourceLabel: string;
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[-–—·\.]/g, "");
}

function buildRegionIndex(): Map<
  string,
  { entry: RegionAliasEntry; sourceType: MatchSourceType; matchedText: string }
> {
  const index = new Map<
    string,
    { entry: RegionAliasEntry; sourceType: MatchSourceType; matchedText: string }
  >();

  regionAliases.forEach((entry) => {
    index.set(normalizeText(entry.canonical), {
      entry,
      sourceType: "canonical",
      matchedText: entry.canonical,
    });

    entry.aliases.forEach((alias) => {
      const key = normalizeText(alias);
      if (!index.has(key)) {
        index.set(key, { entry, sourceType: "alias", matchedText: alias });
      }
    });

    entry.parentRegions?.forEach((parent) => {
      const key = normalizeText(parent);
      if (!index.has(key)) {
        index.set(key, {
          entry,
          sourceType: "parentRegion",
          matchedText: parent,
        });
      }
    });

    entry.subRegions?.forEach((sub) => {
      const key = normalizeText(sub);
      if (!index.has(key)) {
        index.set(key, { entry, sourceType: "subRegion", matchedText: sub });
      }
    });
  });

  return index;
}

function buildGrapeIndex(): Map<
  string,
  { entry: GrapeAliasEntry; sourceType: MatchSourceType; matchedText: string }
> {
  const index = new Map<
    string,
    { entry: GrapeAliasEntry; sourceType: MatchSourceType; matchedText: string }
  >();

  grapeAliases.forEach((entry) => {
    index.set(normalizeText(entry.canonical), {
      entry,
      sourceType: "canonical",
      matchedText: entry.canonical,
    });

    entry.aliases.forEach((alias) => {
      const key = normalizeText(alias);
      if (!index.has(key)) {
        index.set(key, { entry, sourceType: "alias", matchedText: alias });
      }
    });
  });

  return index;
}

const regionIndex = buildRegionIndex();
const grapeIndex = buildGrapeIndex();

function findCanonicalRegion(region: string): RegionAliasEntry | undefined {
  const normalized = normalizeText(region);

  if (regionIndex.has(normalized)) {
    return regionIndex.get(normalized)!.entry;
  }

  for (const entry of regionAliases) {
    if (normalizeText(entry.canonical) === normalized) {
      return entry;
    }
    if (entry.aliases.some((a) => normalizeText(a) === normalized)) {
      return entry;
    }
  }

  return undefined;
}

function findCanonicalGrape(grape: string): GrapeAliasEntry | undefined {
  const normalized = normalizeText(grape);

  if (grapeIndex.has(normalized)) {
    return grapeIndex.get(normalized)!.entry;
  }

  for (const entry of grapeAliases) {
    if (normalizeText(entry.canonical) === normalized) {
      return entry;
    }
    if (entry.aliases.some((a) => normalizeText(a) === normalized)) {
      return entry;
    }
  }

  return undefined;
}

function getSourceLabel(
  sourceType: MatchSourceType,
  matchedText: string,
  canonicalName: string
): string {
  switch (sourceType) {
    case "canonical":
      return `标准答案：${canonicalName}`;
    case "alias":
      return `命中别名「${matchedText}」，标准答案：${canonicalName}`;
    case "parentRegion":
      return `命中父产区「${matchedText}」，标准答案：${canonicalName}`;
    case "subRegion":
      return `命中子产区「${matchedText}」，标准答案：${canonicalName}`;
    case "partial":
      return `命中部分匹配「${matchedText}」，标准答案：${canonicalName}`;
    default:
      return "未命中";
  }
}

export function checkRegionAnswer(
  userAnswer: string,
  correctRegion: string
): MatchResult {
  const user = normalizeText(userAnswer);
  const correct = normalizeText(correctRegion);

  if (!user) {
    return {
      correct: false,
      sourceType: "none",
      matchedText: "",
      canonicalName: correctRegion,
      sourceLabel: "未作答",
    };
  }

  if (user === correct) {
    return {
      correct: true,
      sourceType: "canonical",
      matchedText: correctRegion,
      canonicalName: correctRegion,
      sourceLabel: getSourceLabel("canonical", correctRegion, correctRegion),
    };
  }

  const correctEntry = findCanonicalRegion(correctRegion);
  const userEntry = findCanonicalRegion(userAnswer);

  if (correctEntry && userEntry && correctEntry.canonical === userEntry.canonical) {
    const indexed = regionIndex.get(user);
    const sourceType = indexed?.sourceType || "alias";
    const matchedText = indexed?.matchedText || userAnswer;
    return {
      correct: true,
      sourceType,
      matchedText,
      canonicalName: correctEntry.canonical,
      sourceLabel: getSourceLabel(sourceType, matchedText, correctEntry.canonical),
    };
  }

  if (correctEntry) {
    const allNames = [
      correctEntry.canonical,
      ...correctEntry.aliases,
      ...(correctEntry.parentRegions || []),
      ...(correctEntry.subRegions || []),
    ];

    for (const name of allNames) {
      const normName = normalizeText(name);
      if (user === normName) {
        let sourceType: MatchSourceType = "alias";
        if (name === correctEntry.canonical) sourceType = "canonical";
        else if (correctEntry.aliases.includes(name)) sourceType = "alias";
        else if (correctEntry.parentRegions?.includes(name))
          sourceType = "parentRegion";
        else if (correctEntry.subRegions?.includes(name))
          sourceType = "subRegion";

        return {
          correct: true,
          sourceType,
          matchedText: name,
          canonicalName: correctEntry.canonical,
          sourceLabel: getSourceLabel(
            sourceType,
            name,
            correctEntry.canonical
          ),
        };
      }
    }
  }

  const correctEntryNames = correctEntry
    ? [
        correctEntry.canonical,
        ...correctEntry.aliases,
        ...(correctEntry.parentRegions || []),
        ...(correctEntry.subRegions || []),
      ]
    : [correctRegion];

  for (const name of correctEntryNames) {
    const normName = normalizeText(name);
    if (normName.includes(user) || user.includes(normName)) {
      return {
        correct: true,
        sourceType: "partial",
        matchedText: userAnswer,
        canonicalName: correctEntry?.canonical || correctRegion,
        sourceLabel: getSourceLabel(
          "partial",
          userAnswer,
          correctEntry?.canonical || correctRegion
        ),
      };
    }
  }

  return {
    correct: false,
    sourceType: "none",
    matchedText: userAnswer,
    canonicalName: correctRegion,
    sourceLabel: `答案「${userAnswer}」不正确，正确答案：${correctRegion}`,
  };
}

export function checkGrapeAnswer(
  userAnswer: string,
  correctGrape: string
): MatchResult {
  const user = normalizeText(userAnswer);
  const correct = normalizeText(correctGrape);

  if (!user) {
    return {
      correct: false,
      sourceType: "none",
      matchedText: "",
      canonicalName: correctGrape,
      sourceLabel: "未作答",
    };
  }

  if (user === correct) {
    return {
      correct: true,
      sourceType: "canonical",
      matchedText: correctGrape,
      canonicalName: correctGrape,
      sourceLabel: getSourceLabel("canonical", correctGrape, correctGrape),
    };
  }

  const correctEntry = findCanonicalGrape(correctGrape);
  const userEntry = findCanonicalGrape(userAnswer);

  if (correctEntry && userEntry && correctEntry.canonical === userEntry.canonical) {
    const indexed = grapeIndex.get(user);
    const sourceType = indexed?.sourceType || "alias";
    const matchedText = indexed?.matchedText || userAnswer;
    return {
      correct: true,
      sourceType,
      matchedText,
      canonicalName: correctEntry.canonical,
      sourceLabel: getSourceLabel(sourceType, matchedText, correctEntry.canonical),
    };
  }

  if (correctEntry) {
    const allNames = [correctEntry.canonical, ...correctEntry.aliases];

    for (const name of allNames) {
      const normName = normalizeText(name);
      if (user === normName) {
        let sourceType: MatchSourceType = "alias";
        if (name === correctEntry.canonical) sourceType = "canonical";
        else if (correctEntry.aliases.includes(name)) sourceType = "alias";

        return {
          correct: true,
          sourceType,
          matchedText: name,
          canonicalName: correctEntry.canonical,
          sourceLabel: getSourceLabel(
            sourceType,
            name,
            correctEntry.canonical
          ),
        };
      }
    }
  }

  const correctEntryNames = correctEntry
    ? [correctEntry.canonical, ...correctEntry.aliases]
    : [correctGrape];

  for (const name of correctEntryNames) {
    const normName = normalizeText(name);
    if (normName.includes(user) || user.includes(normName)) {
      return {
        correct: true,
        sourceType: "partial",
        matchedText: userAnswer,
        canonicalName: correctEntry?.canonical || correctGrape,
        sourceLabel: getSourceLabel(
          "partial",
          userAnswer,
          correctEntry?.canonical || correctGrape
        ),
      };
    }
  }

  return {
    correct: false,
    sourceType: "none",
    matchedText: userAnswer,
    canonicalName: correctGrape,
    sourceLabel: `答案「${userAnswer}」不正确，正确答案：${correctGrape}`,
  };
}
