"""
FreshRoute OS Test Suite
Validates mathematical rules, Q10 thermal degradation, 1D MILP vectorization,
cost accounting ledger, and FastAPI REST endpoints against SHARED_API_CONTRACT.md.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.schemas import Batch, Market, DisruptionOverrides, OptimizeRequest
from backend.core.solver import (
    calculate_effective_rsl,
    run_freshroute_milp,
    run_baseline_fifo,
    compute_strategy_kpis,
    solve_scenario,
)


@pytest.fixture
def sample_batches():
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
    ]


@pytest.fixture
def sample_markets():
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
            demand_kg={"Tomato": 1600.0, "Guava": 1200.0, "Banana": 1500.0},
            market_price_kg={"Tomato": 38.0, "Guava": 52.0, "Banana": 32.0},
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
            demand_kg={"Tomato": 1400.0, "Guava": 1300.0, "Banana": 1400.0},
            market_price_kg={"Tomato": 50.0, "Guava": 66.0, "Banana": 42.0},
        ),
    ]


def test_q10_thermal_formula():
    """Verify Q10 calculations match SHARED_API_CONTRACT.md Section 6 values."""
    # B-101 to M1: 4h transit @ 14C (optimal 12C), 3h handling
    # delta_T = 2.0C -> 2.0^(0.2) ~= 1.1487 -> 4.0 * 1.1487 + 3.0 ~= 7.59h
    eff_rsl_m1 = calculate_effective_rsl(4.0, 14.0, 12.0, 3.0)
    assert eff_rsl_m1 == 7.59
    assert round(18.0 - eff_rsl_m1, 2) == 10.41

    # B-101 to M3: 15h transit @ 18C (optimal 12C), 5h handling
    # delta_T = 6.0C -> 2.0^(0.6) ~= 1.5157 -> 15.0 * 1.5157 + 5.0 ~= 27.74h
    eff_rsl_m3 = calculate_effective_rsl(15.0, 18.0, 12.0, 5.0)
    assert eff_rsl_m3 == 27.74
    assert round(18.0 - eff_rsl_m3, 2) == -9.74


def test_freshroute_milp_thermal_pruning(sample_batches, sample_markets):
    """Verify MILP never dispatches to thermally infeasible routes."""
    disruptions = DisruptionOverrides()
    allocations, _, status = run_freshroute_milp(sample_batches, sample_markets, disruptions)
    
    assert status == "OPTIMAL"
    for alloc in allocations:
        if alloc.status == "OPTIMAL_DISPATCH":
            assert alloc.rsl_buffer_hours >= 0.0, (
                f"Batch {alloc.batch_id} to {alloc.market_id} dispatched with negative buffer {alloc.rsl_buffer_hours}"
            )


def test_baseline_fifo_spoils_thermally_infeasible(sample_batches, sample_markets):
    """Verify Baseline FIFO operator dispatches to high-price M3 and spoils."""
    disruptions = DisruptionOverrides()
    allocations, _ = run_baseline_fifo(sample_batches, sample_markets, disruptions)
    
    # First batch B-101 (Tomato, 1800kg) routed to M3 (price 50 vs 38)
    spoiled = [a for a in allocations if a.status == "SPOILED_ON_ARRIVAL"]
    assert len(spoiled) > 0
    first_spoil = spoiled[0]
    assert first_spoil.batch_id == "B-101"
    assert first_spoil.market_id == "M3"
    assert first_spoil.rsl_buffer_hours < 0.0


def test_shared_cost_ledger_identity(sample_batches, sample_markets):
    """Verify net_revenue = gross_revenue - transport_handling_cost - spoilage_cost strictly holds."""
    disruptions = DisruptionOverrides()
    resp = solve_scenario(sample_batches, sample_markets, disruptions)

    # Check for Optimized
    opt = resp.kpis.optimized
    calc_opt_net = round(opt.gross_revenue - opt.transport_handling_cost - opt.spoilage_cost, 2)
    assert abs(opt.net_revenue - calc_opt_net) < 0.05

    # Check for Baseline
    base = resp.kpis.baseline
    calc_base_net = round(base.gross_revenue - base.transport_handling_cost - base.spoilage_cost, 2)
    assert abs(base.net_revenue - calc_base_net) < 0.05


def test_constraint_audits_pass(sample_batches, sample_markets):
    """Verify all 4 constraint audit checks pass in solve_scenario."""
    disruptions = DisruptionOverrides()
    resp = solve_scenario(sample_batches, sample_markets, disruptions)
    assert resp.constraint_audit.mass_balance_passed is True
    assert resp.constraint_audit.capacity_limits_passed is True
    assert resp.constraint_audit.shelf_life_limits_passed is True
    assert resp.constraint_audit.demand_caps_passed is True


def test_monte_carlo_output(sample_batches, sample_markets):
    """Verify Monte Carlo summary is populated with 5 simulation iterations."""
    disruptions = DisruptionOverrides()
    resp = solve_scenario(sample_batches, sample_markets, disruptions)
    assert len(resp.monte_carlo_summary) == 5
    for run in resp.monte_carlo_summary:
        assert run.sim_id >= 1
        assert isinstance(run.baseline_net_rev, float)
        assert isinstance(run.freshroute_net_rev, float)


def test_api_health():
    """Verify GET /api/v1/health returns exact contract payload."""
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "FreshRoute OS MILP Engine",
        "solver": "SciPy HiGHS",
    }


def test_api_default_scenario():
    """Verify GET /api/v1/default-scenario returns complete OptimizeResponse."""
    client = TestClient(app)
    response = client.get("/api/v1/default-scenario")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("OPTIMAL", "FEASIBLE")
    assert "kpis" in data
    assert "deltas" in data["kpis"]
    assert "allocations" in data
    assert "baseline_allocations" in data
    assert "monte_carlo_summary" in data
    assert len(data["batches"]) > 0
    assert len(data["markets"]) > 0


def test_api_optimize(sample_batches, sample_markets):
    """Verify POST /api/v1/optimize re-solves correctly."""
    client = TestClient(app)
    req = {
        "batches": [b.model_dump() for b in sample_batches],
        "markets": [m.model_dump() for m in sample_markets],
        "disruptions": {
            "highway_delay_hours": 2.0,
            "reefer_temp_spike_c": 3.0,
            "demand_multiplier": 1.2,
            "capacity_reduction_pct": 10.0,
        },
    }
    response = client.post("/api/v1/optimize", json=req)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("OPTIMAL", "FEASIBLE")
    assert data["disruptions"]["highway_delay_hours"] == 2.0


def test_api_upload_dataset_json():
    """Verify POST /api/v1/upload-dataset with scenario JSON file."""
    client = TestClient(app)
    scenario_content = {
        "batches": [
            {"batch_id": "T-1", "commodity": "Tomato", "quantity_kg": 1000.0, "rsl_hours": 20.0}
        ],
        "markets": [
            {
                "market_id": "M1",
                "name": "Bengaluru APMC",
                "transit_hours": 4.0,
                "transit_temp_c": 14.0,
                "transport_cost_per_kg": 2.0,
                "max_capacity_kg": 2000.0,
                "demand_kg": {"Tomato": 1000.0},
                "market_price_kg": {"Tomato": 40.0},
            }
        ],
        "disruptions": {"highway_delay_hours": 0.0},
    }
    import json
    files = {
        "scenario_file": ("scenario.json", json.dumps(scenario_content), "application/json")
    }
    response = client.post("/api/v1/upload-dataset", files=files)
    assert response.status_code == 200
    data = response.json()
    assert len(data["batches"]) == 1
    assert data["batches"][0]["batch_id"] == "T-1"
    # optimal_temp_c was imputed from lookup
    assert data["batches"][0]["optimal_temp_c"] == 12.0
    assert len(data["ingestion_warnings"]) > 0
