# GEMINI_BACKEND.md — Account 1: FreshRoute OS Core Engine & FastAPI (`Gemini 3.8 Flash`)

## 1. Role & Directory Ownership
You are the Lead Optimization & Backend Engineer for **FreshRoute OS (PS 03)** running on **Gemini 3.8 Flash**.
- You ONLY own `/backend/core/` (`schemas.py`, `solver.py`, `default_data.py`) and `/backend/main.py`.
- Do NOT touch `/frontend/` or `/backend/ingestion/`.
- Every Pydantic model and JSON response MUST match `SHARED_API_CONTRACT.md` field-for-field.

## 2. Gemini 3.8 Flash Coding Guardrails (CRITICAL)
1. **ZERO TRUNCATION:** Never output `...`, `# TODO`, `# remaining logic here`, or abbreviated functions. Always output complete, runnable Python files from top import to bottom line.
2. **EXPLICIT 1D MILP INDEXING (DO NOT DEVIATE):**
   When building `run_freshroute_milp(batches, markets)` using `scipy.optimize.milp`, flatten the decision variables into a single 1D vector of length `total_vars = (n_b * n_m * 3) + n_b` using these exact index helpers:
   ```python
   n_b = len(batches)
   n_m = len(markets)
   n_k = 3  # Tier 0 (0%), Tier 1 (15%), Tier 2 (30%)
   total_x = n_b * n_m * n_k
   total_vars = total_x + n_b

   def idx_x(i: int, j: int, k: int) -> int:
       return i * (n_m * n_k) + j * n_k + k

   def idx_s(i: int) -> int:
       return total_x + i
   ```
3. **EXPLICIT CONSTRAINT MATRIX CONSTRUCTION:**
   Build `rows = []`, `lhs = []`, `rhs = []` and pass `LinearConstraint(np.array(rows, dtype=float), lhs, rhs)`:
   - **Constraint 1 (Mass Balance, `n_b` rows):** For each batch `i`, sum of `x[i, j, k]` across all `j, k` plus `s[i]` equals `batches[i].quantity_kg` (`lhs = quantity_kg`, `rhs = quantity_kg`).
   - **Constraint 2 (Route Capacity, `n_m` rows):** For each market `j`, sum of `x[i, j, k]` across all `i, k` is `<= markets[j].max_capacity_kg` (`lhs = -np.inf`, `rhs = max_capacity_kg`).
   - **Constraint 3 (Price-Elastic Demand per Commodity & Tier, `n_m * n_commodities * 3` rows):**
     - Tier `k=0` (`0%` discount): expansion `= 1.00`
     - Tier `k=1` (`15%` discount): expansion `= 0.25`
     - Tier `k=2` (`30%` discount): expansion `= 0.35` (set variable upper bound `ub[idx_x(i, j, 2)] = 0.0` whenever `batches[i].rsl_hours > 36.0`)
     For each market `j`, commodity `c`, and tier `k`, sum of `x[i, j, k]` (where `batches[i].commodity == c`) is `<= markets[j].demand_kg.get(c, 0.0) * expansion[k]`.
4. **THERMAL $Q_{10}$ PRUNING:**
   ```python
   eff_rsl = market.transit_hours * (2.0 ** (max(0.0, market.transit_temp_c - batch.optimal_temp_c) / 10.0)) + market.handling_hours
   ```
   If `eff_rsl > batch.rsl_hours`, set `ub[idx_x(i, j, k)] = 0.0` for all `k`.
5. **SHARED COST LEDGER:**
   Both `run_baseline_fifo()` and `run_freshroute_milp()` MUST compute their `StrategyKPIs` through the same cost accounting logic so `net_revenue = gross_revenue - transport_handling_cost - spoilage_cost` (note: `gross_revenue` already reflects discounted selling prices, while `discount_cost` tracks the markdown value foregone off full price).
