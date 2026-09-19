import type { SmellMemory, SmellType, Season, Emotion } from './constants';
import { getSmellTypeInfo } from './constants';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

export interface Filters {
  smellType: string;
  season: string;
  emotion: string;
}

export function filterMemories(memories: SmellMemory[], filters: Filters): SmellMemory[] {
  return memories.filter(m => {
    if (filters.smellType && m.smell_type !== filters.smellType) return false;
    if (filters.season && m.season !== filters.season) return false;
    if (filters.emotion && m.emotion !== filters.emotion) return false;
    return true;
  });
}

export interface IntensityDistribution {
  bucket: string;
  count: number;
  range: [number, number];
}

export function getIntensityDistribution(memories: SmellMemory[]): IntensityDistribution[] {
  const buckets = [
    { bucket: '1-2', range: [1, 2] as [number, number] },
    { bucket: '3-4', range: [3, 4] as [number, number] },
    { bucket: '5-6', range: [5, 6] as [number, number] },
    { bucket: '7-8', range: [7, 8] as [number, number] },
    { bucket: '9-10', range: [9, 10] as [number, number] },
  ];
  return buckets.map(b => ({
    ...b,
    count: memories.filter(m => m.intensity >= b.range[0] && m.intensity <= b.range[1]).length,
  }));
}

export function getAverageIntensity(memories: SmellMemory[]): number {
  if (!memories.length) return 0;
  const sum = memories.reduce((acc, m) => acc + m.intensity, 0);
  return Math.round((sum / memories.length) * 10) / 10;
}

export function getTopIntensityMemories(memories: SmellMemory[], n = 5): SmellMemory[] {
  return [...memories].sort((a, b) => b.intensity - a.intensity).slice(0, n);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export function isLightColor(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155;
}

export function contrastTextColor(hex: string): string {
  return isLightColor(hex) ? '#2A2118' : '#FBF7EE';
}

// ── 封存复核批次 ──────────────────────────────────────────────

export const REVIEW_MIN = 2;
export const REVIEW_MAX = 4;
/** 强度允许的最大档差 */
export const REVIEW_INTENSITY_TOLERANCE = 3;

export interface ReviewIssue {
  kind: 'count' | 'location' | 'type' | 'intensity';
  label: string;
  detail: string;
}

/**
 * 复核一致性校验：地点必须相同、气味类型必须一致、强度差不超过三档。
 * 任一条件不满足，整批拒绝。
 */
export function validateReviewBatch(memories: SmellMemory[]): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  if (memories.length < REVIEW_MIN) return issues;

  const locations = new Set(memories.map((m) => m.location.trim()));
  if (locations.size > 1) {
    issues.push({
      kind: 'location',
      label: '地点不同',
      detail: `检测到 ${locations.size} 个地点：${[...locations].join('、')}`,
    });
  }

  const types = new Set(memories.map((m) => m.smell_type));
  if (types.size > 1) {
    const labels = [...types].map(
      (t) => getSmellTypeInfo(t as SmellType).label,
    );
    issues.push({
      kind: 'type',
      label: '气味类型不一致',
      detail: `同批气味需为同一类型，当前混合了：${labels.join('、')}`,
    });
  }

  const intensities = memories.map((m) => m.intensity);
  const diff = Math.max(...intensities) - Math.min(...intensities);
  if (diff > REVIEW_INTENSITY_TOLERANCE) {
    issues.push({
      kind: 'intensity',
      label: '强度差超过三档',
      detail: `强度区间 ${Math.min(...intensities)}～${Math.max(...intensities)}，相差 ${diff} 档（上限 ${REVIEW_INTENSITY_TOLERANCE} 档）`,
    });
  }

  return issues;
}

export interface BatchSummary {
  /** 批次编号，如 FH-0003 */
  seq: number;
  code: string;
  count: number;
  location: string;
  smellType: SmellType;
  intensityMin: number;
  intensityMax: number;
  avgIntensity: number;
  avgHumidity: number;
  seasons: Season[];
  emotions: Emotion[];
  createdAt: string;
}

export function buildBatchSummary(
  seq: number,
  memories: SmellMemory[],
  createdAt: string,
): BatchSummary {
  const intensities = memories.map((m) => m.intensity);
  const humidities = memories.map((m) => m.humidity);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    seq,
    code: `FH-${String(seq).padStart(4, '0')}`,
    count: memories.length,
    location: memories[0].location.trim(),
    smellType: memories[0].smell_type,
    intensityMin: Math.min(...intensities),
    intensityMax: Math.max(...intensities),
    avgIntensity: round1(intensities.reduce((a, b) => a + b, 0) / intensities.length),
    avgHumidity: round1(humidities.reduce((a, b) => a + b, 0) / humidities.length),
    seasons: [...new Set(memories.map((m) => m.season))],
    emotions: [...new Set(memories.map((m) => m.emotion))],
    createdAt,
  };
}
