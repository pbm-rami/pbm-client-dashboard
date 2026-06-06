'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import KeyMetrics from '@/components/KeyMetrics';
import RevenueChart from '@/components/RevenueChart';
import TrendCharts from '@/components/TrendCharts';
import ListingsTable from '@/components/ListingsTable';
import ListingPerformanceTable from '@/components/ListingPerformanceTable';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [kpiData, setKpiData]               = useState([]);
  const [trendsData, setTrendsData]         = useState([]);   // portfolio trends (all year)
  const [listingTrends, setListingTrends]   = useState([]);   // single listing all-year trend
  const [listingsData, setListingsData]     = useState([]);   // listing table (filtered month)
  const [allListingsData, setAllListingsData] = useState([]); // all months × all listings
  const [allListingNames, setAllListingNames] = useState([]);
  const [selectedMonth, setSelectedMonth]   = useState('');
  const [selectedListing, setSelectedListing] = useState('all');
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');

  // ── Admin / staff redirect: go to /clients ───────────────────
  // Fire early — before any data loads.
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    const role = session?.user?.role;
    if (role === 'admin' || role === 'staff') {
      router.replace('/clients');
    }
  }, [status, session, router]);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') return;
    const role = session?.user?.role;
    if (role === 'admin' || role === 'staff') return;
    async function initialLoad() {
      setLoading(true);
      try {
        const [kpiRes, trendsRes, allListRes] = await Promise.all([
          fetch('/api/kpi'),
          fetch('/api/trends'),
          fetch('/api/listings'),        // no filters → get all listing names
        ]);
        const kpi      = await kpiRes.json();
        const trends   = await trendsRes.json();
        const allList  = await allListRes.json();

        const kpiRows = kpi.data || [];
        setKpiData(kpiRows);
        setTrendsData(trends.data || []);

        const allListRows = allList.data || [];
        const names = [...new Set(allListRows.map(r => r.listing_name))].sort();
        setAllListingNames(names);
        setAllListingsData(allListRows);

        // Default to current month if available, otherwise most recent month with data
        const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        const hasCurrentMonth = kpiRows.some(r => r.month_key === currentMonthKey);
        const mostRecentWithRevenue = [...kpiRows]
          .filter(r => (r.total_rental_revenue ?? 0) > 0 || (r.total_revenue_goal ?? 0) > 0)
          .sort((a, b) => b.month_key > a.month_key ? 1 : -1)[0]?.month_key;
        const defaultMonth = hasCurrentMonth
          ? currentMonthKey
          : (mostRecentWithRevenue || kpiRows[0]?.month_key || '');
        setSelectedMonth(defaultMonth);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    initialLoad();
  }, [status, session]);

  // ── Listing table: re-fetch when month or listing changes ─────
  useEffect(() => {
    if (!selectedMonth) return;
    async function fetchListings() {
      try {
        const params = new URLSearchParams({ month: selectedMonth });
        if (selectedListing && selectedListing !== 'all') params.set('listing', selectedListing);
        const res  = await fetch(`/api/listings?${params}`);
        const json = await res.json();
        setListingsData(json.data || []);
      } catch (e) {
        console.error('Listings fetch error:', e);
      }
    }
    fetchListings();
  }, [selectedMonth, selectedListing]);

  // ── Listing trend: fetch all months for selected listing ──────
  useEffect(() => {
    if (selectedListing === 'all') {
      setListingTrends([]);
      return;
    }
    async function fetchListingTrends() {
      try {
        const params = new URLSearchParams({ listing: selectedListing });
        const res  = await fetch(`/api/listings?${params}`);
        const json = await res.json();
        setListingTrends(json.data || []);
      } catch (e) {
        console.error('Listing trends fetch error:', e);
      }
    }
    fetchListingTrends();
  }, [selectedListing]);

  const currentKpi     = kpiData.find(r => r.month_key === selectedMonth);
  const currentListing = selectedListing !== 'all' ? listingsData[0] : null;

  // Client name comes from the data — no hardcoding needed
  const clientName = kpiData[0]?.client_name ?? 'Portfolio';

  // Show all months that have a goal set (includes future months with $0 revenue)
  const availableMonths = kpiData.filter(r =>
    (r.total_rental_revenue ?? 0) > 0 || (r.total_revenue_goal ?? 0) > 0
  );

  const sortByMonth = (arr) =>
    [...arr].sort((a, b) => {
      const ma = a.report_month ?? a.month_key ?? '';
      const mb = b.report_month ?? b.month_key ?? '';
      return ma < mb ? -1 : ma > mb ? 1 : 0;
    });

  // RevenueChart uses listing-level fields when a listing is selected
  const revenueChartData = sortByMonth(
    selectedListing !== 'all' ? listingTrends : trendsData
  );

  // TrendCharts always expects portfolio field names.
  // When a listing is selected we normalise listing-level fields to match,
  // including LY fields so the "LY Final" lines render correctly.
  const trendChartsData = sortByMonth(
    selectedListing !== 'all'
      ? listingTrends.map(r => ({
          ...r,
          // Revenue
          total_rental_revenue:      r.rental_revenue,
          total_rental_revenue_stly: r.rental_revenue_stly,
          total_rental_revenue_ly:   r.rental_revenue_ly,
          // Occupancy
          avg_occupancy_pct:         r.occupancy_pct,
          avg_occupancy_pct_stly:    r.occupancy_pct_stly,
          avg_occupancy_pct_ly:      r.occupancy_pct_ly,
          avg_market_occupancy_pct:  r.market_occupancy_pct,
          // RevPAR
          avg_revpar:                r.rental_revpar,
          avg_revpar_stly:           r.revpar_stly,
          avg_market_revpar:         r.market_revpar,
        }))
      : trendsData
  );

  // Don't render client dashboard while session is loading or if admin/staff (redirect in flight)
  const _role = session?.user?.role;
  if (status === 'loading' || status === 'unauthenticated' || _role === 'admin' || _role === 'staff') {
    return (
      <div className="min-h-screen bg-[#212327] flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#212327] text-slate-200">
      {/* Header */}
      <div className="bg-[#1c1e22] border-b border-[#383b40] px-4 sm:px-8 py-4 sm:py-5">
        <div className="max-w-screen-2xl mx-auto flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <Image src="/logo.png" alt="Pricing By Mira" width={120} height={80} className="mb-2 rounded" style={{ objectFit: 'contain' }} priority />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Client Performance Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Live portfolio performance overview</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 text-sm text-slate-400">
              <span>👤 {clientName}</span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span>{selectedListing !== 'all' ? selectedListing : `${clientName} Portfolio`}</span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span>
                {selectedListing !== 'all'
                  ? `${currentListing?.bedroom_count ?? '—'} Bedrooms`
                  : `Portfolio · ${currentKpi?.total_bedrooms ?? '—'} Bedrooms`}
              </span>
              {selectedListing === 'all' && currentKpi?.active_listings && (
                <>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span>{currentKpi.active_listings} Active Listings</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="no-print self-start sm:mt-2 px-4 py-2 bg-[#2a2c30] border border-[#383b40] rounded-lg text-slate-300 text-sm hover:bg-[#32353a] transition-colors"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
        {/* Filter Bar */}
        <div className="no-print flex flex-wrap items-center gap-3 mb-6 bg-[#2a2c30] border border-[#383b40] rounded-xl px-4 sm:px-5 py-3">
          <span className="text-slate-400 text-xs font-semibold tracking-wider">FILTERS</span>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm focus:outline-none focus:border-[#e4cf8b] cursor-pointer"
          >
            {availableMonths.map(r => (
              <option key={r.month_key} value={r.month_key}>{r.month_label}</option>
            ))}
          </select>
          <select
            value={selectedListing}
            onChange={e => setSelectedListing(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-[#212327] border border-[#383b40] rounded-lg text-white text-sm focus:outline-none focus:border-[#e4cf8b] cursor-pointer sm:min-w-[180px]"
          >
            <option value="all">All Listings</option>
            {allListingNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {selectedListing !== 'all' && (
            <button
              onClick={() => setSelectedListing('all')}
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Clear
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-slate-400 text-lg">Loading dashboard data…</div>
          </div>
        ) : (
          <>
            {/* Main 2-column layout */}
            <div className="print-layout-row flex flex-col lg:flex-row gap-6 mb-6">
              {/* Left sidebar — Key Metrics */}
              <div className="print-layout-sidebar w-full lg:w-72 lg:flex-shrink-0">
                <KeyMetrics
                  portfolioData={currentKpi}
                  listingData={currentListing}
                  mode={selectedListing !== 'all' ? 'listing' : 'portfolio'}
                  listingName={selectedListing !== 'all' ? selectedListing : null}
                />
              </div>

              {/* Right column — Revenue → Trend Charts → Listing Detail */}
              <div className="flex-1 min-w-0 flex flex-col gap-6">
                <RevenueChart
                  data={revenueChartData}
                  selectedMonth={selectedMonth}
                  isListingMode={selectedListing !== 'all'}
                  listingName={selectedListing !== 'all' ? selectedListing : null}
                />
                <TrendCharts data={trendChartsData} />
                <ListingsTable data={listingsData} />
              </div>
            </div>

            {/* Listing Performance — full metrics table with all-months toggle */}
            <div className="print-break-listing-perf">
              <ListingPerformanceTable
                data={listingsData}
                allMonthsData={selectedListing !== 'all' ? listingTrends : allListingsData}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
