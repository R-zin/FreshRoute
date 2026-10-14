# SHARED_API_CONTRACT.md — FreshRoute OS (PS 03) Single Source of Truth

> **CRITICAL RULE FOR ALL AI AGENTS (CLAUDE & GEMINI):**
> Do NOT invent, rename, camelCase, or omit any field defined in this document.
> Backend (Python/FastAPI), Frontend (React/TypeScript), and Ingestion (Pandas/Pydantic) MUST adhere 100% to these exact `snake_case` JSON keys, types, and mathematical formulas.

---

## 1. Network, Ports & CORS Configuration

| Service | Local URL | Production Env Var | Notes |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend** | `http://localhost:8000` | `VITE_API_BASE_URL` | Prefix all endpoints with `/api/v1` |
| **React (Vite) Frontend** | `http://localhost:5173` | — | Must fall back to `fallbackData.ts` if backend is offline |
| **CORS Policy** | `allow_origins=["*"]` | `allow_methods=["*"]` | `allow_headers=["*"]` |

---

## 2. Shared Domain Constants & Mathematical Rules (Rubric: 70% Weight)

### 2.1 Origin Packinghouse Coordinates (For Leaflet Map Polyline Origin)
```json
{
  "hub_id": "HUB-KOLAR",
  "name": "Kolar–Bengaluru Integrated Cold-Chain Packinghouse",
  "lat": 13.1362,
  "lng": 78.1291
}
```

### 2.2 Discrete Discount Tiers (Mandatory MVP: Discount Recommendations)
| Tier Index (`k`) | `discount_pct` | `discount_rate` ($d_k$) | `demand_expansion` ($\alpha_k$) | Eligibility Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 0** | `0` | `0.00` | `1.00` (100% of base demand) | Always eligible if thermally feasible |
| **Tier 1** | `15` | `0.15` | `0.25` (+25% incremental price-elastic demand) | Always eligible if thermally feasible |
| **Tier 2** | `30` | `0.30` | `0.35` (+35% incremental clearance demand) | **ONLY eligible if `batch.rsl_hours <= 36.0`** |

### 2.3 $Q_{10}$ Arrhenius Thermal Shelf-Life Formula
For batch $i$ and market $j$, the effective biological shelf life consumed during transit and handling is:
$$\text{effective\_transit\_rsl\_hours}_{i,j} = \text{transit\_hours}_j \times 2.0^{\left(\frac{\max(0.0,\; \text{transit\_temp\_c}_j - \text{optimal\_temp\_c}_i)}{10.0}\right)} + \text{handling\_hours}_j$$
- **Safety Buffer:** $\text{rsl\_buffer\_hours}_{i,j} = \text{rsl\_hours}_i - \text{effective\_transit\_rsl\_hours}_{i,j}$
- **Feasibility Rule:** A route $(i, j)$ is **feasible** if and only if $\text{rsl\_buffer\_hours}_{i,j} \ge 0.0$.
  - In **FreshRoute MILP**, any route with $\text{rsl\_buffer\_hours}_{i,j} < 0.0$ has its upper bound hard-pruned to `0.0`.
  - In **Baseline FIFO**, the naive operator ignores thermal decay during dispatch; if $\text{rsl\_buffer\_hours}_{i,j} < 0.0$, the shipment arrives spoiled (`status = "SPOILED_ON_ARRIVAL"`), earns `₹0` revenue, and incurs full transport, handling, and spoilage penalty costs.

### 2.4 Default Commodity Cold-Chain Lookup (For Missing Data Imputation)
| Commodity | `optimal_temp_c` | Default `spoilage_cost_per_kg` (₹) | Default `base_cost_per_kg` (₹) |
| :--- | :--- | :--- | :--- |
| `Tomato` | `12.0` | `14.0` | `18.0` |
| `Guava` | `10.0` | `18.0` | `25.0` |
| `Banana` | `13.0` | `12.0` | `15.0` |
| `Alphonso Mango` | `13.0` | `28.0` | `45.0` |
| `Papaya` | `10.0` | `15.0` | `20.0` |
| `Potato` | `8.0` | `8.0` | `12.0` |
| `Onion` | `15.0` | `9.0` | `14.0` |
| `Spinach` / `Leafy` | `4.0` | `20.0` | `22.0` |
| *Fallback (Any Other)* | `10.0` | `15.0` | `20.0` |

