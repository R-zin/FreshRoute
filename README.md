# FreshRoute OS (Problem Statement 03)
### Physics-Informed Dynamic Perishable Produce Cold-Chain & Markdown Optimization Engine

FreshRoute OS is an enterprise-grade mathematical optimization and logistics decision console designed to eliminate post-harvest agricultural food loss across Indian cold chains (MoFPI / NABCONS benchmarked).

---

## ⚡ 3-Step Quickstart for Judges

You can run FreshRoute OS in **under 60 seconds** using either the native local script or Docker Compose:

### Option A: Native Local Launch (Recommended)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/R-zin/FreshRoute.git
   cd FreshRoute
   ```

2. **Run the one-command hackathon launcher:**
   ```bash
   ./run_demo.sh
   ```
   *The script automatically validates Python packages, verifies benchmark datasets, installs npm packages, and starts both backend and frontend.*

3. **Open the live consoles:**
   * 🖥️ **Operator Console (React UI):** [http://localhost:5173](http://localhost:5173)
   * ⚡ **FastAPI Interactive Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
   * 🩺 **Engine Health Probe:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### Option B: Containerized Launch (Docker Compose)

1. **Start all containers:**
   ```bash
   docker compose up --build
   ```
2. **Access the application:**
   * Frontend: [http://localhost:5173](http://localhost:5173)
   * Backend API: [http://localhost:8000/docs](http://localhost:8000/docs)
3. **Stop containers:**
   ```bash
   docker compose down
   ```

---

## 🧪 Automated Testing & Verification

Run the complete test suite (18 unit, integration, and chaos stress tests):

```bash
# Run full pytest test suite
PYTHONPATH=. pytest -v

# Run standalone physics MILP solver self-test
PYTHONPATH=. python backend/core/solver.py

# Run benchmark scenarios generator & validation table
PYTHONPATH=. python datasets/generate_scenarios.py
```

---

## 🧠 Core Architecture & Mathematical Foundation

FreshRoute OS replaces standard First-In-First-Out (FIFO) dispatch heuristics with a physics-informed Mixed-Integer Linear Program (MILP) solved via `scipy.optimize.milp` (HiGHS solver):

### 1. $Q_{10}$ Arrhenius Thermal Decay Model
Calculates effective biological life consumed during transit and mandi handling:
$$\text{Effective Transit RSL Hours} = t_{\text{transit}} \cdot Q_{10}^{\frac{\max(0,\, T_{\text{reefer}} - T_{\text{optimal}})}{10}} + t_{\text{handling}}$$
* **Safety Pruning Constraint:** Batches with remaining shelf life (RSL) insufficient to survive transit + handling are strictly pruned prior to vectorization:
  $$\text{RSL}_{\text{remaining}} \ge \text{Effective Transit RSL Hours} + 2.0\text{h}$$

### 2. Multi-Tier Dynamic Markdown Eligibility
* **Tier 0:** Full nominal price (0% discount, 1.00x base demand).
* **Tier 1:** 15% markdown (+25% demand expansion).
* **Tier 2:** 30% markdown (+35% demand expansion, eligible **only** if $\text{RSL} \le 36.0\text{h}$).

### 3. Shared Cost Ledger & Audit Function
To ensure 100% apples-to-apples evaluation against Naive FIFO:
$$\text{Net Revenue} = \text{Gross Revenue} - \text{Transport \& Handling Costs} - \text{Spoilage Penalty Costs}$$

---

## 📊 Benchmark Datasets (MoFPI / NABCONS Grounded)

Located in `/datasets/`:
1. **Scenario 1 — Normal Harvest (Baseline):** 10 batches, 4 South Indian mandis, on-schedule transit.
2. **Scenario 2 — NH-44 Monsoon Blockade:** +10h highway delay along the North-South corridor, 20% fleet capacity cut.
3. **Scenario 3 — Reefer Cooling Failure:** +8°C thermal spike in reefer containers causing accelerated $Q_{10}$ decay.
4. **Scenario 4 — Corrupt Judge Stress Test:** Dirty data stress test containing negative values, missing coordinates, non-standard column headers, and units in tons/days. Imputed and normalized with 0 crashes.

---

## 🌐 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health check and solver verification |
| `GET` | `/api/v1/default-scenario` | Solves and returns pre-configured MoFPI 8-batch scenario |
| `POST` | `/api/v1/optimize` | Solves arbitrary batches, markets, and disruption overrides |
| `POST` | `/api/v1/upload-dataset` | Multipart upload for judge CSV/JSON files with auto-imputation |
