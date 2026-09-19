import type { SmellMemory } from './constants';
import { MAX_INTENSITY_GAP, MAX_REVIEW_COUNT, MIN_REVIEW_COUNT } from './constants';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export type ReviewRejectReason =
  | { code: 'count'; message: string }
  | { code: 'location'; message: string }
  | { code: 'smellType'; message: string }
  | { code: 'intensity'; message: string };

/**
 * 封存复核前置校验：
 * 须勾选 2~4 条；地点必须一致；气味类型必须一致；强度极差不得超过三档。
 * 校验失败即整批拒绝，不改动任何记录。
 */
export function validateReviewBatch(memories: SmellMemory[]): ReviewRejectReason | null {
  if (memories.length < MIN_REVIEW_COUNT || memories.length > MAX_REVIEW_COUNT) {
    return {
      code: 'count',
      message: `请勾选 ${MIN_REVIEW_COUNT}～${MAX_REVIEW_COUNT} 条记忆后再开启复核（当前 ${memories.length} 条）`,
    };
  }

  const locations = new Set(memories.map((m) => m.location.trim()));
  if (locations.size > 1) {
    return { code: 'location', message: '整批拒绝：批次内地点不一致，封存复核要求同一场所的记忆' };
  }

  const types = new Set(memories.map((m) => m.smell_type));
  if (types.size > 1) {
    return { code: 'smellType', message: '整批拒绝：批次内气味类型不一致，无法共同封存' };
  }

  const intensities = memories.map((m) => m.intensity);
  const gap = Math.max(...intensities) - Math.min(...intensities);
  if (gap > MAX_INTENSITY_GAP) {
    return {
      code: 'intensity',
      message: `整批拒绝：强度相差 ${gap} 档，超过三档的允许范围（强度 ${Math.min(...intensities)}～${Math.max(...intensities)}）`,
    };
  }

  return null;
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
