"""
FreshRoute OS Backend Service
FastAPI REST API implementing SHARED_API_CONTRACT.md Section 5 endpoints.
Core Mathematical Optimization & Backend Lead implementation.
"""

import csv
import io
import json
import logging
import sys
import traceback
from pathlib import Path
from typing import Any

# Ensure repository root is on sys.path regardless of execution working directory
_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi import FastAPI, File, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

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

# Set up structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("freshroute")

app = FastAPI(
    title="FreshRoute OS MILP Engine",
    version="1.0.0",
    description="High-performance physics-informed cold-chain dispatch and dynamic markdown optimizer for perishable produce.",
)

# 1. CORS Middleware (Adheres strictly to SHARED_API_CONTRACT.md Section 1)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers (Never crash during live judging)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handles standard HTTP exceptions with structured response."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "ERROR",
            "error_type": "HTTPException",
            "message": str(exc.detail),
            "path": request.url.path,
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles request payload validation failures cleanly."""
    return JSONResponse(
        status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
        content={
            "status": "VALIDATION_ERROR",
            "error_type": "RequestValidationError",
            "message": "Invalid request schema or malformed payload",
            "errors": exc.errors(),
            "path": request.url.path,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Global catch-all exception handler:
    Logs full stack trace and returns structured JSON so the server never crashes during live judging.
    """
    tb = traceback.format_exc()
    logger.error("Unhandled error processing %s %s:\n%s", request.method, request.url.path, tb)

    # Classify bad request vs internal solver error
    status_code = (
        status.HTTP_400_BAD_REQUEST
        if isinstance(exc, (ValueError, KeyError))
        else status.HTTP_500_INTERNAL_SERVER_ERROR
    )

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ERROR",
            "error_type": type(exc).__name__,
            "message": str(exc) or "Internal server error occurred",
            "path": request.url.path,
        },
    )


@app.get("/")
def root():
    """Service status and API documentation entry point."""
    return {
        "status": "ok",
        "service": "FreshRoute OS MILP Engine",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# 2. GET /api/v1/health (5.1 in SHARED_API_CONTRACT.md)
@app.get("/api/v1/health")
@app.get("/health")
def get_health() -> dict[str, str]:
    """Instant readiness probe for frontend connection indicator."""
    return {
        "status": "ok",
        "service": "FreshRoute OS MILP Engine",
        "solver": "SciPy HiGHS",
    }


# 3. GET /api/v1/default-scenario (5.2 in SHARED_API_CONTRACT.md)
@app.get("/api/v1/default-scenario", response_model=OptimizeResponse)
@app.get("/default-scenario", response_model=OptimizeResponse)
def get_default_scenario() -> OptimizeResponse:
    """Loads default MoFPI South India perishable produce dataset and initial solved state."""
    batches = get_default_batches()
    markets = get_default_markets()
    disruptions = get_default_disruptions()
    return solve_scenario(
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=disruptions,
        )
    )


# 4. POST /api/v1/optimize (5.3 in SHARED_API_CONTRACT.md)
@app.post("/api/v1/optimize", response_model=OptimizeResponse)
@app.post("/optimize", response_model=OptimizeResponse)
def optimize_scenario(request: OptimizeRequest) -> OptimizeResponse:
    """
    Re-solves both the Naive FIFO Baseline and the FreshRoute MILP Optimizer
    when user adjusts disruption sliders or updates batches/markets.
    """
    return solve_scenario(request)


# ------------------------------------------------------------------------------
# Built-in Robust Ingestion Helpers (Zero-Blocker Fallback)
# ------------------------------------------------------------------------------


def _normalize_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_").replace("-", "_")


def _impute_batch_defaults(commodity: str, row: dict[str, Any], warnings: list[str]) -> dict[str, float]:
    lookup = DEFAULT_COMMODITY_LOOKUP.get(commodity, DEFAULT_COMMODITY_LOOKUP["Fallback"])

    optimal_temp = row.get("optimal_temp_c")
    if optimal_temp is None or optimal_temp == "":
        optimal_temp = lookup["optimal_temp_c"]
        warnings.append(
            f"Batch for commodity '{commodity}': Imputed optimal_temp_c={optimal_temp}°C from cold-chain lookup."
        )
    else:
        optimal_temp = float(optimal_temp)

    spoilage_cost = row.get("spoilage_cost_per_kg")
    if spoilage_cost is None or spoilage_cost == "":
        spoilage_cost = lookup["spoilage_cost_per_kg"]
        warnings.append(
            f"Batch for commodity '{commodity}': Imputed spoilage_cost_per_kg=₹{spoilage_cost} from cold-chain lookup."
        )
    else:
        spoilage_cost = float(spoilage_cost)

    base_cost = row.get("base_cost_per_kg")
    if base_cost is None or base_cost == "":
        base_cost = lookup["base_cost_per_kg"]
        warnings.append(
            f"Batch for commodity '{commodity}': Imputed base_cost_per_kg=₹{base_cost} from cold-chain lookup."
        )
    else:
        base_cost = float(base_cost)

    return {
        "optimal_temp_c": optimal_temp,
        "spoilage_cost_per_kg": spoilage_cost,
        "base_cost_per_kg": base_cost,
    }


def _parse_batches_data(raw_data: Any, warnings: list[str]) -> list[Batch]:
    parsed: list[Batch] = []

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


