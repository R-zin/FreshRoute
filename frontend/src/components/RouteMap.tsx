import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Popup,
  Tooltip,
} from 'react-leaflet';
import { OptimizeResponse, ORIGIN_HUB } from '../types/api';
import {
  MapPin,
  Truck,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Package,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

export interface RouteMapProps {
  response: OptimizeResponse;
}

interface MarketRouteAggregation {
  marketId: string;
  marketName: string;
  lat: number;
  lng: number;
  transitHours: number;
  effectiveTransitHours: number;
  transitTempC: number;
  effectiveTransitTempC: number;
  maxCapacityKg: number;
  dispatchedKg: number;
  markdownKg: number;
  minRslBufferHours: number | null;
  capacityUtilizationPct: number;
  commodities: {
    commodity: string;
    quantityKg: number;
    markdownKg: number;
    discounts: number[];
  }[];
  routeStatus: 'SAFE' | 'WARNING' | 'BLOCKED';
  lineColor: string;
  isDashed: boolean;
}

export const RouteMap: React.FC<RouteMapProps> = ({ response }) => {
  const { markets, allocations, disruptions } = response;

  // Aggregate OPTIMAL_DISPATCH data per destination market
  const marketAggregations: MarketRouteAggregation[] = useMemo(() => {
    return markets.map((m) => {
      // Filter optimal allocations targeting this market
      const marketAllocs = allocations.filter(
        (a) => a.market_id === m.market_id && a.status === 'OPTIMAL_DISPATCH'
      );

      const dispatchedKg = marketAllocs.reduce((sum, a) => sum + a.quantity_kg, 0);
      const markdownKg = marketAllocs
        .filter((a) => a.discount_pct > 0)
        .reduce((sum, a) => sum + a.quantity_kg, 0);

      // Min RSL buffer among dispatched batches to this market
      const minRslBufferHours =
        marketAllocs.length > 0
          ? Math.min(...marketAllocs.map((a) => a.rsl_buffer_hours))
          : null;

      const effectiveTransitHours = m.transit_hours + (disruptions.highway_delay_hours || 0);
      const effectiveTransitTempC = m.transit_temp_c + (disruptions.reefer_temp_spike_c || 0);
      const capacityUtilizationPct =
        m.max_capacity_kg > 0 ? (dispatchedKg / m.max_capacity_kg) * 100 : 0;

      // Group commodities
      const commodityMap = new Map<
        string,
        { quantityKg: number; markdownKg: number; discounts: Set<number> }
      >();

      marketAllocs.forEach((a) => {
        const cur = commodityMap.get(a.commodity) || {
          quantityKg: 0,
          markdownKg: 0,
          discounts: new Set<number>(),
        };
        cur.quantityKg += a.quantity_kg;
        if (a.discount_pct > 0) {
          cur.markdownKg += a.quantity_kg;
          cur.discounts.add(a.discount_pct);
        }
        commodityMap.set(a.commodity, cur);
      });

      const commodities = Array.from(commodityMap.entries()).map(([commodity, data]) => ({
        commodity,
        quantityKg: data.quantityKg,
        markdownKg: data.markdownKg,
        discounts: Array.from(data.discounts),
      }));

      // High-contrast monochrome route status
      // Safe: Pure white (#FFFFFF)
      // Tight / Markdown: Silver Slate (#94A3B8)
      // Blocked: Dark muted dashed (#475569)
      let routeStatus: 'SAFE' | 'WARNING' | 'BLOCKED' = 'BLOCKED';
      let lineColor = '#475569';
      let isDashed = true;

      if (dispatchedKg > 0 && minRslBufferHours !== null) {
        if (minRslBufferHours >= 12.0 && markdownKg === 0) {
          routeStatus = 'SAFE';
          lineColor = '#ffffff';
          isDashed = false;
        } else if (minRslBufferHours >= 0.0) {
          routeStatus = 'WARNING';
          lineColor = '#94a3b8';
          isDashed = false;
        } else {
          routeStatus = 'BLOCKED';
          lineColor = '#475569';
          isDashed = true;
        }
      } else {
        routeStatus = 'BLOCKED';
        lineColor = '#475569';
        isDashed = true;
      }

      return {
        marketId: m.market_id,
        marketName: m.name,
        lat: m.lat,
        lng: m.lng,
        transitHours: m.transit_hours,
        effectiveTransitHours,
        transitTempC: m.transit_temp_c,
        effectiveTransitTempC,
        maxCapacityKg: m.max_capacity_kg,
        dispatchedKg,
        markdownKg,
        minRslBufferHours,
        capacityUtilizationPct,
        commodities,
        routeStatus,
        lineColor,
        isDashed,
      };
    });
  }, [markets, allocations, disruptions]);

  // Origin Hub coordinates
  const originCenter: [number, number] = [ORIGIN_HUB.lat, ORIGIN_HUB.lng];

  // Quick summary counts
  const safeRoutes = marketAggregations.filter((r) => r.routeStatus === 'SAFE').length;
  const warningRoutes = marketAggregations.filter((r) => r.routeStatus === 'WARNING').length;
  const blockedRoutes = marketAggregations.filter((r) => r.routeStatus === 'BLOCKED').length;

  return (
    <div className="tactile-debossed rounded-2xl shadow-xl overflow-hidden flex flex-col h-full relative">
      {/* Map Header Bar */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-[#111418] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-space font-bold text-white tracking-tight truncate">
                South India Logistics Corridors
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full tactile-debossed text-white font-mono font-medium shrink-0">
                Kolar Hub Origin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              Arrhenius Q₁₀=2.0 thermal safety margins & telemetry
            </p>
          </div>
        </div>

        {/* Route Status Summary Badges */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-extruded text-white">
            <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#ffffff]" />
            {safeRoutes} Safe
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-pressed text-slate-300 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {warningRoutes} Tight
          </span>
          {blockedRoutes > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md tactile-debossed text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              {blockedRoutes} Blocked
            </span>
          )}
        </div>
      </div>

      {/* Map Container Area */}
      <div className="relative w-full h-[460px] sm:h-[500px] lg:h-[540px] flex-1 bg-[#0b0e12]">
        <MapContainer
          center={[13.4, 78.2]}
          zoom={6}
          scrollWheelZoom={false}
          className="w-full h-full z-0 dark-map-container"
          style={{ background: '#0b0e12' }}
        >
          {/* Watermark-Free Dark Tiles via OpenStreetMap with CSS Invert Filter */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="dark-map-tiles"
            maxZoom={19}
          />

          {/* =========================================================================
              1. ORIGIN PACKINGHOUSE HUB MARKER (Kolar)
             ========================================================================= */}
          {/* Outer glowing pulsing ring */}
          <CircleMarker
            center={originCenter}
            radius={18}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#ffffff',
              fillOpacity: 0.12,
              weight: 1.5,
              dashArray: '3, 4',
            }}
          />

          {/* Inner prominent hub marker */}
          <CircleMarker
            center={originCenter}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#111418',
              fillOpacity: 0.95,
              weight: 3,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={0.95}
              permanent={false}
            >
              <div className="font-sans text-xs">
                <span className="font-bold text-white block">ORIGIN HUB</span>
                <span>{ORIGIN_HUB.name}</span>
              </div>
            </Tooltip>

            <Popup className="custom-dark-popup">
              <div className="p-4 w-72 text-slate-100 font-sans space-y-3">
                <div className="flex items-start gap-2.5 border-b border-white/[0.08] pb-2.5">
                  <div className="w-8 h-8 rounded-lg tactile-extruded flex items-center justify-center text-white shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                      Central Packinghouse Node
                    </span>
                    <h4 className="text-xs font-bold text-white leading-tight font-space">
                      {ORIGIN_HUB.name}
                    </h4>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Node Identifier:</span>
                    <span className="text-white font-semibold">{ORIGIN_HUB.hub_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coordinates:</span>
                    <span className="text-slate-300">{ORIGIN_HUB.lat.toFixed(4)}° N, {ORIGIN_HUB.lng.toFixed(4)}° E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Produce Stock:</span>
                    <span className="text-white font-semibold">
                      {response.batches.reduce((s, b) => s + b.quantity_kg, 0).toLocaleString('en-IN')} kg
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Corridors:</span>
                    <span className="text-white font-semibold">{marketAggregations.length} APMC Mandis</span>
                  </div>
                </div>

                <div className="tactile-debossed p-2 rounded-lg text-[11px] text-slate-400 leading-snug">
                  Primary aggregation facility servicing Kolar, Malur, and Chikkaballapur farm cooperatives under MoFPI cold-chain protocols.
                </div>
              </div>
            </Popup>
          </CircleMarker>

          {/* =========================================================================
              2. ROUTE POLYLINES & DESTINATION MARKERS
             ========================================================================= */}
          {marketAggregations.map((route) => {
            const destCenter: [number, number] = [route.lat, route.lng];
            const polylinePositions: [number, number][] = [originCenter, destCenter];

            return (
              <React.Fragment key={route.marketId}>
                {/* Outbound Polyline Corridor */}
                <Polyline
                  positions={polylinePositions}
                  pathOptions={{
                    color: route.lineColor,
                    weight: route.dispatchedKg > 0 ? 3.5 : 1.5,
                    opacity: route.dispatchedKg > 0 ? 0.9 : 0.4,
                    dashArray: route.isDashed ? '6, 6' : undefined,
                  }}
                >
                  <Tooltip
                    direction="center"
                    offset={[0, 0]}
                    opacity={0.9}
                    sticky
                  >
                    <div className="font-sans text-xs space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-1.5 font-space">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: route.lineColor }}
                        />
                        <span>{ORIGIN_HUB.hub_id} → {route.marketName}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-mono">
                        {route.dispatchedKg > 0
                          ? `${route.dispatchedKg.toLocaleString('en-IN')} kg • Min Buffer: ${route.minRslBufferHours?.toFixed(1)}h`
                          : 'No Feasible Shipment (Thermal/Capacity Limit)'}
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>

                {/* Destination Market Outer Halo */}
                <CircleMarker
                  center={destCenter}
                  radius={route.dispatchedKg > 0 ? 14 : 9}
                  pathOptions={{
                    color: route.lineColor,
                    fillColor: route.lineColor,
                    fillOpacity: 0.12,
                    weight: 1.5,
                  }}
                />

                {/* Destination Market Inner Marker */}
                <CircleMarker
                  center={destCenter}
                  radius={route.dispatchedKg > 0 ? 8 : 5}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: route.lineColor,
                    fillOpacity: 0.95,
                    weight: 2,
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={0.95}
                    permanent={false}
                  >
                    <div className="font-sans text-xs">
                      <span className="font-bold text-white block">{route.marketName}</span>
                      <span className="text-[10px] text-slate-300 font-mono">
                        {route.dispatchedKg.toLocaleString('en-IN')} kg ({route.capacityUtilizationPct.toFixed(0)}% cap)
                      </span>
                    </div>
                  </Tooltip>

                  {/* Clean Rich Popup */}
                  <Popup className="custom-dark-popup">
                    <div className="p-4 w-80 text-slate-100 font-sans space-y-3.5">
                      {/* Popup Header */}
                      <div className="flex items-start justify-between border-b border-white/[0.08] pb-3 gap-2">
                        <div>
                          <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400 block font-mono">
                            APMC Wholesale • {route.marketId}
                          </span>
                          <h4 className="text-sm font-bold text-white leading-tight mt-0.5 font-space">
                            {route.marketName}
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase shrink-0 ${
                            route.routeStatus === 'SAFE'
                              ? 'tactile-extruded text-white'
                              : route.routeStatus === 'WARNING'
                              ? 'tactile-pressed text-slate-300'
                              : 'tactile-debossed text-slate-500'
                          }`}
                        >
                          {route.routeStatus === 'SAFE'
                            ? 'Optimal Buffer'
                            : route.routeStatus === 'WARNING'
                            ? 'Margin Rescue'
                            : 'Infeasible'}
                        </span>
                      </div>

                      {/* Transit & Reefer Conditions Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="tactile-debossed p-2 rounded-lg">
                          <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                            <Clock className="w-3.5 h-3.5 text-white" />
                            <span className="text-[10px] font-mono uppercase tracking-wider">Transit Time</span>
                          </div>
                          <div className="font-mono text-sm font-bold text-white">
                            {route.effectiveTransitHours.toFixed(1)} hrs
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Base: {route.transitHours}h {disruptions.highway_delay_hours > 0 && `(+${disruptions.highway_delay_hours}h)`}
                          </div>
                        </div>

                        <div className="tactile-debossed p-2 rounded-lg">
                          <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                            <Thermometer className="w-3.5 h-3.5 text-white" />
                            <span className="text-[10px] font-mono uppercase tracking-wider">Reefer Temp</span>
                          </div>
                          <div className="font-mono text-sm font-bold text-white">
                            {route.effectiveTransitTempC.toFixed(1)}°C
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Base: {route.transitTempC}°C {disruptions.reefer_temp_spike_c > 0 && `(+${disruptions.reefer_temp_spike_c}°C)`}
                          </div>
                        </div>
                      </div>

                      {/* Capacity Utilization Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            Capacity:
                          </span>
                          <span className="font-bold text-white">
                            {route.dispatchedKg.toLocaleString('en-IN')} / {route.maxCapacityKg.toLocaleString('en-IN')} kg
                            <span className="text-slate-400 font-normal ml-1">
                              ({route.capacityUtilizationPct.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full tactile-slider-track rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-white h-full rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                            style={{
                              width: `${Math.min(100, Math.max(0, route.capacityUtilizationPct))}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Thermal Buffer Margin Callout */}
                      <div className="tactile-debossed p-2.5 rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {route.routeStatus === 'SAFE' ? (
                            <ShieldCheck className="w-4 h-4 text-white" />
                          ) : route.routeStatus === 'WARNING' ? (
                            <AlertTriangle className="w-4 h-4 text-slate-300" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="text-slate-300 text-[11px] font-mono">
                            {route.minRslBufferHours !== null
                              ? `Min Thermal Buffer: ${route.minRslBufferHours.toFixed(1)}h`
                              : 'No viable thermal corridor'}
                          </span>
                        </div>
                        {route.markdownKg > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-white tactile-extruded px-2 py-0.5 rounded">
                            <Sparkles className="w-3 h-3 text-white" />
                            {route.markdownKg.toLocaleString('en-IN')} kg disc.
                          </span>
                        )}
                      </div>

                      {/* Commodity Breakdown */}
                      <div className="space-y-1.5 pt-1 border-t border-white/[0.08]">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between font-mono">
                          <span>Delivered Produce Breakdown</span>
                          <Package className="w-3.5 h-3.5 text-slate-500" />
                        </div>

                        {route.commodities.length > 0 ? (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                            {route.commodities.map((c) => (
                              <div
                                key={c.commodity}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded tactile-debossed"
                              >
                                <span className="text-white font-medium">{c.commodity}</span>
                                <div className="flex items-center gap-2">
                                  {c.discounts.length > 0 && (
                                    <span className="text-[10px] text-white font-mono tactile-extruded px-1.5 py-0.2 rounded">
                                      {c.discounts.map((d) => `-${d}%`).join(', ')}
                                    </span>
                                  )}
                                  <span className="font-mono text-white font-semibold">
                                    {c.quantityKg.toLocaleString('en-IN')} kg
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500 italic py-1 text-center tactile-debossed rounded">
                            No allocations to this market under current disruption constraints.
                          </div>
                        )}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Floating Interactive Map Legend */}
        <div className="absolute bottom-4 right-4 z-10 tactile-debossed bg-[#111418]/95 backdrop-blur-md rounded-xl p-3 shadow-2xl text-xs max-w-[240px] space-y-2 pointer-events-auto border border-white/[0.08]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between pb-1 border-b border-white/[0.06] font-mono">
            <span>Corridor Legend</span>
            <span className="text-slate-500 text-[9px]">Q₁₀ Arrhenius</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-5 h-1 rounded-full bg-white shadow-[0_0_6px_#ffffff] shrink-0" />
              <span className="text-slate-300">
                Safe Buffer (<strong className="text-white font-mono">≥ 12h</strong>)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-5 h-1 rounded-full bg-slate-400 shrink-0" />
              <span className="text-slate-300">
                Tight (<strong className="text-slate-200 font-mono">0–12h</strong> / Markdown)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-5 h-1 border-b-2 border-dashed border-slate-600 shrink-0" />
              <span className="text-slate-400">
                Blocked (Decay / Deficit)
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
              <span className="w-2.5 h-2.5 rounded-full bg-white ring-2 ring-slate-700 shrink-0" />
              <span className="text-slate-300 font-medium">
                Origin Hub (Kolar)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteMap;
