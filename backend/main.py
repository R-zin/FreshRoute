"""
FreshRoute OS Backend Service
FastAPI REST API implementing SHARED_API_CONTRACT.md endpoints.
Lead Optimization & Backend Engineer implementation (Gemini 3.8 Flash).
"""

import csv
import io
import json
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from backend.core.default_data import (
    get_default_batches,
    get_default_disruptions,
    get_default_markets,
)
from backend.core.schemas import (
    DEFAULT_COMMODITY_LOOKUP,
    Batch,
    DisruptionOverrides,
    Market,
    OptimizeRequest,
    OptimizeResponse,
)
from backend.core.solver import solve_scenario

app = FastAPI(
    title="FreshRoute OS MILP Engine",
    version="1.0.0",
    description="High-performance cold-chain dispatch and dynamic markdown optimizer for perishable produce.",
)

# CORS Middleware (Adheres strictly to SHARED_API_CONTRACT.md Section 1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "FreshRoute OS MILP Engine",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# 5.1 GET /api/v1/health
@app.get("/api/v1/health")
def get_health() -> Dict[str, str]:
    """Instant readiness probe for frontend connection indicator."""
    return {
        "status": "ok",
        "service": "FreshRoute OS MILP Engine",
        "solver": "SciPy HiGHS",
    }


# 5.2 GET /api/v1/default-scenario
@app.get("/api/v1/default-scenario", response_model=OptimizeResponse)
def get_default_scenario() -> OptimizeResponse:
    """Loads default MoFPI South India perishable produce dataset and solved state."""
    batches = get_default_batches()
    markets = get_default_markets()
    disruptions = get_default_disruptions()
    return solve_scenario(batches, markets, disruptions)


# 5.3 POST /api/v1/optimize
@app.post("/api/v1/optimize", response_model=OptimizeResponse)
def optimize_scenario(request: OptimizeRequest) -> OptimizeResponse:
    """
    Re-solves both the Naive FIFO Baseline and the FreshRoute MILP Optimizer
    when user adjusts disruption sliders or updates batches/markets.
    """
    return solve_scenario(request.batches, request.markets, request.disruptions)


def _normalize_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_").replace("-", "_")


def _impute_batch_defaults(commodity: str, row: Dict[str, Any], warnings: List[str]) -> Dict[str, float]:
    lookup = DEFAULT_COMMODITY_LOOKUP.get(commodity, DEFAULT_COMMODITY_LOOKUP["Fallback"])
    
    optimal_temp = row.get("optimal_temp_c")
    if optimal_temp is None or optimal_temp == "":
        optimal_temp = lookup["optimal_temp_c"]
        warnings.append(f"Batch for commodity '{commodity}': Imputed optimal_temp_c={optimal_temp}°C from cold-chain lookup.")
    else:
        optimal_temp = float(optimal_temp)

    spoilage_cost = row.get("spoilage_cost_per_kg")
    if spoilage_cost is None or spoilage_cost == "":
        spoilage_cost = lookup["spoilage_cost_per_kg"]
        warnings.append(f"Batch for commodity '{commodity}': Imputed spoilage_cost_per_kg=₹{spoilage_cost} from cold-chain lookup.")
    else:
        spoilage_cost = float(spoilage_cost)

    base_cost = row.get("base_cost_per_kg")
    if base_cost is None or base_cost == "":
        base_cost = lookup["base_cost_per_kg"]
        warnings.append(f"Batch for commodity '{commodity}': Imputed base_cost_per_kg=₹{base_cost} from cold-chain lookup.")
    else:
        base_cost = float(base_cost)

    return {
        "optimal_temp_c": optimal_temp,
        "spoilage_cost_per_kg": spoilage_cost,
        "base_cost_per_kg": base_cost,
    }