---

## 3. Canonical Pydantic v2 Models (`/backend/core/schemas.py`)

Account 1 and Account 3 MUST use these exact Pydantic classes:

```python
from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, Field


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
```

---

## 4. Canonical TypeScript Interfaces (`/frontend/src/types/api.ts`)

Account 2 MUST copy these exact interfaces into `/frontend/src/types/api.ts`:

```typescript
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
```

---

## 5. REST API Endpoints Specification

### 5.1 `GET /api/v1/health`
- **Purpose:** Instant readiness probe for frontend connection indicator.
- **Response (`200 OK`):**
  ```json
  { "status": "ok", "service": "FreshRoute OS MILP Engine", "solver": "SciPy HiGHS" }
  ```

### 5.2 `GET /api/v1/default-scenario`
- **Purpose:** Loads the default MoFPI South India perishable produce dataset and its initial solved state on page startup.
- **Response (`200 OK`):** Returns a complete `OptimizeResponse` JSON object.

### 5.3 `POST /api/v1/optimize`
- **Purpose:** Re-solves both the Naive FIFO Baseline and the FreshRoute MILP Optimizer when the user adjusts any disruption slider or edits batch/market parameters.
- **Request Body:** `OptimizeRequest` JSON.
- **Response (`200 OK`):** Returns a complete `OptimizeResponse` JSON object.

### 5.4 `POST /api/v1/upload-dataset`
- **Purpose:** Ingests hidden judge evaluation files (`multipart/form-data`), normalizes column aliases, logs any unit conversions or missing-value imputations into `ingestion_warnings`, and immediately runs the optimizer.
- **Request (`multipart/form-data`):**
  - `scenario_file` (optional): Single `.json` or combined `.csv` file.
  - `batches_file` (optional): `.csv` or `.json` file containing batch inventory rows.
  - `markets_file` (optional): `.csv` or `.json` file containing market demand & route rows.
- **Response (`200 OK`):** Returns a complete `OptimizeResponse` JSON object with `ingestion_warnings` populated.

---

## 6. Reference Sample Payload (`OptimizeResponse`)

Use this exact structure in `/frontend/src/mocks/fallbackData.ts` and `/tests/test_solver.py`:

