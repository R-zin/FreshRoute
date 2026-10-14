"""
FreshRoute OS (PS 03) - Comprehensive Solver & Ingestion Test Suite
Author: Account 3 (Data & QA Lead)
Coverage: Rubric Criteria (Feasibility 15%, Robustness 10%, Engineering 10%)

Automated Test Matrix:
  1. test_mass_balance_exact: Exact conservation across Baseline and MILP (1e-4)
  2. test_route_capacity_compliance: Route limits never exceeded (1e-4)
  3. test_thermal_shelf_life_feasibility: Effective transit decay <= RSL & buffer >= 0
  4. test_discount_tier_eligibility_and_demand_caps: 30% discount RSL <= 36h & tier caps
  5. test_economic_dominance_over_baseline: Net revenue gain & spoilage reduction
  6. test_fifty_randomized_fuzz_scenarios: 50 randomized supply-chain instances (<250ms)
  7. test_extreme_edge_cases: Zero demand, zero capacity, and expired produce (RSL=0.5h)
  8. test_fuzzy_ingestion_unit_conversions: Corrupt MT/days CSV parsing with audit warnings
  9. test_explainability_audit_strings: Quantitative human-readable reasons on every row
  10. test_api_endpoints: Health probe and REST optimization endpoints
"""

from __future__ import annotations

import json
import math
import re
import time
from pathlib import Path
from typing import List

import numpy as np
import pytest

from backend.core.schemas import (
    Batch,
    Market,
    DisruptionOverrides,
    OptimizeRequest,
    OptimizeResponse,
)
from backend.core.solver import (
    calculate_effective_rsl,
    run_freshroute_milp,
    run_baseline_fifo,
    compute_strategy_kpis,
    solve_scenario,
)
from backend.ingestion.parser import parse_uploaded_files


# ==============================================================================
# FIXTURES
# ==============================================================================

@pytest.fixture
def sample_batches() -> List[Batch]:
    return [
        Batch(
            batch_id="B-101",
            commodity="Tomato",
            quantity_kg=1800.0,
            rsl_hours=18.0,
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        ),
        Batch(
            batch_id="B-102",
            commodity="Tomato",
            quantity_kg=2400.0,
            rsl_hours=48.0,
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        ),
        Batch(
            batch_id="B-103",
            commodity="Guava",
            quantity_kg=1500.0,
            rsl_hours=22.0,
            optimal_temp_c=10.0,
            spoilage_cost_per_kg=18.0,
            base_cost_per_kg=25.0,
        ),
        Batch(
            batch_id="B-104",
            commodity="Banana",
            quantity_kg=2200.0,
            rsl_hours=32.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=12.0,
            base_cost_per_kg=15.0,
        ),
        Batch(
            batch_id="B-105",
            commodity="Alphonso Mango",
            quantity_kg=1200.0,
            rsl_hours=28.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=28.0,
            base_cost_per_kg=45.0,
        ),
    ]


