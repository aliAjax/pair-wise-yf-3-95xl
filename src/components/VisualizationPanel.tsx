import type { SmellMemory } from '../utils/constants';
import IntensityChart from './visualization/IntensityChart';
import AvgGauge from './visualization/AvgGauge';
import HumidityScatter from './visualization/HumidityScatter';
import TopList from './visualization/TopList';

interface Props {
  memories: SmellMemory[];
  reviewedIds: Set<string>;
  onSelect: (id: string) => void;
}

export default function VisualizationPanel({ memories, reviewedIds, onSelect }: Props) {
  if (memories.length === 0) return null;

  return (
    <section className="container max-w-6xl mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-hand text-2xl text-ochre-600">气味观测</span>
        <span className="text-xs text-ink-700/50">· 基于当前筛选结果</span>
        <span className="inline-flex items-center gap-1 text-xs text-moss-600 ml-1">
          <span className="w-2.5 h-2.5 rounded-full bg-moss-500 ring-2 ring-moss-200" />
          已复核
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        <IntensityChart memories={memories} />
        <AvgGauge memories={memories} />
        <HumidityScatter memories={memories} reviewedIds={reviewedIds} />
        <TopList memories={memories} reviewedIds={reviewedIds} onSelect={onSelect} />
      </div>
    </section>
  );
}
