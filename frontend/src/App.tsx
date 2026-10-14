import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  OptimizeResponse,
  DisruptionOverrides,
  ORIGIN_HUB,
} from './types/api';
import { fetchDefaultScenario, postOptimize } from './api/client';
import {
  KpiRibbon,
  DisruptionControls,
  RouteMap,
  AnalyticsPanel,
  DispatchTable,
  DatasetUploader,
} from './components';
import {
  Radio,
  MapPin,
  UploadCloud,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

export default function App(): React.ReactElement {
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [showUploader, setShowUploader] = useState<boolean>(false);

  // Local disruptions state for instantaneous slider drag feedback
  const [activeDisruptions, setActiveDisruptions] = useState<DisruptionOverrides | null>(null);

  // Ref to track if the disruption change originated from user slider interaction
  const isUserSliderActionRef = useRef<boolean>(false);

  // Initial load of scenario data
  useEffect(() => {
    let mounted = true;
    fetchDefaultScenario().then((result) => {
      if (mounted) {
        setData(result.data);
        setActiveDisruptions(result.data.disruptions);
        setIsLive(result.isLive);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 200ms Debounced Optimization when disruption sliders or presets change
  useEffect(() => {
    if (!activeDisruptions || !data || !isUserSliderActionRef.current) {
      return;
    }

    setIsSolving(true);
    const handler = setTimeout(async () => {
      try {
        const result = await postOptimize({
          batches: data.batches,
          markets: data.markets,
          disruptions: activeDisruptions,
        });

        setData(result.data);
        setIsLive(result.isLive);
      } catch (err) {
        console.error('Debounced optimization call failed:', err);
      } finally {
        setIsSolving(false);
        isUserSliderActionRef.current = false;
      }
    }, 200);

    return () => {
      clearTimeout(handler);
    };
  }, [activeDisruptions, data?.batches, data?.markets]);

  // Handler when user moves sliders or clicks a preset
  const handleDisruptionsChange = useCallback(
    (nextDisruptions: DisruptionOverrides) => {
      isUserSliderActionRef.current = true;
      setActiveDisruptions(nextDisruptions);
    },
    []
  );

  // Reset to default scenario
  const handleResetScenario = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDefaultScenario();
      setData(result.data);
      setActiveDisruptions(result.data.disruptions);
      setIsLive(result.isLive);
      setShowUploader(false);
    } catch (err) {
      console.error('Failed to reset default scenario:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle successful dataset upload by judges
  const handleUploadSuccess = useCallback(
    (uploadedData: OptimizeResponse, live: boolean) => {
      setData(uploadedData);
      setActiveDisruptions(uploadedData.disruptions);
      setIsLive(live);
    },
    []
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION HEADER
         ========================================================================= */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3 self-start md:self-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white font-extrabold text-xl tracking-tighter ring-1 ring-emerald-400/30 shrink-0">
              FR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  FreshRoute OS
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-medium">
                  PS 03
                </span>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  MoFPI NABCONS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dynamic Perishable Produce Cold-Chain & Markdown Optimizer
              </p>
            </div>
          </div>

          {/* Center/Right Status Indicators & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-end md:self-auto">
            {/* Live Solver Connection Indicator Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-inner ${
                isLive
                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/30 text-amber-300'
              }`}
              title={
                isLive
                  ? 'Connected directly to FastAPI SciPy HiGHS backend solver'
                  : 'Running in self-contained client-side mathematical simulation mode'
              }
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  isLive ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                }`}
              />
              <span className="font-mono text-[11px]">
                {isLive
                  ? 'Connected: SciPy HiGHS MILP Engine'
                  : 'Offline Simulation Mode'}
              </span>
            </div>

            {/* Origin Hub Pill */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-slate-300 truncate max-w-[200px]">
                {ORIGIN_HUB.name}
              </span>
            </div>

            {/* Toggle Dataset Uploader Button */}
            <button
              onClick={() => setShowUploader((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                showUploader
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700 hover:text-white'
              }`}
              title="Upload judge scenario or CSV/JSON files"
            >
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showUploader ? 'Close Uploader' : 'Upload Scenario'}</span>
            </button>

            {/* Reset to Default Scenario Button */}
            <button
              onClick={handleResetScenario}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
              title="Reload default MoFPI South India scenario"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reset Default</span>
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN OPERATOR CONSOLE BODY
         ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
            <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-xl shadow-emerald-500/20" />
            <div className="text-center">
              <p className="text-base font-bold text-white">
                Initializing FreshRoute Cold-Chain Intelligence Engine...
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Calibrating Arrhenius $Q_{10}=2.0$ decay rates & loading South Indian APMC mandis
              </p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Collapsible Judge Dataset Uploader */}
            {showUploader && (
              <section aria-label="Dataset Ingestion & Fuzzy Schema Normalizer">
                <DatasetUploader
                  onUploadSuccess={handleUploadSuccess}
                  onClose={() => setShowUploader(false)}
                  currentWarnings={data.ingestion_warnings}
                />
              </section>
            )}

            {/* Standalone Fuzzy Schema Warning Banner (when uploader is closed but warnings exist) */}
            {!showUploader && data.ingestion_warnings && data.ingestion_warnings.length > 0 && (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 shadow-md text-amber-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 uppercase tracking-wider">
                      Fuzzy Schema & Unit Normalization Log:
                    </span>{' '}
                    <span>
                      {data.ingestion_warnings.length} auto-conversions applied (e.g. MT → kg, days → hours).
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploader(true)}
                  className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-medium shrink-0"
                >
                  View Ingestion Log
                </button>
              </div>
            )}

            {/* =========================================================================
                1. EXECUTIVE KPI RIBBON (4 Rubric Cards)
               ========================================================================= */}
            <section aria-label="Executive KPI Overview">
              <KpiRibbon response={data} />
            </section>

            {/* =========================================================================
                2. MAIN 12-COLUMN GRID:
                   - Left 4 cols: Disruption Controls & Stress Testing Sliders
                   - Right 8 cols: React-Leaflet Corridor Map
               ========================================================================= */}
            <section
              aria-label="Disruption Simulator and Logistics Corridor Map"
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
            >
              <div className="lg:col-span-4 flex flex-col">
                <DisruptionControls
                  disruptions={activeDisruptions || data.disruptions}
                  onChange={handleDisruptionsChange}
                  isSolving={isSolving}
                />
              </div>

              <div className="lg:col-span-8 flex flex-col">
                <RouteMap response={data} />
              </div>
            </section>

            {/* =========================================================================
                3. RECHARTS ANALYTICS ROW (2 Grouped Financial & Monte Carlo Charts)
               ========================================================================= */}
            <section aria-label="Financial and Monte Carlo Robustness Analytics">
              <AnalyticsPanel response={data} />
            </section>

            {/* =========================================================================
                4. DISPATCH TABLE & AUDIT (FreshRoute MILP vs. Baseline Failure Breakdown)
               ========================================================================= */}
            <section aria-label="Optimized Dispatch Plan & Baseline FIFO Audit">
              <DispatchTable response={data} />
            </section>
          </div>
        ) : (
          <div className="text-center py-24 text-rose-400 bg-slate-900/60 rounded-2xl border border-rose-900/50 p-8">
            <p className="text-base font-semibold">Failed to load scenario data.</p>
            <p className="text-xs text-slate-400 mt-1">
              Please ensure Vite and fallback data are correctly configured.
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

      {/* =========================================================================
          OPERATIONAL FOOTER
         ========================================================================= */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 px-4 sm:px-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-slate-400">
              FreshRoute OS (PS 03) • Mathematical Cold-Chain & Markdown Optimization
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>MoFPI NABCONS Cold-Chain Standards</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline font-mono text-slate-400">
              Arrhenius Decay Rate: $Q_{10}=2.0$
            </span>
            <span className="hidden md:inline">•</span>
            <span className="text-emerald-400 font-medium">
              SciPy HiGHS Dual Simplex / Branch-and-Bound
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