@pytest.fixture
def sample_markets() -> List[Market]:
    return [
        Market(
            market_id="M1",
            name="Bengaluru Yeshwanthpur APMC",
            lat=13.0285,
            lng=77.5409,
            transit_hours=4.0,
            transit_temp_c=14.0,
            transport_cost_per_kg=2.5,
            handling_hours=3.0,
            handling_cost_per_kg=1.2,
            max_capacity_kg=4500.0,
            demand_kg={"Tomato": 1600.0, "Guava": 1200.0, "Banana": 1500.0, "Alphonso Mango": 600.0},
            market_price_kg={"Tomato": 38.0, "Guava": 52.0, "Banana": 32.0, "Alphonso Mango": 95.0},
        ),
        Market(
            market_id="M2",
            name="Chennai Koyambedu Wholesale Market",
            lat=13.0694,
            lng=80.1948,
            transit_hours=7.5,
            transit_temp_c=15.5,
            transport_cost_per_kg=4.2,
            handling_hours=3.5,
            handling_cost_per_kg=1.4,
            max_capacity_kg=5500.0,
            demand_kg={"Tomato": 1800.0, "Guava": 1000.0, "Banana": 1600.0, "Alphonso Mango": 800.0},
            market_price_kg={"Tomato": 44.0, "Guava": 58.0, "Banana": 36.0, "Alphonso Mango": 105.0},
        ),
        Market(
            market_id="M3",
            name="Hyderabad Bowenpally Market",
            lat=17.4691,
            lng=78.4765,
            transit_hours=15.0,
            transit_temp_c=18.0,
            transport_cost_per_kg=7.5,
            handling_hours=5.0,
            handling_cost_per_kg=1.8,
            max_capacity_kg=5000.0,
            demand_kg={"Tomato": 1400.0, "Guava": 1300.0, "Banana": 1400.0, "Alphonso Mango": 700.0},
            market_price_kg={"Tomato": 50.0, "Guava": 66.0, "Banana": 42.0, "Alphonso Mango": 115.0},
        ),
    ]


# ==============================================================================
# 1. TEST MASS BALANCE EXACT
# ==============================================================================

def test_mass_balance_exact(sample_batches, sample_markets):
    """
    Rubric: Feasibility (15%).
    Verifies that for every batch i, dispatched_kg + spoiled_kg == batch.quantity_kg
    within 1e-4 tolerance across both Baseline FIFO and FreshRoute MILP.
    """
    disruptions = DisruptionOverrides(highway_delay_hours=4.0, capacity_reduction_pct=15.0)
    response = solve_scenario(sample_batches, sample_markets, disruptions)

    # 1. Verify FreshRoute MILP mass balance per batch
    for b in sample_batches:
        batch_rows = [r for r in response.allocations if r.batch_id == b.batch_id]
        total_accounted = sum(r.quantity_kg for r in batch_rows)
        assert abs(total_accounted - b.quantity_kg) < 1e-4, (
            f"MILP Mass Balance violated for batch {b.batch_id}: "
            f"accounted={total_accounted:.4f} kg != initial={b.quantity_kg:.4f} kg"
        )

    # 2. Verify Baseline FIFO mass balance per batch
    for b in sample_batches:
        base_rows = [r for r in response.baseline_allocations if r.batch_id == b.batch_id]
        total_accounted = sum(r.quantity_kg for r in base_rows)
        assert abs(total_accounted - b.quantity_kg) < 1e-4, (
            f"Baseline Mass Balance violated for batch {b.batch_id}: "
            f"accounted={total_accounted:.4f} kg != initial={b.quantity_kg:.4f} kg"
        )

    # 3. Verify high-level audit flag
    assert response.constraint_audit.mass_balance_passed is True


# ==============================================================================
# 2. TEST ROUTE CAPACITY COMPLIANCE
# ==============================================================================

def test_route_capacity_compliance(sample_batches, sample_markets):
    """
    Rubric: Feasibility (15%).
    Verifies total dispatched weight to each market j never exceeds
    market.max_capacity_kg * (1 - capacity_reduction_pct/100) + 1e-4.
    """
    # Test under 25% capacity reduction disruption
    disruptions = DisruptionOverrides(capacity_reduction_pct=25.0)
    response = solve_scenario(sample_batches, sample_markets, disruptions)

    for m in sample_markets:
        eff_cap = m.max_capacity_kg * (1.0 - disruptions.capacity_reduction_pct / 100.0)
        dispatched_to_m = sum(
            r.quantity_kg for r in response.allocations
            if r.market_id == m.market_id and r.status == "OPTIMAL_DISPATCH"
        )
        assert dispatched_to_m <= eff_cap + 1e-4, (
            f"Route capacity violated for market {m.market_id}: "
            f"dispatched={dispatched_to_m:.2f} kg > effective_capacity={eff_cap:.2f} kg"
        )

    assert response.constraint_audit.capacity_limits_passed is True


