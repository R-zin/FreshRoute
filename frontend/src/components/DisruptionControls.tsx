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
    <div className="tactile-debossed rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-white/[0.06] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl tactile-extruded flex items-center justify-center text-white shrink-0">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-space font-bold text-white tracking-tight">
                Disruption Simulator & Stress-Testing
              </h2>
              {isSolving ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full tactile-pressed text-white text-xs font-mono animate-pulse">
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  Solving MILP...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full tactile-extruded text-slate-400 text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#ffffff]" />
                  Live Sync
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-sans">
              Simulate dynamic cold-chain disruptions; HiGHS MILP re-optimizes routes and markdowns in real-time.
            </p>
          </div>
        </div>

        <button
          onClick={() => onChange(JUDGE_SCENARIOS[0].values)}
          disabled={isSolving}
          className="tactile-extruded inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all self-start sm:self-auto disabled:opacity-50"
          title="Reset to Normal Harvest baseline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Baseline</span>
        </button>
      </div>

      {/* Preset Buttons Section */}
      <div className="py-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-white" />
            Evaluation Presets (One-Click Testing)
          </span>
          <span className="text-[11px] font-mono">
            {activePreset ? (
              <span className="text-white font-semibold">
                Active: {activePreset.name}
              </span>
            ) : (
              <span className="text-slate-400">
                Custom Manual Config
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
                className={`p-3.5 rounded-xl text-left transition-all duration-200 relative group flex flex-col justify-between ${
                  isSelected
                    ? 'tactile-pressed border border-white/20 ring-1 ring-white/10'
                    : 'tactile-extruded hover:border-white/10'
                } disabled:opacity-60`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isSelected
                          ? 'bg-white text-black font-bold'
                          : 'tactile-debossed text-slate-400'
                      }`}
                    >
                      {preset.badge}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div
                    className={`text-xs font-space font-bold leading-tight ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {preset.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {preset.description}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono text-slate-400">
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
      <div className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* =========================================================================
            SLIDER 1: NH-44 / Long-Haul Highway Delay
           ========================================================================= */}
        <div className="tactile-debossed p-4 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <div>
                <label
                  htmlFor="slider-highway-delay"
                  className="text-xs font-bold text-white block cursor-pointer font-space"
                >
                  NH-44 / Highway Delay
                </label>
                <span className="text-[10px] text-slate-400">
                  Transit gridlock, checkpoints, or monsoon landslides
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2.5 py-1 rounded-md">
                {disruptions.highway_delay_hours === 0
                  ? '0h (Nominal)'
                  : `+${disruptions.highway_delay_hours.toFixed(0)}h`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <div className="tactile-slider-track p-1.5 rounded-full flex items-center">
              <input
                id="slider-highway-delay"
                type="range"
                min="0"
                max="18"
                step="1.0"
                value={disruptions.highway_delay_hours}
                onChange={handleHighwayDelayChange}
                disabled={isSolving}
                className="custom-range-slider"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>0h (On-Schedule)</span>
              <span>+6h (Congestion)</span>
              <span>+12h (Landslide)</span>
              <span>+18h (Severe)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 tactile-debossed p-2 rounded-lg border border-white/[0.02]">
            <span className="text-white font-mono font-semibold">Impact:</span> Consumes remaining shelf life (RSL) on long-haul routes (e.g. Hyderabad/Chennai).
          </p>
        </div>

        {/* =========================================================================
            SLIDER 2: Cold-Chain Reefer Temp Spike
           ========================================================================= */}
        <div className="tactile-debossed p-4 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Thermometer className="w-4 h-4 text-white" />
              </div>
              <div>
                <label
                  htmlFor="slider-temp-spike"
                  className="text-xs font-bold text-white block cursor-pointer font-space"
                >
                  Cold-Chain Reefer Temp Spike
                </label>
                <span className="text-[10px] text-slate-400">
                  Reefer compressor failure or poor pre-cooling
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2.5 py-1 rounded-md">
                {disruptions.reefer_temp_spike_c === 0
                  ? '0.0°C (Nominal)'
                  : `+${disruptions.reefer_temp_spike_c.toFixed(1)}°C`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <div className="tactile-slider-track p-1.5 rounded-full flex items-center">
              <input
                id="slider-temp-spike"
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={disruptions.reefer_temp_spike_c}
                onChange={handleTempSpikeChange}
                disabled={isSolving}
                className="custom-range-slider"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>0.0°C (Optimal)</span>
              <span>+4.0°C (Mild)</span>
              <span>+8.0°C (Fault)</span>
              <span>+12.0°C (Breach)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 tactile-debossed p-2 rounded-lg border border-white/[0.02]">
            <span className="text-white font-mono font-semibold">Q₁₀ Arrhenius:</span> Spoilage decay doubles every +10°C breach: <code className="text-slate-300 font-mono">2.0^((T_transit - T_opt)/10)</code>.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 3: Destination Market Demand Surge
           ========================================================================= */}
        <div className="tactile-debossed p-4 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <label
                  htmlFor="slider-demand-multiplier"
                  className="text-xs font-bold text-white block cursor-pointer font-space"
                >
                  Destination Market Demand Surge
                </label>
                <span className="text-[10px] text-slate-400">
                  APMC mandi demand fluctuations or festival spikes
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2.5 py-1 rounded-md">
                {disruptions.demand_multiplier.toFixed(2)}x
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <div className="tactile-slider-track p-1.5 rounded-full flex items-center">
              <input
                id="slider-demand-multiplier"
                type="range"
                min="0.70"
                max="1.50"
                step="0.05"
                value={disruptions.demand_multiplier}
                onChange={handleDemandMultiplierChange}
                disabled={isSolving}
                className="custom-range-slider"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>0.70x (Slump)</span>
              <span>1.00x (Baseline)</span>
              <span>1.25x (High)</span>
              <span>1.50x (Peak Festival)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 tactile-debossed p-2 rounded-lg border border-white/[0.02]">
            <span className="text-white font-mono font-semibold">Elasticity:</span> 15% markdowns expand demand by +25%; 30% clearances expand demand by +35%.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 4: Fleet Capacity Reduction
           ========================================================================= */}
        <div className="tactile-debossed p-4 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                <Percent className="w-4 h-4 text-white" />
              </div>
              <div>
                <label
                  htmlFor="slider-capacity-reduction"
                  className="text-xs font-bold text-white block cursor-pointer font-space"
                >
                  Fleet Capacity Reduction
                </label>
                <span className="text-[10px] text-slate-400">
                  Vehicle breakdowns or driver availability shortages
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2.5 py-1 rounded-md">
                {disruptions.capacity_reduction_pct === 0
                  ? '0% (Full)'
                  : `-${disruptions.capacity_reduction_pct.toFixed(0)}% Fleet`}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mt-3">
            <div className="tactile-slider-track p-1.5 rounded-full flex items-center">
              <input
                id="slider-capacity-reduction"
                type="range"
                min="0"
                max="50"
                step="5"
                value={disruptions.capacity_reduction_pct}
                onChange={handleCapacityReductionChange}
                disabled={isSolving}
                className="custom-range-slider"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>0% (100% Active)</span>
              <span>15% (Mild Squeeze)</span>
              <span>30% (Severe Deficit)</span>
              <span>50% (Half Fleet)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 tactile-debossed p-2 rounded-lg border border-white/[0.02]">
            <span className="text-white font-mono font-semibold">Bottleneck:</span> Dynamically scales max route transport capacity: <code className="text-slate-300 font-mono">max_cap * (1 - cut%)</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisruptionControls;
