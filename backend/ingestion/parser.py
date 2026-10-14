"""
FreshRoute OS (PS 03) - Data Ingestion & Fuzzy Parser Engine
Author: Account 3 (Data Ingestion & Chaos QA Lead)
Built with Python 3.11, Pandas, and Pydantic v2.

Features:
- Zero-blocker import pattern with exact fallback Pydantic v2 schemas.
- Case-insensitive, punctuation-stripped fuzzy alias matching for all fields.
- Automated unit conversion with audit warnings (MT/tons -> kg, days -> hours).
- Default cold-chain lookup table imputation for missing/NaN parameters.
- Multi-format Market ingestion: supports both Long-Format and Wide-Format CSVs.
- 15 Indian APMC/city coordinate resolver with deterministic jitter for Leaflet maps.
- Zero-crash dirty data sanitization and negative value clamping.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import json
import math
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
from pydantic import BaseModel, Field

# ==============================================================================
# 1. ZERO-BLOCKER IMPORT PATTERN
# ==============================================================================
try:
    from backend.core.schemas import Batch, Market
except (ImportError, ModuleNotFoundError):
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


# ==============================================================================
# 2. SHARED CONSTANTS & DOMAIN LOOKUP TABLES (Section 2.4)
# ==============================================================================
COMMODITY_COLD_CHAIN_LOOKUP: Dict[str, Dict[str, float]] = {
    "Tomato": {"optimal_temp_c": 12.0, "spoilage_cost_per_kg": 14.0, "base_cost_per_kg": 18.0},
    "Guava": {"optimal_temp_c": 10.0, "spoilage_cost_per_kg": 18.0, "base_cost_per_kg": 25.0},
    "Banana": {"optimal_temp_c": 13.0, "spoilage_cost_per_kg": 12.0, "base_cost_per_kg": 15.0},
    "Alphonso Mango": {"optimal_temp_c": 13.0, "spoilage_cost_per_kg": 28.0, "base_cost_per_kg": 45.0},
    "Papaya": {"optimal_temp_c": 10.0, "spoilage_cost_per_kg": 15.0, "base_cost_per_kg": 20.0},
    "Potato": {"optimal_temp_c": 8.0, "spoilage_cost_per_kg": 8.0, "base_cost_per_kg": 12.0},
    "Onion": {"optimal_temp_c": 15.0, "spoilage_cost_per_kg": 9.0, "base_cost_per_kg": 14.0},
    "Spinach": {"optimal_temp_c": 4.0, "spoilage_cost_per_kg": 20.0, "base_cost_per_kg": 22.0},
}

FALLBACK_COMMODITY_DEFAULT: Dict[str, float] = {
    "optimal_temp_c": 10.0,
    "spoilage_cost_per_kg": 15.0,
    "base_cost_per_kg": 20.0,
}

# 15 Built-in Indian Cities / Mandis for Coordinate Geocoding
CITY_COORDINATES: Dict[str, Tuple[float, float]] = {
    "bengaluru": (12.9716, 77.5946),
    "bangalore": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "madras": (13.0827, 80.2707),
    "hyderabad": (17.3850, 78.4867),
    "kochi": (9.9312, 76.2673),
    "cochin": (9.9312, 76.2673),
    "mumbai": (19.0760, 72.8777),
    "bombay": (19.0760, 72.8777),
    "pune": (18.5204, 73.8567),
    "delhi": (28.6139, 77.2090),
    "new delhi": (28.6139, 77.2090),
    "kolkata": (22.5726, 88.3639),
    "calcutta": (22.5726, 88.3639),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur": (26.9124, 75.7873),
    "coimbatore": (11.0168, 76.9558),
    "vijayawada": (16.5062, 80.6480),
    "nagpur": (21.1458, 79.0882),
    "indore": (22.7196, 75.8577),
    "mysuru": (12.2958, 76.6394),
    "mysore": (12.2958, 76.6394),
}

# Explicit Normalized Column Aliases
BATCH_ALIASES = {
    "batch_id": {"batchid", "id", "lotid", "batch", "batchno", "sku", "skuid", "lot", "lotno"},
    "commodity": {"commodity", "crop", "produce", "item", "product", "fruitveg", "fruit", "vegetable", "variety", "name", "cropname"},
    "quantity_kg": {"quantitykg", "qty", "quantity", "stockkg", "stock", "volume", "volumekg", "weightkg", "weight", "availablestock", "stockmt", "quantitytons", "qtytonnes", "inventory", "tons", "tonnes", "mt", "quantityinmt", "quantitymt"},
    "rsl_hours": {"rslhours", "remainingshelflife", "shelflifehours", "shelflife", "expiryhrs", "expiryhours", "rsl", "shelflifedays", "rsldays", "remainingdays", "daystoexpiry", "expirydays", "days", "shelflifeinhrs", "shelflifeindays"},
    "optimal_temp_c": {"optimaltempc", "optimaltemp", "storagetempc", "storagetemp", "tempc", "idealtemp", "temp", "optimaltemperature", "targettemp", "storagetemperature"},
    "spoilage_cost_per_kg": {"spoilagecostperkg", "spoilagecost", "penaltycost", "disposalcost", "spoilagepenalty", "penalty", "disposalpenalty", "spoilagepenaltyperkg", "wastecost"},
    "base_cost_per_kg": {"basecostperkg", "basecost", "procurementcost", "unitcost", "costperkg", "purchasecost", "procurementcostperkg", "farmgateprice"},
}

MARKET_ALIASES = {
    "market_id": {"marketid", "id", "destid", "destinationid", "mandiid", "hubid", "destination"},
    "name": {"name", "marketname", "destination", "hub", "city", "mandi", "destinationname", "hubname"},
    "transit_hours": {"transithours", "traveltime", "travelhours", "leadtime", "durationhrs", "durationhours", "etahours", "transporttime", "traveltimehrs", "transittime", "transitduration"},
    "transit_temp_c": {"transittempc", "transittemp", "reefertempc", "trucktempc", "reefertemp", "tempc", "ambienttemp", "shippingtemp", "trucktemp"},
    "transport_cost_per_kg": {"transportcostperkg", "transportcost", "freightcost", "freightcostperkg", "shippingcostperkg", "costperkg", "freight", "logisticsperkg", "transportrate"},
    "handling_hours": {"handlinghours", "handlingtime", "handlingtimehrs", "unloadinghours", "unloadingtime", "dwelltime", "turnaroundhours"},
    "handling_cost_per_kg": {"handlingcostperkg", "handlingcost", "unloadingcost", "mandihandlingcost", "mandichargesperkg", "handlingfee"},
    "max_capacity_kg": {"maxcapacitykg", "capacity", "truckcapacity", "routecapacity", "maxload", "capacitymt", "capacitykg", "capacitytons", "truckloadlimit", "lanecapacity"},
    "lat": {"lat", "latitude", "y", "marketlat", "destlat"},
    "lng": {"lng", "lon", "long", "longitude", "x", "marketlng", "destlng"},
    "commodity": {"commodity", "crop", "produce", "item", "product", "fruit", "vegetable"},
    "demand_kg": {"demandkg", "demand", "maxdemand", "basedemand", "targetdemand"},
    "market_price_kg": {"marketpricekg", "price", "marketprice", "sellingprice", "wholesaleprice", "unitprice", "baseprice"},
}


# ==============================================================================
# 3. HELPER FUNCTIONS: NORMALIZATION & GEOCODING
# ==============================================================================
def _normalize_col_name(col: Any) -> str:
    """Normalize column header: lowercase, strip whitespace, underscores, hyphens, and parentheses."""
    return re.sub(r"[\s_\-\(\)\[\]/]", "", str(col).strip().lower())


def _find_matching_column(df_columns: List[str], alias_set: set[str]) -> Optional[str]:
    """Find the first matching source column that maps into an alias set."""
    for col in df_columns:
        if _normalize_col_name(col) in alias_set:
            return col
    return None


def normalize_commodity_name(raw: Any) -> str:
    """Normalize commodity name to canonical title case (e.g. 'tomatoes' -> 'Tomato')."""
    if pd.isna(raw) or raw is None:
        return "Unknown"
    val = str(raw).strip()
    low = val.lower().rstrip("s")
    clean_low = re.sub(r"[_\-]", " ", val.lower().strip())

    norm_map = {
        "tomato": "Tomato",
        "guava": "Guava",
        "banana": "Banana",
        "alphonso mango": "Alphonso Mango",
        "alphonso": "Alphonso Mango",
        "mango": "Alphonso Mango",
        "papaya": "Papaya",
        "potato": "Potato",
        "onion": "Onion",
        "spinach": "Spinach",
        "leafy": "Spinach",
        "leafy green": "Spinach",
        "palak": "Spinach",
    }

    if clean_low in norm_map:
        return norm_map[clean_low]
    if low in norm_map:
        return norm_map[low]
    for k, canonical in norm_map.items():
        if k in clean_low:
            return canonical

    return val.title()


def resolve_market_lat_lng(name: str, market_id: str, existing_lat: Optional[float] = None, existing_lng: Optional[float] = None) -> Tuple[float, float]:
    """
    Impute missing lat/lng coordinates using the 15 Indian APMCs/cities lookup.
    Applies deterministic hash-based jitter so React-Leaflet never receives NaN or identical points.
    """
    if existing_lat is not None and not math.isnan(existing_lat) and existing_lng is not None and not math.isnan(existing_lng):
        return (round(float(existing_lat), 4), round(float(existing_lng), 4))

    clean_search = f"{name} {market_id}".lower()
    matched_coord = None
    for city, coord in CITY_COORDINATES.items():
        if city in clean_search:
            matched_coord = coord
            break

    # Compute deterministic hash for reproducible jitter
    h = int(hashlib.md5(f"{name}_{market_id}".encode("utf-8")).hexdigest(), 16)
    jitter_lat = ((h % 1000) / 1000.0 - 0.5) * 0.04
    jitter_lng = (((h // 1000) % 1000) / 1000.0 - 0.5) * 0.04

    if matched_coord:
        return (round(matched_coord[0] + jitter_lat, 4), round(matched_coord[1] + jitter_lng, 4))

    # Fallback to Kolar Packinghouse region (13.1362, 78.1291) with wider deterministic spread
    wide_jitter_lat = ((h % 1000) / 1000.0 - 0.5) * 3.5
    wide_jitter_lng = (((h // 1000) % 1000) / 1000.0 - 0.5) * 3.5
    return (round(13.1362 + wide_jitter_lat, 4), round(78.1291 + wide_jitter_lng, 4))


def _clean_float(val: Any, default: float = 0.0) -> Tuple[float, bool]:
    """
    Safely convert any cell to float.
    Strips currency symbols (₹, $), commas, units (kg, hrs).
    Returns (cleaned_float, was_imputed_or_default).
    """
    if pd.isna(val) or val is None or str(val).strip() == "":
        return (default, True)
    try:
        if isinstance(val, (int, float)):
            num = float(val)
        else:
            s = str(val).replace("₹", "").replace("$", "").replace(",", "").replace("kg", "").replace("hrs", "").replace("h", "").strip()
            num = float(s)
        if math.isnan(num) or math.isinf(num):
            return (default, True)
        return (num, False)
    except Exception:
        return (default, True)


# ==============================================================================
# 4. PARSE BATCHES DATAFRAME
# ==============================================================================
def parse_batches_df(df: pd.DataFrame) -> tuple[list[Batch], list[str]]:
    """
    Parse an inventory DataFrame into canonical Batch Pydantic v2 objects.
    Applies fuzzy alias resolution, unit auto-conversion (MT -> kg, days -> hrs),
    negative value clamping, and cold-chain default imputation.
    """
    batches: list[Batch] = []
    warnings: list[str] = []

    if df is None or df.empty:
        warnings.append("Received empty or null batches DataFrame.")
        return batches, warnings

    # Drop completely empty rows
    df = df.dropna(how="all").copy()
    if df.empty:
        warnings.append("All rows in batches DataFrame were empty.")
        return batches, warnings

    cols = list(df.columns)
    col_batch_id = _find_matching_column(cols, BATCH_ALIASES["batch_id"])
    col_commodity = _find_matching_column(cols, BATCH_ALIASES["commodity"])
    col_quantity = _find_matching_column(cols, BATCH_ALIASES["quantity_kg"])
    col_rsl = _find_matching_column(cols, BATCH_ALIASES["rsl_hours"])
    col_opt_temp = _find_matching_column(cols, BATCH_ALIASES["optimal_temp_c"])
    col_spoilage = _find_matching_column(cols, BATCH_ALIASES["spoilage_cost_per_kg"])
    col_base_cost = _find_matching_column(cols, BATCH_ALIASES["base_cost_per_kg"])

    # Unit Conversion Detection: Quantity (MT/tons -> kg)
    qty_multiplier = 1.0
    if col_quantity:
        q_norm = col_quantity.lower()
        if "mt" in q_norm or "ton" in q_norm or "tonne" in q_norm:
            qty_multiplier = 1000.0
            warnings.append(f"Converted batch quantity from metric tons ({col_quantity}) to kg (x1000).")

    # Unit Conversion Detection: RSL (days -> hours)
    rsl_multiplier = 1.0
    if col_rsl:
        r_norm = col_rsl.lower()
        if "day" in r_norm:
            rsl_multiplier = 24.0
            warnings.append(f"Converted shelf-life column '{col_rsl}' from days to hours (x24).")
        else:
            # Check heuristic: if max <= 14.0 and median <= 7.0 for positive values
            numeric_rsl = pd.to_numeric(df[col_rsl], errors="coerce").dropna()
            if not numeric_rsl.empty and (numeric_rsl > 0).any() and numeric_rsl.max() <= 14.0 and numeric_rsl.median() <= 7.0:
                rsl_multiplier = 24.0
                warnings.append(f"Detected day-scale shelf life in column '{col_rsl}' (max={numeric_rsl.max():.1f} <= 14): auto-converted days to hours (x24).")

    for idx, row in df.iterrows():
        # 1. Batch ID
        if col_batch_id and pd.notna(row[col_batch_id]) and str(row[col_batch_id]).strip():
            b_id = str(row[col_batch_id]).strip()
        else:
            b_id = f"B-{idx+1:03d}"
            warnings.append(f"Row {idx+1}: Missing batch_id; auto-generated '{b_id}'.")

        # 2. Commodity
        if col_commodity and pd.notna(row[col_commodity]) and str(row[col_commodity]).strip():
            commodity = normalize_commodity_name(row[col_commodity])
        else:
            commodity = "Tomato"
            warnings.append(f"Batch {b_id}: Missing commodity; defaulted to 'Tomato'.")

        cold_defaults = COMMODITY_COLD_CHAIN_LOOKUP.get(commodity, FALLBACK_COMMODITY_DEFAULT)

        # 3. Quantity (kg)
        if col_quantity:
            raw_qty, was_imp = _clean_float(row[col_quantity], default=100.0)
            if was_imp:
                warnings.append(f"Batch {b_id}: Imputed missing quantity_kg with default 100.0 kg.")
            qty_kg = raw_qty * qty_multiplier
        else:
            qty_kg = 100.0
            warnings.append(f"Batch {b_id}: No quantity column found; defaulted to 100.0 kg.")

        if qty_kg < 0.0:
            warnings.append(f"Batch {b_id}: Clamped negative quantity_kg={qty_kg} to 0.0.")
            qty_kg = 0.0

        # 4. RSL (hours)
        if col_rsl:
            raw_rsl, was_imp = _clean_float(row[col_rsl], default=48.0)
            if was_imp:
                warnings.append(f"Batch {b_id}: Imputed missing rsl_hours with default 48.0 hours.")
            rsl_hrs = raw_rsl * rsl_multiplier
        else:
            rsl_hrs = 48.0
            warnings.append(f"Batch {b_id}: No rsl_hours column found; defaulted to 48.0 hours.")

        if rsl_hrs < 0.0:
            warnings.append(f"Batch {b_id}: Clamped negative rsl_hours={rsl_hrs} to 0.0.")
            rsl_hrs = 0.0

        # 5. Optimal Temp (°C)
        if col_opt_temp and pd.notna(row[col_opt_temp]):
            opt_temp, was_imp = _clean_float(row[col_opt_temp], default=cold_defaults["optimal_temp_c"])
            if was_imp:
                opt_temp = cold_defaults["optimal_temp_c"]
                warnings.append(f"Batch {b_id}: Imputed missing optimal_temp_c={opt_temp}°C for '{commodity}'.")
        else:
            opt_temp = cold_defaults["optimal_temp_c"]
            warnings.append(f"Batch {b_id}: Imputed optimal_temp_c={opt_temp}°C for '{commodity}' from cold-chain reference.")

        # 6. Spoilage Cost per kg (₹)
        if col_spoilage and pd.notna(row[col_spoilage]):
            spoil_cost, was_imp = _clean_float(row[col_spoilage], default=cold_defaults["spoilage_cost_per_kg"])
            if was_imp:
                spoil_cost = cold_defaults["spoilage_cost_per_kg"]
                warnings.append(f"Batch {b_id}: Imputed missing spoilage_cost_per_kg=₹{spoil_cost} for '{commodity}'.")
        else:
            spoil_cost = cold_defaults["spoilage_cost_per_kg"]
            warnings.append(f"Batch {b_id}: Imputed spoilage_cost_per_kg=₹{spoil_cost} for '{commodity}' from reference.")

        if spoil_cost < 0.0:
            warnings.append(f"Batch {b_id}: Clamped negative spoilage_cost_per_kg={spoil_cost} to 0.0.")
            spoil_cost = 0.0

        # 7. Base Cost per kg (₹)
        if col_base_cost and pd.notna(row[col_base_cost]):
            base_cost, was_imp = _clean_float(row[col_base_cost], default=cold_defaults["base_cost_per_kg"])
            if was_imp:
                base_cost = cold_defaults["base_cost_per_kg"]
                warnings.append(f"Batch {b_id}: Imputed missing base_cost_per_kg=₹{base_cost} for '{commodity}'.")
        else:
            base_cost = cold_defaults["base_cost_per_kg"]
            warnings.append(f"Batch {b_id}: Imputed base_cost_per_kg=₹{base_cost} for '{commodity}' from reference.")

        if base_cost < 0.0:
            warnings.append(f"Batch {b_id}: Clamped negative base_cost_per_kg={base_cost} to 0.0.")
            base_cost = 0.0

        batch_obj = Batch(
            batch_id=b_id,
            commodity=commodity,
            quantity_kg=round(qty_kg, 2),
            rsl_hours=round(rsl_hrs, 2),
            optimal_temp_c=round(opt_temp, 2),
            spoilage_cost_per_kg=round(spoil_cost, 2),
            base_cost_per_kg=round(base_cost, 2),
        )
        batches.append(batch_obj)

    return batches, warnings


# ==============================================================================
# 5. PARSE MARKETS DATAFRAME (LONG-FORMAT AND WIDE-FORMAT)
# ==============================================================================
def parse_markets_df(df: pd.DataFrame, known_commodities: list[str] | None = None) -> tuple[list[Market], list[str]]:
    """
    Parse a destination market & route DataFrame into canonical Market Pydantic v2 objects.
    Seamlessly supports:
    - Long-format CSVs: (market_id, commodity, demand_kg, market_price_kg) rows grouped by market_id.
    - Wide-format CSVs: columns like demand_tomato, price_tomato, or JSON string cells.
    - 15 Indian APMC geocoding with deterministic jitter for Leaflet coordinates.
    - Capacity MT -> kg unit auto-conversion.
    """
    markets: list[Market] = []
    warnings: list[str] = []

    if df is None or df.empty:
        warnings.append("Received empty or null markets DataFrame.")
        return markets, warnings

    df = df.dropna(how="all").copy()
    if df.empty:
        warnings.append("All rows in markets DataFrame were empty.")
        return markets, warnings

    cols = list(df.columns)
    col_market_id = _find_matching_column(cols, MARKET_ALIASES["market_id"])
    col_name = _find_matching_column(cols, MARKET_ALIASES["name"])
    col_transit_hrs = _find_matching_column(cols, MARKET_ALIASES["transit_hours"])
    col_transit_temp = _find_matching_column(cols, MARKET_ALIASES["transit_temp_c"])
    col_tr_cost = _find_matching_column(cols, MARKET_ALIASES["transport_cost_per_kg"])
    col_handling_hrs = _find_matching_column(cols, MARKET_ALIASES["handling_hours"])
    col_handling_cost = _find_matching_column(cols, MARKET_ALIASES["handling_cost_per_kg"])
    col_capacity = _find_matching_column(cols, MARKET_ALIASES["max_capacity_kg"])
    col_lat = _find_matching_column(cols, MARKET_ALIASES["lat"])
    col_lng = _find_matching_column(cols, MARKET_ALIASES["lng"])
    col_commodity = _find_matching_column(cols, MARKET_ALIASES["commodity"])
    col_demand = _find_matching_column(cols, MARKET_ALIASES["demand_kg"])
    col_price = _find_matching_column(cols, MARKET_ALIASES["market_price_kg"])

    # Capacity unit conversion
    cap_multiplier = 1.0
    if col_capacity:
        c_norm = col_capacity.lower()
        if "mt" in c_norm or "ton" in c_norm or "tonne" in c_norm:
            cap_multiplier = 1000.0
            warnings.append(f"Converted market capacity from metric tons ({col_capacity}) to kg (x1000).")

    # Detect if format is Long-Format vs Wide-Format
    is_long_format = col_commodity is not None and (col_demand is not None or col_price is not None)

    # Detect Wide-Format commodity-specific columns e.g. demand_tomato, price_tomato
    wide_demand_cols: Dict[str, str] = {}
    wide_price_cols: Dict[str, str] = {}

    for c in cols:
        norm = _normalize_col_name(c)
        # Check demand patterns
        m_dem = re.match(r"^(?:demand|demandkg|qty|stock)(?:for)?([a-z]+)$", norm) or re.match(r"^([a-z]+)(?:demand|demandkg|qty|stock)$", norm)
        if m_dem and norm not in MARKET_ALIASES["demand_kg"]:
            comm = normalize_commodity_name(m_dem.group(1))
            wide_demand_cols[comm] = c

        # Check price patterns
        m_pri = re.match(r"^(?:price|marketprice|marketpricekg|sellingprice|rate)(?:for)?([a-z]+)$", norm) or re.match(r"^([a-z]+)(?:price|marketprice|marketpricekg|rate)$", norm)
        if m_pri and norm not in MARKET_ALIASES["market_price_kg"]:
            comm = normalize_commodity_name(m_pri.group(1))
            wide_price_cols[comm] = c

    # Also check if known_commodities was provided and match columns directly
    if known_commodities:
        for k_comm in known_commodities:
            k_clean = _normalize_col_name(k_comm)
            for c in cols:
                c_norm = _normalize_col_name(c)
                if k_clean in c_norm and ("demand" in c_norm or "qty" in c_norm) and k_comm not in wide_demand_cols:
                    wide_demand_cols[k_comm] = c
                if k_clean in c_norm and ("price" in c_norm or "rate" in c_norm) and k_comm not in wide_price_cols:
                    wide_price_cols[k_comm] = c

    # Grouping key: by market_id if present, else synthesize
    if col_market_id:
        grouped = df.groupby(col_market_id, sort=False)
    else:
        # Synthesize grouping based on name or row indices
        if col_name and not is_long_format:
            grouped = df.groupby(col_name, sort=False)
        else:
            # Single row per market or grouped sequentially
            df["_temp_mkt_id"] = [f"M-{i+1}" for i in range(len(df))]
            grouped = df.groupby("_temp_mkt_id", sort=False)
            col_market_id = "_temp_mkt_id"

    market_idx = 0
    for m_key, group_df in grouped:
        market_idx += 1
        m_id = str(m_key).strip() if pd.notna(m_key) else f"M-{market_idx}"
        first_row = group_df.iloc[0]

        # Name
        if col_name and pd.notna(first_row[col_name]) and str(first_row[col_name]).strip():
            name = str(first_row[col_name]).strip()
        else:
            name = f"Market {m_id}"

        # Transit hours
        if col_transit_hrs and pd.notna(first_row[col_transit_hrs]):
            transit_hrs, _ = _clean_float(first_row[col_transit_hrs], default=4.0)
        else:
            transit_hrs = 4.0
            warnings.append(f"Market {m_id} ({name}): Imputed missing transit_hours=4.0h.")

        if transit_hrs < 0.0:
            warnings.append(f"Market {m_id}: Clamped negative transit_hours={transit_hrs} to 0.0.")
            transit_hrs = 0.0

        # Transit temp (°C)
        if col_transit_temp and pd.notna(first_row[col_transit_temp]):
            transit_temp, _ = _clean_float(first_row[col_transit_temp], default=15.0)
        else:
            transit_temp = 15.0

        # Transport cost per kg (₹)
        if col_tr_cost and pd.notna(first_row[col_tr_cost]):
            tr_cost, _ = _clean_float(first_row[col_tr_cost], default=2.5)
        else:
            tr_cost = 2.5
            warnings.append(f"Market {m_id} ({name}): Imputed missing transport_cost_per_kg=₹2.5.")

        if tr_cost < 0.0:
            warnings.append(f"Market {m_id}: Clamped negative transport_cost_per_kg={tr_cost} to 0.0.")
            tr_cost = 0.0

        # Handling hours
        if col_handling_hrs and pd.notna(first_row[col_handling_hrs]):
            handling_hrs, _ = _clean_float(first_row[col_handling_hrs], default=3.0)
        else:
            handling_hrs = 3.0

        if handling_hrs < 0.0:
            handling_hrs = 0.0

        # Handling cost per kg (₹)
        if col_handling_cost and pd.notna(first_row[col_handling_cost]):
            handling_cost, _ = _clean_float(first_row[col_handling_cost], default=1.5)
        else:
            handling_cost = 1.5

        if handling_cost < 0.0:
            handling_cost = 0.0

        # Capacity (kg)
        if col_capacity and pd.notna(first_row[col_capacity]):
            raw_cap, was_imp = _clean_float(first_row[col_capacity], default=5000.0)
            max_cap = raw_cap * cap_multiplier
        else:
            max_cap = 5000.0
            warnings.append(f"Market {m_id} ({name}): Missing capacity; defaulted to 5,000 kg.")

        if max_cap < 0.0:
            warnings.append(f"Market {m_id}: Clamped negative max_capacity_kg={max_cap} to 0.0.")
            max_cap = 0.0

        # Lat / Lng resolution with city geocoding
        raw_lat = first_row[col_lat] if col_lat and pd.notna(first_row[col_lat]) else None
        raw_lng = first_row[col_lng] if col_lng and pd.notna(first_row[col_lng]) else None
        lat, lng = resolve_market_lat_lng(name, m_id, raw_lat, raw_lng)

        # Build demand_kg and market_price_kg
        demand_kg: Dict[str, float] = {}
        market_price_kg: Dict[str, float] = {}

        if is_long_format:
            # Long format: each row in group specifies a commodity
            for _, r in group_df.iterrows():
                comm_val = r[col_commodity]
                if pd.isna(comm_val) or not str(comm_val).strip():
                    continue
                comm_name = normalize_commodity_name(comm_val)

                # Demand
                if col_demand and pd.notna(r[col_demand]):
                    d_val, _ = _clean_float(r[col_demand], default=1000.0)
                else:
                    d_val = 1000.0

                if d_val < 0.0:
                    warnings.append(f"Market {m_id} ({comm_name}): Clamped negative demand_kg={d_val} to 0.0.")
                    d_val = 0.0

                # Price
                if col_price and pd.notna(r[col_price]):
                    p_val, _ = _clean_float(r[col_price], default=35.0)
                else:
                    cold_defaults = COMMODITY_COLD_CHAIN_LOOKUP.get(comm_name, FALLBACK_COMMODITY_DEFAULT)
                    p_val = round(cold_defaults["base_cost_per_kg"] * 1.6, 2)
                    warnings.append(f"Market {m_id} ({comm_name}): Imputed wholesale market price ₹{p_val}/kg.")

                if p_val < 0.0:
                    warnings.append(f"Market {m_id} ({comm_name}): Clamped negative market_price_kg={p_val} to 0.0.")
                    p_val = 0.0

                demand_kg[comm_name] = round(d_val, 2)
                market_price_kg[comm_name] = round(p_val, 2)
        else:
            # Wide format: check for JSON string cells first
            json_parsed = False
            if col_demand and pd.notna(first_row[col_demand]):
                val_str = str(first_row[col_demand]).strip()
                if val_str.startswith("{") and val_str.endswith("}"):
                    try:
                        d_dict = json.loads(val_str)
                        for k, v in d_dict.items():
                            c_k = normalize_commodity_name(k)
                            v_clean, _ = _clean_float(v, default=0.0)
                            demand_kg[c_k] = max(0.0, round(v_clean, 2))
                        json_parsed = True
                    except Exception:
                        pass

            if col_price and pd.notna(first_row[col_price]):
                val_str = str(first_row[col_price]).strip()
                if val_str.startswith("{") and val_str.endswith("}"):
                    try:
                        p_dict = json.loads(val_str)
                        for k, v in p_dict.items():
                            c_k = normalize_commodity_name(k)
                            v_clean, _ = _clean_float(v, default=35.0)
                            market_price_kg[c_k] = max(0.0, round(v_clean, 2))
                    except Exception:
                        pass

            # If not JSON, check wide columns (e.g. demand_tomato, price_tomato)
            if not json_parsed and wide_demand_cols:
                for comm, c_name in wide_demand_cols.items():
                    d_raw, _ = _clean_float(first_row[c_name], default=0.0)
                    if d_raw < 0.0:
                        warnings.append(f"Market {m_id} ({comm}): Clamped negative wide demand {d_raw} to 0.0.")
                        d_raw = 0.0
                    demand_kg[comm] = round(d_raw, 2)

                    # Match corresponding price column
                    if comm in wide_price_cols:
                        p_raw, _ = _clean_float(first_row[wide_price_cols[comm]], default=35.0)
                    elif col_price and pd.notna(first_row[col_price]):
                        p_raw, _ = _clean_float(first_row[col_price], default=35.0)
                    else:
                        cold_defaults = COMMODITY_COLD_CHAIN_LOOKUP.get(comm, FALLBACK_COMMODITY_DEFAULT)
                        p_raw = round(cold_defaults["base_cost_per_kg"] * 1.6, 2)

                    if p_raw < 0.0:
                        warnings.append(f"Market {m_id} ({comm}): Clamped negative wide price {p_raw} to 0.0.")
                        p_raw = 0.0

                    market_price_kg[comm] = round(p_raw, 2)

        # Fallback if no demand was parsed: supply known commodities with baseline demands
        if not demand_kg and known_commodities:
            for k_comm in known_commodities:
                c_norm = normalize_commodity_name(k_comm)
                cold_defaults = COMMODITY_COLD_CHAIN_LOOKUP.get(c_norm, FALLBACK_COMMODITY_DEFAULT)
                demand_kg[c_norm] = 1200.0
                market_price_kg[c_norm] = round(cold_defaults["base_cost_per_kg"] * 1.6, 2)
            warnings.append(f"Market {m_id}: Imputed default demands for {len(known_commodities)} commodities.")
        elif not demand_kg:
            # Fallback default commodity
            demand_kg["Tomato"] = 1500.0
            market_price_kg["Tomato"] = 38.0
            warnings.append(f"Market {m_id}: No commodity demand specified; created default Tomato demand.")

        market_obj = Market(
            market_id=m_id,
            name=name,
            lat=lat,
            lng=lng,
            transit_hours=round(transit_hrs, 2),
            transit_temp_c=round(transit_temp, 2),
            transport_cost_per_kg=round(tr_cost, 2),
            handling_hours=round(handling_hrs, 2),
            handling_cost_per_kg=round(handling_cost, 2),
            max_capacity_kg=round(max_cap, 2),
            demand_kg=demand_kg,
            market_price_kg=market_price_kg,
        )
        markets.append(market_obj)

    return markets, warnings


# ==============================================================================
# 6. PUBLIC ENTRYPOINT: PARSE UPLOADED FILES (FASTAPI MULTIPART / JSON)
# ==============================================================================
def parse_uploaded_files(
    scenario_bytes: bytes | None = None,
    scenario_filename: str | None = None,
    batches_bytes: bytes | None = None,
    batches_filename: str | None = None,
    markets_bytes: bytes | None = None,
    markets_filename: str | None = None,
) -> tuple[list[Batch], list[Market], list[str]]:
    """
    Primary ingestion entrypoint used by FastAPI POST /api/v1/upload-dataset.
    Accepts scenario file (JSON/CSV) OR separate batches/markets files.
    Returns (batches, markets, ingestion_warnings).
    """
    all_batches: list[Batch] = []
    all_markets: list[Market] = []
    all_warnings: list[str] = []

    def _read_dataframe_from_bytes(data: bytes, filename: Optional[str]) -> Tuple[Optional[pd.DataFrame], Optional[Dict[str, Any]]]:
        if not data:
            return None, None
        text = data.decode("utf-8-sig", errors="replace").strip()
        if not text:
            return None, None

        # Try JSON first if indicated by filename or structure
        is_json = (filename and filename.lower().endswith(".json")) or (text.startswith("{") or text.startswith("["))
        if is_json:
            try:
                parsed_json = json.loads(text)
                if isinstance(parsed_json, dict):
                    return None, parsed_json
                elif isinstance(parsed_json, list):
                    return pd.DataFrame(parsed_json), None
            except Exception:
                pass

        # CSV fallback
        try:
            return pd.read_csv(io.StringIO(text)), None
        except Exception as e:
            all_warnings.append(f"Failed to read CSV from {filename or 'bytes'}: {str(e)}")
            return None, None

    # Case 1: Combined Scenario file provided
    if scenario_bytes:
        df_scen, json_scen = _read_dataframe_from_bytes(scenario_bytes, scenario_filename)
        if json_scen:
            # Look for batches and markets in JSON dictionary
            b_data = json_scen.get("batches") or json_scen.get("inventory") or json_scen.get("lots")
            m_data = json_scen.get("markets") or json_scen.get("destinations") or json_scen.get("mandis")

            if b_data and isinstance(b_data, list):
                b_list, b_warn = parse_batches_df(pd.DataFrame(b_data))
                all_batches.extend(b_list)
                all_warnings.extend(b_warn)

            known_comm = [b.commodity for b in all_batches] if all_batches else None
            if m_data and isinstance(m_data, list):
                m_list, m_warn = parse_markets_df(pd.DataFrame(m_data), known_commodities=known_comm)
                all_markets.extend(m_list)
                all_warnings.extend(m_warn)

            if all_batches and all_markets:
                return all_batches, all_markets, all_warnings
        elif df_scen is not None:
            # If scenario is a single CSV, parse batches from it
            b_list, b_warn = parse_batches_df(df_scen)
            all_batches.extend(b_list)
            all_warnings.extend(b_warn)

    # Case 2: Separate Batches file provided
    if batches_bytes:
        df_b, json_b = _read_dataframe_from_bytes(batches_bytes, batches_filename)
        if json_b and ("batches" in json_b or "inventory" in json_b):
            target_list = json_b.get("batches") or json_b.get("inventory")
            df_b = pd.DataFrame(target_list)
        elif df_b is None and json_b is not None:
            df_b = pd.DataFrame([json_b])

        if df_b is not None:
            b_list, b_warn = parse_batches_df(df_b)
            all_batches.extend(b_list)
            all_warnings.extend(b_warn)

    known_comm = [b.commodity for b in all_batches] if all_batches else None

    # Case 3: Separate Markets file provided
    if markets_bytes:
        df_m, json_m = _read_dataframe_from_bytes(markets_bytes, markets_filename)
        if json_m and ("markets" in json_m or "destinations" in json_m):
            target_list = json_m.get("markets") or json_m.get("destinations")
            df_m = pd.DataFrame(target_list)
        elif df_m is None and json_m is not None:
            df_m = pd.DataFrame([json_m])

        if df_m is not None:
            m_list, m_warn = parse_markets_df(df_m, known_commodities=known_comm)
            all_markets.extend(m_list)
            all_warnings.extend(m_warn)

    return all_batches, all_markets, all_warnings


async def parse_uploaded_dataset(
    scenario_file: Any = None,
    batches_file: Any = None,
    markets_file: Any = None,
) -> Any:
    """
    Direct bridge called by FastAPI POST /api/v1/upload-dataset.
    Ingests uploaded files (scenario_file, batches_file, markets_file),
    normalizes column aliases, imputes missing cold-chain values,
    solves the scenario with the MILP solver, and returns an OptimizeResponse.
    """
    scenario_bytes: bytes | None = None
    scenario_filename: str | None = None
    if scenario_file is not None:
        read_method = getattr(scenario_file, "read", None)
        if callable(read_method):
            res = read_method()
            scenario_bytes = await res if asyncio.iscoroutine(res) else res
        scenario_filename = getattr(scenario_file, "filename", None)

    batches_bytes: bytes | None = None
    batches_filename: str | None = None
    if batches_file is not None:
        read_method = getattr(batches_file, "read", None)
        if callable(read_method):
            res = read_method()
            batches_bytes = await res if asyncio.iscoroutine(res) else res
        batches_filename = getattr(batches_file, "filename", None)

    markets_bytes: bytes | None = None
    markets_filename: str | None = None
    if markets_file is not None:
        read_method = getattr(markets_file, "read", None)
        if callable(read_method):
            res = read_method()
            markets_bytes = await res if asyncio.iscoroutine(res) else res
        markets_filename = getattr(markets_file, "filename", None)

    batches, markets, warnings = parse_uploaded_files(
        scenario_bytes=scenario_bytes,
        scenario_filename=scenario_filename,
        batches_bytes=batches_bytes,
        batches_filename=batches_filename,
        markets_bytes=markets_bytes,
        markets_filename=markets_filename,
    )

    try:
        from backend.core.default_data import (
            get_default_batches,
            get_default_markets,
            get_default_disruptions,
        )
        from backend.core.solver import solve_scenario

        if not batches:
            warnings.append("No batches uploaded or parsed; falling back to default MoFPI batches.")
            batches = get_default_batches()
        if not markets:
            warnings.append("No markets uploaded or parsed; falling back to default MoFPI markets.")
            markets = get_default_markets()

        return solve_scenario(
            batches=batches,
            markets=markets,
            disruptions=get_default_disruptions(),
            ingestion_warnings=warnings,
        )
    except ImportError:
        return {
            "batches": batches,
            "markets": markets,
            "ingestion_warnings": warnings,
        }


# ==============================================================================
# 7. STANDALONE SELF-TEST BLOCK
# ==============================================================================
if __name__ == "__main__":
    print("[RUNNING] Ingestion Parser Self-Test...")

    # Deliberately corrupt Batches CSV
    corrupt_batches_csv = """lot_id,fruit_veg,stock_mt,shelf_life_days,storage_temp,spoilage_cost,base_cost
