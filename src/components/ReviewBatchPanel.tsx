import type { ReviewBatch, SmellMemory } from '../utils/constants';
import { getSmellTypeInfo, REVIEW_INVALID_LABELS } from '../utils/constants';
import { formatDate } from '../utils/helpers';
import { BadgeCheck, ShieldX, PackageCheck } from 'lucide-react';

interface Props {
  batches: ReviewBatch[];
  memories: SmellMemory[];
  highlightedId?: string | null;
  onSelectMemory: (id: string) => void;
}

export default function ReviewBatchPanel({ batches, memories, highlightedId, onSelectMemory }: Props) {
  if (batches.length === 0) return null;

  // 有效批次在前，同状态按封存时间倒序
  const sorted = [...batches].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  const activeCount = batches.filter((b) => b.status === 'active').length;

  return (
    <section className="container max-w-6xl mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-hand text-2xl text-moss-600">封存复核批次</span>
        <span className="text-xs text-ink-700/50">
          · 共 {batches.length} 批{activeCount > 0 ? `，${activeCount} 批有效` : '，暂无有效批次'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {sorted.map((b) => {
          const stype = getSmellTypeInfo(b.smell_type);
          const active = b.status === 'active';
          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-5 shadow-paper transition-all duration-300 ${
                highlightedId === b.id
                  ? 'border-moss-400 ring-2 ring-moss-300/60 bg-moss-50'
                  : 'border-paper-300 bg-paper-50/80 backdrop-blur'
              } ${!active ? 'opacity-75' : ''}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif text-lg font-semibold text-ink-800 truncate">
                      {b.location}
                    </span>
                    <span
                      className="scent-tag text-paper-50"
                      style={{ backgroundColor: stype.color }}
                    >
                      {stype.emoji} {stype.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-700/50 mt-1 font-mono">
                    批次 {b.id} · 封存于 {formatDate(b.created_at)}
                  </p>
                </div>
                {active ? (
                  <span className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full bg-moss-100 text-moss-600 text-xs font-medium border border-moss-200">
                    <BadgeCheck className="w-3.5 h-3.5" /> 有效
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full bg-brick-500/10 text-brick-600 text-xs font-medium border border-brick-500/30">
                    <ShieldX className="w-3.5 h-3.5" /> 已失效
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-xl bg-paper-100/80 border border-paper-200/80 px-3 py-2 text-center">
                  <div className="font-serif text-xl font-bold text-ochre-600 leading-tight">{b.memory_count}</div>
                  <div className="text-[11px] text-ink-700/55">复核条数</div>
                </div>
                <div className="rounded-xl bg-paper-100/80 border border-paper-200/80 px-3 py-2 text-center">
                  <div className="font-serif text-xl font-bold text-ochre-600 leading-tight">
                    {b.intensity_min}～{b.intensity_max}
                  </div>
                  <div className="text-[11px] text-ink-700/55">强度区间</div>
                </div>
                <div className="rounded-xl bg-paper-100/80 border border-paper-200/80 px-3 py-2 text-center">
                  <div className="font-serif text-xl font-bold text-moss-600 leading-tight">{b.avg_intensity}</div>
                  <div className="text-[11px] text-ink-700/55">平均强度</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {b.memory_ids.map((mid) => {
                  const m = memories.find((x) => x.id === mid);
                  return (
                    <button
                      key={mid}
                      onClick={() => m && onSelectMemory(m.id)}
                      disabled={!m}
                      title={m ? '定位到该记忆' : '该记录已被移除'}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                        m
                          ? 'bg-paper-100 text-ink-800 border-paper-300 hover:bg-ochre-100 hover:border-ochre-300'
                          : 'bg-paper-200/60 text-ink-700/40 border-paper-300 cursor-not-allowed line-through'
                      }`}
                    >
                      <PackageCheck className="w-3 h-3" />
                      {m ? m.location : '已移除记录'}
                    </button>
                  );
                })}
              </div>

              {!active && (
                <p className="flex items-center gap-1.5 text-[11px] text-brick-600/90 border-t border-brick-500/15 pt-2.5">
                  <ShieldX className="w-3.5 h-3.5 shrink-0" />
                  {b.invalidated_at && `${formatDate(b.invalidated_at)} · `}
                  因{b.invalid_reason ? REVIEW_INVALID_LABELS[b.invalid_reason] : '内容变动'}整批失效，
                  摘要与原结果保留，相关记录已退回待复核
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
