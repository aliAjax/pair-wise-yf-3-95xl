import { useState } from 'react';
import {
  ClipboardCheck,
  X,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
} from 'lucide-react';
import type { ReviewBatch } from '../store/memoryStore';
import type { ReviewIssue } from '../utils/helpers';
import { REVIEW_MIN, REVIEW_MAX, formatDate } from '../utils/helpers';
import { getSmellTypeInfo, getSeasonInfo, getEmotionInfo } from '../utils/constants';

interface Props {
  selectionMode: boolean;
  selectedCount: number;
  onEnterSelection: () => void;
  onCancelSelection: () => void;
  onSubmit: () => void;
  issues: ReviewIssue[];
  /** 刚提交成功的批次（用于展开摘要），成功后由父组件控制 */
  lastResultBatch: ReviewBatch | null;
  batches: ReviewBatch[];
  reviewedCount: number;
  pendingCount: number;
}

const reasonLabels: Record<string, string> = {
  edited: '记录被编辑',
  removed: '记录被移除',
  're-reviewed': '记录参与再次复核',
};

export default function ReviewBar({
  selectionMode,
  selectedCount,
  onEnterSelection,
  onCancelSelection,
  onSubmit,
  issues,
  lastResultBatch,
  batches,
  reviewedCount,
  pendingCount,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const canSubmit = selectedCount >= REVIEW_MIN && selectedCount <= REVIEW_MAX;
  const latest = lastResultBatch ?? batches[batches.length - 1] ?? null;
  const invalidBatches = batches.filter((b) => b.status === 'invalidated');

  return (
    <section className="container max-w-6xl mb-6">
      <div className="rounded-2xl border border-paper-300 shadow-paper overflow-hidden bg-paper-50/70 backdrop-blur">
        {/* ── 主操作行 ── */}
        <div className="p-4 md:p-5">
          {!selectionMode ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-hand text-xl text-moss-600">封存复核</span>
                <span className="text-xs text-ink-700/50">
                  · 已复核 {reviewedCount} 条 · 待复核 {pendingCount} 条
                </span>
              </div>
              <div className="flex-1" />
              <button onClick={onEnterSelection} className="btn-primary inline-flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" />
                开启复核
              </button>
            </div>
          ) : (
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${canSubmit ? 'text-ochre-500' : 'text-brick-500'}`} />
                  <span className="font-hand text-xl text-ochre-600">
                    选择 {REVIEW_MIN}～{REVIEW_MAX} 条记忆
                  </span>
                  <span
                    className={`inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full text-sm font-bold ${
                      canSubmit
                        ? 'bg-moss-100 text-moss-700'
                        : selectedCount > REVIEW_MAX
                          ? 'bg-brick-500/15 text-brick-600'
                          : 'bg-paper-200 text-ink-700/70'
                    }`}
                  >
                    {selectedCount}
                  </span>
                </div>
                <div className="flex-1 text-[11px] text-ink-700/50 leading-snug">
                  整批需满足：地点相同 · 气味类型一致 · 强度差不超过三档，否则整批拒绝
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={onCancelSelection} className="btn-secondary inline-flex items-center gap-1.5">
                    <X className="w-4 h-4" /> 取消
                  </button>
                  <button
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    className={`btn-primary inline-flex items-center gap-1.5 ${!canSubmit ? 'opacity-40 cursor-not-allowed hover:translate-y-0' : ''}`}
                  >
                    <ShieldCheck className="w-4 h-4" /> 提交复核
                  </button>
                </div>
              </div>
              {selectedCount > REVIEW_MAX && (
                <p className="mt-2 text-xs text-brick-600">
                  最多选择 {REVIEW_MAX} 条，请取消 {selectedCount - REVIEW_MAX} 条勾选
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 拒绝原因（整批拒绝，不留任何批次结果）── */}
        {selectionMode && issues.length > 0 && (
          <div className="mx-4 md:mx-5 mb-4 rounded-xl border border-brick-400/50 bg-brick-500/10 p-4 animate-fadeInUp">
            <div className="flex items-center gap-2 text-brick-600 font-semibold text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              整批拒绝 · 以下条件未满足，原记录与筛选均未改动
            </div>
            <ul className="space-y-1">
              {issues.map((iss, i) => (
                <li key={`${iss.kind}-${i}`} className="flex items-start gap-2 text-sm text-brick-700/90">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brick-500 shrink-0" />
                  <span>
                    <b>{iss.label}</b>
                    <span className="text-ink-700/70"> — {iss.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── 最近批次摘要 ── */}
        {!selectionMode && latest && (
          <BatchSummaryCard batch={latest} defaultOpen={!!lastResultBatch} />
        )}

        {/* ── 批次历史（含已失效批次）── */}
        {!selectionMode && batches.length > 0 && (
          <div className="border-t border-paper-200">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center gap-2 px-4 md:px-5 py-2.5 text-xs text-ink-700/60 hover:bg-paper-100/70 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              复核批次记录（{batches.length} 批{invalidBatches.length > 0 ? `，${invalidBatches.length} 批已失效` : ''}）
              {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
            </button>
            {showHistory && (
              <div className="px-4 md:px-5 pb-4 space-y-2 animate-fadeInUp">
                {[...batches].reverse().map((b) => (
                  <div
                    key={b.id}
                    className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-xs ${
                      b.status === 'active'
                        ? 'border-moss-300 bg-moss-100/40'
                        : 'border-paper-200 bg-paper-100/60'
                    }`}
                  >
                    {b.status === 'active'
                      ? <ShieldCheck className="w-3.5 h-3.5 text-moss-600 shrink-0" />
                      : <ShieldOff className="w-3.5 h-3.5 text-ink-700/40 shrink-0" />}
                    <span className={`font-semibold ${b.status === 'active' ? 'text-moss-700' : 'text-ink-700/50 line-through decoration-paper-400'}`}>
                      {b.summary.code}
                    </span>
                    <span className="inline-flex items-center gap-1 text-ink-700/70">
                      <MapPin className="w-3 h-3" />{b.summary.location}
                    </span>
                    <span>{getSmellTypeInfo(b.summary.smellType).emoji} {getSmellTypeInfo(b.summary.smellType).label}</span>
                    <span>{b.summary.count} 条 · 强度 {b.summary.intensityMin}～{b.summary.intensityMax}</span>
                    <span className="text-ink-700/45">{formatDate(b.summary.createdAt)}</span>
                    {b.status === 'invalidated' && (
                      <span className="text-brick-600/80 ml-auto">
                        已失效 · {b.invalidReason ? reasonLabels[b.invalidReason] : '状态退回待复核'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BatchSummaryCard({ batch, defaultOpen }: { batch: ReviewBatch; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { summary: s, status } = batch;
  const stype = getSmellTypeInfo(s.smellType);
  const active = status === 'active';

  return (
    <div className={`mx-4 md:mx-5 mb-4 rounded-xl border overflow-hidden animate-fadeInUp ${
      active ? 'border-moss-300 bg-moss-100/40' : 'border-paper-200 bg-paper-100/60'
    }`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left"
      >
        {active
          ? <ShieldCheck className="w-4 h-4 text-moss-600" />
          : <ShieldOff className="w-4 h-4 text-ink-700/40" />}
        <span className={`font-hand text-lg ${active ? 'text-moss-700' : 'text-ink-700/50'}`}>
          {active ? '复核通过' : '该批复核已失效'} · {s.code}
        </span>
        <span className="text-xs text-ink-700/55">{formatDate(s.createdAt)}</span>
        {open ? <ChevronUp className="w-4 h-4 ml-auto text-ink-700/50" /> : <ChevronDown className="w-4 h-4 ml-auto text-ink-700/50" />}
      </button>

      {open && (
        <div className="px-4 pb-4 animate-fadeInUp">
          <p className="text-sm text-ink-800 mb-3">
            于 <b>{s.location}</b> 封存的 <b>{s.count}</b> 条{' '}
            <span style={{ color: stype.color }}>{stype.emoji} {stype.label}</span>
            气味记录通过一致性复核
            {!active && (
              <span className="text-brick-600/90">
                ；原结果保留，状态已退回待复核
                {batch.invalidReason ? `（${reasonLabels[batch.invalidReason]}）` : ''}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-paper-50/80 border border-paper-200 py-2">
              <div className="text-lg font-serif font-bold text-ochre-600 leading-tight">
                {s.intensityMin === s.intensityMax ? s.intensityMin : `${s.intensityMin}～${s.intensityMax}`}
              </div>
              <div className="text-[10px] text-ink-700/55">强度区间</div>
            </div>
            <div className="rounded-lg bg-paper-50/80 border border-paper-200 py-2">
              <div className="text-lg font-serif font-bold text-ochre-600 leading-tight">{s.avgIntensity}</div>
              <div className="text-[10px] text-ink-700/55">平均强度</div>
            </div>
            <div className="rounded-lg bg-paper-50/80 border border-paper-200 py-2">
              <div className="text-lg font-serif font-bold text-moss-600 leading-tight">{s.avgHumidity}</div>
              <div className="text-[10px] text-ink-700/55">平均湿度感</div>
            </div>
            <div className="rounded-lg bg-paper-50/80 border border-paper-200 py-2">
              <div className="text-lg font-serif font-bold text-ink-800 leading-tight">{s.count}</div>
              <div className="text-[10px] text-ink-700/55">记忆条数</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.seasons.map((v) => {
              const info = getSeasonInfo(v);
              return (
                <span key={v} className="scent-tag bg-ochre-100 text-ochre-600">{info.emoji} {info.label}</span>
              );
            })}
            {s.emotions.map((v) => {
              const info = getEmotionInfo(v);
              return (
                <span key={v} className={`scent-tag ${info.bg} ${info.text}`}>{info.emoji} {info.label}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
