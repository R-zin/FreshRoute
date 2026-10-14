"""
FreshRoute OS MILP Optimization Engine & Baseline FIFO Simulator
Core algorithms implementing Arrhenius Q10 thermal shelf-life modeling,
1D MILP vectorization with SciPy HiGHS, and shared cost accounting.
"""

import time
from typing import Dict, List, Tuple
import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp

from backend.core.schemas import (
    AllocationRow,
    Batch,
    ConstraintAudit,
    DisruptionOverrides,
    KPIDeltas,
    KpiComparisonBundle,
    Market,
    MonteCarloRun,
    OptimizeResponse,
    StrategyKPIs,
)


def calculate_effective_rsl(
    transit_hours: float,
    transit_temp_c: float,
    optimal_temp_c: float,
    handling_hours: float,
) -> float:
    """
    Q10 Arrhenius Thermal Shelf-Life Formula:
    effective_transit_rsl_hours = transit_hours * 2.0^(max(0.0, transit_temp - optimal_temp) / 10.0) + handling_hours
    """
    delta_temp = max(0.0, transit_temp_c - optimal_temp_c)
    thermal_acceleration = 2.0 ** (delta_temp / 10.0)
    effective_rsl = (transit_hours * thermal_acceleration) + handling_hours
    return round(effective_rsl, 2)