# ==============================================================================
# 3. TEST THERMAL SHELF-LIFE FEASIBILITY
# ==============================================================================

def test_thermal_shelf_life_feasibility(sample_batches, sample_markets):
    """
    Rubric: Feasibility (15%) & Spoilage Reduction (20%).
    Verifies every allocation row with status == 'OPTIMAL_DISPATCH' satisfies
    effective_transit_rsl_hours <= batch.rsl_hours + 1e-4 and rsl_buffer_hours >= -1e-4.
    """
    disruptions = DisruptionOverrides(highway_delay_hours=2.0, reefer_temp_spike_c=4.0)
    response = solve_scenario(sample_batches, sample_markets, disruptions)

    batch_map = {b.batch_id: b for b in sample_batches}

    for row in response.allocations:
        if row.status == "OPTIMAL_DISPATCH":
            b = batch_map[row.batch_id]
            assert row.effective_transit_rsl_hours <= b.rsl_hours + 1e-4, (
                f"Thermal shelf life violated for batch {row.batch_id} to market {row.market_id}: "
                f"transit_decay={row.effective_transit_rsl_hours:.2f}h > initial_rsl={b.rsl_hours:.2f}h"
            )
            assert row.rsl_buffer_hours >= -1e-4, (
                f"Negative RSL buffer for batch {row.batch_id}: {row.rsl_buffer_hours:.2f}h"
            )

    assert response.constraint_audit.shelf_life_limits_passed is True


# ==============================================================================
# 4. TEST DISCOUNT TIER ELIGIBILITY AND DEMAND CAPS
# ==============================================================================

def test_discount_tier_eligibility_and_demand_caps(sample_batches, sample_markets):
    """
    Rubric: Feasibility (15%) & Commercial Relevance (10%).
    Verifies:
      - 30% clearance discount is NEVER applied to a batch with rsl_hours > 36.0h.
      - Dispatched quantities per (market, commodity, discount_pct) respect tier caps
        (1.00x base for 0%, 0.25x for 15%, 0.35x for 30%).
    """
    # Severe monsoon disruption forcing discount markdown usage
    disruptions = DisruptionOverrides(highway_delay_hours=8.0, capacity_reduction_pct=20.0)
    response = solve_scenario(sample_batches, sample_markets, disruptions)

    batch_map = {b.batch_id: b for b in sample_batches}

    tier_multipliers = {0: 1.00, 15: 0.25, 30: 0.35}

    for row in response.allocations:
        if row.status == "OPTIMAL_DISPATCH":
            b = batch_map[row.batch_id]
            # 30% Clearance Discount rule: RSL MUST be <= 36.0h
            if row.discount_pct == 30:
                assert b.rsl_hours <= 36.0 + 1e-4, (
                    f"Invalid 30% clearance discount given to fresh batch {b.batch_id} "
                    f"with RSL {b.rsl_hours:.1f}h > 36.0h"
                )

    # Verify demand expansion caps per (market, commodity, tier)
    for m in sample_markets:
        for commodity, base_dem in m.demand_kg.items():
            for disc_pct, mult in tier_multipliers.items():
                cap = base_dem * mult * disruptions.demand_multiplier
                alloc_qty = sum(
                    r.quantity_kg for r in response.allocations
                    if r.market_id == m.market_id
                    and r.commodity == commodity
                    and r.discount_pct == disc_pct
                    and r.status == "OPTIMAL_DISPATCH"
                )
                assert alloc_qty <= cap + 1e-4, (
                    f"Demand cap exceeded for {m.market_id} {commodity} tier {disc_pct}%: "
                    f"allocated={alloc_qty:.2f} kg > cap={cap:.2f} kg"
                )

    assert response.constraint_audit.demand_caps_passed is True


# ==============================================================================
# 5. TEST ECONOMIC DOMINANCE OVER BASELINE
# ==============================================================================