def _parse_batches_data(raw_data: Any, warnings: List[str]) -> List[Batch]:
    parsed: List[Batch] = []
    
    if isinstance(raw_data, list):
        items = raw_data
    elif isinstance(raw_data, dict):
        items = raw_data.get("batches", [])
    else:
        items = []

    for idx, item in enumerate(items):
        norm = {_normalize_key(k): v for k, v in item.items()}
        batch_id = str(norm.get("batch_id") or norm.get("id") or f"B-{idx+101}")
        commodity = str(norm.get("commodity") or norm.get("item") or norm.get("crop") or "Tomato").strip()
        
        qty = float(norm.get("quantity_kg") or norm.get("quantity") or norm.get("qty") or norm.get("kg") or 0.0)
        rsl = float(norm.get("rsl_hours") or norm.get("shelf_life_hours") or norm.get("rsl") or 24.0)
        
        imputed = _impute_batch_defaults(commodity, norm, warnings)

        parsed.append(
            Batch(
                batch_id=batch_id,
                commodity=commodity,
                quantity_kg=qty,
                rsl_hours=rsl,
                optimal_temp_c=imputed["optimal_temp_c"],
                spoilage_cost_per_kg=imputed["spoilage_cost_per_kg"],
                base_cost_per_kg=imputed["base_cost_per_kg"],
            )
        )
    return parsed


def _parse_markets_data(raw_data: Any, warnings: List[str]) -> List[Market]:
    parsed: List[Market] = []
    
    if isinstance(raw_data, list):
        items = raw_data
    elif isinstance(raw_data, dict):
        items = raw_data.get("markets", [])
    else:
        items = []

    for idx, item in enumerate(items):
        norm = {_normalize_key(k): v for k, v in item.items()}
        market_id = str(norm.get("market_id") or norm.get("id") or f"M{idx+1}")
        name = str(norm.get("name") or norm.get("market_name") or norm.get("mandi") or f"Market {market_id}")
        
        lat = float(norm.get("lat") or norm.get("latitude") or 12.9716)
        lng = float(norm.get("lng") or norm.get("lon") or norm.get("longitude") or 77.5946)
        transit_h = float(norm.get("transit_hours") or norm.get("transit_time") or norm.get("duration_hours") or 4.0)
        transit_temp = float(norm.get("transit_temp_c") or norm.get("transit_temp") or norm.get("reefer_temp") or 15.0)
        transport_cost = float(norm.get("transport_cost_per_kg") or norm.get("transport_cost") or norm.get("freight_cost") or 3.0)
        handling_h = float(norm.get("handling_hours") or norm.get("handling_time") or 3.0)
        handling_cost = float(norm.get("handling_cost_per_kg") or norm.get("handling_cost") or 1.5)
        max_cap = float(norm.get("max_capacity_kg") or norm.get("capacity_kg") or norm.get("capacity") or 5000.0)

        # Parse demand_kg dictionary
        demand_raw = norm.get("demand_kg") or norm.get("demand")
        demand_dict: Dict[str, float] = {}
        if isinstance(demand_raw, dict):
            demand_dict = {str(k): float(v) for k, v in demand_raw.items()}
        elif isinstance(demand_raw, str):
            try:
                loaded = json.loads(demand_raw)
                if isinstance(loaded, dict):
                    demand_dict = {str(k): float(v) for k, v in loaded.items()}
            except Exception:
                pass

        # Parse market_price_kg dictionary
        price_raw = norm.get("market_price_kg") or norm.get("price_kg") or norm.get("price")
        price_dict: Dict[str, float] = {}
        if isinstance(price_raw, dict):
            price_dict = {str(k): float(v) for k, v in price_raw.items()}
        elif isinstance(price_raw, str):
            try:
                loaded = json.loads(price_raw)
                if isinstance(loaded, dict):
                    price_dict = {str(k): float(v) for k, v in loaded.items()}
            except Exception:
                pass

        # If column-based demand/price was used in CSV (e.g. demand_Tomato, price_Tomato)
        for k, v in norm.items():
            if k.startswith("demand_"):
                comm = k.replace("demand_", "").capitalize()
                try:
                    demand_dict[comm] = float(v)
                except (ValueError, TypeError):
                    pass
            elif k.startswith("price_"):
                comm = k.replace("price_", "").capitalize()
                try:
                    price_dict[comm] = float(v)
                except (ValueError, TypeError):
                    pass

        parsed.append(
            Market(
                market_id=market_id,
                name=name,
                lat=lat,
                lng=lng,
                transit_hours=transit_h,
                transit_temp_c=transit_temp,
                transport_cost_per_kg=transport_cost,
                handling_hours=handling_h,
                handling_cost_per_kg=handling_cost,
                max_capacity_kg=max_cap,
                demand_kg=demand_dict,
                market_price_kg=price_dict,
            )
        )
    return parsed