def run_freshroute_milp(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
) -> Tuple[List[AllocationRow], np.ndarray, str]:
    """
    Solves the FreshRoute Mixed Integer Linear Program (MILP) using SciPy HiGHS.

    MILP Formulation Verification:
    - Total decision variables = (n_b * n_m * 3) + n_b
    - Objective vector c is negated because scipy.optimize.milp minimizes c^T x
    - Every infeasible route where eff_rsl > batch.rsl_hours has ub[idx_x(i, j, k)] = 0.0
    - Tier 2 (30% clearance discount, k=2) has ub[idx_x(i, j, 2)] = 0.0 whenever batch.rsl_hours > 36.0
    """
    n_b = len(batches)
    n_m = len(markets)
    n_k = 3  # Tier 0 (0%), Tier 1 (15%), Tier 2 (30%)
    total_x = n_b * n_m * n_k
    total_vars = total_x + n_b

    if n_b == 0 or n_m == 0:
        return [], np.zeros(total_vars, dtype=float), "FEASIBLE"

    def idx_x(i: int, j: int, k: int) -> int:
        return i * (n_m * n_k) + j * n_k + k

    def idx_s(i: int) -> int:
        return total_x + i

    # Discount tier constants
    expansion = [1.00, 0.25, 0.35]
    discount_rates = [0.00, 0.15, 0.30]
    discount_pcts = [0, 15, 30]

    # Effective market capacity and demand under disruptions
    cap_multiplier = max(0.0, 1.0 - (disruptions.capacity_reduction_pct / 100.0))
    eff_cap = [max(0.0, m.max_capacity_kg * cap_multiplier) for m in markets]

    # Unique commodities
    all_commodities = sorted(
        list(set(b.commodity for b in batches).union(*(m.demand_kg.keys() for m in markets)))
    )

    # 1. Bounds vector
    lb = np.zeros(total_vars, dtype=float)
    ub = np.zeros(total_vars, dtype=float)

    # Upper bounds for slack variables s[i]
    for i in range(n_b):
        ub[idx_s(i)] = batches[i].quantity_kg

    # Upper bounds and thermal pruning for dispatch variables x[i, j, k]
    for i in range(n_b):
        b = batches[i]
        for j in range(n_m):
            m = markets[j]
            eff_transit_h = m.transit_hours + disruptions.highway_delay_hours
            eff_transit_temp = m.transit_temp_c + disruptions.reefer_temp_spike_c
            eff_rsl = calculate_effective_rsl(
                eff_transit_h,
                eff_transit_temp,
                b.optimal_temp_c,
                m.handling_hours,
            )

            is_thermally_feasible = eff_rsl <= b.rsl_hours
            base_d = max(0.0, m.demand_kg.get(b.commodity, 0.0) * disruptions.demand_multiplier)
            market_price = m.market_price_kg.get(b.commodity, 0.0)

            for k in range(n_k):
                var_idx = idx_x(i, j, k)
                if not is_thermally_feasible or base_d <= 0.0 or market_price <= 0.0:
                    ub[var_idx] = 0.0
                elif k == 2 and b.rsl_hours > 36.0:
                    ub[var_idx] = 0.0
                else:
                    ub[var_idx] = min(b.quantity_kg, eff_cap[j], base_d * expansion[k])

    # 2. Objective vector c (Minimize negative net revenue)
    c = np.zeros(total_vars, dtype=float)

    # Spoilage cost penalty for unsold inventory s[i]
    for i in range(n_b):
        c[idx_s(i)] = batches[i].spoilage_cost_per_kg

    # Net contribution for x[i, j, k]
    for i in range(n_b):
        b = batches[i]
        for j in range(n_m):
            m = markets[j]
            price = m.market_price_kg.get(b.commodity, 0.0)
            freight = m.transport_cost_per_kg + m.handling_cost_per_kg
            for k in range(n_k):
                net_rev_per_kg = price * (1.0 - discount_rates[k]) - freight
                c[idx_x(i, j, k)] = -net_rev_per_kg

    # 3. Explicit Constraint Matrix Construction
    rows: List[List[float]] = []
    lhs: List[float] = []
    rhs: List[float] = []

    # Constraint 1: Mass Balance (n_b rows)
    # For each batch i: sum(x[i, j, k]) + s[i] == batches[i].quantity_kg
    for i in range(n_b):
        row = [0.0] * total_vars
        for j in range(n_m):
            for k in range(n_k):
                row[idx_x(i, j, k)] = 1.0
        row[idx_s(i)] = 1.0
        rows.append(row)
        lhs.append(batches[i].quantity_kg)
        rhs.append(batches[i].quantity_kg)

    # Constraint 2: Route Capacity (n_m rows)
    # For each market j: sum(x[i, j, k]) <= markets[j].max_capacity_kg
    for j in range(n_m):
        row = [0.0] * total_vars
        for i in range(n_b):
            for k in range(n_k):
                row[idx_x(i, j, k)] = 1.0
        rows.append(row)
        lhs.append(-np.inf)
        rhs.append(eff_cap[j])

    # Constraint 3: Price-Elastic Demand per Commodity & Tier (n_m * n_commodities * 3 rows)
    # For each market j, commodity c, tier k: sum_{i: commodity==c} x[i, j, k] <= demand * expansion[k]
    for j in range(n_m):
        m = markets[j]
        for comm in all_commodities:
            base_d = max(0.0, m.demand_kg.get(comm, 0.0) * disruptions.demand_multiplier)
            for k in range(n_k):
                row = [0.0] * total_vars
                has_matching_batch = False
                for i in range(n_b):
                    if batches[i].commodity == comm:
                        row[idx_x(i, j, k)] = 1.0
                        has_matching_batch = True
                if has_matching_batch:
                    rows.append(row)
                    lhs.append(-np.inf)
                    rhs.append(base_d * expansion[k])

    A = np.array(rows, dtype=float)
    constraints = LinearConstraint(A, lhs, rhs)
    bounds = Bounds(lb, ub)
    integrality = np.zeros(total_vars, dtype=float)

    try:
        res = milp(c=c, bounds=bounds, constraints=constraints, integrality=integrality)
    except Exception:
        return run_fallback_heuristic(batches, markets, disruptions)

    if not res.success or res.x is None:
        return run_fallback_heuristic(batches, markets, disruptions)

    alloc_rows: List[AllocationRow] = []
    sol_x = res.x

    # Process active dispatches
    for i in range(n_b):
        b = batches[i]
        for j in range(n_m):
            m = markets[j]
            eff_transit_h = m.transit_hours + disruptions.highway_delay_hours
            eff_transit_temp = m.transit_temp_c + disruptions.reefer_temp_spike_c
            eff_rsl = calculate_effective_rsl(
                eff_transit_h,
                eff_transit_temp,
                b.optimal_temp_c,
                m.handling_hours,
            )
            rsl_buf = round(b.rsl_hours - eff_rsl, 2)
            price = m.market_price_kg.get(b.commodity, 0.0)
            freight = m.transport_cost_per_kg + m.handling_cost_per_kg

            for k in range(n_k):
                qty = float(sol_x[idx_x(i, j, k)])
                if qty > 1e-4:
                    disc_pct = discount_pcts[k]
                    unit_net = (price * (1.0 - discount_rates[k])) - freight
                    net_contrib = round(qty * unit_net, 2)

                    if disc_pct == 0:
                        reason = (
                            f"FEFO Optimal Dispatch: {eff_rsl:.1f}h thermal-adjusted transit fits "
                            f"within {b.rsl_hours:.1f}h RSL ({rsl_buf:.1f}h safe buffer); "
                            f"nets ₹{unit_net:.1f}/kg."
                        )
                    else:
                        reason = (
                            f"Urgent RSL ({b.rsl_hours:.1f}h): Applied {disc_pct}% markdown to unlock "
                            f"price-elastic demand at {m.name} ({rsl_buf:.1f}h buffer), "
                            f"avoiding ₹{b.spoilage_cost_per_kg:.0f}/kg spoilage penalty."
                        )

                    alloc_rows.append(
                        AllocationRow(
                            batch_id=b.batch_id,
                            commodity=b.commodity,
                            market_id=m.market_id,
                            market_name=m.name,
                            quantity_kg=round(qty, 2),
                            discount_pct=disc_pct,
                            effective_transit_rsl_hours=eff_rsl,
                            rsl_buffer_hours=rsl_buf,
                            status="OPTIMAL_DISPATCH",
                            net_contribution=net_contrib,
                            reason=reason,
                        )
                    )

    # Process unallocated unsold inventory at hub
    for i in range(n_b):
        b = batches[i]
        unsold_qty = float(sol_x[idx_s(i)])
        if unsold_qty > 1e-4:
            net_contrib = -round(unsold_qty * b.spoilage_cost_per_kg, 2)
            reason = (
                f"Unallocated inventory ({unsold_qty:.1f} kg) could not be dispatched "
                f"before expiration; incurred ₹{b.spoilage_cost_per_kg:.0f}/kg spoilage penalty."
            )
            alloc_rows.append(
                AllocationRow(
                    batch_id=b.batch_id,
                    commodity=b.commodity,
                    market_id="HUB-KOLAR",
                    market_name="Kolar Cold-Chain Packinghouse (Unsold)",
                    quantity_kg=round(unsold_qty, 2),
                    discount_pct=0,
                    effective_transit_rsl_hours=0.0,
                    rsl_buffer_hours=0.0,
                    status="EXPIRED_UNSOLD",
                    net_contribution=net_contrib,
                    reason=reason,
                )
            )

    return alloc_rows, sol_x, "OPTIMAL"