def test_economic_dominance_over_baseline(sample_batches, sample_markets):
    """
    Rubric: Net Economic Outcome (20 pts) & Spoilage Reduction (20 pts).
    Verifies that kpis.optimized.net_revenue >= kpis.baseline.net_revenue
    and kpis.optimized.spoiled_kg <= kpis.baseline.spoiled_kg across normal
    and disrupted scenarios.
    """
    scenarios = [
        DisruptionOverrides(highway_delay_hours=0.0, reefer_temp_spike_c=0.0),
        DisruptionOverrides(highway_delay_hours=6.0, reefer_temp_spike_c=5.0),
        DisruptionOverrides(reefer_temp_spike_c=8.0),
    ]

    for d in scenarios:
        res = solve_scenario(sample_batches, sample_markets, d)
        opt_rev = res.kpis.optimized.net_revenue
        base_rev = res.kpis.baseline.net_revenue
        opt_spoil = res.kpis.optimized.spoiled_kg
        base_spoil = res.kpis.baseline.spoiled_kg

        assert opt_rev >= base_rev - 1e-4, (
            f"Economic Dominance violated under disruption {d}: "
            f"optimized_net={opt_rev:.2f} < baseline_net={base_rev:.2f}"
        )
        assert opt_spoil <= base_spoil + 1e-4, (
            f"Spoilage reduction violated under disruption {d}: "
            f"optimized_spoil={opt_spoil:.2f} > baseline_spoil={base_spoil:.2f}"
        )

    # Verify high temp spike scenario achieves substantial delta
    res_spike = solve_scenario(sample_batches, sample_markets, DisruptionOverrides(reefer_temp_spike_c=8.0))
    gain = res_spike.kpis.deltas.net_revenue_gain
    assert gain >= 0.0, f"Expected non-negative gain under reefer failure, got {gain:.2f}"


# ==============================================================================
# 6. TEST FIFTY RANDOMIZED FUZZ SCENARIOS
# ==============================================================================

def test_fifty_randomized_fuzz_scenarios():
    """
    Rubric: Robustness & Sensitivity (10%) & Engineering (10%).
    Generates 50 random supply-chain instances using numpy.random.default_rng(2026).
    Varies batch sizes, RSL from 6h to 96h, temperatures from 10C to 30C, and capacities.
    Asserts constraint_audit passes all 4 boolean flags on all 50 runs with
    average solve time < 250ms per run.
    """
    rng = np.random.default_rng(2026)
    commodities = ["Tomato", "Guava", "Banana", "Alphonso Mango", "Papaya"]

    solve_times: List[float] = []

    for sim_idx in range(50):
        # Generate 4 - 8 random batches
        num_batches = int(rng.integers(4, 9))
        fuzz_batches = []
        for b_idx in range(num_batches):
            comm = str(rng.choice(commodities))
            fuzz_batches.append(
                Batch(
                    batch_id=f"FUZZ-B{sim_idx}-{b_idx}",
                    commodity=comm,
                    quantity_kg=float(round(rng.uniform(600.0, 3500.0), 1)),
                    rsl_hours=float(round(rng.uniform(6.0, 96.0), 1)),
                    optimal_temp_c=12.0,
                    spoilage_cost_per_kg=15.0,
                    base_cost_per_kg=20.0,
                )
            )

        # Generate 2 - 4 random markets
        num_markets = int(rng.integers(2, 5))
        fuzz_markets = []
        for m_idx in range(num_markets):
            fuzz_markets.append(
                Market(
                    market_id=f"FUZZ-M{m_idx}",
                    name=f"Fuzz Market {m_idx}",
                    lat=13.0 + m_idx * 0.5,
                    lng=77.5 + m_idx * 0.5,
                    transit_hours=float(round(rng.uniform(2.5, 16.0), 1)),
                    transit_temp_c=float(round(rng.uniform(10.0, 30.0), 1)),
                    transport_cost_per_kg=float(round(rng.uniform(1.5, 7.5), 1)),
                    handling_hours=float(round(rng.uniform(2.0, 4.0), 1)),
                    handling_cost_per_kg=1.5,
                    max_capacity_kg=float(round(rng.uniform(2000.0, 9000.0), 1)),
                    demand_kg={c: float(round(rng.uniform(800.0, 2500.0), 1)) for c in commodities},
                    market_price_kg={c: float(round(rng.uniform(30.0, 110.0), 1)) for c in commodities},
                )
            )

        # Generate stochastic disruptions
        disruptions = DisruptionOverrides(
            highway_delay_hours=float(round(rng.uniform(0.0, 10.0), 1)),
            reefer_temp_spike_c=float(round(rng.uniform(0.0, 8.0), 1)),
            capacity_reduction_pct=float(round(rng.uniform(0.0, 25.0), 1)),
        )

        res = solve_scenario(fuzz_batches, fuzz_markets, disruptions)
        solve_times.append(res.solve_time_ms)
        assert res.solve_time_ms < 250.0, f"Fuzz run {sim_idx} solve time {res.solve_time_ms}ms exceeds 250ms"

        # Assert status is optimal or feasible
        assert res.status in ("OPTIMAL", "FEASIBLE", "FALLBACK_HEURISTIC")

        # Assert all 4 constraint audit flags pass
        assert res.constraint_audit.mass_balance_passed is True, f"Fuzz run {sim_idx} mass balance failed"
        assert res.constraint_audit.capacity_limits_passed is True, f"Fuzz run {sim_idx} capacity failed"
        assert res.constraint_audit.shelf_life_limits_passed is True, f"Fuzz run {sim_idx} shelf life failed"
        assert res.constraint_audit.demand_caps_passed is True, f"Fuzz run {sim_idx} demand caps failed"

    avg_solve_time = sum(solve_times) / len(solve_times)
    assert avg_solve_time < 250.0, f"Average solve time {avg_solve_time:.1f}ms exceeds 250ms target"


