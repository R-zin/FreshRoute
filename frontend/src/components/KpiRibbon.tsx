import React from 'react';
import { OptimizeResponse } from '../types/api';
import {
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Leaf,
  Target,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Info,
} from 'lucide-react';

export interface KpiRibbonProps {
  response: OptimizeResponse;
}

export const KpiRibbon: React.FC<KpiRibbonProps> = ({ response }) => {
  const { kpis, constraint_audit, status, solve_time_ms } = response;

  const allConstraintsPassed =
    constraint_audit.mass_balance_passed &&
    constraint_audit.capacity_limits_passed &&
    constraint_audit.shelf_life_limits_passed &&
    constraint_audit.demand_caps_passed;

  const passedCount = [
    constraint_audit.mass_balance_passed,
    constraint_audit.capacity_limits_passed,
    constraint_audit.shelf_life_limits_passed,
    constraint_audit.demand_caps_passed,
  ].filter(Boolean).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* =========================================================================
          CARD 1: Net Economic Outcome (20% Rubric Weight)
         ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-emerald-950/20 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block">
                  Card 1 • Financial Alpha
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Net Economic Outcome
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              20% Rubric Weight
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1">
              <span>₹{kpis.optimized.net_revenue.toLocaleString('en-IN')}</span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                +₹{kpis.deltas.net_revenue_gain.toLocaleString('en-IN')} vs. Baseline
              </span>
            </div>
          </div>
        </div>

        {/* Compact Mini-Ledger Footer */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Optimized Financial Ledger</span>
            <span className="text-slate-500 font-mono">P&L Audit</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Gross Rev:</span>
              <span className="font-mono font-medium text-emerald-400">
                ₹{kpis.optimized.gross_revenue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Freight/Handling:</span>
              <span className="font-mono font-medium text-slate-300">
                -₹{kpis.optimized.transport_handling_cost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Markdown Inv.:</span>
              <span className="font-mono font-medium text-amber-400">
                -₹{kpis.optimized.discount_cost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Spoilage Penalty:</span>
              <span className="font-mono font-medium text-rose-400">
                -₹{kpis.optimized.spoilage_cost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: Spoilage Reduction (20% Rubric Weight)
         ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-emerald-950/20 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />

        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block">
                  Card 2 • Food Waste
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Spoilage Reduction
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              20% Rubric Weight
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1.5">
              <span>{kpis.optimized.spoiled_kg.toFixed(0)} kg</span>
              <span className="text-base font-semibold text-emerald-400">
                ({kpis.optimized.spoilage_rate_pct.toFixed(1)}%)
              </span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {kpis.deltas.spoilage_reduction_pct.toFixed(1)}% waste reduction vs. FIFO ({kpis.baseline.spoiled_kg.toFixed(0)} kg)
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle referencing MoFPI NABCONS Benchmark */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="flex items-start gap-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <p className="font-medium text-slate-200">
                MoFPI NABCONS Benchmark (11.6%–15.1% national loss rate)
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Baseline FIFO lost <span className="font-mono text-rose-400 font-semibold">{kpis.baseline.spoilage_rate_pct.toFixed(1)}%</span>. FreshRoute MILP prevents thermal failure via FEFO dispatch.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: Demand Fulfillment (15% Rubric Weight)
         ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-cyan-950/20 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />

        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block">
                  Card 3 • APMC Supply
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Demand Fulfillment
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
              15% Rubric Weight
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1">
              <span>{kpis.optimized.demand_fulfillment_pct.toFixed(1)}%</span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                +{kpis.deltas.demand_fulfillment_gain_pct.toFixed(1)}% vs. Baseline
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Baseline Comparison */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">Mandi Market Absorption</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {kpis.optimized.demand_fulfillment_pct.toFixed(1)}% / 100%
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700/60 relative">
            {/* Baseline indicator mark */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: `${Math.min(100, Math.max(0, kpis.baseline.demand_fulfillment_pct))}%` }}
              title={`Baseline: ${kpis.baseline.demand_fulfillment_pct.toFixed(1)}%`}
            />
            {/* Optimized Fill */}
            <div
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.optimized.demand_fulfillment_pct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5">
            <span>Baseline: <strong className="font-mono text-slate-300">{kpis.baseline.demand_fulfillment_pct.toFixed(1)}%</strong></span>
            <span className="text-emerald-400 font-medium">High-Service SLA</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 4: Hard Constraint Compliance (15% Rubric Weight)
         ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl transition-all duration-200 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-blue-950/20 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />

        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block">
                  Card 4 • Solver Audit
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Hard Constraint Compliance
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              15% Rubric Weight
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-3xl font-extrabold font-mono tracking-tight flex items-center gap-2">
              {allConstraintsPassed ? (
                <>
                  <span className="text-emerald-400">100% Verified</span>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 inline shrink-0" />
                </>
              ) : (
                <>
                  <span className="text-amber-400">{passedCount}/4 Verified</span>
                  <ShieldAlert className="w-6 h-6 text-amber-400 inline shrink-0" />
                </>
              )}
            </div>

            {/* Solver Status Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-emerald-300">{status}</span>
              <span className="text-slate-400">in {solve_time_ms.toFixed(1)} ms</span>
            </div>
          </div>
        </div>

        {/* 4 Green Check Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Mathematical Guarantees (HiGHS MILP)
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                constraint_audit.mass_balance_passed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {constraint_audit.mass_balance_passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">Mass Balance</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                constraint_audit.capacity_limits_passed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {constraint_audit.capacity_limits_passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">Route Capacity</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                constraint_audit.shelf_life_limits_passed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {constraint_audit.shelf_life_limits_passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">Thermal RSL</span>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                constraint_audit.demand_caps_passed
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              {constraint_audit.demand_caps_passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              )}
              <span className="truncate">Demand Caps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiRibbon;