def run_fallback_heuristic(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
) -> Tuple[List[AllocationRow], np.ndarray, str]:
    """
    Greedy FEFO (First-Expired, First-Out) fallback heuristic used if SciPy MILP
    solver experiences degeneracy or numerical failure.
    """
    n_b = len(batches)
    n_m = len(markets)
    n_k = 3
    total_x = n_b * n_m * n_k
    total_vars = total_x + n_b

    def idx_x(i: int, j: int, k: int) -> int:
        return i * (n_m * n_k) + j * n_k + k

    def idx_s(i: int) -> int:
        return total_x + i

    cap_multiplier = max(0.0, 1.0 - (disruptions.capacity_reduction_pct / 100.0))
    rem_cap = {j: max(0.0, m.max_capacity_kg * cap_multiplier) for j, m in enumerate(markets)}

    expansion = [1.00, 0.25, 0.35]
    discount_rates = [0.00, 0.15, 0.30]
    discount_pcts = [0, 15, 30]

    rem_demand: Dict[Tuple[int, str, int], float] = {}
    for j, m in enumerate(markets):
        for comm, d_val in m.demand_kg.items():
            base_d = max(0.0, d_val * disruptions.demand_multiplier)
            for k in range(n_k):
                rem_demand[(j, comm, k)] = base_d * expansion[k]

    sol_x = np.zeros(total_vars, dtype=float)
    alloc_rows: List[AllocationRow] = []

    sorted_batch_indices = sorted(range(n_b), key=lambda i: batches[i].rsl_hours)

    for i in sorted_batch_indices:
        b = batches[i]
        rem_batch_qty = b.quantity_kg

        candidates = []
        for j, m in enumerate(markets):
            eff_transit_h = m.transit_hours + disruptions.highway_delay_hours
            eff_transit_temp = m.transit_temp_c + disruptions.reefer_temp_spike_c
            eff_rsl = calculate_effective_rsl(
                eff_transit_h,
                eff_transit_temp,
                b.optimal_temp_c,
                m.handling_hours,
            )
            if eff_rsl > b.rsl_hours:
                continue

            price = m.market_price_kg.get(b.commodity, 0.0)
            if price <= 0.0:
                continue
            freight = m.transport_cost_per_kg + m.handling_cost_per_kg

            for k in range(n_k):
                if k == 2 and b.rsl_hours > 36.0:
                    continue
                net_margin = price * (1.0 - discount_rates[k]) - freight
                if net_margin > 0.0:
                    candidates.append((net_margin, j, k, eff_rsl))

        candidates.sort(key=lambda item: item[0], reverse=True)

        for net_margin, j, k, eff_rsl in candidates:
            if rem_batch_qty <= 1e-4:
                break
            m = markets[j]
            avail_cap = rem_cap[j]
            avail_dem = rem_demand.get((j, b.commodity, k), 0.0)
            qty_to_alloc = min(rem_batch_qty, avail_cap, avail_dem)

            if qty_to_alloc > 1e-4:
                rem_cap[j] -= qty_to_alloc
                rem_demand[(j, b.commodity, k)] -= qty_to_alloc
                rem_batch_qty -= qty_to_alloc
                sol_x[idx_x(i, j, k)] += qty_to_alloc

                rsl_buf = round(b.rsl_hours - eff_rsl, 2)
                disc_pct = discount_pcts[k]
                net_contrib = round(qty_to_alloc * net_margin, 2)

                reason = (
                    f"Fallback Heuristic: Dispatched {qty_to_alloc:.1f}kg to {m.name} "
                    f"({disc_pct}% discount, {rsl_buf:.1f}h buffer)."
                )

                alloc_rows.append(
                    AllocationRow(
                        batch_id=b.batch_id,
                        commodity=b.commodity,
                        market_id=m.market_id,
                        market_name=m.name,
                        quantity_kg=round(qty_to_alloc, 2),
                        discount_pct=disc_pct,
                        effective_transit_rsl_hours=eff_rsl,
                        rsl_buffer_hours=rsl_buf,
                        status="OPTIMAL_DISPATCH",
                        net_contribution=net_contrib,
                        reason=reason,
                    )
                )

        if rem_batch_qty > 1e-4:
            sol_x[idx_s(i)] = rem_batch_qty
            net_contrib = -round(rem_batch_qty * b.spoilage_cost_per_kg, 2)
            alloc_rows.append(
                AllocationRow(
                    batch_id=b.batch_id,
                    commodity=b.commodity,
                    market_id="HUB-KOLAR",
                    market_name="Kolar Cold-Chain Packinghouse (Unsold)",
                    quantity_kg=round(rem_batch_qty, 2),
                    discount_pct=0,
                    effective_transit_rsl_hours=0.0,
                    rsl_buffer_hours=0.0,
                    status="EXPIRED_UNSOLD",
                    net_contribution=net_contrib,
                    reason=f"Fallback Heuristic: {rem_batch_qty:.1f}kg expired unsold at packinghouse.",
                )
            )

    return alloc_rows, sol_x, "FALLBACK_HEURISTIC"


