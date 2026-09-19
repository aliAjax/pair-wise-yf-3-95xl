import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import ReviewBatchPanel from '../components/ReviewBatchPanel';
import ReviewToolbar from '../components/ReviewToolbar';
import { useMemoryStore } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import { MIN_REVIEW_COUNT, MAX_REVIEW_COUNT } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import type { ReviewRejectReason } from '../utils/helpers';
import { BookOpenCheck, ClipboardCheck, CheckCircle2 } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
};

export default function Home() {
  const {
    memories, reviewBatches, initIfEmpty,
    addMemory, updateMemory, deleteMemory, submitReview,
  } = useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  const [reviewMode, setReviewMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState<ReviewRejectReason | null>(null);
  const [highlightBatchId, setHighlightBatchId] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<string | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

  // 批次 id -> 批次，供卡片/图表判定复核状态
  const activeBatchMap = useMemo(() => {
    const map = new Map<string, typeof reviewBatches[number]>();
    reviewBatches.filter((b) => b.status === 'active').forEach((b) => map.set(b.id, b));
    return map;
  }, [reviewBatches]);

  const reviewedIdSet = useMemo(() => {
    const set = new Set<string>();
    memories.forEach((m) => {
      if (m.review && activeBatchMap.has(m.review.batch_id)) set.add(m.id);
    });
    return set;
  }, [memories, activeBatchMap]);

  // 已失效但原结果保留的记忆（用于卡片展开提示）
  const invalidBatchByMemory = useMemo(() => {
    const map = new Map<string, typeof reviewBatches[number]>();
    reviewBatches
      .filter((b) => b.status === 'invalidated')
      .forEach((b) => b.memory_ids.forEach((mid) => {
        if (!map.has(mid)) map.set(mid, b);
      }));
    return map;
  }, [reviewBatches]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput) => {
    if (editing) {
      updateMemory(editing.id, data);
    } else {
      addMemory(data);
    }
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？${
      target?.review && activeBatchMap.has(target.review.batch_id)
        ? '\n该记录属于一个有效复核批次，删除后整批复核将失效。'
        : ''
    }`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
      setSelectedIds((ids) => ids.filter((x) => x !== id));
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const enterReviewMode = () => {
    setReviewMode(true);
    setRejectReason(null);
  };
  const exitReviewMode = () => {
    setReviewMode(false);
    setSelectedIds([]);
    setRejectReason(null);
  };

  const toggleSelect = (id: string) => {
    setRejectReason(null);
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_REVIEW_COUNT) return ids;
      return [...ids, id];
    });
  };

  const handleReviewSubmit = () => {
    const result = submitReview(selectedIds);
    if (result.ok === false) {
      // 整批拒绝：原记录、顺序和筛选均不变，保留勾选以便调整
      setRejectReason(result.reason);
      return;
    }
    // 通过：生成批次摘要、记录进入已复核，退出选择模式
    setHighlightBatchId(result.batchId);
    setApprovalNotice(`封存复核通过：${selectedIds.length} 条记忆已进入「已复核」，批次摘要已生成`);
    exitReviewMode();
    window.setTimeout(() => setApprovalNotice(null), 4000);
    window.setTimeout(() => {
      document
        .querySelector('[data-review-batch-panel]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  return (
    <div className="min-h-screen">
      <Header
        onAdd={openAddModal}
        memoryCount={memories.length}
        reviewedCount={reviewedIdSet.size}
      />

      <main className="container max-w-6xl pb-20">
        {approvalNotice && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-2xl bg-moss-100 border border-moss-300 text-moss-600 text-sm shadow-paper animate-fadeInUp">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {approvalNotice}
          </div>
        )}

        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <VisualizationPanel
          memories={filteredMemories}
          reviewedIds={reviewedIdSet}
          onSelect={scrollToCard}
        />

        <div data-review-batch-panel>
          <ReviewBatchPanel
            batches={reviewBatches}
            memories={memories}
            highlightedId={highlightBatchId}
            onSelectMemory={scrollToCard}
          />
        </div>

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-ink-700/50 hidden sm:inline">
                点击卡片展开完整回忆
              </span>
              <button
                onClick={reviewMode ? exitReviewMode : enterReviewMode}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  reviewMode
                    ? 'bg-moss-500 text-paper-50 border-moss-600 shadow-paper'
                    : 'bg-paper-50 text-moss-600 border-moss-300 hover:bg-moss-100'
                }`}
              >
                <ClipboardCheck className="w-4 h-4" />
                {reviewMode ? '退出复核' : '封存复核'}
              </button>
            </div>
          </div>

          {reviewMode && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-moss-100/70 border border-moss-200 text-xs text-moss-600">
              复核模式：勾选 {MIN_REVIEW_COUNT}～{MAX_REVIEW_COUNT} 条记忆后封存。要求地点相同、气味类型一致、强度差不超过三档，否则整批拒绝。
            </div>
          )}

          {filteredMemories.length === 0 ? (
            <div className="bg-paper-50/70 backdrop-blur rounded-3xl border-2 border-dashed border-paper-400 py-20 text-center">
              <div className="text-6xl mb-4 select-none">🍂</div>
              <h3 className="font-serif text-2xl text-ink-800 mb-2">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '没有匹配的气味记忆'
                  : '还没有封存任何气味'}
              </h3>
              <p className="text-ink-700/60 max-w-md mx-auto mb-6">
                {(filters.smellType || filters.season || filters.emotion)
                  ? '换一组筛选条件试试？或者先封存一段新的气味'
                  : '空气中一定有让你难忘的味道——无论是衣柜里的樟木香，还是雨后操场的青草气'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={openAddModal} className="btn-primary">
                  封存第一段气味
                </button>
                {(filters.smellType || filters.season || filters.emotion) && (
                  <button onClick={resetFilters} className="btn-secondary">
                    清除筛选条件
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="masonry-grid">
              {filteredMemories.map((m, idx) => (
                <div key={m.id} data-memory-id={m.id}>
                  <MemoryCard
                    memory={m}
                    index={idx}
                    isExpanded={!reviewMode && expandedId === m.id}
                    onToggle={() => {
                      if (reviewMode) {
                        toggleSelect(m.id);
                      } else {
                        setExpandedId(expandedId === m.id ? null : m.id);
                      }
                    }}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => handleDelete(m.id)}
                    selectable={reviewMode}
                    selected={selectedIds.includes(m.id)}
                    reviewedBatch={m.review ? activeBatchMap.get(m.review.batch_id) ?? null : null}
                    invalidBatch={m.review ? null : (invalidBatchByMemory.get(m.id) ?? null)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {reviewMode && (
          <div className="h-24" />
        )}
      </main>

      {reviewMode && (
        <div className="fixed bottom-0 inset-x-0 z-30 pb-4 pointer-events-none">
          <div className="pointer-events-auto">
            <ReviewToolbar
              selectedCount={selectedIds.length}
              rejectReason={rejectReason}
              onSubmit={handleReviewSubmit}
              onCancel={exitReviewMode}
            />
          </div>
        </div>
      )}

      <footer className="pb-10 pt-4 text-center text-xs text-ink-700/40 font-hand text-lg">
        <p>愿每一缕气味，都是打开旧时光的钥匙 · Scent Archive</p>
      </footer>

      <MemoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editingData={editing}
      />
    </div>
  );
}