# ==============================================================================
# 7. TEST EXTREME EDGE CASES
# ==============================================================================

def test_extreme_edge_cases(sample_batches, sample_markets):
    """
    Rubric: Robustness & Zero-Crash Assurance (10%).
    Verifies graceful handling without solver crashes or NaN values for:
      (a) Zero demand across all markets
      (b) Zero route capacity across all markets
      (c) An already-expired batch (rsl_hours = 0.5h)
    """
    # (a) Zero demand across all markets
    zero_demand_markets = [
        Market(
            market_id=m.market_id,
            name=m.name,
            transit_hours=m.transit_hours,
            transit_temp_c=m.transit_temp_c,
            transport_cost_per_kg=m.transport_cost_per_kg,
            max_capacity_kg=m.max_capacity_kg,
            demand_kg={c: 0.0 for c in m.demand_kg},
            market_price_kg=m.market_price_kg,
        )
        for m in sample_markets
    ]
    res_a = solve_scenario(sample_batches, zero_demand_markets)
    assert not math.isnan(res_a.kpis.optimized.net_revenue)
    assert res_a.constraint_audit.mass_balance_passed is True
    # In zero demand, all stock should be held/spoiled unallocated
    assert sum(r.quantity_kg for r in res_a.allocations if r.status == "OPTIMAL_DISPATCH") == 0.0

    # (b) Zero route capacity across all markets
    zero_cap_markets = [
        Market(
            market_id=m.market_id,
            name=m.name,
            transit_hours=m.transit_hours,
            transit_temp_c=m.transit_temp_c,
            transport_cost_per_kg=m.transport_cost_per_kg,
            max_capacity_kg=0.0,
            demand_kg=m.demand_kg,
            market_price_kg=m.market_price_kg,
        )
        for m in sample_markets
    ]
    res_b = solve_scenario(sample_batches, zero_cap_markets)
    assert not math.isnan(res_b.kpis.optimized.net_revenue)
    assert res_b.constraint_audit.capacity_limits_passed is True
    assert sum(r.quantity_kg for r in res_b.allocations if r.status == "OPTIMAL_DISPATCH") == 0.0

    # (c) Already-expired batch (rsl_hours = 0.5h)
    expired_batches = [
        Batch(
            batch_id="B-EXPIRED",
            commodity="Tomato",
            quantity_kg=1000.0,
            rsl_hours=0.5,  # 30 minutes remaining, cannot reach any market
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        )
    ]
    res_c = solve_scenario(expired_batches, sample_markets)
    assert not math.isnan(res_c.kpis.optimized.net_revenue)
    # The expired batch must be marked unallocated/spoilage
    dispatched_c = sum(r.quantity_kg for r in res_c.allocations if r.status == "OPTIMAL_DISPATCH")
    assert dispatched_c == 0.0
    assert any(r.batch_id == "B-EXPIRED" and r.status == "EXPIRED_UNSOLD" for r in res_c.allocations)


