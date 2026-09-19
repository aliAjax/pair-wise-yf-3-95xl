import { CheckCircle2, ShieldBan, X } from 'lucide-react';
import { MIN_REVIEW_COUNT, MAX_REVIEW_COUNT } from '../utils/constants';
import type { ReviewRejectReason } from '../utils/helpers';

interface Props {
  selectedCount: number;
  rejectReason: ReviewRejectReason | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export default function ReviewToolbar({ selectedCount, rejectReason, onSubmit, onCancel }: Props) {
  const canSubmit = selectedCount >= MIN_REVIEW_COUNT && selectedCount <= MAX_REVIEW_COUNT;

  return (
    <div className="sticky bottom-4 z-30 container max-w-6xl">
      <div className="bg-paper-50/95 backdrop-blur rounded-2xl border border-moss-300 shadow-paper-hover px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-serif font-bold text-sm ${
              canSubmit ? 'bg-moss-500 text-paper-50' : 'bg-paper-200 text-ink-700/60'
            }`}>
              {selectedCount}
            </span>
            <span className="text-ink-800 font-medium">
              已勾选 {selectedCount} 条
            </span>
            <span className="text-xs text-ink-700/50">
              （需 {MIN_REVIEW_COUNT}～{MAX_REVIEW_COUNT} 条 · 地点相同 · 气味类型一致 · 强度差不超过三档）
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="btn-ghost text-sm px-3 py-2">
              <X className="w-4 h-4 mr-1" /> 取消
            </button>
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                canSubmit
                  ? 'bg-moss-500 hover:bg-moss-600 text-paper-50 shadow-paper hover:-translate-y-0.5'
                  : 'bg-paper-200/70 text-ink-700/40 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" /> 封存复核
            </button>
          </div>
        </div>
        {rejectReason && (
          <div className="flex items-start gap-2 text-xs text-brick-600 bg-brick-500/10 border border-brick-500/25 rounded-xl px-3 py-2">
            <ShieldBan className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{rejectReason.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
