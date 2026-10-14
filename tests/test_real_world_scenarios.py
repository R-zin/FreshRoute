"""
FreshRoute OS (PS 03) — Intensive Real-World Scenario Testing Suite
Validates solver performance against MoFPI / NABCONS benchmark scenarios:
  1. Scenario 1: Normal Harvest (Baseline Operations)
  2. Scenario 2: NH-44 Monsoon Blockade (+10h transit, 20% capacity reduction)
  3. Scenario 3: Reefer Cooling Failure (+8°C temperature spike, Q10 Arrhenius decay)
  4. Scenario 4: Corrupt Judge Stress Test (Fuzzy ingestion, missing values, dirty data)
  5. Monte Carlo Stochastic Stress Test (30 perturbation runs)
  6. End-to-End API Multipart Upload Stress Test
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.core.schemas import DisruptionOverrides, OptimizeRequest
from backend.core.solver import solve_scenario
from backend.ingestion.parser import parse_uploaded_files
from backend.main import app

DATASETS_DIR = Path(__file__).parent.parent / "datasets"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ==============================================================================
# 1. SCENARIO 1: NORMAL HARVEST (BASELINE OPERATIONS)
# ==============================================================================

def test_scenario_1_normal_harvest():
    """Verify Scenario 1 (Normal Harvest) achieves > ₹60k gain and zero spoilage."""
    scen_path = DATASETS_DIR / "scenario_1_normal_harvest.json"
    assert scen_path.exists(), f"Missing {scen_path}"

    with open(scen_path, "rb") as f:
        data = f.read()

    batches, markets, warnings = parse_uploaded_files(
        scenario_bytes=data,
        scenario_filename="scenario_1_normal_harvest.json",
    )
    assert len(batches) == 10
    assert len(markets) == 4

    res = solve_scenario(
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=DisruptionOverrides(),
        ),
        ingestion_warnings=warnings,
    )

    assert res.status in ("OPTIMAL", "FEASIBLE")
    assert res.constraint_audit.mass_balance_passed is True
    assert res.constraint_audit.capacity_limits_passed is True
    assert res.constraint_audit.shelf_life_limits_passed is True
    assert res.constraint_audit.demand_caps_passed is True

    # Economic outcome verification
    economic_gain = res.kpis.deltas.net_revenue_gain
    assert economic_gain >= 60_000.0, f"Expected gain >= 60k, got ₹{economic_gain:,.2f}"
    assert res.kpis.optimized.net_revenue > res.kpis.baseline.net_revenue
    assert res.kpis.optimized.spoiled_kg == 0.0


# ==============================================================================
# 2. SCENARIO 2: NH-44 MONSOON BLOCKADE (+10h Delay, 20% Capacity Reduction)
# ==============================================================================

def test_scenario_2_nh44_monsoon_blockade():
    """Verify Scenario 2 (NH-44 Monsoon Blockade) dynamically reroutes to proximal markets."""
    scen_path = DATASETS_DIR / "scenario_2_nh44_monsoon_blockade.json"
    assert scen_path.exists(), f"Missing {scen_path}"

    with open(scen_path, "rb") as f:
        data = f.read()

    batches, markets, warnings = parse_uploaded_files(
        scenario_bytes=data,
        scenario_filename="scenario_2_nh44_monsoon_blockade.json",
    )

    # Disruption: 10h highway delay + 20% capacity cut
    disruptions = DisruptionOverrides(
        highway_delay_hours=10.0,
        reefer_temp_spike_c=0.0,
        demand_multiplier=1.0,
        capacity_reduction_pct=20.0,
    )

    res = solve_scenario(
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=disruptions,
        ),
        ingestion_warnings=warnings,
    )

    assert res.status in ("OPTIMAL", "FEASIBLE")
    assert res.constraint_audit.mass_balance_passed is True
    assert res.constraint_audit.capacity_limits_passed is True
    assert res.constraint_audit.shelf_life_limits_passed is True

    # FreshRoute MILP prevents massive spoilage under corridor blockade
    economic_gain = res.kpis.deltas.net_revenue_gain
    assert economic_gain >= 60_000.0, f"Expected gain >= 60k under monsoon blockade, got ₹{economic_gain:,.2f}"
    assert res.kpis.optimized.spoilage_rate_pct < res.kpis.baseline.spoilage_rate_pct


# ==============================================================================
# 3. SCENARIO 3: REEFER COOLING FAILURE (+8°C Temp Spike, Arrhenius Decay)
# ==============================================================================

def test_scenario_3_reefer_cooling_failure():
    """Verify Scenario 3 thermal spike accelerates Q10 decay and triggers safe thermal pruning."""
    scen_path = DATASETS_DIR / "scenario_3_reefer_cooling_failure.json"
    assert scen_path.exists(), f"Missing {scen_path}"

    with open(scen_path, "rb") as f:
        data = f.read()

    batches, markets, warnings = parse_uploaded_files(
        scenario_bytes=data,
        scenario_filename="scenario_3_reefer_cooling_failure.json",
    )

    # Disruption: +8°C reefer thermal excursion
    disruptions = DisruptionOverrides(
        highway_delay_hours=0.0,
        reefer_temp_spike_c=8.0,
        demand_multiplier=1.0,
        capacity_reduction_pct=0.0,
    )

    res = solve_scenario(
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=disruptions,
        ),
        ingestion_warnings=warnings,
    )

    assert res.status in ("OPTIMAL", "FEASIBLE")
    assert res.constraint_audit.shelf_life_limits_passed is True

    # Under +8C, FIFO naively dispatches to distant mandis where produce spoils
    economic_gain = res.kpis.deltas.net_revenue_gain
    assert economic_gain >= 60_000.0, f"Expected gain >= 60k under cooling failure, got ₹{economic_gain:,.2f}"
    assert res.kpis.deltas.spoilage_reduction_pct > 50.0


# ==============================================================================
# 4. SCENARIO 4: CORRUPT JUDGE STRESS TEST (DIRTY INGESTION ROBUSTNESS)
# ==============================================================================

def test_scenario_4_corrupt_judge_stress_test():
    """Verify dirty CSV data (negative numbers, MT/days units, missing coordinates) is sanitized."""
    b_path = DATASETS_DIR / "scenario_4_corrupt_batches.csv"
    m_path = DATASETS_DIR / "scenario_4_corrupt_markets.csv"

    assert b_path.exists() and m_path.exists()

    with open(b_path, "rb") as fb, open(m_path, "rb") as fm:
        batches, markets, warnings = parse_uploaded_files(
            batches_bytes=fb.read(),
            batches_filename="scenario_4_corrupt_batches.csv",
            markets_bytes=fm.read(),
            markets_filename="scenario_4_corrupt_markets.csv",
        )

    # Validate fuzzy cleaning
    assert len(batches) >= 4
    assert len(markets) >= 2
    assert len(warnings) > 10

    # Ensure all negative values clamped to >= 0
    for b in batches:
        assert b.quantity_kg >= 0.0
        assert b.spoilage_cost_per_kg >= 0.0
        assert b.base_cost_per_kg >= 0.0

    # Solve should succeed with 0 crash
    res = solve_scenario(
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=DisruptionOverrides(),
        ),
        ingestion_warnings=warnings,
    )

    assert res.status == "OPTIMAL"
    assert res.constraint_audit.mass_balance_passed is True


# ==============================================================================
# 5. MONTE CARLO STOCHASTIC STRESS TEST (30 PERTURBATION RUNS)
# ==============================================================================

def test_monte_carlo_stochastic_dominance():
    """Verify FreshRoute MILP dominates Baseline FIFO across >= 90% of Monte Carlo runs."""
    from backend.core.default_data import get_default_batches, get_default_markets

    res = solve_scenario(
        request=OptimizeRequest(
            batches=get_default_batches(),
            markets=get_default_markets(),
            disruptions=DisruptionOverrides(highway_delay_hours=2.0, reefer_temp_spike_c=2.0),
        )
    )

    mc_runs = res.monte_carlo_summary
    assert len(mc_runs) == 30

    freshroute_wins = sum(1 for r in mc_runs if r.freshroute_net_rev >= r.baseline_net_rev)
    win_pct = (freshroute_wins / len(mc_runs)) * 100.0

    assert win_pct >= 90.0, f"Expected FreshRoute win rate >= 90%, got {win_pct:.1f}%"


# ==============================================================================
# 6. END-TO-END API MULTIPART UPLOADS FOR ALL BENCHMARK SCENARIOS
# ==============================================================================

@pytest.mark.parametrize(
    "scenario_name",
    [
        "scenario_1_normal_harvest.json",
        "scenario_2_nh44_monsoon_blockade.json",
        "scenario_3_reefer_cooling_failure.json",
    ],
)
def test_api_upload_dataset_unified_json(client: TestClient, scenario_name: str):
    """Test API multipart upload of each unified JSON scenario."""
    file_path = DATASETS_DIR / scenario_name
    assert file_path.exists()

    with open(file_path, "rb") as f:
        files = {"scenario_file": (scenario_name, f, "application/json")}
        res = client.post("/api/v1/upload-dataset", files=files)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("OPTIMAL", "FEASIBLE")
    assert data["constraint_audit"]["mass_balance_passed"] is True
    assert data["solve_time_ms"] > 0.0
