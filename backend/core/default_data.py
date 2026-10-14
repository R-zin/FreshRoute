"""
FreshRoute OS Default Scenario Data
Grounded in India's Ministry of Food Processing Industries (MoFPI / NABCONS) cold-chain study.
Origin Packinghouse: Kolar–Bengaluru Integrated Cold-Chain Hub (HUB-KOLAR).
"""

from backend.core.schemas import Batch, DisruptionOverrides, Market


def get_default_disruptions() -> DisruptionOverrides:
    """Returns baseline disruption parameters (nominal zero disruption)."""
    return DisruptionOverrides(
        highway_delay_hours=0.0,
        reefer_temp_spike_c=0.0,
        demand_multiplier=1.0,
        capacity_reduction_pct=0.0,
    )


def get_default_batches() -> list[Batch]:
    """
    Returns 8 realistic inventory batches at Kolar–Bengaluru Packinghouse
    grounded in MoFPI / NABCONS perishables baseline data.
    """
    return [
        Batch(
            batch_id="B-101",
            commodity="Tomato",
            quantity_kg=1800.0,
            rsl_hours=18.0,
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        ),  # Urgent batch; will spoil if Naive FIFO greedily ships to Hyderabad!
        Batch(
            batch_id="B-102",
            commodity="Tomato",
            quantity_kg=2400.0,
            rsl_hours=52.0,
            optimal_temp_c=12.0,
            spoilage_cost_per_kg=14.0,
            base_cost_per_kg=18.0,
        ),
        Batch(
            batch_id="B-103",
            commodity="Guava",
            quantity_kg=1500.0,
            rsl_hours=21.0,
            optimal_temp_c=10.0,
            spoilage_cost_per_kg=18.0,
            base_cost_per_kg=25.0,
        ),  # Urgent batch; requires local/regional dispatch + dynamic markdown!
        Batch(
            batch_id="B-104",
            commodity="Guava",
            quantity_kg=2100.0,
            rsl_hours=64.0,
            optimal_temp_c=10.0,
            spoilage_cost_per_kg=18.0,
            base_cost_per_kg=25.0,
        ),
        Batch(
            batch_id="B-105",
            commodity="Banana",
            quantity_kg=2200.0,
            rsl_hours=26.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=12.0,
            base_cost_per_kg=15.0,
        ),  # Urgent batch; sensitive to elevated reefer temperatures
        Batch(
            batch_id="B-106",
            commodity="Banana",
            quantity_kg=2600.0,
            rsl_hours=72.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=12.0,
            base_cost_per_kg=15.0,
        ),
        Batch(
            batch_id="B-107",
            commodity="Alphonso Mango",
            quantity_kg=1200.0,
            rsl_hours=24.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=28.0,
            base_cost_per_kg=45.0,
        ),  # Premium high-margin crop; high spoilage penalty if delayed
        Batch(
            batch_id="B-108",
            commodity="Alphonso Mango",
            quantity_kg=1600.0,
            rsl_hours=68.0,
            optimal_temp_c=13.0,
            spoilage_cost_per_kg=28.0,
            base_cost_per_kg=45.0,
        ),
    ]


def get_default_markets() -> list[Market]:
    """
    Returns 4 South India Wholesale / Retail Destination Markets:
    - M1: Bengaluru Yeshwanthpur APMC (Local, shortest route)
    - M2: Chennai Koyambedu Wholesale Hub (Regional freight corridor)
    - M3: Hyderabad Bowenpally Market (Long distance, highest nominal prices)
    - M4: Kochi Maradu Urban Retail Hub (Western Ghats transit corridor)
    """
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
            max_capacity_kg=5000.0,
            demand_kg={
                "Tomato": 1800.0,
                "Guava": 1400.0,
                "Banana": 1800.0,
                "Alphonso Mango": 1000.0,
            },
            market_price_kg={
                "Tomato": 38.0,
                "Guava": 52.0,
                "Banana": 32.0,
                "Alphonso Mango": 95.0,
            },
        ),
        Market(
            market_id="M2",
            name="Chennai Koyambedu Wholesale Hub",
            lat=13.0694,
            lng=80.1948,
            transit_hours=9.0,
            transit_temp_c=16.0,
            transport_cost_per_kg=5.0,
            handling_hours=4.0,
            handling_cost_per_kg=1.5,
            max_capacity_kg=4800.0,
            demand_kg={
                "Tomato": 1600.0,
                "Guava": 1200.0,
                "Banana": 1600.0,
                "Alphonso Mango": 900.0,
            },
            market_price_kg={
                "Tomato": 44.0,
                "Guava": 58.0,
                "Banana": 36.0,
                "Alphonso Mango": 105.0,
            },
        ),
        Market(
            market_id="M3",
            name="Hyderabad Bowenpally Market",
            lat=17.4691,
            lng=78.4765,
            transit_hours=15.0,
            transit_temp_c=18.5,
            transport_cost_per_kg=7.5,
            handling_hours=5.0,
            handling_cost_per_kg=1.8,
            max_capacity_kg=5200.0,
            demand_kg={
                "Tomato": 1600.0,
                "Guava": 1400.0,
                "Banana": 1600.0,
                "Alphonso Mango": 1000.0,
            },
            market_price_kg={
                "Tomato": 52.0,
                "Guava": 68.0,
                "Banana": 44.0,
                "Alphonso Mango": 125.0,
            },
        ),
        Market(
            market_id="M4",
            name="Kochi Maradu Urban Retail Hub",
            lat=9.9390,
            lng=76.3218,
            transit_hours=11.0,
            transit_temp_c=15.5,
            transport_cost_per_kg=6.0,
            handling_hours=3.5,
            handling_cost_per_kg=1.5,
            max_capacity_kg=4200.0,
            demand_kg={
                "Tomato": 1400.0,
                "Guava": 1000.0,
                "Banana": 1400.0,
                "Alphonso Mango": 800.0,
            },
            market_price_kg={
                "Tomato": 48.0,
                "Guava": 62.0,
                "Banana": 40.0,
                "Alphonso Mango": 115.0,
            },
        ),
    ]
