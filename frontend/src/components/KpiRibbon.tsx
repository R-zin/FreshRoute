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
          CARD 1: Net Economic Outcome
         ========================================================================= */}
      <div className="glass-panel p-5 rounded-xl flex flex-col justify-between hover:border-white/10 transition-all duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Net Economic Return
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Value Display */}
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
              ₹{kpis.optimized.net_revenue.toLocaleString('en-IN')}
            </div>

            {/* Delta Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>
                +₹{kpis.deltas.net_revenue_gain.toLocaleString('en-IN')} vs. FIFO
              </span>
            </div>
          </div>
        </div>

        {/* Minimalist P&L Breakdown */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg">
            <span className="text-slate-400 block text-[10px]">Gross Rev</span>
            <span className="font-semibold text-slate-200">
              ₹{(kpis.optimized.gross_revenue / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg">
            <span className="text-slate-400 block text-[10px]">Logistics</span>
            <span className="font-semibold text-slate-300">
              -₹{(kpis.optimized.transport_handling_cost / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg">
            <span className="text-slate-400 block text-[10px]">Markdowns</span>
            <span className="font-semibold text-amber-300/90">
              -₹{(kpis.optimized.discount_cost / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg">
            <span className="text-slate-400 block text-[10px]">Spoilage Cut</span>
            <span className="font-semibold text-emerald-400">
              ₹{kpis.optimized.spoilage_cost.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 2: Spoilage & Food Waste
         ========================================================================= */}
      <div className="glass-panel p-5 rounded-xl flex flex-col justify-between hover:border-white/10 transition-all duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Food Loss & Spoilage
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Leaf className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Value Display */}
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-baseline gap-2">
              <span>{kpis.optimized.spoiled_kg.toFixed(0)} kg</span>
              <span className="text-sm font-semibold text-emerald-400 font-mono">
                ({kpis.optimized.spoilage_rate_pct.toFixed(1)}%)
              </span>
            </div>

            {/* Delta Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>
                {kpis.deltas.spoilage_reduction_pct.toFixed(0)}% reduction vs. FIFO
              </span>
            </div>
          </div>
        </div>

        {/* Minimalist Benchmark Note */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
          <div className="space-y-0.5">
            <span className="text-[10px] text-slate-500 block uppercase font-mono">
              MoFPI National Benchmark
            </span>
            <span className="text-slate-300 font-mono text-[11px]">
              11.6%–15.1% loss (Baseline lost {kpis.baseline.spoilage_rate_pct.toFixed(1)}%)
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono font-medium shrink-0">
            Zero Waste
          </span>
        </div>
      </div>

      {/* =========================================================================
          CARD 3: Mandi Demand Fulfillment
         ========================================================================= */}
      <div className="glass-panel p-5 rounded-xl flex flex-col justify-between hover:border-white/10 transition-all duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              APMC Demand Fulfillment
            </span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Value Display */}
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white">
              {kpis.optimized.demand_fulfillment_pct.toFixed(1)}%
            </div>

            {/* Delta Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-mono font-medium">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span>
                +{kpis.deltas.demand_fulfillment_gain_pct.toFixed(1)}% vs. FIFO
              </span>
            </div>
          </div>
        </div>

        {/* Minimalist Progress Meter */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Market Absorption</span>
            <span className="text-slate-200 font-medium">
              Baseline: {kpis.baseline.demand_fulfillment_pct.toFixed(1)}%
            </span>
          </div>

          <div className="w-full bg-[#141824] rounded-full h-2 overflow-hidden relative border border-white/[0.05]">
            {/* Baseline marker line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-slate-500 z-10"
              style={{ left: `${Math.min(100, Math.max(0, kpis.baseline.demand_fulfillment_pct))}%` }}
              title={`Baseline: ${kpis.baseline.demand_fulfillment_pct.toFixed(1)}%`}
            />
            {/* Optimized Fill */}
            <div
              className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, kpis.optimized.demand_fulfillment_pct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* =========================================================================
          CARD 4: Constraint Compliance & Solver Audit
         ========================================================================= */}
      <div className="glass-panel p-5 rounded-xl flex flex-col justify-between hover:border-white/10 transition-all duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              MILP Physical Guarantees
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Value Display */}
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-white flex items-center gap-2">
              {allConstraintsPassed ? (
                <>
                  <span>100% Compliant</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 inline shrink-0" />
                </>
              ) : (
                <>
                  <span>{passedCount}/4 Verified</span>
                  <ShieldAlert className="w-5 h-5 text-amber-400 inline shrink-0" />
                </>
              )}
            </div>

            {/* Solver Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981] shrink-0" />
              <span className="font-semibold text-white">{status}</span>
              <span className="text-slate-400">in {solve_time_ms.toFixed(1)}ms</span>
            </div>
          </div>
        </div>

        {/* 4 Clean Status Chips */}
        <div className="mt-4 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              constraint_audit.mass_balance_passed
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}
          >
            {constraint_audit.mass_balance_passed ? (
              <CheckCircle2 className="w-3 h-3 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">Mass Balance</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              constraint_audit.capacity_limits_passed
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}
          >
            {constraint_audit.capacity_limits_passed ? (
              <CheckCircle2 className="w-3 h-3 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">Route Capacity</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              constraint_audit.shelf_life_limits_passed
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}
          >
            {constraint_audit.shelf_life_limits_passed ? (
              <CheckCircle2 className="w-3 h-3 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">Thermal RSL</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
              constraint_audit.demand_caps_passed
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/5 border-rose-500/20 text-rose-400'
            }`}
          >
            {constraint_audit.demand_caps_passed ? (
              <CheckCircle2 className="w-3 h-3 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">Demand Caps</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiRibbon;
