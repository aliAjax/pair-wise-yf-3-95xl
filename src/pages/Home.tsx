import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header';
import FilterPanel from '../components/FilterPanel';
import VisualizationPanel from '../components/VisualizationPanel';
import MemoryCard from '../components/MemoryCard';
import MemoryModal from '../components/MemoryModal';
import ReviewBar from '../components/ReviewBar';
import { useMemoryStore, selectReviewStats } from '../store/memoryStore';
import type { Filters } from '../utils/helpers';
import { filterMemories, validateReviewBatch } from '../utils/helpers';
import type { SmellMemory } from '../utils/constants';
import type { MemoryInput } from '../store/memoryStore';
import { BookOpenCheck } from 'lucide-react';

const defaultFilters: Filters = {
  smellType: '',
  season: '',
  emotion: '',
};

export default function Home() {
  const { memories, batches, initIfEmpty, addMemory, updateMemory, deleteMemory, submitReview } =
    useMemoryStore();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmellMemory | null>(null);

  // 封存复核批次相关状态
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [highlightBatchId, setHighlightBatchId] = useState<string | null>(null);

  useEffect(() => {
    initIfEmpty();
  }, [initIfEmpty]);

  const filteredMemories = useMemo(
    () => filterMemories(memories, filters),
    [memories, filters],
  );

  const stats = useMemo(() => selectReviewStats(memories, batches), [memories, batches]);

  // 批次 id → 编号 的索引，用于卡片徽标
  const batchCodeMap = useMemo(() => {
    const m = new Map<string, string>();
    batches.forEach((b) => m.set(b.id, b.summary.code));
    return m;
  }, [batches]);

  const activeBatchIds = useMemo(
    () => new Set(batches.filter((b) => b.status === 'active').map((b) => b.id)),
    [batches],
  );

  // 勾选仅作用于当前筛选结果；筛选与顺序均不改变。
  // 筛选条件变化后，自动剔除不在当前结果中的勾选（原列表、顺序、筛选本身不变）
  useEffect(() => {
    if (!selectionMode) return;
    const visibleIds = new Set(filteredMemories.map((m) => m.id));
    setSelectedIds((ids) => ids.filter((id) => visibleIds.has(id)));
  }, [filteredMemories, selectionMode]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMemories = useMemo(
    () => filteredMemories.filter((m) => selectedSet.has(m.id)),
    [filteredMemories, selectedSet],
  );

  // 提交后随勾选变化实时刷新拒绝原因
  const liveIssues = useMemo(() => {
    if (!selectionMode || !reviewAttempted) return [];
    if (selectedMemories.length < 2) return [];
    return validateReviewBatch(selectedMemories);
  }, [selectionMode, reviewAttempted, selectedMemories]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const resetFilters = () => setFilters(defaultFilters);

  const openAddModal = () => { setEditing(null); setModalOpen(true); };
  const openEditModal = (m: SmellMemory) => { setEditing(m); setModalOpen(true); };

  const handleSubmit = (data: MemoryInput) => {
    if (editing) {
      updateMemory(editing.id, data);
      // 编辑已复核记录会使其批次失效，关闭可能存在的摘要高亮
      if (editing.review_batch_id) setHighlightBatchId(null);
    } else {
      addMemory(data);
    }
  };

  const handleDelete = (id: string) => {
    const target = memories.find((m) => m.id === id);
    const msg = `确认删除「${target?.location ?? '这段记忆'}」吗？`;
    if (window.confirm(msg)) {
      deleteMemory(id);
      if (expandedId === id) setExpandedId(null);
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      setHighlightBatchId(null);
    }
  };

  const enterSelection = () => {
    setSelectionMode(true);
    setSelectedIds([]);
    setReviewAttempted(false);
    setExpandedId(null);
  };
  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setReviewAttempted(false);
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  };

  const handleReviewSubmit = () => {
    setReviewAttempted(true);
    if (selectedMemories.length < 2 || selectedMemories.length > 4) return;
    const result = submitReview(selectedMemories.map((m) => m.id));
    if (result.ok && result.batch) {
      setHighlightBatchId(result.batch.id);
      setSelectionMode(false);
      setSelectedIds([]);
      setReviewAttempted(false);
    }
  };

  const scrollToCard = (id: string) => {
    setExpandedId(id);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-memory-id="${id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <div className="min-h-screen">
      <Header onAdd={openAddModal} memoryCount={memories.length} reviewedCount={stats.reviewed} />

      <main className="container max-w-6xl pb-20">
        <FilterPanel
          filters={filters}
          onChange={handleFilterChange}
          onReset={resetFilters}
          resultCount={filteredMemories.length}
        />

        <ReviewBar
          selectionMode={selectionMode}
          selectedCount={selectedMemories.length}
          onEnterSelection={enterSelection}
          onCancelSelection={cancelSelection}
          onSubmit={handleReviewSubmit}
          issues={liveIssues}
          lastResultBatch={batches.find((b) => b.id === highlightBatchId) ?? null}
          batches={batches}
          reviewedCount={stats.reviewed}
          pendingCount={stats.pending}
        />

        <VisualizationPanel memories={filteredMemories} onSelect={scrollToCard} />

        <section className="mt-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-hand text-2xl text-ochre-600 flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" />
              气味档案
            </h2>
            <span className="text-xs text-ink-700/50">
              {selectionMode ? '勾选卡片即可加入本批复核' : '点击卡片展开完整回忆'}
            </span>
          </div>

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
              {filteredMemories.map((m, idx) => {
                const batchId = m.review_batch_id;
                const isActive = !!batchId && activeBatchIds.has(batchId);
                return (
                  <div key={m.id} data-memory-id={m.id}>
                    <MemoryCard
                      memory={m}
                      index={idx}
                      isExpanded={expandedId === m.id}
                      onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      onEdit={() => openEditModal(m)}
                      onDelete={() => handleDelete(m.id)}
                      selectionMode={selectionMode}
                      selected={selectedSet.has(m.id)}
                      onToggleSelect={() => toggleSelect(m.id)}
                      activeBatchCode={isActive ? batchCodeMap.get(batchId!) ?? null : null}
                      invalidBatchCode={
                        !isActive && batchId ? batchCodeMap.get(batchId) ?? null : null
                      }
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

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
