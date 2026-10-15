import React, { useState, useMemo } from 'react';
import { OptimizeResponse } from '../types/api';
import {
  Table,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Store,
  Tag,
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

const PAGE_SIZE = 10;

export const DispatchTable: React.FC<DispatchTableProps> = ({ response }) => {
  const [activeTab, setActiveTab] = useState<TabMode>('optimized');
  const [selectedCommodity, setSelectedCommodity] = useState<string>('All');
  const [selectedTier, setSelectedTier] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('net_contribution');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [showAllRows, setShowAllRows] = useState<boolean>(false);

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const displayedRows = useMemo(() => {
    if (showAllRows) return sortedRows;
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, currentPage, showAllRows]);

  // Reset page on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedCommodity, selectedTier, searchQuery, activeTab]);

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
      return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-400 ml-1 inline" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-400 ml-1 inline" />
    );
  };

  const toggleRowExpand = (rowKey: string) => {
    setExpandedRowKey((prev) => (prev === rowKey ? null : rowKey));
  };

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Top Segmented Tab Toggle & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Table className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-space font-bold text-white tracking-tight">
                Dispatch Matrix & Thermal Audit
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Algorithmic MILP allocations vs. naive FIFO baseline
              </p>
            </div>
          </div>
        </div>

        {/* Tab Toggle Segment */}
        <div className="bg-[#0b0e14] p-1 rounded-xl flex items-center border border-white/[0.06] self-start lg:self-auto font-mono text-xs">
          <button
            onClick={() => setActiveTab('optimized')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
              activeTab === 'optimized'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimal Dispatch</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/[0.06] text-slate-300">
              {response.allocations.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('baseline')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all duration-150 ${
              activeTab === 'baseline'
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Baseline FIFO Audit</span>
            {baselineSpoiledCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300">
                {baselineSpoiledCount} Spoiled
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Control Filters & Search Bar */}
      <div className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Commodity Filter */}
          <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <Filter className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Commodity:</span>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
            >
              {availableCommodities.map((c) => (
                <option key={c} value={c} className="bg-[#0f1219] text-white">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Tier Filter */}
          <div className="flex items-center gap-1.5 bg-[#0b0e14] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs font-mono">
            <Tag className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400 text-[11px]">Tier:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="All" className="bg-[#0f1219] text-white">
                All Tiers
              </option>
              <option value="0% Full Price" className="bg-[#0f1219] text-white">
                0% Full Price
              </option>
              <option value="15% Markdown" className="bg-[#0f1219] text-white">
                15% Markdown
              </option>
              <option value="30% Clearance" className="bg-[#0f1219] text-white">
                30% Clearance
              </option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px] sm:min-w-[260px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search batch, mandi, commodity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0b0e14] border border-white/[0.06] rounded-lg pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40"
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

      {/* Aggregate Stats Summary Ribbon */}
      <div className="py-2.5 px-3.5 bg-white/[0.02] border border-white/[0.05] rounded-xl my-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Showing:</span>
            <span className="font-bold text-white">
              {filteredRows.length} of {rawRows.length} routes
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Volume:</span>
            <span className="font-bold text-white">
              {aggregateStats.totalKg.toLocaleString('en-IN')} kg
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span>Net Return:</span>
            <span className="font-bold text-emerald-400">
              {aggregateStats.totalNet >= 0 ? '+' : ''}₹
              {aggregateStats.totalNet.toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        {activeTab === 'baseline' ? (
          <div className="flex items-center gap-1.5 text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {aggregateStats.spoiledCount} Spoilage Failures ({aggregateStats.spoiledKg.toLocaleString('en-IN')} kg)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>0 kg Spoilage on Arrival (Pre-Pruned)</span>
          </div>
        )}
      </div>

      {/* Scannable Data Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#0c0f17]">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-[#08090d] border-b border-white/[0.06] text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
              <th
                onClick={() => handleSort('batch_id')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none"
              >
                Batch / Commodity {renderSortIndicator('batch_id')}
              </th>
              <th
                onClick={() => handleSort('market_name')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none"
              >
                Destination {renderSortIndicator('market_name')}
              </th>
              <th
                onClick={() => handleSort('quantity_kg')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none text-right"
              >
                Quantity {renderSortIndicator('quantity_kg')}
              </th>
              <th
                onClick={() => handleSort('discount_pct')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none text-center"
              >
                Pricing Tier {renderSortIndicator('discount_pct')}
              </th>
              <th
                onClick={() => handleSort('rsl_buffer_hours')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none"
              >
                Thermal Buffer {renderSortIndicator('rsl_buffer_hours')}
              </th>
              <th
                onClick={() => handleSort('net_contribution')}
                className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors select-none text-right"
              >
                Net Return {renderSortIndicator('net_contribution')}
              </th>
              <th className="py-3 px-3.5 text-right w-24">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04] text-xs font-sans">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-300 font-space">
                    No dispatch allocations match the filters.
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Try clearing the search query or selecting "All" commodities.
                  </p>
                </td>
              </tr>
            ) : (
              displayedRows.map((row, idx) => {
                const rowKey = `${row.batch_id}-${row.market_id}-${row.discount_pct}-${idx}`;
                const isExpanded = expandedRowKey === rowKey;
                const isSpoiled =
                  row.status === 'SPOILED_ON_ARRIVAL' ||
                  row.rsl_buffer_hours < 0;

                return (
                  <React.Fragment key={rowKey}>
                    <tr
                      onClick={() => toggleRowExpand(rowKey)}
                      className={`cursor-pointer transition-colors duration-100 ${
                        isSpoiled
                          ? 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06]'
                          : isExpanded
                          ? 'bg-white/[0.04]'
                          : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Batch & Commodity */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded text-[11px]">
                            {row.batch_id}
                          </span>
                          <span className="text-slate-300 font-medium">
                            {row.commodity}
                          </span>
                        </div>
                      </td>

                      {/* Destination Market */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-medium text-white truncate max-w-[160px]">
                            {row.market_name}
                          </span>
                        </div>
                      </td>

                      {/* Quantity (kg) */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-white">
                          {row.quantity_kg.toLocaleString('en-IN')}
                        </span>
                        <span className="text-slate-500 ml-1 text-[11px] font-mono">kg</span>
                      </td>

                      {/* Pricing Tier */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        {row.discount_pct === 0 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 font-mono text-[10px] border border-white/[0.06]">
                            0% Full Price
                          </span>
                        )}
                        {row.discount_pct === 15 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[10px] border border-amber-500/20 font-medium">
                            15% Markdown
                          </span>
                        )}
                        {row.discount_pct === 30 && (
                          <span className="inline-block px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono text-[10px] border border-rose-500/30 font-bold">
                            30% Clearance
                          </span>
                        )}
                        {row.discount_pct !== 0 &&
                          row.discount_pct !== 15 &&
                          row.discount_pct !== 30 && (
                            <span className="inline-block px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 font-mono text-[10px]">
                              {row.discount_pct}% Off
                            </span>
                          )}
                      </td>

                      {/* Thermal RSL Buffer */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {row.rsl_buffer_hours >= 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[11px] font-medium border border-emerald-500/20">
                            +{row.rsl_buffer_hours.toFixed(1)}h Safe
                          </span>
                        ) : row.rsl_buffer_hours >= 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-[11px] font-medium border border-amber-500/20">
                            +{row.rsl_buffer_hours.toFixed(1)}h Tight
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold border border-rose-500/30">
                            {row.rsl_buffer_hours.toFixed(1)}h Spoiled
                          </span>
                        )}
                      </td>

                      {/* Net Contribution (₹) */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap font-mono">
                        <span
                          className={`font-bold ${
                            row.net_contribution >= 0
                              ? 'text-white'
                              : 'text-rose-400'
                          }`}
                        >
                          {row.net_contribution >= 0 ? '+' : '-'}₹
                          {Math.abs(row.net_contribution).toLocaleString('en-IN', {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </td>

                      {/* Expand / Details Toggle Button */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] transition-colors"
                        >
                          <span>{isExpanded ? 'Hide' : 'Audit'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Accordion Row for Decision Rationale */}
                    {isExpanded && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={7} className="p-3.5 sm:px-6">
                          <div className="bg-[#08090d] border border-white/[0.06] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-emerald-400" />
                                Mathematical Decision Audit (SciPy HiGHS)
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  row.status === 'OPTIMAL_DISPATCH'
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                }`}
                              >
                                Status: {row.status}
                              </span>
                            </div>

                            <p className="text-slate-300 leading-relaxed font-sans">
                              {row.reason}
                            </p>

                            <div className="pt-2 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                              <div>
                                Transit Time Consumed:{' '}
                                <span className="text-white font-bold">
                                  {row.effective_transit_rsl_hours.toFixed(1)}h
                                </span>
                              </div>
                              <div>
                                Unit Return:{' '}
                                <span className="text-white font-bold">
                                  {(row.net_contribution / row.quantity_kg).toFixed(1)} ₹/kg
                                </span>
                              </div>
                              <div>
                                Batch ID:{' '}
                                <span className="text-white font-bold">
                                  {row.batch_id}
                                </span>
                              </div>
                              <div>
                                Target APMC:{' '}
                                <span className="text-white font-bold">
                                  {row.market_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & View Controls */}
      <div className="mt-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <span>
            Showing {displayedRows.length} of {filteredRows.length} records
          </span>
          <button
            onClick={() => setShowAllRows((prev) => !prev)}
            className="text-[11px] underline text-slate-300 hover:text-white ml-2 cursor-pointer"
          >
            {showAllRows ? 'Show Paginated (10/page)' : 'Show All'}
          </button>
        </div>

        {!showAllRows && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DispatchTable;
