"""
FreshRoute OS Default Data
Standard MoFPI South India perishable produce cold-chain dataset.
Originating Hub: Kolar–Bengaluru Integrated Cold-Chain Packinghouse (HUB-KOLAR).
"""

from typing import List
from backend.core.schemas import Batch, Market, DisruptionOverrides


def get_default_disruptions() -> DisruptionOverrides:
    return DisruptionOverrides(
        highway_delay_hours=0.0,
        reefer_temp_spike_c=0.0,
        demand_multiplier=1.0,
        capacity_reduction_pct=0.0,
    )


def get_default_batches() -> List[Batch]:
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
        Batch(
            batch_id="B-106",
            commodity="Tomato",
            quantity_kg=1600.0,
            rsl_hours=14.0,
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        ),
        Batch(
            batch_id="B-107",
            commodity="Papaya",
            quantity_kg=1100.0,
            rsl_hours=26.0,
            optimal_temp_c=10.0,
            spoilage_cost_per_kg=15.0,
            base_cost_per_kg=20.0,
        ),
    ]


def get_default_markets() -> List[Market]:
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
            demand_kg={"Tomato": 1600.0, "Guava": 1200.0, "Banana": 1500.0, "Alphonso Mango": 600.0, "Papaya": 500.0},
            market_price_kg={"Tomato": 38.0, "Guava": 52.0, "Banana": 32.0, "Alphonso Mango": 95.0, "Papaya": 35.0},
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
            demand_kg={"Tomato": 1800.0, "Guava": 1000.0, "Banana": 1600.0, "Alphonso Mango": 800.0, "Papaya": 600.0},
            market_price_kg={"Tomato": 44.0, "Guava": 58.0, "Banana": 36.0, "Alphonso Mango": 105.0, "Papaya": 38.0},
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
            demand_kg={"Tomato": 1400.0, "Guava": 1300.0, "Banana": 1400.0, "Alphonso Mango": 700.0, "Papaya": 500.0},
            market_price_kg={"Tomato": 50.0, "Guava": 66.0, "Banana": 42.0, "Alphonso Mango": 115.0, "Papaya": 42.0},
        ),
        Market(
            market_id="M4",
            name="Kochi Ernakulam Central Market",
            lat=9.9816,
            lng=76.2999,
            transit_hours=12.0,
            transit_temp_c=16.5,
            transport_cost_per_kg=6.0,
            handling_hours=4.0,
            handling_cost_per_kg=1.6,
            max_capacity_kg=4000.0,
            demand_kg={"Tomato": 1200.0, "Guava": 800.0, "Banana": 1200.0, "Alphonso Mango": 500.0, "Papaya": 400.0},
            market_price_kg={"Tomato": 47.0, "Guava": 62.0, "Banana": 40.0, "Alphonso Mango": 110.0, "Papaya": 40.0},
        ),
    ]
