import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId, validateReviewBatch, buildBatchSummary, REVIEW_MIN, REVIEW_MAX } from '../utils/helpers';
import type { BatchSummary, ReviewIssue } from '../utils/helpers';
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

export type BatchStatus = 'active' | 'invalidated';

export interface ReviewBatch {
  id: string;
  status: BatchStatus;
  memoryIds: string[];
  summary: BatchSummary;
  invalidatedAt?: string;
  /** 失效原因：edited / removed / re-reviewed */
  invalidReason?: 'edited' | 'removed' | 're-reviewed';
  invalidDetail?: string;
}

interface ReviewResult {
  ok: boolean;
  batch?: ReviewBatch;
  issues: ReviewIssue[];
}

interface MemoryStore {
  memories: SmellMemory[];
  batches: ReviewBatch[];
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  initIfEmpty: () => void;
  submitReview: (ids: string[]) => ReviewResult;
}

/** 使引用了指定记忆、且仍有效的批次失效，原批次记录保留 */
function invalidateBatches(
  batches: ReviewBatch[],
  ids: string[],
  reason: 'edited' | 'removed' | 're-reviewed',
  detail: string,
): ReviewBatch[] {
  const idSet = new Set(ids);
  const at = new Date().toISOString();
  return batches.map((b) =>
    b.status === 'active' && b.memoryIds.some((id) => idSet.has(id))
      ? { ...b, status: 'invalidated', invalidatedAt: at, invalidReason: reason, invalidDetail: detail }
      : b,
  );
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      batches: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...input,
          created_at: now,
          updated_at: now,
          review_batch_id: null,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input) => {
        const target = get().memories.find((m) => m.id === id);
        const wasReviewed = !!target?.review_batch_id;
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...input, updated_at: new Date().toISOString(), review_batch_id: null }
              : m,
          ),
        });
        // 任一已复核记录被编辑 → 该批复核失效，状态退回待复核
        if (wasReviewed) {
          set({
            batches: invalidateBatches(
              get().batches,
              [id],
              'edited',
              `批次中的记忆「${target?.location ?? id}」被编辑`,
            ),
          });
        }
      },
      deleteMemory: (id) => {
        const target = get().memories.find((m) => m.id === id);
        const wasReviewed = !!target?.review_batch_id;
        set({ memories: get().memories.filter((m) => m.id !== id) });
        // 记录被移除 → 其所在批次失效，其余成员状态退回待复核
        if (wasReviewed) {
          set({
            batches: invalidateBatches(
              get().batches,
              [id],
              'removed',
              `批次中的记忆「${target?.location ?? id}」被移除`,
            ),
          });
        }
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({
            memories: mockMemories.map((m) => ({ ...m, review_batch_id: null })),
          });
        }
      },
      submitReview: (ids) => {
        const { memories, batches } = get();
        const idSet = new Set(ids);
        const picked = memories.filter((m) => idSet.has(m.id));

        // 复核仅限二至四条记忆
        if (picked.length < REVIEW_MIN || picked.length > REVIEW_MAX) {
          return {
            ok: false,
            issues: [{
              kind: 'count',
              label: '数量不符',
              detail: `每次复核需勾选 ${REVIEW_MIN}～${REVIEW_MAX} 条记忆，当前选择 ${picked.length} 条`,
            }],
          };
        }

        // 整批校验：地点相同、类型一致、强度差 ≤ 3
        const issues = validateReviewBatch(picked);
        if (issues.length > 0) {
          return { ok: false, issues };
        }

        const now = new Date().toISOString();
        const seq = batches.reduce((max, b) => Math.max(max, b.summary.seq), 0) + 1;
        const batchId = generateId();
        const batch: ReviewBatch = {
          id: batchId,
          status: 'active',
          memoryIds: picked.map((m) => m.id),
          summary: buildBatchSummary(seq, picked, now),
        };

        // 记录若已属于其他有效批次（再次复核），原批次先行失效
        const priorActive = batches.filter(
          (b) => b.status === 'active' && b.memoryIds.some((id) => idSet.has(id)),
        );

        set({
          memories: memories.map((m) =>
            idSet.has(m.id) ? { ...m, review_batch_id: batchId } : m,
          ),
          batches: [
            ...invalidateBatches(
              batches,
              priorActive.flatMap((b) => b.memoryIds),
              're-reviewed',
              '批次中的记忆参与了新的复核',
            ),
            batch,
          ],
        });

        return { ok: true, batch, issues: [] };
      },
    }),
    {
      name: 'scent-memory-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ memories: state.memories, batches: state.batches }),
      version: 2,
      migrate: (persisted: unknown) => {
        const p = (persisted ?? {}) as Partial<{ memories: SmellMemory[]; batches: ReviewBatch[] }>;
        return {
          memories: Array.isArray(p.memories)
            ? p.memories.map((m) =>
                m.review_batch_id === undefined ? { ...m, review_batch_id: null } : m,
              )
            : [],
          batches: Array.isArray(p.batches) ? p.batches : [],
        };
      },
    },
  ),
);

// ── 复核相关派生选择器 ──────────────────────────────────────────

/** 记忆当前是否处于「已复核」状态（其批次仍有效） */
export function selectIsReviewed(m: SmellMemory): boolean {
  if (!m.review_batch_id) return false;
  const batch = useMemoryStore.getState().batches.find((b) => b.id === m.review_batch_id);
  return !!batch && batch.status === 'active';
}

export interface ReviewStats {
  total: number;
  reviewed: number;
  pending: number;
  activeBatches: number;
  invalidBatches: number;
}

export function selectReviewStats(memories: SmellMemory[], batches: ReviewBatch[]): ReviewStats {
  const activeBatchIds = new Set(
    batches.filter((b) => b.status === 'active').map((b) => b.id),
  );
  const reviewed = memories.filter(
    (m) => m.review_batch_id && activeBatchIds.has(m.review_batch_id),
  ).length;
  return {
    total: memories.length,
    reviewed,
    pending: memories.length - reviewed,
    activeBatches: activeBatchIds.size,
    invalidBatches: batches.length - activeBatchIds.size,
  };
}