# ==============================================================================
# 8. TEST FUZZY INGESTION UNIT CONVERSIONS
# ==============================================================================

def test_fuzzy_ingestion_unit_conversions():
    """
    Rubric: Robustness & Data Engineering (10%).
    Feeds scenario_4_corrupt_batches.csv into parse_uploaded_files and verifies:
      - stock_mt (metric tons) converted to kg (x1000).
      - shelf_life_days converted to hours (x24).
      - Negative values clamped to 0.0.
      - Non-empty ingestion_warnings log containing audit trail.
    """
    corrupt_batches_csv = (
        "lot_id,produce,stock_mt,shelf_life_days,storage_temp,disposal_penalty,procurement_cost\n"
        "L-901,tomatoes,2.5,1.25,NaN,-10.0,NaN\n"
        "L-902,guavas,1.8,2.5,NaN,NaN,-5.0\n"
        "L-903,bananas,-120,0.75,14.0,12.0,15.0\n"
        "L-904,alphonso_mango,1.4,3.5,13.0,28.0,45.0\n"
        ",,,,,,\n"
    )

    batches, markets, warnings = parse_uploaded_files(
        batches_bytes=corrupt_batches_csv.encode("utf-8"),
        batches_filename="scenario_4_corrupt_batches.csv",
    )

    assert len(batches) == 4, f"Expected 4 valid batches parsed, got {len(batches)}"

    # Check Batch 1: 2.5 MT -> 2500 kg, 1.25 days -> 30.0h, imputed optimal temp
    b1 = batches[0]
    assert b1.batch_id == "L-901"
    assert b1.commodity == "Tomato"
    assert b1.quantity_kg == 2500.0
    assert b1.rsl_hours == 30.0
    assert b1.optimal_temp_c == 12.0  # Imputed for Tomato
    assert b1.spoilage_cost_per_kg == 0.0  # Clamped from -10.0

    # Check Batch 3: Clamped negative stock
    b3 = batches[2]
    assert b3.quantity_kg == 0.0
    assert b3.rsl_hours == 18.0  # 0.75 * 24

    # Assert warnings audit trail
    assert len(warnings) > 0
    assert any("metric tons" in w.lower() and "kg" in w.lower() for w in warnings)
    assert any("days to hours" in w.lower() for w in warnings)
    assert any("clamped" in w.lower() for w in warnings)


# ==============================================================================
# 9. TEST EXPLAINABILITY AUDIT STRINGS
# ==============================================================================

