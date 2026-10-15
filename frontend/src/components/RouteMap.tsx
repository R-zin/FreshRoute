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
  Truck,
  Thermometer,
  Clock,
  MapPin,
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

      // Semantic status and clean polyline colors
      let routeStatus: 'SAFE' | 'WARNING' | 'BLOCKED' = 'BLOCKED';
      let lineColor = '#f43f5e';
      let isDashed = true;

      if (dispatchedKg > 0 && minRslBufferHours !== null) {
        if (minRslBufferHours >= 10.0 && markdownKg === 0) {
          routeStatus = 'SAFE';
          lineColor = '#10b981'; // Emerald
          isDashed = false;
        } else if (minRslBufferHours >= 0.0) {
          routeStatus = 'WARNING';
          lineColor = '#f59e0b'; // Amber
          isDashed = false;
        } else {
          routeStatus = 'BLOCKED';
          lineColor = '#f43f5e'; // Rose
          isDashed = true;
        }
      } else {
        routeStatus = 'BLOCKED';
        lineColor = '#64748b'; // Muted Slate
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
    <div className="glass-panel rounded-2xl shadow-xl overflow-hidden flex flex-col h-full relative">
      {/* Map Header Bar */}
      <div className="px-5 py-3.5 border-b border-white/[0.06] bg-[#0c0f17]/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-space font-bold text-white tracking-tight truncate">
                Cold-Chain Corridors
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 font-mono">
                Kolar Hub Origin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              Dynamic FEFO routing & Arrhenius decay tracking
            </p>
          </div>
        </div>

        {/* Route Status Summary Badges */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            {safeRoutes} Safe
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {warningRoutes} Tight
          </span>
          {blockedRoutes > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              {blockedRoutes} Blocked
            </span>
          )}
        </div>
      </div>

      {/* Map Container Area */}
      <div className="relative w-full h-[460px] sm:h-[500px] lg:h-[540px] flex-1 bg-[#08090d]">
        <MapContainer
          center={[13.4, 78.2]}
          zoom={6}
          scrollWheelZoom={false}
          className="w-full h-full z-0"
          style={{ background: '#08090d' }}
        >
          {/* Pristine CartoDB Dark Matter Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
            className="dark-map-tiles"
          />

          {/* =========================================================================
              1. ORIGIN PACKINGHOUSE HUB MARKER (Kolar)
             ========================================================================= */}
          {/* Outer glowing pulsing ring */}
          <CircleMarker
            center={originCenter}
            radius={18}
            pathOptions={{
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.15,
              weight: 1.5,
              dashArray: '3, 4',
            }}
          />

          {/* Inner prominent hub marker */}
          <CircleMarker
            center={originCenter}
            radius={9}
            pathOptions={{
              color: '#10b981',
              fillColor: '#0c0f17',
              fillOpacity: 0.95,
              weight: 2.5,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={1}
              permanent={false}
              className="font-mono text-xs"
            >
              <div className="font-bold text-emerald-400">Hub Origin</div>
              <div className="text-[10px] text-slate-300">{ORIGIN_HUB.name}</div>
            </Tooltip>

            <Popup className="custom-dark-popup">
              <div className="p-4 space-y-2.5 min-w-[240px]">
                <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
                  <div className="w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold font-space text-white">
                      Central Packinghouse
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {ORIGIN_HUB.hub_id}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-300 space-y-1 font-mono text-[11px]">
                  <div>Location: Kolar District, Karnataka</div>
                  <div>Target Mandis: {markets.length} APMC Markets</div>
                  <div>Status: Primary Distribution Node</div>
                </div>
              </div>
            </Popup>
          </CircleMarker>

          {/* =========================================================================
              2. CORRIDOR ROUTE POLYLINES (Origin to Mandis)
             ========================================================================= */}
          {marketAggregations.map((route) => {
            const positions: [number, number][] = [
              originCenter,
              [route.lat, route.lng],
            ];

            return (
              <Polyline
                key={`line-${route.marketId}`}
                positions={positions}
                pathOptions={{
                  color: route.lineColor,
                  weight: route.routeStatus === 'SAFE' ? 3.5 : 2.5,
                  opacity: route.routeStatus === 'SAFE' ? 0.9 : 0.8,
                  dashArray: route.isDashed ? '6, 6' : undefined,
                }}
              />
            );
          })}

          {/* =========================================================================
              3. DESTINATION MARKET APMC MARKERS
             ========================================================================= */}
          {marketAggregations.map((m) => {
            const isSafe = m.routeStatus === 'SAFE';
            const isWarning = m.routeStatus === 'WARNING';
            const markerColor = isSafe
              ? '#10b981'
              : isWarning
              ? '#f59e0b'
              : '#f43f5e';

            return (
              <CircleMarker
                key={`marker-${m.marketId}`}
                center={[m.lat, m.lng]}
                radius={8}
                pathOptions={{
                  color: markerColor,
                  fillColor: '#0c0f17',
                  fillOpacity: 0.95,
                  weight: 2.5,
                }}
              >
                {/* Clean Hover Tooltip */}
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={1}
                  className="font-mono"
                >
                  <div className="font-bold text-white">{m.marketName}</div>
                  <div className="text-[10px] text-slate-300">
                    {m.dispatchedKg.toLocaleString('en-IN')} kg dispatched
                    {m.markdownKg > 0 && ` (${m.markdownKg.toLocaleString('en-IN')} kg discounted)`}
                  </div>
                </Tooltip>

                {/* Rich Minimalist Popup Details */}
                <Popup className="custom-dark-popup">
                  <div className="p-4 space-y-3 min-w-[260px]">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                      <div>
                        <h4 className="text-xs font-bold font-space text-white">
                          {m.marketName}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {m.marketId}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          isSafe
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : isWarning
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {m.routeStatus}
                      </span>
                    </div>

                    {/* Telemetry Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
                        <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                          <Clock className="w-3 h-3 text-slate-400" /> Transit
                        </span>
                        <span className="font-bold text-white">
                          {m.effectiveTransitHours.toFixed(1)}h
                        </span>
                        {disruptions.highway_delay_hours > 0 && (
                          <span className="text-[9px] text-amber-400 block">
                            (+{disruptions.highway_delay_hours}h delay)
                          </span>
                        )}
                      </div>

                      <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
                        <span className="text-slate-400 flex items-center gap-1 text-[10px]">
                          <Thermometer className="w-3 h-3 text-amber-400" /> Reefer
                        </span>
                        <span className="font-bold text-white">
                          {m.effectiveTransitTempC.toFixed(1)}°C
                        </span>
                        {disruptions.reefer_temp_spike_c > 0 && (
                          <span className="text-[9px] text-amber-400 block">
                            (+{disruptions.reefer_temp_spike_c}°C spike)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dispatched Volume & Capacity */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400">Corridor Capacity</span>
                        <span className="text-white font-semibold">
                          {m.capacityUtilizationPct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, Math.max(0, m.capacityUtilizationPct))}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-400">
                        <span>{m.dispatchedKg.toLocaleString('en-IN')} kg sent</span>
                        <span>{m.maxCapacityKg.toLocaleString('en-IN')} kg cap</span>
                      </div>
                    </div>

                    {/* Thermal Shelf Life RSL Buffer */}
                    <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Min RSL Buffer</span>
                      <span
                        className={`font-bold ${
                          (m.minRslBufferHours ?? 0) >= 5
                            ? 'text-emerald-400'
                            : (m.minRslBufferHours ?? 0) >= 0
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {m.minRslBufferHours !== null
                          ? `+${m.minRslBufferHours.toFixed(1)}h`
                          : 'No Dispatch'}
                      </span>
                    </div>

                    {/* Produce Commodity Breakdown */}
                    {m.commodities.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-white/[0.06]">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">
                          Allocated Batches
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {m.commodities.map((c) => (
                            <div
                              key={c.commodity}
                              className="flex items-center justify-between text-[10px] font-mono bg-white/[0.02] p-1.5 rounded"
                            >
                              <span className="text-slate-200">{c.commodity}</span>
                              <span className="text-white font-semibold">
                                {c.quantityKg.toLocaleString('en-IN')} kg
                                {c.markdownKg > 0 && (
                                  <span className="text-amber-400 ml-1">
                                    (-{Array.from(c.discounts).join(',')}% off)
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteMap;
