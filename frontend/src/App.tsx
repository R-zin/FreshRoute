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
    <div className="min-h-screen bg-[#0b0d0f] text-[#e1e2e8] flex flex-col font-sans selection:bg-white selection:text-black antialiased">
      {/* =========================================================================
          TOP NAVIGATION HEADER (STITCH TACTILE CONSOLE)
         ========================================================================= */}
      <header className="bg-[#111418] border-b border-white/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.8)] sticky top-0 z-50 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Product Title */}
          <div className="flex items-center space-x-3.5 self-start md:self-auto">
            <div className="w-9 h-9 rounded-xl tactile-extruded flex items-center justify-center text-white font-space font-bold text-base tracking-tighter shrink-0 ring-1 ring-white/10">
              pO
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-space font-bold tracking-tight text-white">
                  perishOpt
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full tactile-debossed text-white/80 font-mono font-medium border border-white/5">
                  PS 03
                </span>
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full tactile-debossed text-slate-400 font-mono border border-white/5">
                  MoFPI NABCONS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans">
                Dynamic Perishable Produce Cold-Chain & Markdown Optimizer
              </p>
            </div>
          </div>

          {/* Center/Right Status Indicators & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 self-end md:self-auto">
            {/* Live Solver Connection Indicator Badge */}
            <div
              className="tactile-debossed flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              title={
                isLive
                  ? 'Connected directly to FastAPI SciPy HiGHS backend solver'
                  : 'Running in self-contained client-side mathematical simulation mode'
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLive
                    ? 'bg-white pulsing-indicator shadow-[0_0_8px_#ffffff]'
                    : 'bg-slate-400'
                }`}
              />
              <span className="font-mono text-[11px] text-white">
                {isLive ? 'SciPy HiGHS Engine: Active' : 'Simulation Mode'}
              </span>
            </div>

            {/* Origin Hub Pill */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 tactile-debossed px-3 py-1.5 rounded-lg">
              <MapPin className="w-3.5 h-3.5 text-white/80" />
              <span className="font-mono text-slate-300 truncate max-w-[200px]">
                {ORIGIN_HUB.name}
              </span>
            </div>

            {/* Toggle Dataset Uploader Button */}
            <button
              onClick={() => setShowUploader((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showUploader
                  ? 'tactile-pressed text-white'
                  : 'tactile-extruded text-slate-200 hover:text-white'
              }`}
              title="Upload judge scenario or CSV/JSON files"
            >
              <UploadCloud className="w-3.5 h-3.5 text-white" />
              <span>{showUploader ? 'Close Uploader' : 'Upload Scenario'}</span>
            </button>

            {/* Reset to Default Scenario Button */}
            <button
              onClick={handleResetScenario}
              disabled={loading}
              className="tactile-extruded inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50"
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
            <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin shadow-lg shadow-white/10" />
            <div className="text-center">
              <p className="text-base font-space font-bold text-white">
                Initializing perishOpt Cold-Chain Intelligence Engine...
              </p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Calibrating Arrhenius Q₁₀=2.0 decay rates & loading South Indian APMC mandis
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
              <div className="tactile-debossed rounded-xl p-3.5 text-white flex items-center justify-between gap-3 text-xs border border-white/10">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                  <div>
                    <span className="font-bold text-white uppercase tracking-wider font-mono">
                      Fuzzy Schema Normalization Log:
                    </span>{' '}
                    <span className="text-slate-300">
                      {data.ingestion_warnings.length} auto-conversions applied (e.g. MT → kg, days → hours).
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUploader(true)}
                  className="tactile-extruded px-2.5 py-1 rounded-md text-white text-[11px] font-medium shrink-0"
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
                   - Right 8 cols: Corridor Map
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
                4. DISPATCH TABLE & AUDIT (perishOpt MILP vs. Baseline Failure Breakdown)
               ========================================================================= */}
            <section aria-label="Optimized Dispatch Plan & Baseline FIFO Audit">
              <DispatchTable response={data} />
            </section>
          </div>
        ) : (
          <div className="text-center py-24 text-slate-300 tactile-debossed rounded-2xl p-8 border border-white/10">
            <p className="text-base font-semibold text-white">Failed to load scenario data.</p>
            <p className="text-xs text-slate-400 mt-1">
              Please ensure backend server or fallback data is correctly configured.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-xl tactile-extruded text-white text-xs font-semibold"
            >
              Reload System
            </button>
          </div>
        )}
      </main>

      {/* =========================================================================
          OPERATIONAL FOOTER (NEUMORPHIC MINIMALIST)
         ========================================================================= */}
      <footer className="border-t border-white/[0.06] bg-[#0e1115] py-4 px-4 sm:px-6 text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white pulsing-indicator shadow-[0_0_6px_#ffffff]" />
            <span className="font-space font-medium text-slate-200">
              perishOpt (PS 03) • Mathematical Cold-Chain & Markdown Optimization
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>MoFPI NABCONS Cold-Chain Standards</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline text-slate-300">
              Arrhenius Decay Rate: Q₁₀=2.0
            </span>
            <span className="hidden md:inline">•</span>
            <span className="text-white font-medium flex items-center gap-1">
              <Zap className="w-3 h-3 text-white inline" />
              SciPy HiGHS Dual Simplex / Branch-and-Bound
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