def run_baseline_fifo(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
) -> Tuple[List[AllocationRow], float]:
    """
    Simulates naive First-In First-Out (FIFO) operator dispatch.
    - Considers batches in arrival order.
    - Routes to highest nominal price market first.
    - Offers no discounts (Tier 0 only).
    - Ignores thermal degradation during routing; ships even if produce spoils in transit.
    """
    cap_multiplier = max(0.0, 1.0 - (disruptions.capacity_reduction_pct / 100.0))
    rem_cap = {m.market_id: max(0.0, m.max_capacity_kg * cap_multiplier) for m in markets}

    rem_demand: Dict[Tuple[str, str], float] = {}
    for m in markets:
        for comm, d_val in m.demand_kg.items():
            rem_demand[(m.market_id, comm)] = max(0.0, d_val * disruptions.demand_multiplier)

    alloc_rows: List[AllocationRow] = []

    for b in batches:
        rem_batch_qty = b.quantity_kg

        candidate_markets = sorted(
            markets,
            key=lambda m: m.market_price_kg.get(b.commodity, 0.0),
            reverse=True,
        )

        for m in candidate_markets:
            if rem_batch_qty <= 1e-4:
                break

            price = m.market_price_kg.get(b.commodity, 0.0)
            if price <= 0.0:
                continue

            avail_cap = rem_cap[m.market_id]
            avail_dem = rem_demand.get((m.market_id, b.commodity), 0.0)
            qty_to_alloc = min(rem_batch_qty, avail_cap, avail_dem)

            if qty_to_alloc > 1e-4:
                rem_cap[m.market_id] -= qty_to_alloc
                rem_demand[(m.market_id, b.commodity)] -= qty_to_alloc
                rem_batch_qty -= qty_to_alloc

                eff_transit_h = m.transit_hours + disruptions.highway_delay_hours
                eff_transit_temp = m.transit_temp_c + disruptions.reefer_temp_spike_c
                eff_rsl = calculate_effective_rsl(
                    eff_transit_h,
                    eff_transit_temp,
                    b.optimal_temp_c,
                    m.handling_hours,
                )
                rsl_buf = round(b.rsl_hours - eff_rsl, 2)
                freight = m.transport_cost_per_kg + m.handling_cost_per_kg

                if rsl_buf >= 0.0:
                    status = "DELIVERED"
                    net_contrib = round(qty_to_alloc * (price - freight), 2)
                    reason = (
                        f"Baseline FIFO: Dispatched to high-price market {m.name} at full price; "
                        f"delivered safely with {rsl_buf:.1f}h buffer."
                    )
                else:
                    status = "SPOILED_ON_ARRIVAL"
                    penalty = freight + b.spoilage_cost_per_kg
                    net_contrib = -round(qty_to_alloc * penalty, 2)
                    deficit = abs(rsl_buf)
                    reason = (
                        f"FIFO shipped to highest nominal price market without thermal check: "
                        f"needed {eff_rsl:.1f}h effective RSL, had {b.rsl_hours:.1f}h (-{deficit:.1f}h deficit)."
                    )

                alloc_rows.append(
                    AllocationRow(
                        batch_id=b.batch_id,
                        commodity=b.commodity,
                        market_id=m.market_id,
                        market_name=m.name,
                        quantity_kg=round(qty_to_alloc, 2),
                        discount_pct=0,
                        effective_transit_rsl_hours=eff_rsl,
                        rsl_buffer_hours=rsl_buf,
                        status=status,
                        net_contribution=net_contrib,
                        reason=reason,
                    )
                )

        if rem_batch_qty > 1e-4:
            net_contrib = -round(rem_batch_qty * b.spoilage_cost_per_kg, 2)
            alloc_rows.append(
                AllocationRow(
                    batch_id=b.batch_id,
                    commodity=b.commodity,
                    market_id="HUB-KOLAR",
                    market_name="Kolar Cold-Chain Packinghouse (Unsold)",
                    quantity_kg=round(rem_batch_qty, 2),
                    discount_pct=0,
                    effective_transit_rsl_hours=0.0,
                    rsl_buffer_hours=0.0,
                    status="EXPIRED_UNSOLD",
                    net_contribution=net_contrib,
                    reason=(
                        f"Baseline FIFO: Unallocated inventory ({rem_batch_qty:.1f} kg) expired "
                        f"unsold at packinghouse due to lack of market capacity/demand."
                    ),
                )
            )

    return alloc_rows, 0.0


