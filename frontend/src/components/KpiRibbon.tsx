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
      <div className="tactile-debossed p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                  Card 1 • Financial Alpha
                </span>
                <h3 className="text-sm font-space font-bold text-white tracking-tight truncate">
                  Net Economic Outcome
                </h3>
              </div>
            </div>
            <span className="tactile-extruded text-[10px] font-mono font-medium px-2 py-0.5 rounded text-white shrink-0">
              20% Rubric
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1">
              <span>₹{kpis.optimized.net_revenue.toLocaleString('en-IN')}</span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-extruded text-white text-xs font-mono font-semibold max-w-full">
              <ArrowUpRight className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">
                +₹{kpis.deltas.net_revenue_gain.toLocaleString('en-IN')} vs. Baseline
              </span>
            </div>
          </div>
        </div>

        {/* Compact Mini-Ledger Footer with Stacked Clean Blocks */}
        <div className="mt-4 pt-3 border-t border-white/[0.04] bg-[#0a0c0f] -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between font-mono">
            <span>Optimized Financial Ledger</span>
            <span className="text-slate-500">P&L Audit</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="tactile-debossed p-1.5 rounded">
              <span className="text-[9px] text-slate-400 block font-mono truncate">Gross Revenue</span>
              <span className="font-mono font-bold text-white text-xs block truncate">
                ₹{kpis.optimized.gross_revenue.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="tactile-debossed p-1.5 rounded">
              <span className="text-[9px] text-slate-400 block font-mono truncate">Freight & Transit</span>
              <span className="font-mono font-bold text-slate-300 text-xs block truncate">
                -₹{kpis.optimized.transport_handling_cost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="tactile-debossed p-1.5 rounded">
              <span className="text-[9px] text-slate-400 block font-mono truncate">Markdown Invest.</span>
              <span className="font-mono font-bold text-slate-300 text-xs block truncate">
                -₹{kpis.optimized.discount_cost.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="tactile-debossed p-1.5 rounded">
              <span className="text-[9px] text-slate-400 block font-mono truncate">Spoilage Penalty</span>
              <span className="font-mono font-bold text-slate-300 text-xs block truncate">
                -₹{kpis.optimized.spoilage_cost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: Spoilage Reduction (20% Rubric Weight)
         ========================================================================= */}
      <div className="tactile-debossed p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                  Card 2 • Food Waste
                </span>
                <h3 className="text-sm font-space font-bold text-white tracking-tight truncate">
                  Spoilage Reduction
                </h3>
              </div>
            </div>
            <span className="tactile-extruded text-[10px] font-mono font-medium px-2 py-0.5 rounded text-white shrink-0">
              20% Rubric
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1.5">
              <span>{kpis.optimized.spoiled_kg.toFixed(0)} kg</span>
              <span className="text-base font-semibold text-slate-300 font-mono">
                ({kpis.optimized.spoilage_rate_pct.toFixed(1)}%)
              </span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-extruded text-white text-xs font-mono font-semibold max-w-full">
              <ShieldCheck className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">
                {kpis.deltas.spoilage_reduction_pct.toFixed(1)}% cut vs. FIFO ({kpis.baseline.spoiled_kg.toFixed(0)} kg)
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle referencing MoFPI NABCONS Benchmark */}
        <div className="mt-4 pt-3 border-t border-white/[0.04] bg-[#0a0c0f] -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="flex items-start gap-2 text-xs text-slate-300">
            <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <div className="leading-snug">
              <p className="font-medium text-slate-200 text-xs">
                MoFPI Benchmark (11.6%–15.1% loss)
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Baseline FIFO lost <span className="font-mono text-white font-semibold">{kpis.baseline.spoilage_rate_pct.toFixed(1)}%</span>. perishOpt MILP pre-prunes decay.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: Demand Fulfillment (15% Rubric Weight)
         ========================================================================= */}
      <div className="tactile-debossed p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                  Card 3 • APMC Supply
                </span>
                <h3 className="text-sm font-space font-bold text-white tracking-tight truncate">
                  Demand Fulfillment
                </h3>
              </div>
            </div>
            <span className="tactile-extruded text-[10px] font-mono font-medium px-2 py-0.5 rounded text-white shrink-0">
              15% Rubric
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-1">
              <span>{kpis.optimized.demand_fulfillment_pct.toFixed(1)}%</span>
            </div>

            {/* Delta Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-extruded text-white text-xs font-mono font-semibold max-w-full">
              <ArrowUpRight className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="truncate">
                +{kpis.deltas.demand_fulfillment_gain_pct.toFixed(1)}% vs. Baseline
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar & Baseline Comparison */}
        <div className="mt-4 pt-3 border-t border-white/[0.04] bg-[#0a0c0f] -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 font-mono text-[11px]">Mandi Market Absorption</span>
            <span className="font-mono text-white font-semibold">
              {kpis.optimized.demand_fulfillment_pct.toFixed(1)}% / 100%
            </span>
          </div>

          <div className="w-full tactile-slider-track rounded-full h-2 overflow-hidden p-0.5 relative">
            {/* Baseline indicator mark */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-400 z-10"
              style={{ left: `${Math.min(100, Math.max(0, kpis.baseline.demand_fulfillment_pct))}%` }}
              title={`Baseline: ${kpis.baseline.demand_fulfillment_pct.toFixed(1)}%`}
            />
            {/* Optimized Fill */}
            <div
              className="bg-white h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              style={{ width: `${Math.min(100, Math.max(0, kpis.optimized.demand_fulfillment_pct))}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
            <span>Baseline: <strong className="text-slate-300">{kpis.baseline.demand_fulfillment_pct.toFixed(1)}%</strong></span>
            <span className="text-white font-medium">High-Service SLA</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 4: Hard Constraint Compliance (15% Rubric Weight)
         ========================================================================= */}
      <div className="tactile-debossed p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
        <div>
          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                  Card 4 • Solver Audit
                </span>
                <h3 className="text-sm font-space font-bold text-white tracking-tight truncate">
                  Constraint Compliance
                </h3>
              </div>
            </div>
            <span className="tactile-extruded text-[10px] font-mono font-medium px-2 py-0.5 rounded text-white shrink-0">
              15% Rubric
            </span>
          </div>

          {/* Primary Metric */}
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight flex items-center gap-2 text-white">
              {allConstraintsPassed ? (
                <>
                  <span>100% Verified</span>
                  <CheckCircle2 className="w-5 h-5 text-white inline shrink-0" />
                </>
              ) : (
                <>
                  <span>{passedCount}/4 Verified</span>
                  <ShieldAlert className="w-5 h-5 text-slate-300 inline shrink-0" />
                </>
              )}
            </div>

            {/* Solver Status Badge */}
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-extruded text-white text-xs font-mono max-w-full">
              <span className="w-2 h-2 rounded-full bg-white pulsing-indicator shadow-[0_0_6px_#ffffff] shrink-0" />
              <span className="font-semibold text-white truncate">{status}</span>
              <span className="text-slate-400 shrink-0">in {solve_time_ms.toFixed(1)} ms</span>
            </div>
          </div>
        </div>

        {/* 4 Check Pills */}
        <div className="mt-4 pt-3 border-t border-white/[0.04] bg-[#0a0c0f] -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
            Mathematical Guarantees (HiGHS)
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium font-mono ${
                constraint_audit.mass_balance_passed
                  ? 'tactile-extruded text-white'
                  : 'bg-white/5 border border-white/20 text-slate-400'
              }`}
            >
              {constraint_audit.mass_balance_passed ? (
                <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
              )}
              <span className="truncate">Mass Balance</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium font-mono ${
                constraint_audit.capacity_limits_passed
                  ? 'tactile-extruded text-white'
                  : 'bg-white/5 border border-white/20 text-slate-400'
              }`}
            >
              {constraint_audit.capacity_limits_passed ? (
                <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
              )}
              <span className="truncate">Route Cap.</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium font-mono ${
                constraint_audit.shelf_life_limits_passed
                  ? 'tactile-extruded text-white'
                  : 'bg-white/5 border border-white/20 text-slate-400'
              }`}
            >
              {constraint_audit.shelf_life_limits_passed ? (
                <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
              )}
              <span className="truncate">Thermal RSL</span>
            </div>

            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium font-mono ${
                constraint_audit.demand_caps_passed
                  ? 'tactile-extruded text-white'
                  : 'bg-white/5 border border-white/20 text-slate-400'
              }`}
            >
              {constraint_audit.demand_caps_passed ? (
                <CheckCircle2 className="w-3 h-3 text-white shrink-0" />
              ) : (
                <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
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