def _parse_csv_bytes(content: bytes) -> List[Dict[str, Any]]:
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


# 5.4 POST /api/v1/upload-dataset
@app.post("/api/v1/upload-dataset", response_model=OptimizeResponse)
async def upload_dataset(
    scenario_file: Optional[UploadFile] = File(None),
    batches_file: Optional[UploadFile] = File(None),
    markets_file: Optional[UploadFile] = File(None),
) -> OptimizeResponse:
    """
    Ingests hidden judge evaluation files (multipart/form-data), normalizes column aliases,
    logs any unit conversions or missing-value imputations into ingestion_warnings,
    and immediately runs the optimizer.
    """
    warnings: List[str] = []
    batches: List[Batch] = []
    markets: List[Market] = []
    disruptions = get_default_disruptions()

    # If ingestion module is implemented by Account 3, attempt to delegate
    try:
        from backend.ingestion.parser import parse_uploaded_dataset  # type: ignore
        return await parse_uploaded_dataset(
            scenario_file=scenario_file,
            batches_file=batches_file,
            markets_file=markets_file,
        )
    except (ImportError, AttributeError):
        pass

    # Built-in robust ingestion parser
    if scenario_file is not None:
        content = await scenario_file.read()
        filename = scenario_file.filename.lower() if scenario_file.filename else ""
        if filename.endswith(".json") or content.strip().startswith(b"{") or content.strip().startswith(b"["):
            try:
                data = json.loads(content.decode("utf-8"))
                if isinstance(data, dict):
                    if "batches" in data:
                        batches = _parse_batches_data(data["batches"], warnings)
                    if "markets" in data:
                        markets = _parse_markets_data(data["markets"], warnings)
                    if "disruptions" in data:
                        dis_data = {_normalize_key(k): v for k, v in data["disruptions"].items()}
                        disruptions = DisruptionOverrides(**dis_data)
                elif isinstance(data, list):
                    batches = _parse_batches_data(data, warnings)
            except Exception as e:
                warnings.append(f"Failed to parse scenario JSON: {str(e)}")
        else:
            rows = _parse_csv_bytes(content)
            batches = _parse_batches_data(rows, warnings)

    if batches_file is not None:
        content = await batches_file.read()
        filename = batches_file.filename.lower() if batches_file.filename else ""
        if filename.endswith(".json"):
            try:
                data = json.loads(content.decode("utf-8"))
                batches = _parse_batches_data(data, warnings)
            except Exception as e:
                warnings.append(f"Failed to parse batches JSON: {str(e)}")
        else:
            rows = _parse_csv_bytes(content)
            batches = _parse_batches_data(rows, warnings)

    if markets_file is not None:
        content = await markets_file.read()
        filename = markets_file.filename.lower() if markets_file.filename else ""
        if filename.endswith(".json"):
            try:
                data = json.loads(content.decode("utf-8"))
                markets = _parse_markets_data(data, warnings)
            except Exception as e:
                warnings.append(f"Failed to parse markets JSON: {str(e)}")
        else:
            rows = _parse_csv_bytes(content)
            markets = _parse_markets_data(rows, warnings)

    # Fall back to default scenario items if files didn't supply them
    if not batches:
        warnings.append("No batches uploaded or parsed; falling back to default MoFPI batches.")
        batches = get_default_batches()
    if not markets:
        warnings.append("No markets uploaded or parsed; falling back to default MoFPI markets.")
        markets = get_default_markets()

    return solve_scenario(
        batches=batches,
        markets=markets,
        disruptions=disruptions,
        ingestion_warnings=warnings,
    )
