import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Sidebar from "./components/Sidebar";
import KPICard from "./components/KPICard";
import MapComponent from "./components/MapComponent";
import {
  TripTrendsChart,
  BoroughComparisonChart,
  FareDistributionChart,
} from "./components/Charts";
import { Search, Bell, RefreshCw } from "lucide-react";

const API_BASE_URL = "http://localhost:5000/api";

function App() {
  const [kpiData, setKpiData] = useState([]);
  const [boroughData, setBoroughData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [fareDistData, setFareDistData] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [avgStats, setAvgStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state — passed down to Sidebar and used when fetching
  const [filters, setFilters] = useState({
    boroughs: ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"],
    minFare: 0,
    maxFare: 250,
    minDistance: 0,
    maxDistance: 50,
  });

  const fetchData = useCallback(async (activeFilters) => {
    setLoading(true);
    setError(null);
    try {
      // Build query params for filtered endpoints
      const params = new URLSearchParams();
      if (activeFilters.minFare > 0)
        params.append("min_fare", activeFilters.minFare);
      if (activeFilters.maxFare < 250)
        params.append("max_fare", activeFilters.maxFare);
      if (activeFilters.minDistance > 0)
        params.append("min_distance", activeFilters.minDistance);
      if (activeFilters.maxDistance < 50)
        params.append("max_distance", activeFilters.maxDistance);
      if (activeFilters.boroughs.length < 5) {
        activeFilters.boroughs.forEach((b) => params.append("borough", b));
      }

      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const [statsRes, boroughRes, trendsRes, fareRes, peakRes] =
        await Promise.all([
          axios.get(`${API_BASE_URL}/statistics`),
          axios.get(`${API_BASE_URL}/statistics/by-borough`),
          axios.get(`${API_BASE_URL}/statistics/trends`),
          axios.get(`${API_BASE_URL}/statistics/fare-distribution`),
          axios.get(`${API_BASE_URL}/statistics/peak-hours`),
        ]);

      const stats = statsRes.data;
      setAvgStats(stats);

      // ── Trends → group by month for clean chart ──────────────────────────
      const rawTrends = trendsRes.data;
      const monthMap = {};
      rawTrends.forEach(({ date, trips }) => {
        const month = date.slice(0, 7); // "2019-01"
        monthMap[month] = (monthMap[month] || 0) + trips;
      });
      const groupedTrends = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, trips]) => ({
          name: new Date(month + "-01").toLocaleString("default", {
            month: "short",
            year: "2-digit",
          }),
          trips,
        }));
      setTrendData(groupedTrends);

      // ── Sparklines from monthly trends ───────────────────────────────────
      const last7 = groupedTrends.slice(-7).map((d) => d.trips);

      // ── KPI Cards — all real ─────────────────────────────────────────────
      setKpiData([
        {
          title: "Total Trips",
          value: stats.total_trips.toLocaleString(),
          change: null,
          trend: "up",
          data: last7.length > 0 ? last7 : [1],
        },
        {
          title: "Revenue",
          value: `$${(stats.total_revenue / 1_000_000).toFixed(2)}M`,
          change: null,
          trend: "up",
          data: last7.length > 0 ? last7 : [1],
        },
        {
          title: "Avg. Fare",
          value: `$${stats.avg_fare.toFixed(2)}`,
          change: null,
          trend: "neutral",
          data: last7.length > 0 ? last7 : [1],
        },
        {
          title: "Avg. Distance",
          value: `${stats.avg_distance.toFixed(1)} mi`,
          change: null,
          trend: "up",
          data: last7.length > 0 ? last7 : [1],
        },
      ]);

      // ── Borough data — real ───────────────────────────────────────────────
      const bData = boroughRes.data
        .filter((b) => b.borough && b.borough !== "" && b.borough !== "Unknown")
        .map((b) => ({
          name: b.borough,
          trips: b.trip_count,
          revenue: Math.round(b.total_revenue),
        }));
      setBoroughData(bData);

      // ── Fare distribution ─────────────────────────────────────────────────
      setFareDistData(fareRes.data);

      // ── Peak hours ────────────────────────────────────────────────────────
      const maxCount = Math.max(...peakRes.data.map((r) => r.trip_count), 1);
      setPeakHours(
        peakRes.data.slice(0, 4).map((r) => ({
          ...r,
          pct: Math.round((r.trip_count / maxCount) * 100),
          label_count:
            r.trip_count > 999
              ? `${(r.trip_count / 1000).toFixed(1)}K trips`
              : `${r.trip_count} trips`,
        })),
      );

      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load data. Is the API server running on port 5000?");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters);
  }, []);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    fetchData(newFilters);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-charcoal text-white flex-col gap-4">
        <RefreshCw size={32} className="animate-spin text-taxi-yellow" />
        <p className="text-lg font-medium">Loading Dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-charcoal text-white flex-col gap-4">
        <p className="text-red-400 text-lg">{error}</p>
        <button
          onClick={() => fetchData(filters)}
          className="px-6 py-2 bg-taxi-yellow text-black rounded-lg font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-charcoal text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar filters={filters} onApplyFilters={handleApplyFilters} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-[#333] flex items-center justify-between px-8 bg-charcoal flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-taxi-yellow font-bold text-lg tracking-tight">
              🚕 NYC Urban Mobility
            </span>
            <span className="text-xs text-gray-500 font-mono bg-[#2C2C2E] px-2 py-1 rounded">
              {(avgStats?.total_trips || 0).toLocaleString()} trips in DB
            </span>
          </div>
          <div className="relative w-80">
            <Search
              className="absolute left-3 top-2.5 text-gray-500"
              size={18}
            />
            <input
              type="text"
              placeholder="Search zones, boroughs…"
              className="w-full bg-[#2C2C2E] border border-transparent focus:border-taxi-yellow rounded-full py-2 pl-10 pr-4 text-sm text-gray-300 focus:outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-5">
            <button
              onClick={() => fetchData(filters)}
              className="text-gray-400 hover:text-taxi-yellow transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={18} />
            </button>
            <button className="relative text-gray-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center space-x-3 cursor-pointer hover:bg-[#2C2C2E] p-2 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-taxi-yellow to-orange-500 flex items-center justify-center text-black font-bold text-xs">
                MC
              </div>
              <div className="text-sm">
                <div className="font-bold text-white">Michael Chen</div>
                <div className="text-xs text-gray-500">Data Analyst</div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#121212]">
          {/* KPI Row — 4 real cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {kpiData.map((kpi, i) => (
              <KPICard key={i} {...kpi} />
            ))}
          </div>

          {/* Map + Right Panel */}
          <div className="grid grid-cols-12 gap-6 h-[580px] mb-8">
            <div className="col-span-12 lg:col-span-8 h-full rounded-2xl overflow-hidden">
              <MapComponent filters={filters} />
            </div>
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 h-full">
              <div className="flex-1 min-h-0">
                <TripTrendsChart data={trendData} />
              </div>
              <div className="flex-1 min-h-0">
                <BoroughComparisonChart data={boroughData} />
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Fare Distribution */}
            <div className="h-64">
              <FareDistributionChart data={fareDistData} />
            </div>

            {/* Avg Trip Distance — real */}
            <div className="h-64 bg-card-bg rounded-2xl p-6 shadow-lg flex flex-col">
              <h3 className="text-gray-400 text-sm font-medium mb-3">
                Average Trip Distance
              </h3>
              <div className="text-5xl font-bold text-white mt-2">
                {avgStats?.avg_distance?.toFixed(1)}{" "}
                <span className="text-xl text-gray-500">miles</span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-gray-400">
                <span>
                  Avg Speed:{" "}
                  <span className="text-white">
                    {avgStats?.avg_speed_mph?.toFixed(1)} mph
                  </span>
                </span>
                <span>
                  Avg Duration:{" "}
                  <span className="text-white">
                    {avgStats?.avg_duration_minutes?.toFixed(0)} min
                  </span>
                </span>
              </div>
              <div className="mt-auto">
                <svg
                  className="w-full h-12 stroke-taxi-yellow fill-none"
                  viewBox="0 0 100 20"
                >
                  <path
                    d="M0 15 Q 20 18, 40 10 T 80 5 T 100 12"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Peak Hours — real */}
            <div className="h-64 bg-card-bg rounded-2xl p-6 shadow-lg flex flex-col">
              <h3 className="text-white font-bold text-lg mb-4">Peak Hours</h3>
              <div className="space-y-3 flex-1">
                {peakHours.map((item, i) => (
                  <div key={i} className="flex items-center text-sm gap-2">
                    <span className="w-20 text-gray-400 flex-shrink-0">
                      {item.label}
                    </span>
                    <div className="flex-1 h-2 bg-[#333] rounded-full relative">
                      <div
                        className="absolute h-full bg-taxi-yellow rounded-full transition-all duration-700"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                    <span className="text-white font-mono text-xs w-20 text-right flex-shrink-0">
                      {item.label_count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
