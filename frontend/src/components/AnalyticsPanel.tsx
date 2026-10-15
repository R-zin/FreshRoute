import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart,
} from 'recharts';
import { OptimizeResponse } from '../types/api';
import {
  BarChart3,
  Activity,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

export interface AnalyticsPanelProps {
  response: OptimizeResponse;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

const CostModelCustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    const baselineVal = payload.find((p) => p.dataKey === 'baseline')?.value ?? 0;
    const perishOptVal = payload.find((p) => p.dataKey === 'perishopt')?.value ?? 0;
    const diff = perishOptVal - baselineVal;

    return (
      <div className="bg-[#0f1219]/95 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs shadow-xl min-w-[200px] space-y-1.5">
        <div className="font-bold text-white border-b border-white/[0.08] pb-1 font-space">
          {label}
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-slate-500" />
              <span>Baseline FIFO:</span>
            </span>
            <span className="text-slate-300 font-medium">
              ₹{baselineVal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-emerald-400" />
              <span>perishOpt MILP:</span>
            </span>
            <span className="font-bold text-white">
              ₹{perishOptVal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Net Delta:</span>
            <span className={`font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {diff >= 0 ? '+' : ''}₹{diff.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const MonteCarloCustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (active && payload && payload.length) {
    const pRev = payload.find((p) => p.dataKey === 'freshroute_net_rev')?.value ?? 0;
    const bRev = payload.find((p) => p.dataKey === 'baseline_net_rev')?.value ?? 0;
    const alpha = pRev - bRev;

    return (
      <div className="bg-[#0f1219]/95 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs shadow-xl min-w-[220px] space-y-1.5">
        <div className="font-bold text-white border-b border-white/[0.08] pb-1 font-space flex items-center justify-between">
          <span>Simulation #{label}</span>
          <span className="text-[10px] text-emerald-400 font-mono">±20% Noise</span>
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between text-emerald-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span>perishOpt Net:</span>
            </span>
            <span className="font-bold text-white">
              ₹{pRev.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Baseline Net:</span>
            </span>
            <span className="font-medium text-slate-300">
              ₹{bRev.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Resilience Alpha:</span>
            <span className="font-bold text-emerald-400">
              +₹{alpha.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ response }) => {
  const { kpis, monte_carlo_summary } = response;

  // Chart 1: Shared Economic Cost Model Data
  const costModelData = useMemo(() => {
    return [
      {
        metric: 'Gross Rev',
        fullName: 'Gross Revenue',
        baseline: kpis.baseline.gross_revenue,
        perishopt: kpis.optimized.gross_revenue,
      },
      {
        metric: 'Freight',
        fullName: 'Transport Cost',
        baseline: kpis.baseline.transport_handling_cost,
        perishopt: kpis.optimized.transport_handling_cost,
      },
      {
        metric: 'Markdowns',
        fullName: 'Markdown Investment',
        baseline: kpis.baseline.discount_cost,
        perishopt: kpis.optimized.discount_cost,
      },
      {
        metric: 'Spoilage',
        fullName: 'Spoilage Loss Penalty',
        baseline: kpis.baseline.spoilage_cost,
        perishopt: kpis.optimized.spoilage_cost,
      },
      {
        metric: 'Net Outcome',
        fullName: 'Net Economic Outcome',
        baseline: kpis.baseline.net_revenue,
        perishopt: kpis.optimized.net_revenue,
      },
    ];
  }, [kpis]);

  // Monte Carlo summary statistics
  const mcStats = useMemo(() => {
    if (!monte_carlo_summary || monte_carlo_summary.length === 0) {
      return { avgBaseline: 0, avgPerishopt: 0, winRatePct: 100, avgGain: 0 };
    }

    const totalRuns = monte_carlo_summary.length;
    const wins = monte_carlo_summary.filter(
      (r) => r.freshroute_net_rev > r.baseline_net_rev
    ).length;
    const avgBaseline =
      monte_carlo_summary.reduce((s, r) => s + r.baseline_net_rev, 0) / totalRuns;
    const avgPerishopt =
      monte_carlo_summary.reduce((s, r) => s + r.freshroute_net_rev, 0) / totalRuns;

    return {
      avgBaseline,
      avgPerishopt,
      winRatePct: (wins / totalRuns) * 100,
      avgGain: avgPerishopt - avgBaseline,
    };
  }, [monte_carlo_summary]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* =========================================================================
          CHART 1 (Left): Economic Cost Model Comparison
         ========================================================================= */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-space font-bold text-white tracking-tight">
                  Economic P&L Audit
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Naive FIFO Baseline vs. perishOpt MILP
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-medium self-start sm:self-auto">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+₹{kpis.deltas.net_revenue_gain.toLocaleString('en-IN')} Alpha</span>
            </div>
          </div>

          {/* Quick Stats Pill Row */}
          <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs font-mono">
            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Baseline Net</span>
              <span className="font-bold text-slate-300">
                ₹{(kpis.baseline.net_revenue / 1000).toFixed(0)}k
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">perishOpt Net</span>
              <span className="font-bold text-emerald-400">
                ₹{(kpis.optimized.net_revenue / 1000).toFixed(0)}k
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Waste Saved</span>
              <span className="font-bold text-emerald-400">
                ₹{((kpis.baseline.spoilage_cost - kpis.optimized.spoilage_cost) / 1000).toFixed(0)}k
              </span>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="w-full h-[260px] sm:h-[280px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={costModelData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="metric"
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  interval={0}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CostModelCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                  formatter={(value) => (
                    <span className="text-slate-300 font-medium">
                      {value === 'baseline' ? 'Baseline FIFO' : 'perishOpt MILP'}
                    </span>
                  )}
                />
                <Bar
                  dataKey="baseline"
                  name="baseline"
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="perishopt"
                  name="perishopt"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>Dynamic markdowns clear perishable volume before Arrhenius spoilage decay.</span>
          <span className="text-slate-500 text-[10px]">P&L Audit</span>
        </div>
      </div>

      {/* =========================================================================
          CHART 2 (Right): Monte Carlo Robustness (30 Runs)
         ========================================================================= */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-space font-bold text-white tracking-tight">
                  30-Run Monte Carlo Resilience
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Stochastic trials with ±20% transit delay & ±15% thermal noise
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-medium self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{mcStats.winRatePct.toFixed(0)}% Dominance Rate</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs font-mono">
            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Mean Baseline Net</span>
              <span className="font-bold text-slate-300">
                ₹{Math.round(mcStats.avgBaseline / 1000).toFixed(0)}k
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Mean perishOpt Net</span>
              <span className="font-bold text-emerald-400">
                ₹{Math.round(mcStats.avgPerishopt / 1000).toFixed(0)}k
              </span>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] p-2 rounded-lg">
              <span className="text-[10px] text-slate-400 block">Average Alpha</span>
              <span className="font-bold text-emerald-400">
                +₹{Math.round(mcStats.avgGain / 1000).toFixed(0)}k
              </span>
            </div>
          </div>

          {/* Monte Carlo Line/Area Chart */}
          <div className="w-full h-[260px] sm:h-[280px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monte_carlo_summary}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="sim_id"
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  label={{
                    value: 'Stochastic Trials (1 to 30)',
                    position: 'insideBottom',
                    offset: -10,
                    fill: '#64748b',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <YAxis
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<MonteCarloCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '8px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                  formatter={(value) => (
                    <span className="text-slate-300 font-medium">
                      {value === 'freshroute_net_rev'
                        ? 'perishOpt MILP'
                        : 'Baseline FIFO'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="freshroute_net_rev"
                  fill="url(#emeraldArea)"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="freshroute_net_rev"
                  dot={{ r: 2, fill: '#10b981' }}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline_net_rev"
                  stroke="#64748b"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  name="baseline_net_rev"
                  dot={{ r: 1.5, fill: '#64748b' }}
                  activeDot={{ r: 3, fill: '#94a3b8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-2.5 border-t border-white/[0.06] text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span>perishOpt preserves profitability even under harsh multi-factor disruptions.</span>
          <span className="text-slate-500 text-[10px]">30 Runs Evaluated</span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
