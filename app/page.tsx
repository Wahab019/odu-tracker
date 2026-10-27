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
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
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
    <div className="min-h-screen flex flex-col bg-[#0b0d10] text-[#ede7dc] selection:bg-[#f4efe4] selection:text-[#0b0d10]">
      {/* Top Banner Navigation */}
      <header className="border-b border-[#a2acbc]/12 bg-[#0e1015]/85 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#151820] border border-[#f4efe4]/30 flex items-center justify-center shadow-lg shadow-black/50 font-bold text-[#f4efe4] text-lg tracking-tight">
              MTN
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-[#f4efe4] flex items-center gap-2">
                  ODU Pulse
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f4efe4]/10 text-[#f4efe4] border border-[#f4efe4]/25 tracking-wider uppercase font-sans">
                    5G Live
                  </span>
                </h1>
              </div>
              <p className="text-xs text-[#8b93a3]">Daily Wi-Fi Data Usage & Telemetry</p>
            </div>
          </div>

          {/* Router Connection Badge & Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#141720]/80 border border-[#a2acbc]/15 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                {data?.connected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f4efe4] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#f4efe4]"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#cc6b6b]"></span>
                )}
              </span>
              <span className="font-medium text-[#dcd7cb]">
                {data?.connected ? (
                  <>
                    {data.device?.realDevice || "MTN 5G Router"} •{" "}
                    <span className="text-[#f4efe4] font-semibold font-mono">{data.device?.networkType || "5G"}</span>
                  </>
                ) : (
                  "Disconnected"
                )}
              </span>
            </div>

            {/* Pause / Resume Button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isPaused
                  ? "bg-[#252018] border-[#a8906c]/40 text-[#ede2cd] hover:bg-[#30281e]"
                  : "bg-[#141720] border-[#a2acbc]/15 text-[#c5cbd6] hover:bg-[#1c202a] hover:text-[#f4efe4]"
              }`}
              title={isPaused ? "Resume Live Tracking" : "Pause Live Tracking"}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-[#f4efe4]" /> : <Pause className="w-3.5 h-3.5 text-[#8b93a3]" />}
              <span className="hidden md:inline font-sans">{isPaused ? "Resume" : "Live"}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchLiveStats(true)}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-[#141720] border border-[#a2acbc]/15 text-[#c5cbd6] hover:bg-[#1c202a] hover:text-[#f4efe4] transition-colors disabled:opacity-50"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-[#f4efe4]" : ""}`} />
            </button>

            {/* Export Dropdown / Button */}
            <a
              href="/api/export?format=csv"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141720] border border-[#a2acbc]/15 text-xs font-medium text-[#c5cbd6] hover:bg-[#1c202a] hover:border-[#f4efe4]/30 hover:text-[#f4efe4] transition-all"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-[#f4efe4]" />
              <span className="font-sans">Export CSV</span>
            </a>

            {/* Settings Trigger */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-[#141720] border border-[#a2acbc]/15 text-[#c5cbd6] hover:bg-[#1c202a] hover:text-[#f4efe4] transition-colors"
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
          <div className="p-4 rounded-2xl bg-[#26181b] border border-[#7d3b41]/40 text-[#f5c6cb] text-sm flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#e5828b] shrink-0" />
              <div>
                <p className="font-semibold text-[#f9d7db]">Router Communication Notice</p>
                <p className="text-xs text-[#d1949a]">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#432328] hover:bg-[#522b31] text-[#fbe5e7] border border-[#834249]/50 transition-colors"
            >
              Configure IP
            </button>
          </div>
        )}

        {/* PRIMARY HERO ROW: Today's Data Card + Live Speed Card + 5G Signal Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Card 1: Today's Data Usage (Prominent 5 Cols) */}
          <div className="lg:col-span-5 glass-panel-glow rounded-3xl p-6 sm:p-7 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-[#f4efe4]/10 via-[#a2acbc]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#a8b0bf] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#f4efe4]" />
                  Today&apos;s Usage • {data?.todayUsage?.date || "Today"}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full font-sans ${
                    dailyPercent >= 100
                      ? "bg-[#351e22]/90 text-[#f7b6b6] border border-[#c46969]/40"
                      : dailyPercent >= 80
                      ? "bg-[#332b20]/90 text-[#f5e0be] border border-[#d2ad6d]/40"
                      : "bg-[#1f2622]/90 text-[#d6e6d8] border border-[#77997a]/40"
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
              <div className="mt-5 flex items-baseline gap-2.5">
                <div className="text-5xl sm:text-6xl font-bold tracking-tight text-[#faf8f2] font-mono">
                  {todayTotalGB >= 1 ? todayTotalGB.toFixed(2) : (todayTotalBytes / (1024 * 1024)).toFixed(0)}
                </div>
                <span className="text-2xl font-bold text-[#d4cdbf]">
                  {todayTotalGB >= 1 ? "GB" : "MB"}
                </span>
              </div>

              <p className="text-xs text-[#8b93a3] mt-1.5">
                Total data transferred through Wi-Fi since 00:00 midnight
              </p>

              {/* Download vs Upload Split Bar */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-[#f4efe4] flex items-center gap-1">
                    <Download className="w-3.5 h-3.5 text-[#d4cdbf]" /> Download: {formatBytes(todayDlBytes)} ({dlSharePercent}%)
                  </span>
                  <span className="text-[#a2acbc] flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5 text-[#8b93a3]" /> Upload: {formatBytes(todayUlBytes)} ({ulSharePercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-[#161922] border border-[#a2acbc]/10 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${dlSharePercent}%` }}
                    className="bg-gradient-to-r from-[#d9d2c5] to-[#f4efe4] transition-all duration-500"
                  />
                  <div
                    style={{ width: `${ulSharePercent}%` }}
                    className="bg-[#485060] transition-all duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Daily Target Progress */}
            <div className="mt-6 pt-5 border-t border-[#a2acbc]/10">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[#8b93a3]">
                  Daily Plan Target ({targetDailyGB} GB)
                </span>
                <span className="font-mono font-bold text-[#faf8f2]">
                  {dailyPercent}% used • {(Math.max(0, targetDailyGB - todayTotalGB)).toFixed(2)} GB left
                </span>
              </div>
              <div className="h-2 w-full bg-[#161922] rounded-full overflow-hidden border border-[#a2acbc]/10">
                <div
                  style={{ width: `${Math.min(100, dailyPercent)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    dailyPercent >= 100
                      ? "bg-gradient-to-r from-[#8f3939] to-[#dc6c6c]"
                      : dailyPercent >= 80
                      ? "bg-gradient-to-r from-[#b38644] to-[#ebd19d]"
                      : "bg-gradient-to-r from-[#cfc7b7] to-[#f4efe4]"
                  }`}
                />
              </div>

              <div className="mt-3.5 flex items-center justify-between text-[11px] text-[#8b93a3]">
                <span>Peak Today: <span className="font-mono text-[#c5cbd6]">{formatSpeed(data?.todayUsage?.peakSpeedBps || 0)}</span></span>
                <button
                  onClick={() => {
                    if (data?.todayUsage) {
                      setSelectedDayForCalibrate(data.todayUsage);
                      setCalibrateDl((data.todayUsage.downloadBytes / (1024 * 1024 * 1024)).toFixed(2));
                      setCalibrateUl((data.todayUsage.uploadBytes / (1024 * 1024 * 1024)).toFixed(2));
                      setShowCalibrate(true);
                    }
                  }}
                  className="text-[#f4efe4] hover:underline underline-offset-4 decoration-[#a2acbc]/40 font-medium"
                >
                  Calibrate Baseline
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Real-time Speed Meter (4 Cols) */}
          <div className="lg:col-span-4 glass-panel rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#a8b0bf] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#f4efe4]" />
                  Real-Time Wi-Fi Speed
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#8b93a3]">
                  <span className="w-2 h-2 rounded-full bg-[#f4efe4] animate-pulse" />
                  Live Poll ({data?.settings?.autoRefreshIntervalSec || 3}s)
                </span>
              </div>

              {/* Speeds */}
              <div className="grid grid-cols-2 gap-3.5 mt-5">
                <div className="p-4 rounded-2xl bg-[#12151c] border border-[#a2acbc]/12">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#f4efe4]">
                    <Download className="w-3.5 h-3.5 text-[#d4cdbf]" />
                    <span>Download</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-[#faf8f2] tracking-tight">
                    {formatSpeed(data?.currentDlSpeedBps || 0)}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#12151c] border border-[#a2acbc]/12">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#a2acbc]">
                    <Upload className="w-3.5 h-3.5 text-[#8b93a3]" />
                    <span>Upload</span>
                  </div>
                  <div className="mt-2 text-2xl font-bold font-mono text-[#e4decb] tracking-tight">
                    {formatSpeed(data?.currentUlSpeedBps || 0)}
                  </div>
                </div>
              </div>

              {/* Live Mini Sparkline */}
              <div className="mt-5">
                <div className="text-[11px] text-[#8b93a3] mb-2 flex justify-between">
                  <span>Recent Activity Pulse</span>
                  <span>Last 25 cycles</span>
                </div>
                <div className="h-16 w-full bg-[#111319] rounded-xl p-1.5 flex items-end gap-1 overflow-hidden border border-[#a2acbc]/10">
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
                        className="flex-1 rounded-sm bg-gradient-to-t from-[#363d4d] to-[#f4efe4] transition-all duration-300"
                        style={{ height: `${heightPercent}%` }}
                        title={`${sp.time}: DL ${formatSpeed(sp.dlSpeedBps)} | UL ${formatSpeed(sp.ulSpeedBps)}`}
                      />
                    );
                  })}
                  {(!data?.speedHistory || data.speedHistory.length === 0) && (
                    <div className="w-full h-full flex items-center justify-center text-xs text-[#8b93a3]">
                      Collecting speed samples...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3.5 border-t border-[#a2acbc]/10 flex items-center justify-between text-xs text-[#8b93a3]">
              <span>Router Gateway</span>
              <a
                href={`http://${data?.settings?.routerIp || "192.168.0.1"}`}
                target="_blank"
                rel="noreferrer"
                className="text-[#f4efe4] hover:underline flex items-center gap-1 font-mono"
              >
                {data?.settings?.routerIp || "192.168.0.1"}
                <ExternalLink className="w-3 h-3 text-[#a2acbc]" />
              </a>
            </div>
          </div>

          {/* Card 3: 5G Signal & ODU Cell Telemetry (3 Cols) */}
          <div className="lg:col-span-3 glass-panel rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#a8b0bf] flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-[#f4efe4]" />
                  MTN Cell Telemetry
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1b202a] text-[#f4efe4] border border-[#a2acbc]/20 font-mono">
                  {data?.device?.networkType || "5G NSA"}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-[#a2acbc]/10">
                  <span className="text-[#8b93a3]">Signal (RSRP)</span>
                  <span className="font-mono font-semibold text-[#faf8f2]">
                    {data?.device?.rsrp || "- dBm"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#a2acbc]/10">
                  <span className="text-[#8b93a3]">5G Signal (NR RSRP)</span>
                  <span className="font-mono font-semibold text-[#f4efe4]">
                    {data?.device?.rsrp5g || "- dBm"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#a2acbc]/10">
                  <span className="text-[#8b93a3]">Active Band</span>
                  <span className="font-mono text-[#c2c8d4]">
                    5G n{data?.device?.currentBand5g || "78"} • LTE B{data?.device?.currentBand || "20"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-[#a2acbc]/10">
                  <span className="text-[#8b93a3]">Hardware / Board</span>
                  <span className="font-mono text-[#c2c8d4]">
                    {data?.device?.boardType || "ZLT X17U"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-[#8b93a3]">ODU Uptime</span>
                  <span className="font-mono text-[#c2c8d4] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#8b93a3]" />
                    {formatSecondsToUptime(data?.device?.uptimeSeconds || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-2xl bg-[#12151c] border border-[#a2acbc]/12 text-[11px] text-[#8b93a3] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#f4efe4] shrink-0" />
              <span>SIM IMSI: {data?.device?.imsi?.slice(-6) ? `***${data.device.imsi.slice(-6)}` : "Verified"}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Hourly Usage Distribution (Today) */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#faf8f2] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#f4efe4]" />
                Hourly Data Distribution (Today)
              </h2>
              <p className="text-xs text-[#8b93a3]">
                Data burned during each hour of the day (00:00 to 23:00)
              </p>
            </div>
            <div className="text-xs font-mono text-[#8b93a3]">
              Total Today: <span className="text-[#faf8f2] font-bold">{formatBytes(todayTotalBytes)}</span>
            </div>
          </div>

          {/* 24-Hour Bar Graph */}
          <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 items-end h-36 pt-4 border-b border-[#a2acbc]/10">
            {hoursList.map((h) => {
              const bucket = hourlyData[h];
              const dl = bucket?.downloadBytes || 0;
              const ul = bucket?.uploadBytes || 0;
              const total = dl + ul;
              const percent = maxHourBytes > 0 ? Math.max(6, (total / maxHourBytes) * 100) : 6;
              const isCurrentHour = mounted && new Date().getHours() === Number(h);

              return (
                <div key={h} className="flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none absolute -top-12 z-30 bg-[#12151c] text-[#f4efe4] text-[10px] py-1.5 px-2.5 rounded-lg border border-[#a2acbc]/25 whitespace-nowrap shadow-xl">
                    <p className="font-bold text-[#faf8f2]">{h}:00 - {h}:59</p>
                    <p className="text-[#a2acbc]">Total: {formatBytes(total)}</p>
                  </div>

                  <div
                    style={{ height: `${percent}%` }}
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      isCurrentHour
                        ? "bg-gradient-to-t from-[#d9d2c5] to-[#ffffff] shadow-lg shadow-white/10 ring-1 ring-[#f4efe4]/30"
                        : total > 0
                        ? "bg-gradient-to-t from-[#2a303d] to-[#6c7689] hover:to-[#f4efe4]"
                        : "bg-[#181c25]/50"
                    }`}
                  />
                  <span
                    className={`text-[9px] mt-2 font-mono ${
                      isCurrentHour ? "text-[#faf8f2] font-bold" : "text-[#6f7787]"
                    }`}
                  >
                    {h}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#8b93a3] mt-3">
            <span>00:00 (Midnight)</span>
            <span>12:00 (Noon)</span>
            <span>23:00 (Night)</span>
          </div>
        </div>

        {/* SECTION 3: Daily History & Comparison Table */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#faf8f2] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#f4efe4]" />
                Daily Usage History
              </h2>
              <p className="text-xs text-[#8b93a3]">
                Historical record of your Wi-Fi data consumption per calendar day
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/export?format=csv"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141720] border border-[#a2acbc]/15 text-xs text-[#c5cbd6] hover:text-[#f4efe4] hover:bg-[#1c202a] transition-all font-sans"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#d4cdbf]" />
                <span>Export CSV</span>
              </a>
              <a
                href="/api/export?format=json"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141720] border border-[#a2acbc]/15 text-xs text-[#c5cbd6] hover:text-[#f4efe4] hover:bg-[#1c202a] transition-all font-sans"
              >
                <FileJson className="w-3.5 h-3.5 text-[#a2acbc]" />
                <span>JSON</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#a2acbc]/15 text-[#8b93a3]">
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Download</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Upload</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Total Data</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Budget Status</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider">Peak Speed</th>
                  <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#a2acbc]/10">
                {(data?.dailyHistoryList || []).map((record) => {
                  const dayTotalGb = record.totalBytes / (1024 * 1024 * 1024);
                  const isExceeded = dayTotalGb > targetDailyGB;
                  const isToday = record.date === data?.todayUsage?.date;

                  return (
                    <tr
                      key={record.date}
                      className={`hover:bg-[#181b24]/50 transition-colors ${
                        isToday ? "bg-[#f4efe4]/5 border-l-2 border-[#f4efe4]" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-[#faf8f2] flex items-center gap-2">
                        {record.date}
                        {isToday && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4efe4]/15 text-[#f4efe4] border border-[#f4efe4]/25">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#e2ddd3] font-mono">
                        {formatBytes(record.downloadBytes)}
                      </td>
                      <td className="py-3.5 px-4 text-[#9aa2b1] font-mono">
                        {formatBytes(record.uploadBytes)}
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-[#faf8f2]">
                        {formatBytes(record.totalBytes)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full font-sans ${
                            isExceeded
                              ? "bg-[#351e22]/90 text-[#f7b6b6] border border-[#c46969]/40"
                              : "bg-[#1f2622]/90 text-[#d6e6d8] border border-[#77997a]/40"
                          }`}
                        >
                          {dayTotalGb.toFixed(2)} / {targetDailyGB} GB (
                          {Math.round((dayTotalGb / targetDailyGB) * 100)}%)
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#c5cbd6] font-mono">
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
                          className="text-xs text-[#8b93a3] hover:text-[#f4efe4] font-medium transition-colors"
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
          <div className="glass-panel rounded-3xl p-6 sm:p-7">
            <h3 className="text-base font-bold text-[#faf8f2] flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-[#f4efe4]" />
              MTN SIM Hardware Lifetime/Monthly Counter
            </h3>
            <p className="text-xs text-[#8b93a3] mb-4">
              Direct counter reported by the SIM card inside the router (cmd 205):
            </p>

            <div className="p-5 rounded-2xl bg-[#12151c] border border-[#a2acbc]/12 flex items-center justify-between">
              <div>
                <div className="text-xs text-[#8b93a3]">Total SIM Session/Month Flow</div>
                <div className="text-3xl font-bold font-mono text-[#faf8f2] mt-1">
                  {data?.wan?.monthlyTotalFlowMb
                    ? (data.wan.monthlyTotalFlowMb / 1024).toFixed(2)
                    : "0.00"}{" "}
                  <span className="text-lg text-[#d4cdbf]">GB</span>
                </div>
              </div>
              <div className="text-right text-xs text-[#8b93a3] space-y-1">
                <p>Uptime: <span className="text-[#c5cbd6] font-mono">{formatSecondsToUptime(data?.device?.uptimeSeconds || 0)}</span></p>
                <p className="text-[#a2acbc]">Synced with ODU</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-[#faf8f2] flex items-center gap-2 mb-2">
                <Sliders className="w-4 h-4 text-[#f4efe4]" />
                Daily Tracking Targets
              </h3>
              <p className="text-xs text-[#8b93a3] mb-4">
                Configure your daily threshold to avoid unexpected data depletion.
              </p>
            </div>

            <div className="flex items-center justify-between p-5 rounded-2xl bg-[#12151c] border border-[#a2acbc]/12">
              <div>
                <p className="text-xs text-[#8b93a3]">Daily Budget Limit</p>
                <p className="text-2xl font-bold font-mono text-[#faf8f2] mt-0.5">
                  {targetDailyGB} GB / Day
                </p>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="btn-ivory px-4 py-2 rounded-xl font-bold text-xs font-sans tracking-wide"
              >
                Change Target
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#a2acbc]/10 bg-[#0c0e12] py-6 text-center text-xs text-[#747c8c]">
        <p>MTN Broadband ODU Tracker • Running locally connected to {data?.settings?.routerIp || "192.168.0.1"}</p>
      </footer>

      {/* MODAL: Settings */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#12151d] border border-[#a2acbc]/20 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowSettings(false)}
              className="absolute top-5 right-5 text-[#8b93a3] hover:text-[#faf8f2] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-[#faf8f2] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#f4efe4]" />
              Tracker Settings
            </h3>
            <p className="text-xs text-[#8b93a3] mt-1">
              Adjust your router gateway IP and daily usage budget.
            </p>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                  Router IP Gateway
                </label>
                <input
                  type="text"
                  value={routerIp}
                  onChange={(e) => setRouterIp(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                  placeholder="192.168.0.1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                    Daily Budget (GB)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                    Monthly Budget (GB)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="10"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                  Auto-Refresh Interval (Seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={autoRefreshInterval}
                  onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                  Router Admin Password (Optional)
                </label>
                <input
                  type="password"
                  value={routerPassword}
                  onChange={(e) => setRouterPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                  placeholder="Only if you wish to query connected devices"
                />
                <span className="text-[10px] text-[#8b93a3] mt-1.5 block">
                  Leave blank if not needed; real-time data & byte tracking works without password!
                </span>
              </div>

              {settingsSuccess && (
                <div className="p-3 rounded-xl bg-[#1e2722] text-[#d6e6d8] border border-[#77997a]/40 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#d6e6d8]" />
                  Settings saved successfully!
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 rounded-xl bg-[#1a1e27] text-[#c5cbd6] hover:text-[#faf8f2] text-xs font-medium transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="btn-ivory px-5 py-2 rounded-xl text-xs font-bold"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#12151d] border border-[#a2acbc]/20 rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowCalibrate(false)}
              className="absolute top-5 right-5 text-[#8b93a3] hover:text-[#faf8f2] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-[#faf8f2] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#f4efe4]" />
              Adjust {selectedDayForCalibrate.date}
            </h3>
            <p className="text-xs text-[#8b93a3] mt-1">
              Synchronize or manually override recorded data usage for this day.
            </p>

            <form onSubmit={handleCalibrateSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                  Download (GB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calibrateDl}
                  onChange={(e) => setCalibrateDl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#c5cbd6] mb-1.5">
                  Upload (GB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={calibrateUl}
                  onChange={(e) => setCalibrateUl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0c0e13] border border-[#a2acbc]/20 text-[#faf8f2] text-xs font-mono focus:border-[#f4efe4] focus:ring-1 focus:ring-[#f4efe4]/30 outline-none transition-all"
                  required
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCalibrate(false)}
                  className="px-4 py-2 rounded-xl bg-[#1a1e27] text-[#c5cbd6] hover:text-[#faf8f2] text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-ivory px-4 py-2 rounded-xl text-xs font-bold"
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
