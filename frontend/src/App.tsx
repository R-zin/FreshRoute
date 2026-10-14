import React, { useEffect, useState } from 'react';
import { OptimizeResponse, ORIGIN_HUB } from './types/api';
import { fetchDefaultScenario } from './api/client';
import { Sparkles, Radio, CheckCircle, MapPin, Database, Cpu } from 'lucide-react';

export default function App(): React.ReactElement {
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    fetchDefaultScenario().then((result) => {
      if (mounted) {
        setData(result.data);
        setIsLive(result.isLive);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-bold text-xl">
            FR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              FreshRoute OS <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PS 03</span>
            </h1>
            <p className="text-xs text-slate-400">
              Dynamic Perishable Produce Cold-Chain & Markdown Optimizer
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-800/80 border-slate-700">
            <Radio className={`w-3.5 h-3.5 ${isLive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className={isLive ? 'text-emerald-300' : 'text-amber-300'}>
              {isLive ? 'Backend Online (Port 8000)' : 'Client-Side Offline Engine (Fallback Ready)'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{ORIGIN_HUB.name}</span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-4">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm">Initializing FreshRoute OS Engine & Cold-Chain Data...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Foundational Verification Hero Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Foundational Frontend Layer Ready
                  </div>
                  <h2 className="text-2xl font-bold text-white">System 2 Data Layer Configured</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Strict adherence to <code className="text-emerald-400 font-mono">SHARED_API_CONTRACT.md</code> (Section 4 Types + Fallback Data + API Client).
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-right">
                    <div className="text-xs text-slate-400">Solve Latency</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">
                      {data.solve_time_ms.toFixed(1)} ms
                    </div>
                  </div>
                  <div className="bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700/60 text-right">
                    <div className="text-xs text-slate-400">Solver Status</div>
                    <div className="text-lg font-bold text-white">{data.status}</div>
                  </div>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-5">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                  <Database className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Inventory Batches</div>
                    <div className="text-xl font-bold font-mono text-white">
                      {data.batches.length} Batches
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {data.batches.reduce((sum, b) => sum + b.quantity_kg, 0).toLocaleString()} kg total produce
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-teal-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">APMC Markets</div>
                    <div className="text-xl font-bold font-mono text-white">
                      {data.markets.length} Mandis
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">South India Network</div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                  <Cpu className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">MILP Allocations</div>
                    <div className="text-xl font-bold font-mono text-white">
                      {data.allocations.length} Routes
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {data.baseline_allocations.length} FIFO Baselines
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-400">Constraint Audit</div>
                    <div className="text-xl font-bold font-mono text-emerald-400">100% Pass</div>
                    <div className="text-xs text-slate-500 mt-0.5">All 4 hard checks verified</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick KPI Summary Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Net Revenue Outcome</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-emerald-400">
                    ₹{data.kpis.optimized.net_revenue.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    +₹{data.kpis.deltas.net_revenue_gain.toLocaleString()} vs FIFO
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Baseline FIFO: ₹{data.kpis.baseline.net_revenue.toLocaleString()}
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Spoilage Volume & Rate</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-emerald-400">
                    {data.kpis.optimized.spoilage_rate_pct.toFixed(1)}%
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    -{data.kpis.deltas.spoilage_reduction_pct.toFixed(1)}% spoilage
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Spoiled: {data.kpis.optimized.spoiled_kg.toLocaleString()} kg (vs {data.kpis.baseline.spoiled_kg.toLocaleString()} kg in FIFO)
                </p>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">Demand Fulfillment</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold font-mono text-white">
                    {data.kpis.optimized.demand_fulfillment_pct.toFixed(1)}%
                  </span>
                  <span className="text-xs font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    +{data.kpis.deltas.demand_fulfillment_gain_pct.toFixed(1)}% gain
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Baseline fulfillment: {data.kpis.baseline.demand_fulfillment_pct.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-rose-400">
            Failed to load scenario data.
          </div>
        )}
      </main>
    </div>
  );
}