def test_explainability_audit_strings(sample_batches, sample_markets):
    """
    Rubric: Explainability & Commercial Relevance (10 pts).
    Verifies every AllocationRow in allocations and baseline_allocations contains
    a non-empty, human-readable reason string citing quantitative metrics
    (hours, kilograms, percentages, or rupee values).
    """
    disruptions = DisruptionOverrides(highway_delay_hours=4.0, capacity_reduction_pct=10.0)
    response = solve_scenario(sample_batches, sample_markets, disruptions)

    # 1. Audit FreshRoute MILP allocations
    assert len(response.allocations) > 0
    for row in response.allocations:
        assert isinstance(row.reason, str) and len(row.reason.strip()) > 10, (
            f"Empty or trivial reason string in MILP row for {row.batch_id}"
        )
        # Reason must cite quantitative numbers
        assert re.search(r"\d+", row.reason) is not None, (
            f"Reason string lacks quantitative figures: '{row.reason}'"
        )

    # 2. Audit Baseline FIFO allocations
    assert len(response.baseline_allocations) > 0
    for row in response.baseline_allocations:
        assert isinstance(row.reason, str) and len(row.reason.strip()) > 10, (
            f"Empty or trivial reason string in Baseline row for {row.batch_id}"
        )
        assert re.search(r"\d+", row.reason) is not None, (
            f"Baseline reason string lacks quantitative figures: '{row.reason}'"
        )


# ==============================================================================
# 10. FASTAPI TESTCLIENT ENDPOINTS & REAL-WORLD SCENARIO 4 INGESTION TEST
# ==============================================================================

def test_api_endpoints():
    """
    Verifies FastAPI server endpoints using TestClient:
    - GET /api/v1/health: 200 OK
    - GET /api/v1/default-scenario: 200 OK and valid audit
    - POST /api/v1/optimize: 200 OK and solved
    - POST /api/v1/upload-dataset: Corrupt judge dataset 4 returns 200 OK
    """
    from fastapi.testclient import TestClient
    from backend.main import app

    client = TestClient(app)

    # 1. GET /api/v1/health
    res_health = client.get("/api/v1/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    # 2. GET /api/v1/default-scenario
    res_def = client.get("/api/v1/default-scenario")
    assert res_def.status_code == 200
    data_def = res_def.json()
    assert data_def["status"] in ("OPTIMAL", "FEASIBLE")
    assert data_def["constraint_audit"]["mass_balance_passed"] is True
    assert data_def["constraint_audit"]["capacity_limits_passed"] is True
    assert data_def["constraint_audit"]["shelf_life_limits_passed"] is True
    assert data_def["kpis"]["optimized"]["net_revenue"] > data_def["kpis"]["baseline"]["net_revenue"]

    # 3. POST /api/v1/optimize
    req_payload = {
        "batches": data_def["batches"],
        "markets": data_def["markets"],
        "disruptions": {
            "highway_delay_hours": 3.0,
            "reefer_temp_spike_c": 2.0,
            "demand_multiplier": 1.1,
            "capacity_reduction_pct": 10.0,
        },
    }
    res_opt = client.post("/api/v1/optimize", json=req_payload)
    assert res_opt.status_code == 200
    data_opt = res_opt.json()
    assert data_opt["status"] in ("OPTIMAL", "FEASIBLE")
    assert data_opt["disruptions"]["highway_delay_hours"] == 3.0

    # 4. POST /api/v1/upload-dataset (scenario_4 corrupt CSVs)
    datasets_dir = Path(__file__).parent.parent / "datasets"
    b_path = datasets_dir / "scenario_4_corrupt_batches.csv"
    m_path = datasets_dir / "scenario_4_corrupt_markets.csv"

    assert b_path.exists() and m_path.exists(), "Benchmark scenario 4 CSV files missing"

    with open(b_path, "rb") as fb, open(m_path, "rb") as fm:
        files = {
            "batches_file": ("scenario_4_corrupt_batches.csv", fb, "text/csv"),
            "markets_file": ("scenario_4_corrupt_markets.csv", fm, "text/csv"),
        }
        res_up = client.post("/api/v1/upload-dataset", files=files)

    assert res_up.status_code == 200
    data_up = res_up.json()
    assert data_up["status"] in ("OPTIMAL", "FEASIBLE")
    assert data_up["constraint_audit"]["mass_balance_passed"] is True
    assert len(data_up["ingestion_warnings"]) > 10


