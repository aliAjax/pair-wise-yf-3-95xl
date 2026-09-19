import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, ReviewBatch, ReviewInvalidReason } from '../utils/constants';
import { generateId, validateReviewBatch } from '../utils/helpers';
import type { ReviewRejectReason } from '../utils/helpers';
import { mockMemories } from '../data/mockData';

export interface MemoryInput {
  location: string;
  source_guess: string;
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

export type ReviewResult =
  | { ok: true; batchId: string }
  | { ok: false; reason: ReviewRejectReason };

interface MemoryStore {
  memories: SmellMemory[];
  reviewBatches: ReviewBatch[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  submitReview: (ids: string[]) => ReviewResult;
  initIfEmpty: () => void;
}

/** 将所有包含该记忆的有效批次置为失效；原摘要保留，记录退回待复核 */
function invalidateBatches(
  batches: ReviewBatch[],
  memoryId: string,
  reason: ReviewInvalidReason,
): ReviewBatch[] {
  const at = new Date().toISOString();
  return batches.map((b) =>
    b.status === 'active' && b.memory_ids.includes(memoryId)
      ? { ...b, status: 'invalidated' as const, invalidated_at: at, invalid_reason: reason, invalid_memory_id: memoryId }
      : b,
  );
}

/** 被失效批次覆盖的全部记忆，其复核状态一并退回待复核（保留 review 原结果） */
function resetReviewForBatches(memories: SmellMemory[], invalidIds: Set<string>): SmellMemory[] {
  if (invalidIds.size === 0) return memories;
  return memories.map((m) =>
    m.review && invalidIds.has(m.review.batch_id) ? { ...m, review: undefined } : m,
  );
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      reviewBatches: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input) => {
        let memories = get().memories.map((m) =>
          m.id === id
            ? { ...m, ...input, updated_at: new Date().toISOString() }
            : m,
        );

        // 任一记录被编辑：其所在有效批次整批失效
        let batches = get().reviewBatches;
        const invalidIds = new Set(
          batches
            .filter((b) => b.status === 'active' && b.memory_ids.includes(id))
            .map((b) => b.id),
        );
        if (invalidIds.size > 0) {
          batches = invalidateBatches(batches, id, 'edited');
          memories = resetReviewForBatches(memories, invalidIds);
        }

        set({ memories, reviewBatches: batches });
      },
      deleteMemory: (id) => {
        let memories = get().memories.filter((m) => m.id !== id);
        let batches = get().reviewBatches;

        // 任一记录被移除：其所在有效批次整批失效（摘要仍保留）
        const invalidIds = new Set(
          batches
            .filter((b) => b.status === 'active' && b.memory_ids.includes(id))
            .map((b) => b.id),
        );
        if (invalidIds.size > 0) {
          batches = invalidateBatches(batches, id, 'deleted');
          memories = resetReviewForBatches(memories, invalidIds);
        }

        set({ memories, reviewBatches: batches });
      },
      submitReview: (ids) => {
        const all = get().memories;
        // 保持用户勾选顺序
        const picked = ids
          .map((id) => all.find((m) => m.id === id))
          .filter((m): m is SmellMemory => !!m);

        // 整批拒绝：地点不同 / 气味类型不一致 / 强度差超过三档（含数量不符）
        const reject = validateReviewBatch(picked);
        if (reject) return { ok: false, reason: reject };

        const now = new Date().toISOString();
        const pickedIds = picked.map((m) => m.id);
        const intensities = picked.map((m) => m.intensity);

        const batch: ReviewBatch = {
          id: generateId(),
          created_at: now,
          memory_ids: pickedIds,
          memory_count: picked.length,
          location: picked[0].location.trim(),
          smell_type: picked[0].smell_type,
          intensity_min: Math.min(...intensities),
          intensity_max: Math.max(...intensities),
          avg_intensity: Math.round((intensities.reduce((a, b) => a + b, 0) / picked.length) * 10) / 10,
          status: 'active',
        };

        let batches = get().reviewBatches;
        let memories = get().memories;

        // 再次复核：这些记忆原先所在的有效批次全部失效
        const previousBatches = batches.filter(
          (b) => b.status === 'active' && b.memory_ids.some((mid) => pickedIds.includes(mid)),
        );
        if (previousBatches.length > 0) {
          const previousIds = new Set(previousBatches.map((b) => b.id));
          previousBatches.forEach((b) => {
            const trigger = b.memory_ids.find((mid) => pickedIds.includes(mid));
            batches = invalidateBatches(batches, trigger ?? pickedIds[0], 'rereviewed');
          });
          memories = resetReviewForBatches(memories, previousIds);
        }

        // 通过后记录进入已复核
        memories = memories.map((m) =>
          pickedIds.includes(m.id) ? { ...m, review: { batch_id: batch.id, reviewed_at: now } } : m,
        );

        set({ memories, reviewBatches: [...batches, batch] });
        return { ok: true, batchId: batch.id };
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
