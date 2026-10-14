import React from 'react';
import { DisruptionOverrides } from '../types/api';
import {
  Sliders,
  RotateCcw,
  Thermometer,
  Truck,
  TrendingUp,
  Percent,
  CheckCircle,
  Sparkles,
  CloudRain,
  Flame,
  Cpu,
} from 'lucide-react';

export interface DisruptionControlsProps {
  disruptions: DisruptionOverrides;
  onChange: (next: DisruptionOverrides) => void;
  isSolving: boolean;
}

interface ScenarioPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  values: DisruptionOverrides;
}

export const JUDGE_SCENARIOS: ScenarioPreset[] = [
  {
    id: 'baseline',
    name: 'Normal Harvest (Baseline)',
    badge: 'Standard Operations',
    description: 'Nominal cold-chain, on-schedule logistics, 100% vehicle availability',
    icon: CheckCircle,
    values: {
      highway_delay_hours: 0,
      reefer_temp_spike_c: 0,
      demand_multiplier: 1.0,
      capacity_reduction_pct: 0,
    },
  },
  {
    id: 'monsoon',
    name: 'NH-44 Monsoon Landslide (+10h)',
    badge: 'Transit Bottleneck',
    description: '10h highway gridlock + 15% fleet bottleneck along NH-44 corridor',
    icon: CloudRain,
    values: {
      highway_delay_hours: 10,
      reefer_temp_spike_c: 0,
      demand_multiplier: 1.0,
      capacity_reduction_pct: 15,
    },
  },
  {
    id: 'reefer_fault',
    name: 'Reefer Compressor Fault (+8°C)',
    badge: 'Thermal Abuse',
    description: '+8°C truck compartment spike; triggers Arrhenius accelerated decay',
    icon: Flame,
    values: {
      highway_delay_hours: 0,
      reefer_temp_spike_c: 8,
      demand_multiplier: 1.0,
      capacity_reduction_pct: 0,
    },
  },
  {
    id: 'festival',
    name: 'Festival Demand Spike (1.35x)',
    badge: 'Market Elasticity',
    description: '+35% mandi demand surge with slight +2h delay & +2°C heat',
    icon: Sparkles,
    values: {
      highway_delay_hours: 2,
      reefer_temp_spike_c: 2,
      demand_multiplier: 1.35,
      capacity_reduction_pct: 0,
    },
  },
];

