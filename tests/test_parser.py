"""
FreshRoute OS (PS 03) - Ingestion and Fuzzy Parser Unit Tests
Verifies robust data parsing, fuzzy column mapping, cold-chain imputation,
and zero-crash behavior across diverse CSV and JSON formats.
"""

import io
import json
import pytest
import pandas as pd
from backend.ingestion.parser import (
    parse_batches_df,
    parse_markets_df,
    parse_uploaded_files,
    parse_uploaded_dataset,
    resolve_market_lat_lng,
)
from backend.core.schemas import Batch, Market


def test_fuzzy_alias_mapping_and_unit_conversion():
    csv_data = """lot_id,crop,stock_mt,shelf_life_days,storage_temp
B-01,Tomato,2.5,2.0,12.0
B-02,Guava,1.0,3.0,10.0
"""
    df = pd.read_csv(io.StringIO(csv_data))
    batches, warnings = parse_batches_df(df)

    assert len(batches) == 2
    # Verify unit conversions: MT -> kg (x1000) and days -> hours (x24)
    assert batches[0].batch_id == "B-01"
    assert batches[0].commodity == "Tomato"
    assert batches[0].quantity_kg == 2500.0
    assert batches[0].rsl_hours == 48.0
    assert batches[0].optimal_temp_c == 12.0

    assert batches[1].batch_id == "B-02"
    assert batches[1].commodity == "Guava"
    assert batches[1].quantity_kg == 1000.0
    assert batches[1].rsl_hours == 72.0

    # Ensure audit warnings were generated
    assert any("metric tons" in w.lower() and "kg" in w.lower() for w in warnings)
    assert any("days to hours" in w.lower() for w in warnings)


def test_cold_chain_defaults_imputation():
    csv_data = """batch_id,commodity,quantity_kg,rsl_hours
B-99,Banana,500.0,30.0
"""
    df = pd.read_csv(io.StringIO(csv_data))
    batches, warnings = parse_batches_df(df)

    assert len(batches) == 1
    b = batches[0]
    # Banana cold-chain defaults: optimal_temp_c = 13.0, spoilage_cost_per_kg = 12.0, base_cost_per_kg = 15.0
    assert b.optimal_temp_c == 13.0
    assert b.spoilage_cost_per_kg == 12.0
    assert b.base_cost_per_kg == 15.0
    assert any("Imputed optimal_temp_c" in w for w in warnings)


def test_market_long_format_parsing():
    csv_data = """market_id,name,transit_hours,transit_temp_c,transport_cost_per_kg,max_capacity_kg,commodity,demand_kg,market_price
M-BLR,Bengaluru APMC,4.0,14.0,2.0,5000.0,Tomato,2000.0,40.0
M-BLR,Bengaluru APMC,4.0,14.0,2.0,5000.0,Guava,1500.0,55.0
"""
    df = pd.read_csv(io.StringIO(csv_data))
    markets, warnings = parse_markets_df(df)

    assert len(markets) == 1
    m = markets[0]
    assert m.market_id == "M-BLR"
    assert m.name == "Bengaluru APMC"
    assert m.demand_kg["Tomato"] == 2000.0
    assert m.demand_kg["Guava"] == 1500.0
    assert m.market_price_kg["Tomato"] == 40.0
    assert m.market_price_kg["Guava"] == 55.0
    assert m.lat is not None and m.lng is not None


def test_market_wide_format_parsing():
    csv_data = """market_id,name,travel_time,truck_temp,freight_cost,capacity_kg,demand_tomato,price_tomato,demand_guava,price_guava
M-CHN,Chennai Koyambedu,8.0,15.0,3.5,4000.0,1800.0,42.0,1200.0,60.0
"""
    df = pd.read_csv(io.StringIO(csv_data))
    markets, warnings = parse_markets_df(df)

    assert len(markets) == 1
    m = markets[0]
    assert m.market_id == "M-CHN"
    assert m.demand_kg["Tomato"] == 1800.0
    assert m.demand_kg["Guava"] == 1200.0
    assert m.market_price_kg["Tomato"] == 42.0
    assert m.market_price_kg["Guava"] == 60.0


def test_dirty_data_clamping_and_resilience():
    csv_data = """lot_id,commodity,stock,shelf_life,spoilage_cost,base_cost
B-DIRTY,Tomato,-100.0,-5.0,-10.0,-20.0
,,,
"""
    df = pd.read_csv(io.StringIO(csv_data))
    batches, warnings = parse_batches_df(df)

    assert len(batches) == 1
    b = batches[0]
    # Negative values must be clamped to 0.0
    assert b.quantity_kg == 0.0
    assert b.rsl_hours == 0.0
    assert b.spoilage_cost_per_kg == 0.0
    assert b.base_cost_per_kg == 0.0
    assert any("Clamped negative" in w for w in warnings)


def test_parse_uploaded_files_json():
    scenario_payload = {
        "batches": [
            {"batch_id": "J-1", "commodity": "Tomato", "quantity_kg": 1200.0, "rsl_hours": 24.0}
        ],
        "markets": [
            {
                "market_id": "M-HYD",
                "name": "Hyderabad Bowenpally",
                "transit_hours": 12.0,
                "transit_temp_c": 15.0,
                "transport_cost_per_kg": 4.5,
                "max_capacity_kg": 3000.0,
                "demand_kg": {"Tomato": 1000.0},
                "market_price_kg": {"Tomato": 45.0},
            }
        ]
    }
    raw_bytes = json.dumps(scenario_payload).encode("utf-8")
    batches, markets, warnings = parse_uploaded_files(
        scenario_bytes=raw_bytes,
        scenario_filename="test_scenario.json"
    )

    assert len(batches) == 1
    assert batches[0].batch_id == "J-1"
    assert len(markets) == 1
    assert markets[0].market_id == "M-HYD"


@pytest.mark.anyio
async def test_parse_uploaded_dataset_bridge():
    class MockFile:
        def __init__(self, content: bytes, filename: str):
            self._content = content
            self.filename = filename

        async def read(self):
            return self._content

    payload = {
        "batches": [
            {"batch_id": "B-FAST", "commodity": "Tomato", "quantity_kg": 500.0, "rsl_hours": 20.0}
        ],
        "markets": [
            {
                "market_id": "M-BLR",
                "name": "Bengaluru APMC",
                "transit_hours": 4.0,
                "transit_temp_c": 14.0,
                "transport_cost_per_kg": 2.0,
                "max_capacity_kg": 2000.0,
                "demand_kg": {"Tomato": 500.0},
                "market_price_kg": {"Tomato": 40.0},
            }
        ]
    }
    mock_file = MockFile(json.dumps(payload).encode("utf-8"), "scenario.json")
    response = await parse_uploaded_dataset(scenario_file=mock_file)

    assert hasattr(response, "status") or "status" in response
    if hasattr(response, "status"):
        assert str(response.status).upper() == "OPTIMAL"
        assert len(response.allocations) > 0
