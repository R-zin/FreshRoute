import React, { useState, useMemo } from 'react';
import { OptimizeResponse } from '../types/api';
import {
  Table,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Sparkles,
  ShieldCheck,
  Percent,
  HelpCircle,
  Tag,
  Store,
  Package,
} from 'lucide-react';

export interface DispatchTableProps {
  response: OptimizeResponse;
}

type TabMode = 'optimized' | 'baseline';
type SortField =
  | 'batch_id'
  | 'commodity'
  | 'market_name'
  | 'quantity_kg'
  | 'discount_pct'
  | 'rsl_buffer_hours'
  | 'net_contribution';
type SortDirection = 'asc' | 'desc';

export const DispatchTable: React.FC<DispatchTableProps> = ({ response }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('optimized');
  const [selectedCommodity, setSelectedCommodity] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('net_contribution');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Baseline spoiled count for the tab badge
  const baselineSpoiledCount = useMemo(() => {
    return response.baseline_allocations.filter(
      (row) => row.status === 'SPOILED_ON_ARRIVAL' || row.rsl_buffer_hours < 0
    ).length;
  }, [response.baseline_allocations]);

  // Unique commodities from both allocations and baseline
  const availableCommodities = useMemo(() => {
    const set = new Set<string>();
    ['Tomato', 'Guava', 'Banana', 'Alphonso Mango'].forEach((c) => set.add(c));
    response.allocations.forEach((r) => set.add(r.commodity));
    response.baseline_allocations.forEach((r) => set.add(r.commodity));
    return ['All', ...Array.from(set)];
  }, [response.allocations, response.baseline_allocations]);

  // Current raw data depending on active tab
  const rawRows = useMemo(() => {
    return activeTab === 'optimized'
      ? response.allocations
      : response.baseline_allocations;
  }, [activeTab, response.allocations, response.baseline_allocations]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rawRows.filter((row) => {
      // Commodity filter
      if (
        selectedCommodity !== 'All' &&
        row.commodity.toLowerCase() !== selectedCommodity.toLowerCase()
      ) {
        return false;
      }

      // Tier filter
      if (selectedTier !== 'All') {
        if (selectedTier === '0% Full Price' && row.discount_pct !== 0) {
          return false;
        }
        if (selectedTier === '15% Markdown' && row.discount_pct !== 15) {
          return false;
        }
        if (selectedTier === '30% Clearance' && row.discount_pct !== 30) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesBatch = row.batch_id.toLowerCase().includes(q);
        const matchesMarket = row.market_name.toLowerCase().includes(q);
        const matchesCommodity = row.commodity.toLowerCase().includes(q);
        const matchesReason = row.reason.toLowerCase().includes(q);
        const matchesStatus = row.status.toLowerCase().includes(q);
        if (
          !matchesBatch &&
          !matchesMarket &&
          !matchesCommodity &&
          !matchesReason &&
          !matchesStatus
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rawRows, selectedCommodity, selectedTier, searchQuery]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'batch_id':
          comparison = a.batch_id.localeCompare(b.batch_id);
          break;
        case 'commodity':
          comparison = a.commodity.localeCompare(b.commodity);
          break;
        case 'market_name':
          comparison = a.market_name.localeCompare(b.market_name);
          break;
        case 'quantity_kg':
          comparison = a.quantity_kg - b.quantity_kg;
          break;
        case 'discount_pct':
          comparison = a.discount_pct - b.discount_pct;
          break;
        case 'rsl_buffer_hours':
          comparison = a.rsl_buffer_hours - b.rsl_buffer_hours;
          break;
        case 'net_contribution':
          comparison = a.net_contribution - b.net_contribution;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredRows, sortField, sortDirection]);

  // Aggregate stats for filtered view
  const aggregateStats = useMemo(() => {
    const totalKg = filteredRows.reduce((sum, r) => sum + r.quantity_kg, 0);
    const totalNet = filteredRows.reduce(
      (sum, r) => sum + r.net_contribution,
      0
    );
    const spoiledCount = filteredRows.filter(
      (r) => r.status === 'SPOILED_ON_ARRIVAL' || r.rsl_buffer_hours < 0
    ).length;
    const spoiledKg = filteredRows
      .filter((r) => r.status === 'SPOILED_ON_ARRIVAL' || r.rsl_buffer_hours < 0)
      .reduce((sum, r) => sum + r.quantity_kg, 0);

    return { totalKg, totalNet, spoiledCount, spoiledKg };
  }, [filteredRows]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 opacity-40 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-white ml-1 inline" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-white ml-1 inline" />
    );
  };

  return (
    <div className="tactile-debossed rounded-2xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
      {/* Top Segmented Tab Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-white" />
            <h2 className="text-lg font-space font-bold text-white tracking-tight">
              Cold-Chain Dispatch Plan & Thermal Audit
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Compare algorithmic MILP-FEFO routing against standard naive FIFO dispatch across all APMC mandis.
          </p>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="tactile-slider-track p-1 rounded-xl flex items-center self-start lg:self-auto">
          <button
            onClick={() => setActiveTab('optimized')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all duration-200 ${
              activeTab === 'optimized'
                ? 'bg-white text-black font-bold shadow-[0_0_12px_rgba(255,255,255,0.25)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>perishOpt MILP Optimal Dispatch Plan</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] ${
                activeTab === 'optimized'
                  ? 'bg-black text-white'
                  : 'tactile-debossed text-slate-400'
              }`}
            >
              {response.allocations.length} Routes
            </span>
          </button>

          <button
            onClick={() => setActiveTab('baseline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold font-mono transition-all duration-200 ${
              activeTab === 'baseline'
                ? 'tactile-pressed bg-[#181d22] text-white border border-white/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Baseline (Naive FIFO) Failure Audit</span>
            {baselineSpoiledCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === 'baseline'
                    ? 'bg-white text-black'
                    : 'tactile-debossed text-white'
                }`}
              >
                {baselineSpoiledCount} Spoiled
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Control Filters & Search Bar */}
      <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Commodity Filter */}
          <div className="flex items-center gap-1.5 tactile-slider-track rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Commodity:</span>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              {availableCommodities.map((c) => (
                <option key={c} value={c} className="bg-[#111418] text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Tier Filter */}
          <div className="flex items-center gap-1.5 tactile-slider-track rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <Percent className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Discount Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="All" className="bg-[#111418] text-white">
                All Tiers
              </option>
              <option
                value="0% Full Price"
                className="bg-[#111418] text-white"
              >
                0% Full Price
              </option>
              <option
                value="15% Markdown"
                className="bg-[#111418] text-white"
              >
                15% Markdown
              </option>
              <option
                value="30% Clearance"
                className="bg-[#111418] text-white"
              >
                30% Clearance
              </option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search batch, mandi, commodity, or rationale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full tactile-slider-track rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Stats Bar */}
      <div className="py-3 px-4 tactile-extruded rounded-xl my-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Matching Routes:</span>
            <span className="font-bold text-white">
              {filteredRows.length} / {rawRows.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Total Volume:</span>
            <span className="font-bold text-white">
              {aggregateStats.totalKg.toLocaleString('en-IN')} kg
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Net Financial Return:</span>
            <span className="font-bold text-white">
              {aggregateStats.totalNet >= 0 ? '+' : ''}₹
              {aggregateStats.totalNet.toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {activeTab === 'baseline' ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md tactile-pressed text-slate-200">
            <AlertTriangle className="w-3.5 h-3.5 text-white" />
            <span>
              Baseline FIFO Failures: <strong className="text-white">{aggregateStats.spoiledCount}</strong> routes ({aggregateStats.spoiledKg.toLocaleString('en-IN')} kg spoiled)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md tactile-debossed text-white">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
            <span>
              perishOpt Guarantee: <strong>0 kg Spoilage on Arrival</strong> (FEFO Pre-Pruned)
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.04] shadow-sm bg-[#0e1115]">
        <table className="w-full text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-[#0b0e12] border-b border-white/[0.06] text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
              <th
                onClick={() => handleSort('batch_id')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
              >
                Batch & Commodity {renderSortIndicator('batch_id')}
              </th>
              <th
                onClick={() => handleSort('market_name')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
              >
                Destination Market {renderSortIndicator('market_name')}
              </th>
              <th
                onClick={() => handleSort('quantity_kg')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none text-right"
              >
                Quantity (kg) {renderSortIndicator('quantity_kg')}
              </th>
              <th
                onClick={() => handleSort('discount_pct')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none text-center"
              >
                Pricing / Markdown Tier {renderSortIndicator('discount_pct')}
              </th>
              <th
                onClick={() => handleSort('rsl_buffer_hours')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
              >
                Thermal RSL Buffer {renderSortIndicator('rsl_buffer_hours')}
              </th>
              <th
                onClick={() => handleSort('net_contribution')}
                className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none text-right"
              >
                Net Contribution (₹) {renderSortIndicator('net_contribution')}
              </th>
              <th className="py-3 px-4 min-w-[320px]">
                Explainable Decision Rationale (AI/MILP Audit)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-xs font-sans">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300 font-space">
                    No dispatch allocations match the selected filters.
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Try clearing the search query or selecting "All" commodities.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedCommodity('All');
                      setSelectedTier('All');
                      setSearchQuery('');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg tactile-extruded text-xs text-white font-medium transition-colors"
                  >
                    Reset All Filters
                  </button>
                </td>
              </tr>
            ) : (
              sortedRows.map((row, idx) => {
                const isSpoiled =
                  row.status === 'SPOILED_ON_ARRIVAL' ||
                  row.rsl_buffer_hours < 0;

                return (
                  <tr
                    key={`${row.batch_id}-${row.market_id}-${row.discount_pct}-${idx}`}
                    className={`transition-colors duration-150 ${
                      isSpoiled
                        ? 'bg-white/[0.02] hover:bg-white/[0.05]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Batch & Commodity */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white tactile-extruded px-2 py-0.5 rounded">
                          {row.batch_id}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tactile-debossed text-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          {row.commodity}
                        </span>
                      </div>
                    </td>

                    {/* Destination Market */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <div>
                          <div className="font-medium text-white">
                            {row.market_name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            ID: {row.market_id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Quantity (kg) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-mono font-bold text-white text-sm">
                        {row.quantity_kg.toLocaleString('en-IN')}
                      </span>
                      <span className="text-slate-500 ml-1 text-[11px] font-mono">kg</span>
                    </td>

                    {/* Pricing / Markdown Tier */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {row.discount_pct === 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md tactile-extruded text-white font-mono font-semibold text-[11px]">
                          0% Full Price
                        </span>
                      )}
                      {row.discount_pct === 15 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md tactile-pressed text-white border border-white/20 font-mono font-semibold text-[11px]">
                          <Tag className="w-3 h-3 text-white" />
                          15% Markdown
                        </span>
                      )}
                      {row.discount_pct === 30 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-black font-mono font-bold text-[11px] shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                          <Tag className="w-3 h-3 text-black" />
                          30% Clearance
                        </span>
                      )}
                      {row.discount_pct !== 0 &&
                        row.discount_pct !== 15 &&
                        row.discount_pct !== 30 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md tactile-extruded text-white font-mono font-semibold text-[11px]">
                            {row.discount_pct}% Discount
                          </span>
                        )}
                    </td>

                    {/* Thermal RSL Buffer */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {row.effective_transit_rsl_hours.toFixed(1)}h consumed
                          </span>
                        </div>

                        {row.rsl_buffer_hours >= 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tactile-extruded text-white">
                            +{row.rsl_buffer_hours.toFixed(1)}h buffer
                          </span>
                        ) : row.rsl_buffer_hours >= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tactile-pressed text-slate-300">
                            +{row.rsl_buffer_hours.toFixed(1)}h tight
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white text-black animate-pulse">
                            <XCircle className="w-3 h-3 text-black" />
                            {row.rsl_buffer_hours.toFixed(1)}h SPOILED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Net Contribution (₹) */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-mono font-extrabold text-sm text-white">
                        {row.net_contribution >= 0 ? '+' : '-'}₹
                        {Math.abs(row.net_contribution).toLocaleString('en-IN', {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {(row.net_contribution / row.quantity_kg).toFixed(1)} ₹/kg
                      </div>
                    </td>

                    {/* Explainable Decision Rationale (AI/MILP Audit) */}
                    <td className="py-3 px-4">
                      <div className="p-2.5 rounded-lg tactile-debossed text-[11px] leading-relaxed text-slate-300 border border-white/[0.02]">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                              row.status === 'OPTIMAL_DISPATCH'
                                ? 'bg-white text-black'
                                : row.status === 'SPOILED_ON_ARRIVAL'
                                ? 'tactile-pressed text-white border border-white/20'
                                : 'tactile-extruded text-slate-400'
                            }`}
                          >
                            {row.status}
                          </span>
                        </div>
                        <p className="text-slate-300 font-normal">
                          {row.reason}
                        </p>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary Note */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {activeTab === 'optimized'
              ? 'MILP allocates batches based on biological decay rate, cold-chain transport costs, and demand expansion elasticity.'
              : 'Naive FIFO prioritizes batch age without evaluating Arrhenius transit temperature rise, leading to catastrophic destination spoilage.'}
          </span>
        </div>
        <div className="text-slate-500 font-mono text-[11px] shrink-0">
          Showing {sortedRows.length} of {rawRows.length} dispatch rows
        </div>
      </div>
    </div>
  );
};

export default DispatchTable;