def evaluate_cost_ledger(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
    allocations: List[AllocationRow],
) -> StrategyKPIs:
    """
    Shared Cost Ledger: Computes uniform KPIs across both Baseline and Optimized strategies.
    net_revenue = gross_revenue - transport_handling_cost - spoilage_cost
    """
    gross_revenue = 0.0
    transport_handling_cost = 0.0
    discount_cost = 0.0
    spoilage_cost = 0.0
    spoiled_kg = 0.0
    delivered_kg = 0.0

    batch_map = {b.batch_id: b for b in batches}
    market_map = {m.market_id: m for m in markets}

    for alloc in allocations:
        qty = alloc.quantity_kg
        b = batch_map.get(alloc.batch_id)
        m = market_map.get(alloc.market_id)

        if alloc.status in ("OPTIMAL_DISPATCH", "DELIVERED"):
            delivered_kg += qty
            if m:
                base_price = m.market_price_kg.get(alloc.commodity, 0.0)
                d_rate = alloc.discount_pct / 100.0
                selling_price = base_price * (1.0 - d_rate)

                gross_revenue += qty * selling_price
                discount_cost += qty * base_price * d_rate
                transport_handling_cost += qty * (m.transport_cost_per_kg + m.handling_cost_per_kg)

        elif alloc.status == "SPOILED_ON_ARRIVAL":
            spoiled_kg += qty
            spoil_penalty = b.spoilage_cost_per_kg if b else 14.0
            spoilage_cost += qty * spoil_penalty
            if m:
                transport_handling_cost += qty * (m.transport_cost_per_kg + m.handling_cost_per_kg)

        elif alloc.status in ("EXPIRED_UNSOLD", "SPOILED"):
            spoiled_kg += qty
            spoil_penalty = b.spoilage_cost_per_kg if b else 14.0
            spoilage_cost += qty * spoil_penalty

    total_supply_kg = sum(b.quantity_kg for b in batches)
    total_demand_kg = sum(
        qty * disruptions.demand_multiplier
        for m in markets
        for qty in m.demand_kg.values()
    )

    net_revenue = gross_revenue - transport_handling_cost - spoilage_cost
    spoilage_rate_pct = (spoiled_kg / total_supply_kg * 100.0) if total_supply_kg > 0.0 else 0.0
    demand_fulfillment_pct = (delivered_kg / total_demand_kg * 100.0) if total_demand_kg > 0.0 else 100.0

    return StrategyKPIs(
        net_revenue=round(net_revenue, 2),
        gross_revenue=round(gross_revenue, 2),
        transport_handling_cost=round(transport_handling_cost, 2),
        discount_cost=round(discount_cost, 2),
        spoilage_cost=round(spoilage_cost, 2),
        spoiled_kg=round(spoiled_kg, 2),
        spoilage_rate_pct=round(spoilage_rate_pct, 2),
        demand_fulfillment_pct=round(demand_fulfillment_pct, 2),
    )


