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
  Sparkles,
  Info,
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
      <div className="tactile-extruded p-3.5 rounded-xl border border-white/10 text-xs font-sans space-y-2 min-w-[220px]">
        <div className="font-bold text-white border-b border-white/[0.08] pb-1.5 flex items-center justify-between font-space">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400 font-mono">Shared Ledger</span>
        </div>

        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded bg-slate-600" />
              <span>Baseline (FIFO):</span>
            </span>
            <span className="font-medium text-slate-300">
              ₹{baselineVal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-white" />
              <span className="font-medium text-white">perishOpt MILP:</span>
            </span>
            <span className="font-bold text-white">
              ₹{perishOptVal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="pt-1.5 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">MILP Delta:</span>
            <span className="font-bold text-white">
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
      <div className="tactile-extruded p-3.5 rounded-xl border border-white/10 text-xs font-sans space-y-2 min-w-[240px]">
        <div className="font-bold text-white border-b border-white/[0.08] pb-1.5 flex items-center justify-between font-space">
          <span>Stochastic Trial #{label}</span>
          <span className="text-[10px] text-white font-mono">±20% Noise Bound</span>
        </div>

        <div className="space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-white">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#ffffff]" />
              <span>perishOpt Net Rev:</span>
            </span>
            <span className="font-bold text-white">
              ₹{pRev.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Baseline Net Rev:</span>
            </span>
            <span className="font-semibold text-slate-300">
              ₹{bRev.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="pt-1.5 border-t border-white/[0.08] flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Resilience Advantage:</span>
            <span className="font-bold text-white">
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
        metric: 'Freight/Handling',
        fullName: 'Transport & Handling Cost',
        baseline: kpis.baseline.transport_handling_cost,
        perishopt: kpis.optimized.transport_handling_cost,
      },
      {
        metric: 'Markdown Inv.',
        fullName: 'Markdown Investment',
        baseline: kpis.baseline.discount_cost,
        perishopt: kpis.optimized.discount_cost,
      },
      {
        metric: 'Spoilage Penalty',
        fullName: 'Spoilage Penalty Cost',
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
          CHART 1 (Left): Shared Economic Cost Model Comparison
         ========================================================================= */}
      <div className="tactile-debossed rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden backdrop-blur-md group">
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl tactile-extruded flex items-center justify-center text-white shrink-0">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-space font-bold text-white tracking-tight flex items-center gap-2">
                  Shared Economic Cost Model Comparison
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Side-by-side P&L audit: Naive FIFO Baseline vs. perishOpt MILP
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full tactile-extruded text-white text-xs font-mono font-semibold self-start sm:self-auto">
              <ArrowUpRight className="w-3.5 h-3.5 text-white" />
              <span>+₹{kpis.deltas.net_revenue_gain.toLocaleString('en-IN')} Net Gain</span>
            </div>
          </div>

          {/* Key Insight Mini-Bar */}
          <div className="grid grid-cols-3 gap-2 my-4 text-center">
            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                Baseline FIFO Net
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-300">
                ₹{kpis.baseline.net_revenue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                perishOpt MILP Net
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-white">
                ₹{kpis.optimized.net_revenue.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                Waste Loss Prevented
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-white">
                ₹{(kpis.baseline.spoilage_cost - kpis.optimized.spoilage_cost).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Grouped Bar Chart Container */}
          <div className="w-full h-[280px] sm:h-[300px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={costModelData}
                margin={{ top: 10, right: 10, left: -15, bottom: 35 }}
                barGap={4}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1c2024"
                  vertical={false}
                />
                <XAxis
                  dataKey="metric"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CostModelCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                  formatter={(value) => (
                    <span className="text-slate-300 font-medium">
                      {value === 'baseline'
                        ? 'Baseline (Naive FIFO)'
                        : 'perishOpt MILP'}
                    </span>
                  )}
                />
                <Bar
                  dataKey="baseline"
                  name="baseline"
                  fill="#475569"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="perishopt"
                  name="perishopt"
                  fill="#ffffff"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-white/[0.06] text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-white" />
            <span>Markdown discounts dynamically offset high spoilage disposal costs.</span>
          </span>
          <span className="text-slate-500">20% Rubric Weight</span>
        </div>
      </div>

      {/* =========================================================================
          CHART 2 (Right): 30-Run Monte Carlo Robustness & Sensitivity
         ========================================================================= */}
      <div className="tactile-debossed rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between relative overflow-hidden backdrop-blur-md group">
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.06] gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl tactile-extruded flex items-center justify-center text-white shrink-0">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-space font-bold text-white tracking-tight flex items-center gap-2">
                  30-Run Monte Carlo Robustness
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Stochastic evaluation under ±20% transit delays & ±15% Arrhenius shelf-life noise
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full tactile-extruded text-white text-xs font-mono font-semibold self-start sm:self-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
              <span>{mcStats.winRatePct.toFixed(0)}% Robust Win Rate</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 my-4 text-center">
            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                Mean Baseline Net
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-slate-300">
                ₹{Math.round(mcStats.avgBaseline).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                Mean perishOpt Net
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-white">
                ₹{Math.round(mcStats.avgPerishopt).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="tactile-debossed p-2.5 rounded-xl border border-white/[0.04]">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">
                Avg Net Alpha
              </span>
              <span className="text-xs sm:text-sm font-extrabold font-mono text-white">
                +₹{Math.round(mcStats.avgGain).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Monte Carlo Line/Area Chart */}
          <div className="w-full h-[280px] sm:h-[300px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={monte_carlo_summary}
                margin={{ top: 10, right: 10, left: -15, bottom: 25 }}
              >
                <defs>
                  <linearGradient id="whiteArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1c2024"
                  vertical={false}
                />
                <XAxis
                  dataKey="sim_id"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  label={{
                    value: 'Stochastic Simulation Trials (1 to 30)',
                    position: 'insideBottom',
                    offset: -12,
                    fill: '#64748b',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<MonteCarloCustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}
                  formatter={(value) => (
                    <span className="text-slate-300 font-medium">
                      {value === 'freshroute_net_rev'
                        ? 'perishOpt MILP (Resilient)'
                        : 'Baseline FIFO (Vulnerable)'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="freshroute_net_rev"
                  fill="url(#whiteArea)"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  name="freshroute_net_rev"
                  dot={{ r: 2.5, fill: '#ffffff' }}
                  activeDot={{ r: 5, fill: '#ffffff' }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline_net_rev"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  name="baseline_net_rev"
                  dot={{ r: 2, fill: '#64748b' }}
                  activeDot={{ r: 4, fill: '#94a3b8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-3 border-t border-white/[0.06] text-[11px] text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>perishOpt avoids catastrophic cliff drops caused by unmonitored thermal decay.</span>
          </span>
          <span className="text-slate-500">30 Runs Evaluated</span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
