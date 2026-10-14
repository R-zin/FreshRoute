import React, { useState, useRef } from 'react';
import { OptimizeResponse } from '../types/api';
import { uploadDataset } from '../api/client';
import {
  Upload,
  FileText,
  FileCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Download,
  RotateCcw,
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
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl relative">
      {/* Background ambient decorative glow */}
      <div className="absolute top-0 right-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Judge Scenario & Dataset Ingestion
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-medium">
                Fuzzy Unit Normalizer
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Upload custom test scenarios with automatic schema normalization (e.g. MT → kg, days → hours)
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Uploader"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* =========================================================================
            FUZZY SCHEMA & UNIT NORMALIZATION LOG BANNER (if warnings present)
           ========================================================================= */}
        {warnings.length > 0 && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 shadow-lg text-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Fuzzy Schema & Unit Normalization Log ({warnings.length} entries)</span>
              </div>
              <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                Auto-Resolved by Parser
              </span>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              The ingestion engine automatically harmonized non-standard units, fuzzy column names, and missing produce parameters:
            </p>

            <ul className="space-y-1 mt-2 text-xs font-mono max-h-40 overflow-y-auto pr-1">
              {warnings.map((warn, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-amber-500/20 text-[11px]"
                >
                  <span className="text-amber-400 font-bold">[{idx + 1}]</span>
                  <span className="text-slate-200 leading-snug">{warn}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 max-w-md">
          <button
            type="button"
            onClick={() => {
              setMode('scenario');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'scenario'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Single Scenario File (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('paired');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              mode === 'paired'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Paired Batches + Markets (.csv/.json)</span>
          </button>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'scenario' ? (
            /* =========================================================================
                OPTION 1: Single Scenario File
               ========================================================================= */
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleScenarioDrop}
              onClick={() => scenarioInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                scenarioFile
                  ? 'border-emerald-500/60 bg-emerald-950/20'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60'
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
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {scenarioFile.name}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {(scenarioFile.size / 1024).toFixed(1)} KB • Ready for Optimization
                  </div>
                  <span className="text-[11px] text-emerald-400 underline mt-1">
                    Click or drop to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      Choose a Scenario File or drag & drop here
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Accepts standard FreshRoute JSON bundle with <code className="text-slate-300 font-mono">batches</code> & <code className="text-slate-300 font-mono">markets</code>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* =========================================================================
                OPTION 2: Paired Batches & Markets Files
               ========================================================================= */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Batches File Picker */}
              <div
                onClick={() => batchesInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  batchesFile
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input
                  ref={batchesInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleBatchesChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      1. Batches Dataset
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      {batchesFile ? batchesFile.name : 'Select batches.csv or .json'}
                    </span>
                  </div>
                  {batchesFile && (
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {(batchesFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>

              {/* Markets File Picker */}
              <div
                onClick={() => marketsInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  marketsFile
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input
                  ref={marketsInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleMarketsChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      2. Markets Dataset
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                      {marketsFile ? marketsFile.name : 'Select markets.csv or .json'}
                    </span>
                  </div>
                  {marketsFile && (
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {(marketsFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="bg-rose-950/40 border border-rose-500/40 p-3 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={isUploading || (!scenarioFile && !batchesFile && !marketsFile)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Selection</span>
            </button>

            <button
              type="submit"
              disabled={
                isUploading ||
                (mode === 'scenario' && !scenarioFile) ||
                (mode === 'paired' && (!batchesFile || !marketsFile))
              }
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>Normalizing Schema & Solving MILP...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload & Run FreshRoute MILP</span>
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