# Alias for backward compatibility
compute_strategy_kpis = evaluate_cost_ledger


def compute_kpi_deltas(baseline: StrategyKPIs, optimized: StrategyKPIs) -> KPIDeltas:
    """Computes comparative improvements of FreshRoute MILP over Baseline FIFO."""
    net_revenue_gain = optimized.net_revenue - baseline.net_revenue
    if baseline.spoiled_kg > 0.0:
        spoilage_reduction_pct = (
            (baseline.spoiled_kg - optimized.spoiled_kg) / baseline.spoiled_kg
        ) * 100.0
    else:
        spoilage_reduction_pct = 0.0 if optimized.spoiled_kg == 0.0 else -100.0

    demand_fulfillment_gain_pct = (
        optimized.demand_fulfillment_pct - baseline.demand_fulfillment_pct
    )

    return KPIDeltas(
        net_revenue_gain=round(net_revenue_gain, 2),
        spoilage_reduction_pct=round(spoilage_reduction_pct, 2),
        demand_fulfillment_gain_pct=round(demand_fulfillment_gain_pct, 2),
    )


def audit_constraints(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
    allocations: List[AllocationRow],
    sol_x: np.ndarray,
) -> ConstraintAudit:
    """Verifies mass balance, route capacity, thermal shelf-life, and demand caps."""
    n_b = len(batches)
    n_m = len(markets)
    n_k = 3
    total_x = n_b * n_m * n_k

    def idx_x(i: int, j: int, k: int) -> int:
        return i * (n_m * n_k) + j * n_k + k

    def idx_s(i: int) -> int:
        return total_x + i

    expansion = [1.00, 0.25, 0.35]

    mass_balance_passed = True
    if len(sol_x) == total_x + n_b:
        for i, b in enumerate(batches):
            allocated_kg = sum(sol_x[idx_x(i, j, k)] for j in range(n_m) for k in range(n_k))
            slack_kg = sol_x[idx_s(i)]
            if abs((allocated_kg + slack_kg) - b.quantity_kg) > 0.1:
                mass_balance_passed = False
                break

    capacity_limits_passed = True
    cap_multiplier = max(0.0, 1.0 - (disruptions.capacity_reduction_pct / 100.0))
    for j, m in enumerate(markets):
        eff_cap = m.max_capacity_kg * cap_multiplier
        if len(sol_x) == total_x + n_b:
            market_load = sum(sol_x[idx_x(i, j, k)] for i in range(n_b) for k in range(n_k))
        else:
            market_load = sum(
                a.quantity_kg
                for a in allocations
                if a.market_id == m.market_id and a.status == "OPTIMAL_DISPATCH"
            )
        if market_load > eff_cap + 0.1:
            capacity_limits_passed = False
            break

    shelf_life_limits_passed = True
    for a in allocations:
        if a.status == "OPTIMAL_DISPATCH" and a.rsl_buffer_hours < -0.01:
            shelf_life_limits_passed = False
            break

    demand_caps_passed = True
    all_commodities = set(b.commodity for b in batches)
    for j, m in enumerate(markets):
        for comm in all_commodities:
            base_d = max(0.0, m.demand_kg.get(comm, 0.0) * disruptions.demand_multiplier)
            for k in range(n_k):
                tier_cap = base_d * expansion[k]
                if len(sol_x) == total_x + n_b:
                    tier_load = sum(
                        sol_x[idx_x(i, j, k)]
                        for i, b in enumerate(batches)
                        if b.commodity == comm
                    )
                else:
                    tier_disc = [0, 15, 30][k]
                    tier_load = sum(
                        a.quantity_kg
                        for a in allocations
                        if a.market_id == m.market_id
                        and a.commodity == comm
                        and a.discount_pct == tier_disc
                        and a.status == "OPTIMAL_DISPATCH"
                    )
                if tier_load > tier_cap + 0.1:
                    demand_caps_passed = False
                    break

    return ConstraintAudit(
        mass_balance_passed=mass_balance_passed,
        capacity_limits_passed=capacity_limits_passed,
        shelf_life_limits_passed=shelf_life_limits_passed,
        demand_caps_passed=demand_caps_passed,
    )


