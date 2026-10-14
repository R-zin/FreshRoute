"""
FreshRoute OS Core Schemas (Pydantic v2)
Adheres 100% to SHARED_API_CONTRACT.md specification.
"""

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field

# 2.1 Origin Packinghouse Coordinates
ORIGIN_HUB = {
    "hub_id": "HUB-KOLAR",
    "name": "Kolar–Bengaluru Integrated Cold-Chain Packinghouse",
    "lat": 13.1362,
    "lng": 78.1291,
}

# 2.2 Discrete Discount Tiers
DISCOUNT_TIERS = [
    {"tier": 0, "discount_pct": 0, "discount_rate": 0.00, "demand_expansion": 1.00},
    {"tier": 1, "discount_pct": 15, "discount_rate": 0.15, "demand_expansion": 0.25},
    {"tier": 2, "discount_pct": 30, "discount_rate": 0.30, "demand_expansion": 0.35},
]

# 2.4 Default Commodity Cold-Chain Lookup (For Missing Data Imputation)
DEFAULT_COMMODITY_LOOKUP: Dict[str, Dict[str, float]] = {
    "Tomato": {"optimal_temp_c": 12.0, "spoilage_cost_per_kg": 14.0, "base_cost_per_kg": 18.0},
    "Guava": {"optimal_temp_c": 10.0, "spoilage_cost_per_kg": 18.0, "base_cost_per_kg": 25.0},
    "Banana": {"optimal_temp_c": 13.0, "spoilage_cost_per_kg": 12.0, "base_cost_per_kg": 15.0},
    "Alphonso Mango": {"optimal_temp_c": 13.0, "spoilage_cost_per_kg": 28.0, "base_cost_per_kg": 45.0},
    "Papaya": {"optimal_temp_c": 10.0, "spoilage_cost_per_kg": 15.0, "base_cost_per_kg": 20.0},
    "Potato": {"optimal_temp_c": 8.0, "spoilage_cost_per_kg": 8.0, "base_cost_per_kg": 12.0},
    "Onion": {"optimal_temp_c": 15.0, "spoilage_cost_per_kg": 9.0, "base_cost_per_kg": 14.0},
    "Spinach": {"optimal_temp_c": 4.0, "spoilage_cost_per_kg": 20.0, "base_cost_per_kg": 22.0},
    "Leafy": {"optimal_temp_c": 4.0, "spoilage_cost_per_kg": 20.0, "base_cost_per_kg": 22.0},
    "Fallback": {"optimal_temp_c": 10.0, "spoilage_cost_per_kg": 15.0, "base_cost_per_kg": 20.0},
}


class Batch(BaseModel):
    batch_id: str = Field(..., description="Unique batch identifier, e.g., 'B-101'")
    commodity: str = Field(..., description="Produce name, e.g., 'Tomato'")
    quantity_kg: float = Field(..., ge=0.0, description="Available batch weight in kg")
    rsl_hours: float = Field(..., ge=0.0, description="Remaining shelf life in hours")
    optimal_temp_c: float = Field(default=12.0, description="Ideal storage temperature in Celsius")
    spoilage_cost_per_kg: float = Field(default=14.0, ge=0.0, description="Disposal/loss penalty per kg")
    base_cost_per_kg: float = Field(default=18.0, ge=0.0, description="Procurement cost per kg")


class Market(BaseModel):
    market_id: str = Field(..., description="Unique destination ID, e.g., 'M1'")
    name: str = Field(..., description="Market display name, e.g., 'Bengaluru APMC'")
    lat: float = Field(default=12.9716, description="Latitude for map plotting")
    lng: float = Field(default=77.5946, description="Longitude for map plotting")
    transit_hours: float = Field(..., ge=0.0, description="One-way highway transit time in hours")
    transit_temp_c: float = Field(default=15.0, description="Reefer/truck internal temperature in Celsius")
    transport_cost_per_kg: float = Field(..., ge=0.0, description="Freight cost per kg")
    handling_hours: float = Field(default=3.0, ge=0.0, description="Unloading and mandi handling hours")
    handling_cost_per_kg: float = Field(default=1.5, ge=0.0, description="Loading/unloading cost per kg")
    max_capacity_kg: float = Field(..., ge=0.0, description="Maximum route transport capacity in kg")
    demand_kg: Dict[str, float] = Field(..., description="Base demand per commodity in kg")
    market_price_kg: Dict[str, float] = Field(..., description="Full wholesale selling price per commodity in INR/kg")


class DisruptionOverrides(BaseModel):
    highway_delay_hours: float = Field(default=0.0, ge=0.0, le=48.0)
    reefer_temp_spike_c: float = Field(default=0.0, ge=-5.0, le=25.0)
    demand_multiplier: float = Field(default=1.0, ge=0.1, le=3.0)
    capacity_reduction_pct: float = Field(default=0.0, ge=0.0, le=95.0)


class ConstraintAudit(BaseModel):
    mass_balance_passed: bool = True
    capacity_limits_passed: bool = True
    shelf_life_limits_passed: bool = True
    demand_caps_passed: bool = True


class StrategyKPIs(BaseModel):
    net_revenue: float
    gross_revenue: float
    transport_handling_cost: float
    discount_cost: float
    spoilage_cost: float
    spoiled_kg: float
    spoilage_rate_pct: float
    demand_fulfillment_pct: float


class KPIDeltas(BaseModel):
    net_revenue_gain: float
    spoilage_reduction_pct: float
    demand_fulfillment_gain_pct: float


class KpiComparisonBundle(BaseModel):
    baseline: StrategyKPIs
    optimized: StrategyKPIs
    deltas: KPIDeltas


class AllocationRow(BaseModel):
    batch_id: str
    commodity: str
    market_id: str
    market_name: str
    quantity_kg: float
    discount_pct: int
    effective_transit_rsl_hours: float
    rsl_buffer_hours: float
    status: Literal[
        "OPTIMAL_DISPATCH",
        "DELIVERED",
        "SPOILED_ON_ARRIVAL",
        "EXPIRED_UNSOLD",
        "SPOILED",
    ]
    net_contribution: float
    reason: str


class MonteCarloRun(BaseModel):
    sim_id: int
    baseline_net_rev: float
    freshroute_net_rev: float
    baseline_spoilage_kg: float
    freshroute_spoilage_kg: float


class OptimizeRequest(BaseModel):
    batches: List[Batch]
    markets: List[Market]
    disruptions: DisruptionOverrides = Field(default_factory=DisruptionOverrides)


class OptimizeResponse(BaseModel):
    status: Literal["OPTIMAL", "FEASIBLE", "FALLBACK_HEURISTIC"] = "OPTIMAL"
    solve_time_ms: float
    batches: List[Batch]
    markets: List[Market]
    disruptions: DisruptionOverrides
    constraint_audit: ConstraintAudit
    kpis: KpiComparisonBundle
    allocations: List[AllocationRow]
    baseline_allocations: List[AllocationRow]
    monte_carlo_summary: List[MonteCarloRun]
    ingestion_warnings: List[str] = Field(default_factory=list)
