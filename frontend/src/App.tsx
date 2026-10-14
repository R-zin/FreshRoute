import React, { useEffect, useState, useCallback } from 'react';
import { OptimizeResponse, DisruptionOverrides, ORIGIN_HUB } from './types/api';
import { fetchDefaultScenario, postOptimize } from './api/client';
import { KpiRibbon, DisruptionControls, DispatchTable } from './components';
import { Radio, MapPin } from 'lucide-react';

export default function App(): React.ReactElement {
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSolving, setIsSolving] = useState<boolean>(false);

  // Initial load of scenario data
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

  // Handle disruption slider & preset changes
  const handleDisruptionsChange = useCallback(
    async (nextDisruptions: DisruptionOverrides) => {
      if (!data) return;

      // Optimistically update disruption state immediately for snappy slider feedback
      setData((prev) => (prev ? { ...prev, disruptions: nextDisruptions } : null));
      setIsSolving(true);

      try {
        const result = await postOptimize({
          batches: data.batches,
          markets: data.markets,
          disruptions: nextDisruptions,
        });

        setData(result.data);
        setIsLive(result.isLive);
      } catch (err) {
        console.error('Optimization error:', err);
      } finally {
        setIsSolving(false);
      }
    },
    [data]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white font-extrabold text-xl tracking-tighter ring-1 ring-emerald-400/30">
            FR
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              FreshRoute OS{' '}
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                PS 03
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Dynamic Perishable Produce Cold-Chain & Markdown Optimizer
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-slate-800/90 border-slate-700/80 shadow-inner">
            <Radio
              className={`w-3.5 h-3.5 ${
                isLive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
              }`}
            />
            <span className={isLive ? 'text-emerald-300' : 'text-amber-300'}>
              {isLive
                ? 'FastAPI MILP Engine Live (Port 8000)'
                : 'Offline Client Simulation (HiGHS Fallback)'}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium text-slate-300">{ORIGIN_HUB.name}</span>
          </div>
        </div>
      </header>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
            <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20" />
            <p className="text-sm font-medium animate-pulse">
              Initializing FreshRoute Cold-Chain Intelligence Engine...
            </p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* 1. Executive KPI Ribbon (4 Cards) */}
            <section aria-label="Executive KPI Overview">
              <KpiRibbon response={data} />
            </section>

            {/* 2. Disruption & Stress-Testing Controls */}
            <section aria-label="Cold-Chain Disruption Stress Testing">
              <DisruptionControls
                disruptions={data.disruptions}
                onChange={handleDisruptionsChange}
                isSolving={isSolving}
              />
            </section>

            {/* 3. Dispatch & Allocation Plan Table with Baseline Comparison */}
            <section aria-label="Optimized Dispatch Plan & Audit">
              <DispatchTable response={data} />
            </section>
          </div>
        ) : (
          <div className="text-center py-24 text-rose-400 bg-slate-900/60 rounded-2xl border border-rose-900/50 p-8">
            <p className="text-base font-semibold">Failed to load scenario data.</p>
            <p className="text-xs text-slate-400 mt-1">
              Please ensure Vite and mock fallback data are correctly configured.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
            >
              Reload System
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>FreshRoute OS (PS 03) • Mathematical Cold-Chain Optimization</span>
        </div>
        <div>
          <span>Based on MoFPI NABCONS Cold-Chain Standards & Arrhenius Decay ($Q_{10}=2.0$)</span>
        </div>
      </footer>
    </div>
  );
}