def run_monte_carlo(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
    n_runs: int = 5,
) -> List[MonteCarloRun]:
    """
    Simulates stochastic disruptions (transit delays, temperature spikes, demand swings)
    to compare Baseline FIFO vs FreshRoute MILP robustness.
    """
    runs: List[MonteCarloRun] = []
    rng = np.random.default_rng(seed=42)

    for sim_idx in range(1, n_runs + 1):
        sim_delay = max(0.0, float(disruptions.highway_delay_hours + rng.normal(1.2, 0.6)))
        sim_temp = float(disruptions.reefer_temp_spike_c + rng.normal(0.8, 0.4))
        sim_demand = max(0.2, float(disruptions.demand_multiplier * rng.normal(1.0, 0.05)))
        sim_cap_red = min(
            95.0,
            max(0.0, float(disruptions.capacity_reduction_pct + rng.normal(0.0, 3.0))),
        )

        sim_disruptions = DisruptionOverrides(
            highway_delay_hours=sim_delay,
            reefer_temp_spike_c=sim_temp,
            demand_multiplier=sim_demand,
            capacity_reduction_pct=sim_cap_red,
        )

        base_alloc, _ = run_baseline_fifo(batches, markets, sim_disruptions)
        base_kpis = evaluate_cost_ledger(batches, markets, sim_disruptions, base_alloc)

        opt_alloc, _, _ = run_freshroute_milp(batches, markets, sim_disruptions)
        opt_kpis = evaluate_cost_ledger(batches, markets, sim_disruptions, opt_alloc)

        runs.append(
            MonteCarloRun(
                sim_id=sim_idx,
                baseline_net_rev=base_kpis.net_revenue,
                freshroute_net_rev=opt_kpis.net_revenue,
                baseline_spoilage_kg=base_kpis.spoiled_kg,
                freshroute_spoilage_kg=opt_kpis.spoiled_kg,
            )
        )

    return runs


