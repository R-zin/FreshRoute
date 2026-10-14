export interface Batch {
  batch_id: string;
  commodity: string;
  quantity_kg: number;
  rsl_hours: number;
  optimal_temp_c: number;
  spoilage_cost_per_kg: number;
  base_cost_per_kg: number;
}

export interface Market {
  market_id: string;
  name: string;
  lat: number;
  lng: number;
  transit_hours: number;
  transit_temp_c: number;
  transport_cost_per_kg: number;
  handling_hours: number;
  handling_cost_per_kg: number;
  max_capacity_kg: number;
  demand_kg: Record<string, number>;
  market_price_kg: Record<string, number>;
}

export interface DisruptionOverrides {
  highway_delay_hours: number;
  reefer_temp_spike_c: number;
  demand_multiplier: number;
  capacity_reduction_pct: number;
}

export interface ConstraintAudit {
  mass_balance_passed: boolean;
  capacity_limits_passed: boolean;
  shelf_life_limits_passed: boolean;
  demand_caps_passed: boolean;
}

export interface StrategyKPIs {
  net_revenue: number;
  gross_revenue: number;
  transport_handling_cost: number;
  discount_cost: number;
  spoilage_cost: number;
  spoiled_kg: number;
  spoilage_rate_pct: number;
  demand_fulfillment_pct: number;
}

export interface KPIDeltas {
  net_revenue_gain: number;
  spoilage_reduction_pct: number;
  demand_fulfillment_gain_pct: number;
}

export interface KpiComparisonBundle {
  baseline: StrategyKPIs;
  optimized: StrategyKPIs;
  deltas: KPIDeltas;
}

export type AllocationStatus =
  | "OPTIMAL_DISPATCH"
  | "DELIVERED"
  | "SPOILED_ON_ARRIVAL"
  | "EXPIRED_UNSOLD"
  | "SPOILED";

export interface AllocationRow {
  batch_id: string;
  commodity: string;
  market_id: string;
  market_name: string;
  quantity_kg: number;
  discount_pct: number;
  effective_transit_rsl_hours: number;
  rsl_buffer_hours: number;
  status: AllocationStatus;
  net_contribution: number;
  reason: string;
}

export interface MonteCarloRun {
  sim_id: number;
  baseline_net_rev: number;
  freshroute_net_rev: number;
  baseline_spoilage_kg: number;
  freshroute_spoilage_kg: number;
}

export interface OptimizeRequest {
  batches: Batch[];
  markets: Market[];
  disruptions: DisruptionOverrides;
}

export interface OptimizeResponse {
  status: "OPTIMAL" | "FEASIBLE" | "FALLBACK_HEURISTIC";
  solve_time_ms: number;
  batches: Batch[];
  markets: Market[];
  disruptions: DisruptionOverrides;
  constraint_audit: ConstraintAudit;
  kpis: KpiComparisonBundle;
  allocations: AllocationRow[];
  baseline_allocations: AllocationRow[];
  monte_carlo_summary: MonteCarloRun[];
  ingestion_warnings: string[];
}

export const ORIGIN_HUB = {
  hub_id: "HUB-KOLAR",
  name: "Kolar–Bengaluru Integrated Cold-Chain Packinghouse",
  lat: 13.1362,
  lng: 78.1291,
};
