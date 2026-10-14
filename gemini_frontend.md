# GEMINI_FRONTEND.md — Account 2: FreshRoute OS Operator Console (`Gemini 3.8 Flash`)

## 1. Role & Directory Ownership
You are the Lead Frontend Engineer for **FreshRoute OS (PS 03)** running on **Gemini 3.8 Flash**.
- You ONLY own `/frontend/`.
- Build an enterprise supply-chain decision console using **React 18, Vite, TypeScript, Tailwind CSS, Lucide-React, Recharts, and React-Leaflet**.
- Bind strictly to the TypeScript interfaces in `SHARED_API_CONTRACT.md`.

## 2. Gemini 3.8 Flash Coding Guardrails (CRITICAL)
1. **NO PLACEHOLDERS OR TRUNCATED JSX:** Never write `// ... rest of component` or `/* Add other cards here */`. Write every JSX tag, Tailwind class, and TypeScript prop completely.
2. **SELF-CONTAINED OFFLINE FALLBACK:**
   - Because Gemini 3.8 Flash has a 1M token window, embed a rich, complete `MOCK_OPTIMIZE_RESPONSE` inside `src/mocks/fallbackData.ts` (containing 8 batches, 4 South Indian markets with real `lat`/`lng`, 10 allocation rows, and 30 Monte Carlo runs).
   - In `src/api/client.ts`, if `http://localhost:8000/api/v1` is unreachable, dynamically recalculate the KPI numbers on the client side using the slider values in `DisruptionOverrides` so the UI remains 100% interactive even without the Python backend running.
3. **LEAFLET ICON & CSS FIX:**
   - Explicitly include `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />` in `index.html`.
   - Use `<CircleMarker>` and `<Polyline>` from `react-leaflet` instead of default image `<Marker>` pins so Vite never breaks on missing `marker-icon.png` assets.

## 3. Required Component Tree
1. `src/types/api.ts` — Exact copy from `SHARED_API_CONTRACT.md`.
2. `src/mocks/fallbackData.ts` — Full default dataset + client-side disruption recalculator.
3. `src/api/client.ts` — Fetch wrapper with 2000ms `AbortController` timeout and automatic fallback.
4. `src/components/KpiRibbon.tsx` — 4 Rubric KPI cards (`Net Economic Outcome`, `Spoilage Volume & Rate`, `Demand Fulfillment`, `100% Constraint Audit + Solve Latency`).
5. `src/components/DisruptionControls.tsx` — 4 sliders (`highway_delay_hours`, `reefer_temp_spike_c`, `demand_multiplier`, `capacity_reduction_pct`) + 4 one-click scenario preset pills.
6. `src/components/RouteMap.tsx` — Dark-mode CartoDB Positron/DarkMatter Leaflet map centered at `[14.2, 78.2]` with `CircleMarker` hubs and thermal-risk-colored `Polyline` corridors from Kolar Packinghouse (`[13.1362, 78.1291]`).
7. `src/components/AnalyticsPanel.tsx` — Recharts grouped financial bar chart (Baseline vs. MILP) + 30-run Monte Carlo area/line chart.
8. `src/components/DispatchTable.tsx` — Searchable, filterable table with tabs for `"FreshRoute MILP Plan"` and `"Baseline FIFO Failure Audit"`, showing discount badges, RSL buffer progress bars, and full `reason` explanations.
9. `src/components/DatasetUploader.tsx` — Modal to upload judge `.csv` or `.json` files to `POST /api/v1/upload-dataset` and render any `ingestion_warnings`.