"use client";

import { useEffect, useState, useRef } from "react";
import {
  Wifi,
  Download,
  Upload,
  Activity,
  Calendar,
  Settings,
  RefreshCw,
  Play,
  Pause,
  DownloadCloud,
  FileSpreadsheet,
  FileJson,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  Laptop,
  Smartphone,
  ChevronRight,
  TrendingUp,
  Cpu,
  CheckCircle2,
  Sliders,
  X,
  ExternalLink,
} from "lucide-react";
import { LiveTrackerResult, DayRecord, SpeedPoint } from "@/lib/data-tracker";

export default function Home() {
  const [data, setData] = useState<LiveTrackerResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCalibrate, setShowCalibrate] = useState(false);
  const [selectedDayForCalibrate, setSelectedDayForCalibrate] = useState<DayRecord | null>(null);
  const [calibrateDl, setCalibrateDl] = useState("");
  const [calibrateUl, setCalibrateUl] = useState("");

  // Settings form state
  const [dailyBudget, setDailyBudget] = useState(10);
  const [monthlyBudget, setMonthlyBudget] = useState(150);
  const [routerIp, setRouterIp] = useState("192.168.0.1");
  const [routerPassword, setRouterPassword] = useState("");
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(3);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const fetchLiveStats = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/router/live", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const json: LiveTrackerResult = await res.json();
      setData(json);
      setError(json.connected ? null : json.error || "Cannot reach router");

      if (json.settings) {
        setDailyBudget(json.settings.dailyBudgetGB || 10);
        setMonthlyBudget(json.settings.monthlyBudgetGB || 150);
        setRouterIp(json.settings.routerIp || "192.168.0.1");
        setAutoRefreshInterval(json.settings.autoRefreshIntervalSec || 3);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to query tracker API");
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
    const interval = setInterval(() => {
      if (!isPausedRef.current) {
        fetchLiveStats();
      }
    }, (data?.settings?.autoRefreshIntervalSec || 3) * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyBudgetGB: Number(dailyBudget),
          monthlyBudgetGB: Number(monthlyBudget),
          routerIp,
          routerPassword: routerPassword.trim() || undefined,
          autoRefreshIntervalSec: Number(autoRefreshInterval),
        }),
      });
      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 2500);
        fetchLiveStats(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCalibrateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDayForCalibrate) return;
    try {
      const res = await fetch("/api/history/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDayForCalibrate.date,
          downloadGB: parseFloat(calibrateDl) || 0,
          uploadGB: parseFloat(calibrateUl) || 0,
        }),
      });
      if (res.ok) {
        setShowCalibrate(false);
        fetchLiveStats(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Format helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0.00 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatSpeed = (bps: number) => {
    if (bps < 1024) return `${bps.toFixed(0)} B/s`;
    const kbps = bps / 1024;
    if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`;
    const mbps = kbps / 1024;
    return `${mbps.toFixed(2)} MB/s`;
  };

  const formatSecondsToUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    return `${h}h ${m}m`;
  };

  // Calculations for today
  const todayTotalBytes = data?.todayUsage?.totalBytes || 0;
  const todayDlBytes = data?.todayUsage?.downloadBytes || 0;
  const todayUlBytes = data?.todayUsage?.uploadBytes || 0;
  const todayTotalGB = todayTotalBytes / (1024 * 1024 * 1024);
  const targetDailyGB = data?.settings?.dailyBudgetGB || 10;
  const dailyPercent = Math.min(100, Math.round((todayTotalGB / targetDailyGB) * 100));

  const dlSharePercent =
    todayTotalBytes > 0 ? Math.round((todayDlBytes / todayTotalBytes) * 100) : 85;
  const ulSharePercent = 100 - dlSharePercent;

  // Hourly buckets computation
  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const hourlyData = data?.todayUsage?.hourly || {};
  let maxHourBytes = 1;
  hoursList.forEach((h) => {
    const bucket = hourlyData[h];
    if (bucket) {
      const tot = bucket.downloadBytes + bucket.uploadBytes;
      if (tot > maxHourBytes) maxHourBytes = tot;
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#07090e] text-zinc-100 font-sans selection:bg-[#ffcc00] selection:text-black">
      {/* Top Banner Navigation */}
      <header className="border-b border-white/5 bg-[#0b0e17]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-[#ffcc00] to-[#e6a800] flex items-center justify-center shadow-lg shadow-[#ffcc00]/20 font-black text-black text-xl tracking-tighter">
              MTN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  ODU Pulse
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ffcc00]/10 text-[#ffcc00] border border-[#ffcc00]/30 tracking-wider uppercase">
                    5G Live
                  </span>
                </h1>
              </div>
              <p className="text-xs text-zinc-400">Daily Wi-Fi Data Usage & Telemetry</p>
            </div>
          </div>

          {/* Router Connection Badge & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-white/10 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                {data?.connected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                )}
              </span>
              <span className="font-medium text-zinc-200">
                {data?.connected ? (
                  <>
                    {data.device?.realDevice || "MTN 5G Router"} •{" "}
                    <span className="text-[#ffcc00] font-semibold">{data.device?.networkType || "5G"}</span>
                  </>
                ) : (
                  "Disconnected"
                )}
              </span>
            </div>

            {/* Pause / Resume Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isPaused
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                  : "bg-zinc-900/90 border-white/10 text-zinc-300 hover:bg-zinc-800"
              }`}
              title={isPaused ? "Resume Live Tracking" : "Pause Live Tracking"}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-zinc-400" />}
              <span className="hidden md:inline">{isPaused ? "Resume" : "Live"}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLiveStats(true)}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-zinc-900/90 border border-white/10 text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#ffcc00]" : ""}`} />
            </button>

            {/* Export Dropdown / Button */}
            <a
              href="/api/export?format=csv"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 border border-white/10 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:border-white/20 transition-all"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-[#ffcc00]" />
              <span>Export CSV</span>
            </a>

            {/* Settings Trigger */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg bg-zinc-900/90 border border-white/10 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              title="Settings & Router IP"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold">Router Communication Notice</p>
                <p className="text-xs text-red-400/80">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs font-semibold px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-200"
            >
              Configure IP
            </button>
          </div>
        )}

        {/* PRIMARY HERO ROW: Today's Data Card + Live Speed Card + 5G Signal Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 1: Today's Data Usage (Prominent 5 Cols) */}
          <div className="lg:col-span-5 glass-panel-glow rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-64 h-64 bg-linear-to-bl from-[#ffcc00]/15 to-transparent rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#ffcc00] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Today&apos;s Usage • {data?.todayUsage?.date || "Today"}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    dailyPercent >= 100
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : dailyPercent >= 80
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {dailyPercent >= 100
                    ? "Budget Exceeded"
                    : dailyPercent >= 80
                    ? "Approaching Cap"
                    : "Within Budget"}
                </span>
              </div>

              {/* Huge Number */}
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white font-mono">
                  {todayTotalGB >= 1 ? todayTotalGB.toFixed(2) : (todayTotalBytes / (1024 * 1024)).toFixed(0)}
                </div>
                <span className="text-2xl font-bold text-[#ffcc00] font-sans">
                  {todayTotalGB >= 1 ? "GB" : "MB"}
                </span>
              </div>

              <p className="text-xs text-zinc-400 mt-1">
                Total data transferred through Wi-Fi since 00:00 midnight
              </p>

              {/* Download vs Upload Split Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Download className="w-3 h-3" /> Download: {formatBytes(todayDlBytes)} ({dlSharePercent}%)
                  </span>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <Upload className="w-3 h-3" /> Upload: {formatBytes(todayUlBytes)} ({ulSharePercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${dlSharePercent}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                  />
                  <div
                    style={{ width: `${ulSharePercent}%` }}
                    className="bg-cyan-500 transition-all duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Daily Target Progress */}
            <div className="mt-6 pt-5 border-t border-white/5">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-400">
                  Daily Plan Target ({targetDailyGB} GB)
                </span>
                <span className="font-mono font-bold text-white">
                  {dailyPercent}% used • {(Math.max(0, targetDailyGB - todayTotalGB)).toFixed(2)} GB left
                </span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, dailyPercent)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    dailyPercent >= 100
                      ? "bg-red-500"
                      : dailyPercent >= 80
                      ? "bg-amber-400"
                      : "bg-[#ffcc00]"
                  }`}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Peak Today: {formatSpeed(data?.todayUsage?.peakSpeedBps || 0)}</span>
                <button
                  onClick={() => {
                    if (data?.todayUsage) {
                      setSelectedDayForCalibrate(data.todayUsage);
                      setCalibrateDl((data.todayUsage.downloadBytes / (1024 * 1024 * 1024)).toFixed(2));
                      setCalibrateUl((data.todayUsage.uploadBytes / (1024 * 1024 * 1024)).toFixed(2));
                      setShowCalibrate(true);
                    }
                  }}
                  className="text-[#ffcc00] hover:underline"
                >
                  Calibrate Baseline
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Real-time Speed Meter (4 Cols) */}
          <div className="lg:col-span-4 glass-panel rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#ffcc00]" />
                  Real-Time Wi-Fi Speed
                </span>
                <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Poll ({data?.settings?.autoRefreshIntervalSec || 3}s)
                </span>
              </div>

              {/* Speeds */}
              <div className="grid grid-cols-2 gap-4 mt-5">
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
                    {formatSpeed(data?.currentDlSpeedBps || 0)}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-white tracking-tight">
                    {formatSpeed(data?.currentUlSpeedBps || 0)}
                  </div>
                </div>
              </div>

              {/* Live Mini Sparkline */}
              <div className="mt-5">
                <div className="text-[11px] text-zinc-400 mb-2 flex justify-between">
                  <span>Recent Activity Pulse</span>
                  <span className="text-zinc-400">Last 25 cycles</span>
                </div>
                <div className="h-16 w-full bg-zinc-900/50 rounded-lg p-1.5 flex items-end gap-1 overflow-hidden border border-white/5">
                  {(data?.speedHistory || []).map((sp, idx) => {
                    const totalSpeed = sp.dlSpeedBps + sp.ulSpeedBps;
                    const maxHistorySpeed = Math.max(
                      1024 * 1024,
                      ...((data?.speedHistory || []).map((s) => s.dlSpeedBps + s.ulSpeedBps))
                    );
                    const heightPercent = Math.max(8, Math.min(100, (totalSpeed / maxHistorySpeed) * 100));
                    return (
                      <div
                        key={idx}
                        className="flex-1 rounded-sm bg-linear-to-t from-[#ffcc00]/30 to-[#ffcc00] transition-all duration-300"
                        style={{ height: `${heightPercent}%` }}
                        title={`${sp.time}: DL ${formatSpeed(sp.dlSpeedBps)} | UL ${formatSpeed(sp.ulSpeedBps)}`}
                      />
                    );
                  })}
                  {(!data?.speedHistory || data.speedHistory.length === 0) && (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                      Collecting speed samples...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>Router Gateway</span>
              <a
                href={`http://${data?.settings?.routerIp || "192.168.0.1"}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#ffcc00] hover:underline flex items-center gap-1 font-mono"
              >
                {data?.settings?.routerIp || "192.168.0.1"}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Card 3: 5G Signal & ODU Cell Telemetry (3 Cols) */}
          <div className="lg:col-span-3 glass-panel rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#ffcc00]" />
                  MTN Cell Telemetry
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  {data?.device?.networkType || "5G NSA"}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-zinc-400">Signal (RSRP)</span>
                  <span className="font-mono font-semibold text-white">
                    {data?.device?.rsrp || "- dBm"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-zinc-400">5G Signal (NR RSRP)</span>
                  <span className="font-mono font-semibold text-[#ffcc00]">
                    {data?.device?.rsrp5g || "- dBm"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-zinc-400">Active Band</span>
                  <span className="font-mono text-zinc-200">
                    5G n{data?.device?.currentBand5g || "78"} • LTE B{data?.device?.currentBand || "20"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/5">
                  <span className="text-zinc-400">Hardware / Board</span>
                  <span className="font-mono text-zinc-200">
                    {data?.device?.boardType || "ZLT X17U"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-zinc-400">ODU Uptime</span>
                  <span className="font-mono text-zinc-200 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {formatSecondsToUptime(data?.device?.uptimeSeconds || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-2.5 rounded-xl bg-zinc-900/60 border border-white/5 text-[11px] text-zinc-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>SIM IMSI: {data?.device?.imsi?.slice(-6) ? `***${data.device.imsi.slice(-6)}` : "Verified"}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Hourly Usage Distribution (Today) */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#ffcc00]" />
                Hourly Data Distribution (Today)
              </h2>
              <p className="text-xs text-zinc-400">
                Data burned during each hour of the day (00:00 to 23:00)
              </p>
            </div>
            <div className="text-xs font-mono text-zinc-400">
              Total Today: <span className="text-white font-bold">{formatBytes(todayTotalBytes)}</span>
            </div>
          </div>

          {/* 24-Hour Bar Graph */}
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 items-end h-36 pt-4 border-b border-white/5">
            {hoursList.map((h) => {
              const bucket = hourlyData[h];
              const dl = bucket?.downloadBytes || 0;
              const ul = bucket?.uploadBytes || 0;
              const total = dl + ul;
              const percent = maxHourBytes > 0 ? Math.max(6, (total / maxHourBytes) * 100) : 6;
              const isCurrentHour = new Date().getHours() === Number(h);

              return (
                <div key={h} className="flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-12 z-30 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded-md border border-white/10 whitespace-nowrap shadow-xl">
                    <p className="font-bold text-[#ffcc00]">{h}:00 - {h}:59</p>
                    <p>Total: {formatBytes(total)}</p>
                  </div>

                  <div
                    style={{ height: `${percent}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isCurrentHour
                        ? "bg-[#ffcc00] shadow-lg shadow-[#ffcc00]/30"
                        : total > 0
                        ? "bg-zinc-600 hover:bg-[#ffcc00]/80"
                        : "bg-zinc-800/40"
                    }`}
                  />
                  <span
                    className={`text-[9px] mt-1.5 font-mono ${
                      isCurrentHour ? "text-[#ffcc00] font-bold" : "text-zinc-400"
                    }`}
                  >
                    {h}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-3">
            <span>00:00 (Midnight)</span>
            <span>12:00 (Noon)</span>
            <span>23:00 (Night)</span>
          </div>
        </div>

        {/* SECTION 3: Daily History & Comparison Table */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#ffcc00]" />
                Daily Usage History
              </h2>
              <p className="text-xs text-zinc-400">
                Historical record of your Wi-Fi data consumption per calendar day
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/export?format=csv"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </a>
              <a
                href="/api/export?format=json"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
              >
                <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                <span>JSON</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Download</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Upload</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Total Data</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Budget Status</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Peak Speed</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data?.dailyHistoryList || []).map((record) => {
                  const dayTotalGb = record.totalBytes / (1024 * 1024 * 1024);
                  const isExceeded = dayTotalGb > targetDailyGB;
                  const isToday = record.date === data?.todayUsage?.date;

                  return (
                    <tr
                      key={record.date}
                      className={`hover:bg-white/2 transition-colors ${
                        isToday ? "bg-[#ffcc00]/5" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-white flex items-center gap-2">
                        {record.date}
                        {isToday && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ffcc00]/20 text-[#ffcc00]">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-mono">
                        {formatBytes(record.downloadBytes)}
                      </td>
                      <td className="py-3.5 px-4 text-cyan-400 font-mono">
                        {formatBytes(record.uploadBytes)}
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-white">
                        {formatBytes(record.totalBytes)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isExceeded
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {dayTotalGb.toFixed(2)} / {targetDailyGB} GB (
                          {Math.round((dayTotalGb / targetDailyGB) * 100)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300 font-mono">
                        {formatSpeed(record.peakSpeedBps || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDayForCalibrate(record);
                            setCalibrateDl(
                              (record.downloadBytes / (1024 * 1024 * 1024)).toFixed(2)
                            );
                            setCalibrateUl(
                              (record.uploadBytes / (1024 * 1024 * 1024)).toFixed(2)
                            );
                            setShowCalibrate(true);
                          }}
                          className="text-xs text-zinc-400 hover:text-[#ffcc00] font-medium"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 4: SIM Hardware Total & Monthly Plan Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-[#ffcc00]" />
              MTN SIM Hardware Lifetime/Monthly Counter
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Direct counter reported by the SIM card inside the router (cmd 205):
            </p>

            <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/5 flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-400">Total SIM Session/Month Flow</div>
                <div className="text-3xl font-extrabold font-mono text-white mt-1">
                  {data?.wan?.monthlyTotalFlowMb
                    ? (data.wan.monthlyTotalFlowMb / 1024).toFixed(2)
                    : "0.00"}{" "}
                  <span className="text-lg font-sans text-[#ffcc00]">GB</span>
                </div>
              </div>
              <div className="text-right text-xs text-zinc-400">
                <p>Uptime: {formatSecondsToUptime(data?.device?.uptimeSeconds || 0)}</p>
                <p>Synced with ODU</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <Sliders className="w-4 h-4 text-[#ffcc00]" />
                Daily Tracking Targets
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Configure your daily threshold to avoid unexpected data depletion.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/80 border border-white/5">
              <div>
                <p className="text-xs text-zinc-400">Daily Budget Limit</p>
                <p className="text-xl font-bold font-mono text-white">
                  {targetDailyGB} GB / Day
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="px-3.5 py-1.5 rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] text-black font-semibold text-xs transition-colors"
              >
                Change Target
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 bg-[#090b12] py-6 text-center text-xs text-zinc-400">
        <p>MTN Broadband ODU Tracker • Running locally connected to {data?.settings?.routerIp || "192.168.0.1"}</p>
      </footer>

      {/* MODAL: Settings */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f131f] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#ffcc00]" />
              Tracker Settings
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Adjust your router gateway IP and daily usage budget.
            </p>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Router IP Gateway
                </label>
                <input
                  type="text"
                  value={routerIp}
                  onChange={(e) => setRouterIp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                  placeholder="192.168.0.1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Daily Budget (GB)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Monthly Budget (GB)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Auto-Refresh Interval (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Router Admin Password (Optional)
                </label>
                <input
                  type="password"
                  value={routerPassword}
                  onChange={(e) => setRouterPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                  placeholder="Only if you wish to query connected devices"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Leave blank if not needed; real-time data & byte tracking works without password!
                </span>
              </div>

              {settingsSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Settings saved successfully!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] text-black text-xs font-bold"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Calibrate Day */}
      {showCalibrate && selectedDayForCalibrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0f131f] border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCalibrate(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#ffcc00]" />
              Adjust {selectedDayForCalibrate.date}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Synchronize or manually override recorded data usage for this day.
            </p>

            <form onSubmit={handleCalibrateSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Download (GB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calibrateDl}
                  onChange={(e) => setCalibrateDl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Upload (GB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calibrateUl}
                  onChange={(e) => setCalibrateUl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-white text-xs font-mono focus:border-[#ffcc00] outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCalibrate(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#ffcc00] hover:bg-[#e6b800] text-black text-xs font-bold"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