```json
{
  "status": "OPTIMAL",
  "solve_time_ms": 14.8,
  "batches": [
    {
      "batch_id": "B-101",
      "commodity": "Tomato",
      "quantity_kg": 1800.0,
      "rsl_hours": 18.0,
      "optimal_temp_c": 12.0,
      "spoilage_cost_per_kg": 14.0,
      "base_cost_per_kg": 18.0
    },
    {
      "batch_id": "B-102",
      "commodity": "Tomato",
      "quantity_kg": 2400.0,
      "rsl_hours": 48.0,
      "optimal_temp_c": 12.0,
      "spoilage_cost_per_kg": 14.0,
      "base_cost_per_kg": 18.0
    },
    {
      "batch_id": "B-103",
      "commodity": "Guava",
      "quantity_kg": 1500.0,
      "rsl_hours": 22.0,
      "optimal_temp_c": 10.0,
      "spoilage_cost_per_kg": 18.0,
      "base_cost_per_kg": 25.0
    }
  ],
  "markets": [
    {
      "market_id": "M1",
      "name": "Bengaluru Yeshwanthpur APMC",
      "lat": 13.0285,
      "lng": 77.5409,
      "transit_hours": 4.0,
      "transit_temp_c": 14.0,
      "transport_cost_per_kg": 2.5,
      "handling_hours": 3.0,
      "handling_cost_per_kg": 1.2,
      "max_capacity_kg": 4500.0,
      "demand_kg": { "Tomato": 1600.0, "Guava": 1200.0, "Banana": 1500.0 },
      "market_price_kg": { "Tomato": 38.0, "Guava": 52.0, "Banana": 32.0 }
    },
    {
      "market_id": "M3",
      "name": "Hyderabad Bowenpally Market",
      "lat": 17.4691,
      "lng": 78.4765,
      "transit_hours": 15.0,
      "transit_temp_c": 18.0,
      "transport_cost_per_kg": 7.5,
      "handling_hours": 5.0,
      "handling_cost_per_kg": 1.8,
      "max_capacity_kg": 5000.0,
      "demand_kg": { "Tomato": 1400.0, "Guava": 1300.0, "Banana": 1400.0 },
      "market_price_kg": { "Tomato": 50.0, "Guava": 66.0, "Banana": 42.0 }
    }
  ],
  "disruptions": {
    "highway_delay_hours": 0.0,
    "reefer_temp_spike_c": 0.0,
    "demand_multiplier": 1.0,
    "capacity_reduction_pct": 0.0
  },
  "constraint_audit": {
    "mass_balance_passed": true,
    "capacity_limits_passed": true,
    "shelf_life_limits_passed": true,
    "demand_caps_passed": true
  },
  "kpis": {
    "baseline": {
      "net_revenue": 142500.0,
      "gross_revenue": 210000.0,
      "transport_handling_cost": 38500.0,
      "discount_cost": 0.0,
      "spoilage_cost": 29000.0,
      "spoiled_kg": 1950.0,
      "spoilage_rate_pct": 15.73,
      "demand_fulfillment_pct": 78.4
    },
    "optimized": {
      "net_revenue": 198400.0,
      "gross_revenue": 248900.0,
      "transport_handling_cost": 43200.0,
      "discount_cost": 11400.0,
      "spoilage_cost": 7300.0,
      "spoiled_kg": 420.0,
      "spoilage_rate_pct": 3.39,
      "demand_fulfillment_pct": 96.2
    },
    "deltas": {
      "net_revenue_gain": 55900.0,
      "spoilage_reduction_pct": 78.46,
      "demand_fulfillment_gain_pct": 17.8
    }
  },
  "allocations": [
    {
      "batch_id": "B-101",
      "commodity": "Tomato",
      "market_id": "M1",
      "market_name": "Bengaluru Yeshwanthpur APMC",
      "quantity_kg": 1600.0,
      "discount_pct": 0,
      "effective_transit_rsl_hours": 7.59,
      "rsl_buffer_hours": 10.41,
      "status": "OPTIMAL_DISPATCH",
      "net_contribution": 54880.0,
      "reason": "FEFO Optimal Dispatch: 7.6h thermal-adjusted transit fits within 18h RSL (10.4h safe buffer); nets ₹34.3/kg."
    },
    {
      "batch_id": "B-101",
      "commodity": "Tomato",
      "market_id": "M1",
      "market_name": "Bengaluru Yeshwanthpur APMC",
      "quantity_kg": 200.0,
      "discount_pct": 15,
      "effective_transit_rsl_hours": 7.59,
      "rsl_buffer_hours": 10.41,
      "status": "OPTIMAL_DISPATCH",
      "net_contribution": 5720.0,
      "reason": "Urgent RSL (18h): Applied 15% markdown to unlock price-elastic demand at Bengaluru Yeshwanthpur APMC (10.4h buffer), avoiding ₹14/kg spoilage penalty."
    }
  ],
  "baseline_allocations": [
    {
      "batch_id": "B-101",
      "commodity": "Tomato",
      "market_id": "M3",
      "market_name": "Hyderabad Bowenpally Market",
      "quantity_kg": 1400.0,
      "discount_pct": 0,
      "effective_transit_rsl_hours": 27.74,
      "rsl_buffer_hours": -9.74,
      "status": "SPOILED_ON_ARRIVAL",
      "net_contribution": -32620.0,
      "reason": "FIFO shipped to highest nominal price market without thermal check: needed 27.7h effective RSL, had 18.0h (-9.7h deficit)."
    }
  ],
  "monte_carlo_summary": [
    {
      "sim_id": 1,
      "baseline_net_rev": 139200.0,
      "freshroute_net_rev": 195100.0,
      "baseline_spoilage_kg": 2100.0,
      "freshroute_spoilage_kg": 460.0
    },
    {
      "sim_id": 2,
      "baseline_net_rev": 134800.0,
      "freshroute_net_rev": 192400.0,
      "baseline_spoilage_kg": 2250.0,
      "freshroute_spoilage_kg": 510.0
    }
  ],
  "ingestion_warnings": []
}
```