# Alias for backward compatibility
run_monte_carlo_simulation = run_monte_carlo


def solve_scenario(
    batches: List[Batch],
    markets: List[Market],
    disruptions: DisruptionOverrides,
    ingestion_warnings: List[str] = None,
) -> OptimizeResponse:
    """
    Main entry point for scenario execution:
    Executes Baseline FIFO, FreshRoute MILP, audits constraints, computes KPIs,
    runs Monte Carlo simulation, and packages the canonical OptimizeResponse.
    """
    if ingestion_warnings is None:
        ingestion_warnings = []

    start_time = time.perf_counter()

    # 1. Run Baseline FIFO
    baseline_allocations, _ = run_baseline_fifo(batches, markets, disruptions)
    baseline_kpis = evaluate_cost_ledger(batches, markets, disruptions, baseline_allocations)

    # 2. Run FreshRoute MILP
    opt_allocations, sol_x, opt_status = run_freshroute_milp(batches, markets, disruptions)
    opt_kpis = evaluate_cost_ledger(batches, markets, disruptions, opt_allocations)

    # 3. Deltas and Audit
    kpi_deltas = compute_kpi_deltas(baseline_kpis, opt_kpis)
    kpis_bundle = KpiComparisonBundle(
        baseline=baseline_kpis,
        optimized=opt_kpis,
        deltas=kpi_deltas,
    )

    constraint_audit = audit_constraints(
        batches,
        markets,
        disruptions,
        opt_allocations,
        sol_x,
    )

    # 4. Monte Carlo Summary
    monte_carlo_summary = run_monte_carlo(batches, markets, disruptions, n_runs=5)

    solve_time_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return OptimizeResponse(
        status=opt_status,
        solve_time_ms=solve_time_ms,
        batches=batches,
        markets=markets,
        disruptions=disruptions,
        constraint_audit=constraint_audit,
        kpis=kpis_bundle,
        allocations=opt_allocations,
        baseline_allocations=baseline_allocations,
        monte_carlo_summary=monte_carlo_summary,
        ingestion_warnings=ingestion_warnings,
    )


if __name__ == "__main__":
    # Smoke-test block constructing 3 sample batches and 2 markets
    test_batches = [
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

    test_markets = [
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

    test_disruptions = DisruptionOverrides()
    response = solve_scenario(test_batches, test_markets, test_disruptions)

    audit = response.constraint_audit
    assert audit.mass_balance_passed, "Mass balance constraint check failed!"
    assert audit.capacity_limits_passed, "Capacity limits constraint check failed!"
    assert audit.shelf_life_limits_passed, "Shelf life limits constraint check failed!"
    assert audit.demand_caps_passed, "Demand caps constraint check failed!"

    print("==================================================")
    print("FRESHROUTE OS SMOKE TEST COMPLETED SUCCESSFULLY")
    print(f"Solver Status: {response.status}")
    print(f"Solve Time: {response.solve_time_ms:.2f} ms")
    print(
        f"Constraint Audit: mass_balance={audit.mass_balance_passed}, "
        f"capacity={audit.capacity_limits_passed}, "
        f"shelf_life={audit.shelf_life_limits_passed}, "
        f"demand_caps={audit.demand_caps_passed}"
    )
    print(f"Optimized Net Revenue: ₹{response.kpis.optimized.net_revenue:,.2f}")
    print(f"Baseline Net Revenue:  ₹{response.kpis.baseline.net_revenue:,.2f}")
    print(f"Net Revenue Gain:      ₹{response.kpis.deltas.net_revenue_gain:,.2f}")
    print(f"Spoilage Reduction:    {response.kpis.deltas.spoilage_reduction_pct:.2f}%")
    print(f"Demand Fulfillment:    {response.kpis.optimized.demand_fulfillment_pct:.2f}% (Gain: {response.kpis.deltas.demand_fulfillment_gain_pct:+.2f}%)")
    print(f"Optimized Allocations: {len(response.allocations)} rows")
    print(f"Baseline Allocations:  {len(response.baseline_allocations)} rows")
    print(f"Monte Carlo Runs:      {len(response.monte_carlo_summary)} iterations")
    print("==================================================")
