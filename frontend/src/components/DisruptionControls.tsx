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
    name: 'Normal Harvest',
    badge: 'Baseline',
    description: 'Nominal cold-chain, on-schedule logistics, full fleet',
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
    name: 'NH-44 Landslide',
    badge: 'Transit Bottleneck',
    description: '+10h highway gridlock + 15% fleet bottleneck',
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
    name: 'Reefer Fault',
    badge: 'Thermal Abuse',
    description: '+8°C reefer spike; triggers accelerated decay',
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
    name: 'Festival Surge',
    badge: 'Elasticity Spike',
    description: '+35% demand surge with +2h delay & +2°C heat',
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
    <div className="tactile-debossed rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
              <Sliders className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-space font-bold text-white tracking-tight leading-tight">
                Stress-Testing & Disruption
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Real-time HiGHS MILP re-optimization
              </p>
            </div>
          </div>

          <button
            onClick={() => onChange(JUDGE_SCENARIOS[0].values)}
            disabled={isSolving}
            className="tactile-extruded inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-300 hover:text-white transition-all shrink-0 disabled:opacity-50"
            title="Reset to Normal Harvest baseline"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          {isSolving ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full tactile-pressed text-white text-[11px] animate-pulse">
              <Cpu className="w-3 h-3 animate-spin" />
              Solving MILP...
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full tactile-extruded text-slate-300 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#ffffff]" />
              Live Sync
            </span>
          )}

          <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
            {activePreset ? activePreset.name : 'Custom Scenario'}
          </span>
        </div>
      </div>

      {/* Preset Buttons Section (Clean 2-column grid) */}
      <div className="py-4 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-white" />
            Evaluation Presets
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {JUDGE_SCENARIOS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = activePreset?.id === preset.id;

            return (
              <button
                key={preset.id}
                onClick={() => onChange(preset.values)}
                disabled={isSolving}
                className={`p-2.5 rounded-xl text-left transition-all duration-200 relative group flex flex-col justify-between ${
                  isSelected
                    ? 'tactile-pressed border border-white/20 ring-1 ring-white/10'
                    : 'tactile-extruded hover:border-white/10'
                } disabled:opacity-60`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded truncate max-w-[90px] ${
                        isSelected
                          ? 'bg-white text-black font-bold'
                          : 'tactile-debossed text-slate-400'
                      }`}
                    >
                      {preset.badge}
                    </span>
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div
                    className={`text-xs font-space font-bold leading-snug truncate ${
                      isSelected ? 'text-white' : 'text-slate-200'
                    }`}
                  >
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                    {preset.description}
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-white/[0.04] flex items-center justify-between text-[9px] font-mono text-slate-400">
                  <span>+{preset.values.highway_delay_hours}h</span>
                  <span>+{preset.values.reefer_temp_spike_c}°C</span>
                  <span>{preset.values.demand_multiplier}x</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Interactive Range Sliders (Single Column Stack) */}
      <div className="pt-4 flex flex-col gap-3.5">
        {/* =========================================================================
            SLIDER 1: NH-44 / Long-Haul Highway Delay
           ========================================================================= */}
        <div className="tactile-debossed p-3 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded tactile-extruded flex items-center justify-center text-white shrink-0">
                <Truck className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="slider-highway-delay"
                  className="text-xs font-bold text-white block cursor-pointer font-space truncate"
                >
                  NH-44 Highway Delay
                </label>
                <span className="text-[10px] text-slate-400 block truncate">
                  Monsoon landslide & gridlock
                </span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2 py-0.5 rounded shrink-0">
              {disruptions.highway_delay_hours === 0
                ? '0h (Nominal)'
                : `+${disruptions.highway_delay_hours.toFixed(0)}h`}
            </span>
          </div>

          <div className="space-y-1 mt-2">
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
              <span>0h (Nominal)</span>
              <span>+6h</span>
              <span>+12h</span>
              <span>+18h (Severe)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 tactile-debossed p-1.5 rounded border border-white/[0.02] leading-snug">
            <span className="text-white font-mono font-semibold">Impact:</span> Consumes remaining shelf life (RSL) on long-haul routes.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 2: Cold-Chain Reefer Temp Spike
           ========================================================================= */}
        <div className="tactile-debossed p-3 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded tactile-extruded flex items-center justify-center text-white shrink-0">
                <Thermometer className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="slider-temp-spike"
                  className="text-xs font-bold text-white block cursor-pointer font-space truncate"
                >
                  Reefer Temp Spike
                </label>
                <span className="text-[10px] text-slate-400 block truncate">
                  Compressor fault / pre-cooling leak
                </span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2 py-0.5 rounded shrink-0">
              {disruptions.reefer_temp_spike_c === 0
                ? '0.0°C (Nominal)'
                : `+${disruptions.reefer_temp_spike_c.toFixed(1)}°C`}
            </span>
          </div>

          <div className="space-y-1 mt-2">
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
              <span>+4°C</span>
              <span>+8°C</span>
              <span>+12.0°C (Breach)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 tactile-debossed p-1.5 rounded border border-white/[0.02] leading-snug">
            <span className="text-white font-mono font-semibold">Q₁₀ Arrhenius:</span> Spoilage decay doubles every +10°C breach.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 3: Destination Market Demand Surge
           ========================================================================= */}
        <div className="tactile-debossed p-3 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded tactile-extruded flex items-center justify-center text-white shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="slider-demand-multiplier"
                  className="text-xs font-bold text-white block cursor-pointer font-space truncate"
                >
                  Destination Demand Surge
                </label>
                <span className="text-[10px] text-slate-400 block truncate">
                  APMC mandi demand fluctuations
                </span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2 py-0.5 rounded shrink-0">
              {disruptions.demand_multiplier.toFixed(2)}x
            </span>
          </div>

          <div className="space-y-1 mt-2">
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
              <span>1.00x</span>
              <span>1.25x</span>
              <span>1.50x (Festival)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 tactile-debossed p-1.5 rounded border border-white/[0.02] leading-snug">
            <span className="text-white font-mono font-semibold">Elasticity:</span> -15% markdowns expand demand by +25%; -30% clearances expand by +35%.
          </p>
        </div>

        {/* =========================================================================
            SLIDER 4: Fleet Capacity Reduction
           ========================================================================= */}
        <div className="tactile-debossed p-3 rounded-xl border border-white/[0.04] transition-colors">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded tactile-extruded flex items-center justify-center text-white shrink-0">
                <Percent className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="slider-capacity-reduction"
                  className="text-xs font-bold text-white block cursor-pointer font-space truncate"
                >
                  Fleet Capacity Reduction
                </label>
                <span className="text-[10px] text-slate-400 block truncate">
                  Vehicle breakdowns / driver shortage
                </span>
              </div>
            </div>

            <span className="text-xs font-extrabold font-mono text-white tactile-extruded px-2 py-0.5 rounded shrink-0">
              {disruptions.capacity_reduction_pct === 0
                ? '0% (Full)'
                : `-${disruptions.capacity_reduction_pct.toFixed(0)}% Fleet`}
            </span>
          </div>

          <div className="space-y-1 mt-2">
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
              <span>0% (Full)</span>
              <span>-15%</span>
              <span>-30%</span>
              <span>-50% (Half Fleet)</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 tactile-debossed p-1.5 rounded border border-white/[0.02] leading-snug">
            <span className="text-white font-mono font-semibold">Bottleneck:</span> Scales route transport capacity: <code className="text-slate-300 font-mono">cap * (1 - cut%)</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DisruptionControls;
