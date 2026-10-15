import React, { useState, useRef } from 'react';
import { OptimizeResponse } from '../types/api';
import { uploadDataset } from '../api/client';
import {
  Upload,
  FileText,
  FileCheck,
  AlertTriangle,
  X,
  Layers,
  RotateCcw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface DatasetUploaderProps {
  onUploadSuccess: (data: OptimizeResponse, isLive: boolean) => void;
  onClose?: () => void;
  currentWarnings?: string[];
}

export const DatasetUploader: React.FC<DatasetUploaderProps> = ({
  onUploadSuccess,
  onClose,
  currentWarnings = [],
}) => {
  const [mode, setMode] = useState<'scenario' | 'paired'>('scenario');
  const [scenarioFile, setScenarioFile] = useState<File | null>(null);
  const [batchesFile, setBatchesFile] = useState<File | null>(null);
  const [marketsFile, setMarketsFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>(currentWarnings);
  const [showWarnings, setShowWarnings] = useState<boolean>(false);

  const scenarioInputRef = useRef<HTMLInputElement>(null);
  const batchesInputRef = useRef<HTMLInputElement>(null);
  const marketsInputRef = useRef<HTMLInputElement>(null);

  // Handle Scenario file selection
  const handleScenarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScenarioFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  // Handle Paired files selection
  const handleBatchesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBatchesFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  const handleMarketsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMarketsFile(e.target.files[0]);
      setErrorMessage(null);
    }
  };

  // Drag and drop handlers
  const handleScenarioDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setScenarioFile(e.dataTransfer.files[0]);
      setErrorMessage(null);
    }
  };

  // Submit Upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData();

    if (mode === 'scenario') {
      if (!scenarioFile) {
        setErrorMessage('Please select a scenario .json file to upload.');
        return;
      }
      formData.append('scenario_file', scenarioFile);
    } else {
      if (!batchesFile || !marketsFile) {
        setErrorMessage(
          'Please select both a batches file (.csv/.json) and a markets file (.csv/.json).'
        );
        return;
      }
      formData.append('batches_file', batchesFile);
      formData.append('markets_file', marketsFile);
    }

    setIsUploading(true);

    try {
      const result = await uploadDataset(formData);
      if (result.data.ingestion_warnings && result.data.ingestion_warnings.length > 0) {
        setWarnings(result.data.ingestion_warnings);
      }
      onUploadSuccess(result.data, result.isLive);
    } catch (err) {
      console.error('Dataset upload failed:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred during upload.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setScenarioFile(null);
    setBatchesFile(null);
    setMarketsFile(null);
    setErrorMessage(null);
    if (scenarioInputRef.current) scenarioInputRef.current.value = '';
    if (batchesInputRef.current) batchesInputRef.current.value = '';
    if (marketsInputRef.current) marketsInputRef.current.value = '';
  };

  return (
    <div className="glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 relative">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-white/[0.06] bg-[#0c0f17] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-space font-bold text-white tracking-tight flex items-center gap-2">
              Scenario & Dataset Ingestion
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 font-mono">
                Fuzzy Normalizer
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Upload custom scenarios with auto-normalization (MT → kg, days → hours)
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors"
            title="Close Uploader"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* FUZZY SCHEMA WARNINGS COLLAPSIBLE */}
        {warnings.length > 0 && (
          <div className="bg-[#0b0e14] rounded-xl border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => setShowWarnings((p) => !p)}
              className="w-full p-3 flex items-center justify-between text-left text-xs font-mono text-slate-300 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold text-white">
                  Fuzzy Normalization Applied: {warnings.length} conversions
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <span>{showWarnings ? 'Hide details' : 'View conversions'}</span>
                {showWarnings ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            {showWarnings && (
              <div className="p-3 pt-0 border-t border-white/[0.04] max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono">
                {warnings.map((warn, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-white/[0.02] text-slate-300 flex items-start gap-1.5"
                  >
                    <span className="text-emerald-400 font-bold shrink-0">[{idx + 1}]</span>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="bg-[#0b0e14] p-1 rounded-xl flex items-center max-w-sm border border-white/[0.06] font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('scenario');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'scenario'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Scenario (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('paired');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'paired'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Batches + Markets</span>
          </button>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'scenario' ? (
            /* OPTION 1: Single Scenario */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleScenarioDrop}
              onClick={() => scenarioInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                scenarioFile
                  ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                  : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
              }`}
            >
              <input
                ref={scenarioInputRef}
                type="file"
                accept=".json"
                onChange={handleScenarioChange}
                className="hidden"
              />

              {scenarioFile ? (
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-white font-mono">
                    {scenarioFile.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {(scenarioFile.size / 1024).toFixed(1)} KB • Ready to solve
                  </div>
                  <span className="text-[11px] text-emerald-400 underline mt-1 font-mono">
                    Click to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 block font-space">
                      Drop scenario .json file here, or click to browse
                    </span>
                    <span className="text-xs text-slate-500 block mt-0.5 font-mono">
                      Accepts perishOpt JSON format with batches and markets
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* OPTION 2: Paired Batches & Markets */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => batchesInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  batchesFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                }`}
              >
                <input
                  ref={batchesInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleBatchesChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-300">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white block">
                    1. Batches (.csv / .json)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono truncate max-w-full">
                    {batchesFile ? batchesFile.name : 'Select produce batches'}
                  </span>
                </div>
              </div>

              <div
                onClick={() => marketsInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  marketsFile
                    ? 'border-emerald-500/40 bg-emerald-500/[0.03]'
                    : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                }`}
              >
                <input
                  ref={marketsInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleMarketsChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-300">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-white block">
                    2. Markets (.csv / .json)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono truncate max-w-full">
                    {marketsFile ? marketsFile.name : 'Select destination mandis'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-mono">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isUploading || (!scenarioFile && !batchesFile && !marketsFile)}
              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>

            <button
              type="submit"
              disabled={
                isUploading ||
                (mode === 'scenario' && !scenarioFile) ||
                (mode === 'paired' && (!batchesFile || !marketsFile))
              }
              className="w-full sm:w-auto px-5 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed font-space active:scale-[0.98]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Optimizing MILP...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-black" />
                  <span>Ingest & Run MILP</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DatasetUploader;