def _parse_markets_data(raw_data: Any, warnings: list[str]) -> list[Market]:
    parsed: list[Market] = []

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
        transport_cost = float(
            norm.get("transport_cost_per_kg") or norm.get("transport_cost") or norm.get("freight_cost") or 3.0
        )
        handling_h = float(norm.get("handling_hours") or norm.get("handling_time") or 3.0)
        handling_cost = float(norm.get("handling_cost_per_kg") or norm.get("handling_cost") or 1.5)
        max_cap = float(norm.get("max_capacity_kg") or norm.get("capacity_kg") or norm.get("capacity") or 5000.0)

        # Parse demand_kg dictionary
        demand_raw = norm.get("demand_kg") or norm.get("demand")
        demand_dict: dict[str, float] = {}
        if isinstance(demand_raw, dict):
            demand_dict = {str(k): float(v) for k, v in demand_raw.items()}
        elif isinstance(demand_raw, str):
            try:
                loaded = json.loads(demand_raw)
                if isinstance(loaded, dict):
                    demand_dict = {str(k): float(v) for k, v in loaded.items()}
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        # Parse market_price_kg dictionary
        price_raw = norm.get("market_price_kg") or norm.get("price_kg") or norm.get("price")
        price_dict: dict[str, float] = {}
        if isinstance(price_raw, dict):
            price_dict = {str(k): float(v) for k, v in price_raw.items()}
        elif isinstance(price_raw, str):
            try:
                loaded = json.loads(price_raw)
                if isinstance(loaded, dict):
                    price_dict = {str(k): float(v) for k, v in loaded.items()}
            except (json.JSONDecodeError, TypeError, ValueError):
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

        # Fallback demand/prices if empty
        if not demand_dict:
            demand_dict = {"Tomato": 1500.0, "Guava": 1000.0, "Banana": 1500.0, "Alphonso Mango": 800.0}
            warnings.append(f"Market {name}: Missing demand_kg, populated standard regional demand.")
        if not price_dict:
            price_dict = {"Tomato": 40.0, "Guava": 55.0, "Banana": 35.0, "Alphonso Mango": 100.0}
            warnings.append(f"Market {name}: Missing market_price_kg, populated standard wholesale prices.")

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


def _parse_csv_bytes(content: bytes) -> list[dict[str, Any]]:
    text = content.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


# 5. POST /api/v1/upload-dataset (5.4 in SHARED_API_CONTRACT.md)
@app.post("/api/v1/upload-dataset", response_model=OptimizeResponse)
@app.post("/upload-dataset", response_model=OptimizeResponse)
async def upload_dataset(
    scenario_file: UploadFile | None = File(None),  # noqa: B008
    batches_file: UploadFile | None = File(None),  # noqa: B008
    markets_file: UploadFile | None = File(None),  # noqa: B008
) -> OptimizeResponse:
    """
    Ingests hidden judge evaluation files (multipart/form-data), normalizes column aliases,
    logs any unit conversions or missing-value imputations into ingestion_warnings,
    and immediately runs the optimizer.

    Zero-Blocker Import Rule:
    Attempts to import parser from Account 3's backend.ingestion.parser.
    If not available, falls back gracefully to built-in JSON/CSV parser.
    """
    warnings: list[str] = []
    batches: list[Batch] = []
    markets: list[Market] = []
    disruptions = get_default_disruptions()

    # Primary Ingestion Engine: Cleanly call backend.ingestion.parser.parse_uploaded_files
    try:
        from backend.ingestion.parser import parse_uploaded_files  # type: ignore

        scen_bytes = await scenario_file.read() if scenario_file else None
        scen_name = scenario_file.filename if scenario_file else None
        b_bytes = await batches_file.read() if batches_file else None
        b_name = batches_file.filename if batches_file else None
        m_bytes = await markets_file.read() if markets_file else None
        m_name = markets_file.filename if markets_file else None

        # Extract disruptions from scenario JSON if available
        if scen_bytes:
            try:
                scen_dict = json.loads(scen_bytes.decode("utf-8-sig", errors="replace"))
                if isinstance(scen_dict, dict) and "disruptions" in scen_dict:
                    dis_data = {_normalize_key(k): v for k, v in scen_dict["disruptions"].items()}
                    disruptions = DisruptionOverrides(**dis_data)
            except (json.JSONDecodeError, ValueError, KeyError, TypeError, UnicodeDecodeError):
                pass

        parsed_b, parsed_m, parsed_w = parse_uploaded_files(
            scenario_bytes=scen_bytes,
            scenario_filename=scen_name,
            batches_bytes=b_bytes,
            batches_filename=b_name,
            markets_bytes=m_bytes,
            markets_filename=m_name,
        )
        if scenario_file or batches_file or markets_file:
            batches = parsed_b if parsed_b else get_default_batches()
            markets = parsed_m if parsed_m else get_default_markets()
            if not parsed_b and not scenario_file:
                warnings.append("No batches provided; fell back to default MoFPI batches.")
            if not parsed_m and not scenario_file:
                warnings.append("No markets provided; fell back to default MoFPI markets.")
            warnings.extend(parsed_w)
            return solve_scenario(
                request=OptimizeRequest(
                    batches=batches,
                    markets=markets,
                    disruptions=disruptions,
                ),
                ingestion_warnings=warnings,
            )
    except (ImportError, AttributeError, TypeError):
        pass

    # Built-in robust ingestion parser fallback
    if scenario_file is not None:
        content = await scenario_file.read()
        filename = scenario_file.filename.lower() if scenario_file.filename else ""
        if filename.endswith(".json") or content.strip().startswith((b"{", b"[")):
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
            except Exception as e:  # noqa: BLE001
                warnings.append(f"Failed to parse scenario JSON: {e!s}")
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
            except Exception as e:  # noqa: BLE001
                warnings.append(f"Failed to parse batches JSON: {e!s}")
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
            except Exception as e:  # noqa: BLE001
                warnings.append(f"Failed to parse markets JSON: {e!s}")
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
        request=OptimizeRequest(
            batches=batches,
            markets=markets,
            disruptions=disruptions,
        ),
        ingestion_warnings=warnings,
    )
