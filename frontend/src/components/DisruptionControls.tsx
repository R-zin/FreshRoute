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
  Loader2,
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
    badge: 'Nominal',
    description: 'On-schedule cold chain, full fleet',
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
    badge: 'Bottleneck',
    description: '+10h gridlock, 15% fleet cut',
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
    description: '+8°C spike, Arrhenius decay',
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
    badge: 'Elasticity',
    description: '+35% demand, +2h delay, +2°C',
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
    <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between h-full space-y-5">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-space font-bold text-white tracking-tight leading-tight">
              Disruption Simulator
            </h2>
            <p className="text-[11px] text-slate-400 font-sans">
              Real-time HiGHS MILP stress-testing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSolving ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Solving...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
              <span>Live Sync</span>
            </span>
          )}

          <button
            onClick={() => onChange(JUDGE_SCENARIOS[0].values)}
            disabled={isSolving}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-white transition-all disabled:opacity-50"
            title="Reset to Normal Harvest baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preset Buttons Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Preset Scenarios</span>
          <span className="text-slate-500">
            {activePreset ? activePreset.name : 'Custom Scenario'}
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
                className={`p-3 rounded-xl text-left transition-all duration-150 flex flex-col justify-between border ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.06] text-slate-300'
                } disabled:opacity-50`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`text-[9px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-emerald-400 text-black font-bold'
                        : 'bg-white/[0.05] text-slate-400'
                    }`}
                  >
                    {preset.badge}
                  </span>
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <div className={`text-xs font-semibold leading-tight ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 Clean Range Sliders */}
      <div className="space-y-3 pt-1">
        {/* SLIDER 1: Highway Delay */}
        <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label
                htmlFor="slider-highway-delay"
                className="text-xs font-medium text-slate-200 cursor-pointer truncate"
              >
                NH-44 Highway Delay
              </label>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white shrink-0">
              {disruptions.highway_delay_hours === 0
                ? '0h'
                : `+${disruptions.highway_delay_hours.toFixed(0)}h`}
            </span>
          </div>

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

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0h (Nominal)</span>
            <span>+6h</span>
            <span>+12h</span>
            <span>+18h (Severe)</span>
          </div>
        </div>

        {/* SLIDER 2: Reefer Temp Spike */}
        <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Thermometer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <label
                htmlFor="slider-temp-spike"
                className="text-xs font-medium text-slate-200 cursor-pointer truncate"
              >
                Reefer Temp Breach
              </label>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-amber-300 shrink-0">
              {disruptions.reefer_temp_spike_c === 0
                ? '0.0°C'
                : `+${disruptions.reefer_temp_spike_c.toFixed(1)}°C`}
            </span>
          </div>

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

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0.0°C (Nominal)</span>
            <span>+4°C</span>
            <span>+8°C</span>
            <span>+12°C (Breach)</span>
          </div>
        </div>

        {/* SLIDER 3: Destination Demand Multiplier */}
        <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <label
                htmlFor="slider-demand-multiplier"
                className="text-xs font-medium text-slate-200 cursor-pointer truncate"
              >
                Mandi Demand Surge
              </label>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-sky-300 shrink-0">
              {disruptions.demand_multiplier.toFixed(2)}x
            </span>
          </div>

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

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0.70x (Slump)</span>
            <span>1.00x</span>
            <span>1.25x</span>
            <span>1.50x (Surge)</span>
          </div>
        </div>

        {/* SLIDER 4: Fleet Capacity Cut */}
        <div className="bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Percent className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <label
                htmlFor="slider-capacity-reduction"
                className="text-xs font-medium text-slate-200 cursor-pointer truncate"
              >
                Fleet Capacity Cut
              </label>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-slate-200 shrink-0">
              {disruptions.capacity_reduction_pct === 0
                ? '0% (Full)'
                : `-${disruptions.capacity_reduction_pct.toFixed(0)}%`}
            </span>
          </div>

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

          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0% (Full)</span>
            <span>-15%</span>
            <span>-30%</span>
            <span>-50% (Half)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisruptionControls;