export const DisruptionControls: React.FC<DisruptionControlsProps> = ({
  disruptions,
  onChange,
  isSolving,
}) => {
  const handleHighwayDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...disruptions,
      highway_delay_hours: parseFloat(e.target.value),
    });
  };

  const handleTempSpikeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...disruptions,
      reefer_temp_spike_c: parseFloat(e.target.value),
    });
  };

  const handleDemandMultiplierChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      ...disruptions,
      demand_multiplier: parseFloat(e.target.value),
    });
  };

  const handleCapacityReductionChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({
      ...disruptions,
      capacity_reduction_pct: parseFloat(e.target.value),
    });
  };

  // Check which preset is currently active
  const activePreset = JUDGE_SCENARIOS.find(
    (preset) =>
      preset.values.highway_delay_hours === disruptions.highway_delay_hours &&
      preset.values.reefer_temp_spike_c === disruptions.reefer_temp_spike_c &&
      Math.abs(preset.values.demand_multiplier - disruptions.demand_multiplier) <
        0.01 &&
      preset.values.capacity_reduction_pct === disruptions.capacity_reduction_pct
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                Supply Chain Stress-Testing & Disruption Controls
              </h2>
              {isSolving ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono border border-emerald-500/30 animate-pulse">
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  Solving MILP...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono border border-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live Sync
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate dynamic cold-chain disruptions; HiGHS MILP re-optimizes routes and markdown tiers in real-time.
            </p>
          </div>
        </div>

        <button
          onClick={() => onChange(JUDGE_SCENARIOS[0].values)}
          disabled={isSolving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors shadow-sm self-start sm:self-auto disabled:opacity-50"
          title="Reset to Normal Harvest baseline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Baseline</span>
        </button>
      </div>

      {/* Preset Buttons Section */}
      <div className="py-5 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Judge Evaluation Scenario Presets (One-Click Testing)
          </span>
          <span className="text-[11px] text-slate-500">
            {activePreset ? (
              <span className="text-emerald-400 font-medium">
                Active: {activePreset.name}
              </span>
            ) : (
              <span className="text-amber-400 font-medium">
                Custom Manual Configuration
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {JUDGE_SCENARIOS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = activePreset?.id === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => onChange(preset.values)}
                disabled={isSolving}
                className={`p-3.5 rounded-xl border text-left transition-all duration-200 relative group flex flex-col justify-between ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                } disabled:opacity-60`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {preset.badge}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div
                    className={`text-xs font-bold leading-tight ${
                      isSelected ? 'text-emerald-300' : 'text-slate-200'
                    }`}
                  >
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>+{preset.values.highway_delay_hours}h delay</span>
                  <span>+{preset.values.reefer_temp_spike_c}°C</span>
                  <span>{preset.values.demand_multiplier}x</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Interactive Range Sliders */}
      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* =========================================================================
            SLIDER 1: NH-44 / Long-Haul Highway Delay
           ========================================================================= */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <label
                  htmlFor="slider-highway-delay"
                  className="text-xs font-bold text-white block cursor-pointer"
                >
                  NH-44 / Highway Delay
                </label>
                <span className="text-[10px] text-slate-400">
                  Transit gridlock, checkpoints, or monsoon landslides
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                {disruptions.highway_delay_hours === 0
                  ? '0 hrs (Nominal)'
                  : `+${disruptions.highway_delay_hours.toFixed(0)} hrs`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <input
              id="slider-highway-delay"
              type="range"
              min="0"
              max="18"
              step="1.0"
              value={disruptions.highway_delay_hours}
              onChange={handleHighwayDelayChange}
              disabled={isSolving}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0h (On-Schedule)</span>
              <span>+6h (Congestion)</span>
              <span>+12h (Severe Landslide)</span>
              <span>+18h (Max Stress)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-blue-400 font-semibold">Impact:</span> Directly consumes remaining shelf life (RSL) on long-haul routes (e.g. Hyderabad/Chennai).
          </p>
        </div>

        {/* =========================================================================
            SLIDER 2: Cold-Chain Reefer Temp Spike
           ========================================================================= */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Thermometer className="w-4 h-4" />
              </div>
              <div>
                <label
                  htmlFor="slider-temp-spike"
                  className="text-xs font-bold text-white block cursor-pointer"
                >
                  Cold-Chain Reefer Temp Spike
                </label>
                <span className="text-[10px] text-slate-400">
                  Reefer compressor failure or poor pre-cooling
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                {disruptions.reefer_temp_spike_c === 0
                  ? '0.0°C (Nominal)'
                  : `+${disruptions.reefer_temp_spike_c.toFixed(1)}°C`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <input
              id="slider-temp-spike"
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={disruptions.reefer_temp_spike_c}
              onChange={handleTempSpikeChange}
              disabled={isSolving}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.0°C (Optimal)</span>
              <span>+4.0°C (Mild)</span>
              <span>+8.0°C (Compressor Fault)</span>
              <span>+12.0°C (Thermal Breach)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-rose-400 font-semibold">Q₁₀ Arrhenius:</span> Spoilage decay doubles every +10°C breach: <code className="text-slate-300 font-mono">2.0^((T_transit - T_opt)/10)</code>.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 3: Destination Market Demand Surge
           ========================================================================= */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <label
                  htmlFor="slider-demand-multiplier"
                  className="text-xs font-bold text-white block cursor-pointer"
                >
                  Destination Market Demand Surge
                </label>
                <span className="text-[10px] text-slate-400">
                  APMC mandi demand fluctuations or festival spikes
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                {disruptions.demand_multiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <input
              id="slider-demand-multiplier"
              type="range"
              min="0.70"
              max="1.50"
              step="0.05"
              value={disruptions.demand_multiplier}
              onChange={handleDemandMultiplierChange}
              disabled={isSolving}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.70x (Slump)</span>
              <span>1.00x (Baseline)</span>
              <span>1.25x (High)</span>
              <span>1.50x (Peak Festival)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-emerald-400 font-semibold">Price Elasticity:</span> 15% markdowns expand demand by +25%; 30% clearances expand demand by +35%.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 4: Fleet Capacity Reduction
           ========================================================================= */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <label
                  htmlFor="slider-capacity-reduction"
                  className="text-xs font-bold text-white block cursor-pointer"
                >
                  Fleet Capacity Reduction
                </label>
                <span className="text-[10px] text-slate-400">
                  Vehicle breakdowns or driver availability shortages
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-extrabold font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                {disruptions.capacity_reduction_pct === 0
                  ? '0% (Full Fleet)'
                  : `-${disruptions.capacity_reduction_pct.toFixed(0)}% Fleet`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <input
              id="slider-capacity-reduction"
              type="range"
              min="0"
              max="50"
              step="5"
              value={disruptions.capacity_reduction_pct}
              onChange={handleCapacityReductionChange}
              disabled={isSolving}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0% (100% Active)</span>
              <span>15% (Mild Squeeze)</span>
              <span>30% (Severe Deficit)</span>
              <span>50% (Half Fleet Down)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
            <span className="text-amber-400 font-semibold">Bottleneck:</span> Dynamically scales max route transport capacity: <code className="text-slate-300 font-mono">max_cap * (1 - cut%)</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisruptionControls;
