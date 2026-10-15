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
  MapPin,
  UploadCloud,
  RotateCcw,
  AlertTriangle,
  Zap,
  Leaf,
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

  // Handle successful dataset upload
  const handleUploadSuccess = useCallback(
    (uploadedData: OptimizeResponse, live: boolean) => {
      setData(uploadedData);
      setActiveDisruptions(uploadedData.disruptions);
      setIsLive(live);
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black antialiased">
      {/* =========================================================================
          TOP NAVIGATION HEADER (CLEAN & MINIMALIST)
         ========================================================================= */}
      <header className="bg-[#0c0f17]/80 backdrop-blur-md border-b border-white/[0.06] sticky top-0 z-50 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3 self-start md:self-auto">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-space font-bold tracking-tight text-white">
                  Freshroute
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 font-mono">
                  perishOpt Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                Dynamic Cold-Chain Logistics & Markdown Optimizer
              </p>
            </div>
          </div>

          {/* Right Status Indicators & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 self-end md:self-auto">
            {/* Live Solver Connection Indicator Badge */}
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs font-mono"
              title={
                isLive
                  ? 'Connected directly to FastAPI SciPy HiGHS backend solver'
                  : 'Running in self-contained client-side mathematical simulation mode'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive
                    ? 'bg-emerald-400 pulsing-indicator shadow-[0_0_8px_#10b981]'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] text-slate-300">
                {isLive ? 'SciPy HiGHS Solver' : 'Simulation Mode'}
              </span>
            </div>

            {/* Origin Hub Pill */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3 py-1 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-mono text-slate-300 text-[11px] truncate max-w-[200px]" title={ORIGIN_HUB.name}>
                {ORIGIN_HUB.name}
              </span>
            </div>

            {/* Toggle Dataset Uploader Button */}
            <button
              onClick={() => setShowUploader((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                showUploader
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200'
              }`}
              title="Upload judge scenario or CSV/JSON files"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{showUploader ? 'Close' : 'Upload Scenario'}</span>
            </button>

            {/* Reset to Default Scenario Button */}
            <button
              onClick={handleResetScenario}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all disabled:opacity-50"
              title="Reload default MoFPI South India scenario"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Reset</span>
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
            <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <p className="text-sm font-space font-semibold text-white">
                Initializing Freshroute Intelligence Engine...
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Calibrating Arrhenius Q₁₀ decay rates & APMC mandis
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
              <div className="bg-[#0c0f17] rounded-xl p-3 text-slate-300 flex items-center justify-between gap-3 text-xs border border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-semibold text-white font-mono">
                      Fuzzy Schema Normalizer:
                    </span>{' '}
                    <span className="text-slate-400">
                      {data.ingestion_warnings.length} auto-conversions applied (MT → kg, days → hours).
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploader(true)}
                  className="px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white text-[11px] font-mono shrink-0 transition-colors"
                >
                  View Log
                </button>
              </div>
            )}

            {/* =========================================================================
                1. EXECUTIVE KPI OVERVIEW (4 Clean Minimalist Cards)
               ========================================================================= */}
            <section aria-label="Executive KPI Overview">
              <KpiRibbon response={data} />
            </section>

            {/* =========================================================================
                2. INTERACTIVE SIMULATION & LOGISTICS MAP:
                   - Left 4 cols: Disruption Controls & Stress Testing Sliders
                   - Right 8 cols: South India Logistics Corridor Map
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
                3. RECHARTS ANALYTICS: Economic P&L & Monte Carlo Robustness
               ========================================================================= */}
            <section aria-label="Financial and Monte Carlo Robustness Analytics">
              <AnalyticsPanel response={data} />
            </section>

            {/* =========================================================================
                4. DISPATCH MATRIX & AUDIT TABLE
               ========================================================================= */}
            <section aria-label="Optimized Dispatch Plan & Baseline FIFO Audit">
              <DispatchTable response={data} />
            </section>
          </div>
        ) : (
          <div className="text-center py-24 text-slate-400 bg-[#0c0f17] rounded-2xl p-8 border border-white/[0.08]">
            <p className="text-sm font-semibold text-white">Failed to load scenario data.</p>
            <p className="text-xs text-slate-500 mt-1">
              Please ensure backend server or fallback data is correctly configured.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-400 text-black text-xs font-semibold hover:bg-emerald-300 transition-colors"
            >
              Reload System
            </button>
          </div>
        )}
      </main>

      {/* =========================================================================
          OPERATIONAL FOOTER (MINIMALIST)
         ========================================================================= */}
      <footer className="border-t border-white/[0.06] bg-[#0c0f17] py-3.5 px-4 sm:px-6 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span className="font-space font-medium text-slate-300">
              Freshroute • perishOpt Cold-Chain Optimization
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
            <span>MoFPI NABCONS Standards</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Arrhenius Q₁₀=2.0 Decay</span>
            <span className="hidden md:inline">•</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-emerald-400 inline" />
              SciPy HiGHS Dual Simplex
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