L-901,tomatoes,1.5,1.5,NaN,-10.0,NaN
L-902,guavas,2.0,3.0,NaN,NaN,-5.0
L-903,bananas,-0.5,0.8,14.0,12.0,15.0
,,,
"""

    # Deliberately corrupt Markets CSV (Long-format with negative values & capacity in MT)
    corrupt_markets_csv = """destination_id,destination,travel_time,truck_temp,freight_cost,handling_time,handling_cost,capacity_mt,commodity,demand_kg,market_price
M1,Bengaluru APMC,4.0,14.0,2.5,3.0,1.2,4.5,Tomato,1600,38.0
M1,Bengaluru APMC,4.0,14.0,2.5,3.0,1.2,4.5,Guava,1200,52.0
M2,Chennai Mandi,8.0,16.0,-1.0,2.5,1.0,3.0,Tomato,-500,42.0
"""

    # Deliberately corrupt Wide-format Markets CSV
    corrupt_wide_markets_csv = """market_id,market_name,travel_hours,freight,capacity_mt,demand_tomato,price_tomato,demand_banana,price_banana
M3,Hyderabad Bowenpally Market,15.0,7.5,5.0,1400.0,50.0,-200.0,42.0
"""

    # 1. Test Batches Parsing
    df_batches = pd.read_csv(io.StringIO(corrupt_batches_csv))
    parsed_batches, batch_warnings = parse_batches_df(df_batches)

    assert len(parsed_batches) == 3, f"Expected 3 batches, got {len(parsed_batches)}"
    # Check Batch 1
    b1 = parsed_batches[0]
    assert b1.batch_id == "L-901"
    assert b1.commodity == "Tomato"
    assert b1.quantity_kg == 1500.0, f"Expected 1500.0 kg (1.5 MT x 1000), got {b1.quantity_kg}"
    assert b1.rsl_hours == 36.0, f"Expected 36.0 hrs (1.5 days x 24), got {b1.rsl_hours}"
    assert b1.optimal_temp_c == 12.0, f"Expected imputed 12.0 C for Tomato, got {b1.optimal_temp_c}"
    assert b1.spoilage_cost_per_kg == 0.0, f"Expected clamped 0.0 from -10, got {b1.spoilage_cost_per_kg}"
    assert b1.base_cost_per_kg == 18.0, f"Expected imputed 18.0 for Tomato, got {b1.base_cost_per_kg}"

    # Check Batch 2
    b2 = parsed_batches[1]
    assert b2.commodity == "Guava"
    assert b2.quantity_kg == 2000.0
    assert b2.rsl_hours == 72.0
    assert b2.optimal_temp_c == 10.0
    assert b2.spoilage_cost_per_kg == 18.0
    assert b2.base_cost_per_kg == 0.0, f"Expected clamped 0.0 from -5.0, got {b2.base_cost_per_kg}"

    # Check Batch 3 (clamped negative stock)
    b3 = parsed_batches[2]
    assert b3.quantity_kg == 0.0, f"Expected clamped 0.0 from -0.5 MT, got {b3.quantity_kg}"
    assert b3.rsl_hours == 19.2, f"Expected 19.2 hrs (0.8 x 24), got {b3.rsl_hours}"
    assert len(batch_warnings) >= 5, f"Expected at least 5 warnings, got {len(batch_warnings)}"

    # 2. Test Long-Format Markets Parsing
    df_long_markets = pd.read_csv(io.StringIO(corrupt_markets_csv))
    parsed_long_mkt, long_mkt_warnings = parse_markets_df(df_long_markets, known_commodities=["Tomato", "Guava"])

    assert len(parsed_long_mkt) == 2, f"Expected 2 unique markets, got {len(parsed_long_mkt)}"
    m1 = next(m for m in parsed_long_mkt if m.market_id == "M1")
    assert m1.name == "Bengaluru APMC"
    assert m1.max_capacity_kg == 4500.0, f"Expected 4500 kg (4.5 MT x 1000), got {m1.max_capacity_kg}"
    assert m1.demand_kg["Tomato"] == 1600.0
    assert m1.demand_kg["Guava"] == 1200.0
    assert m1.market_price_kg["Tomato"] == 38.0
    assert m1.market_price_kg["Guava"] == 52.0
    assert m1.lat is not None and not math.isnan(m1.lat)
    assert m1.lng is not None and not math.isnan(m1.lng)

    m2 = next(m for m in parsed_long_mkt if m.market_id == "M2")
    assert m2.transport_cost_per_kg == 0.0, f"Expected clamped 0.0 from -1.0, got {m2.transport_cost_per_kg}"
    assert m2.demand_kg["Tomato"] == 0.0, f"Expected clamped 0.0 from -500.0, got {m2.demand_kg['Tomato']}"

    # 3. Test Wide-Format Markets Parsing
    df_wide_markets = pd.read_csv(io.StringIO(corrupt_wide_markets_csv))
    parsed_wide_mkt, wide_mkt_warnings = parse_markets_df(df_wide_markets)
    assert len(parsed_wide_mkt) == 1
    m3 = parsed_wide_mkt[0]
    assert m3.market_id == "M3"
    assert m3.max_capacity_kg == 5000.0, f"Expected 5000 kg, got {m3.max_capacity_kg}"
    assert m3.demand_kg["Tomato"] == 1400.0
    assert m3.market_price_kg["Tomato"] == 50.0
    assert m3.demand_kg["Banana"] == 0.0, f"Expected clamped 0.0 from -200, got {m3.demand_kg['Banana']}"

    # 4. Test Public Entrypoint: parse_uploaded_files
    all_b, all_m, all_w = parse_uploaded_files(
        batches_bytes=corrupt_batches_csv.encode("utf-8"),
        batches_filename="hidden_test_batches.csv",
        markets_bytes=corrupt_markets_csv.encode("utf-8"),
        markets_filename="hidden_test_markets.csv"
    )
    assert len(all_b) == 3
    assert len(all_m) == 2
    assert len(all_w) > 0

    print("PARSER SELF-TEST PASSED")
