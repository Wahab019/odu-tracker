import fs from "fs";
import path from "path";
import { RouterWanStats, RouterDeviceInfo, fetchRouterLiveStats, loginAndGetDevices, ConnectedDevice } from "./router-client";

export interface HourlyUsage {
  downloadBytes: number;
  uploadBytes: number;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  peakSpeedBps: number;
  samplesCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  hourly: Record<string, HourlyUsage>; // "00" to "23"
}

export interface SpeedPoint {
  time: string;
  dlSpeedBps: number;
  ulSpeedBps: number;
}

export interface TrackerSettings {
  routerIp: string;
  routerPassword?: string;
  dailyBudgetGB: number;
  monthlyBudgetGB: number;
  billingCycleDay: number; // e.g. 1
  autoRefreshIntervalSec: number;
}

export interface TrackerStore {
  settings: TrackerSettings;
  lastSnapshot?: {
    wanRxBytes: number;
    wanTxBytes: number;
    timestamp: number;
  };
  dailyHistory: Record<string, DayRecord>; // Key: YYYY-MM-DD
  speedHistory: SpeedPoint[]; // last 30 readings for real-time speed chart
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "tracker_store.json");

const DEFAULT_SETTINGS: TrackerSettings = {
  routerIp: "192.168.0.1",
  dailyBudgetGB: 10,
  monthlyBudgetGB: 150,
  billingCycleDay: 1,
  autoRefreshIntervalSec: 3,
};

function ensureStore(): TrackerStore {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORE_PATH)) {
    const initial: TrackerStore = {
      settings: DEFAULT_SETTINGS,
      dailyHistory: {},
      speedHistory: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!data.settings) data.settings = DEFAULT_SETTINGS;
    if (!data.dailyHistory) data.dailyHistory = {};
    if (!data.speedHistory) data.speedHistory = [];
    return data;
  } catch {
    const fallback: TrackerStore = {
      settings: DEFAULT_SETTINGS,
      dailyHistory: {},
      speedHistory: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

function saveStore(store: TrackerStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving tracker store:", err);
  }
}

function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentHourKey(): string {
  const now = new Date();
  return String(now.getHours()).padStart(2, "0");
}

export interface LiveTrackerResult {
  connected: boolean;
  error?: string;
  settings: TrackerSettings;
  device?: RouterDeviceInfo;
  wan?: RouterWanStats;
  currentDlSpeedBps: number;
  currentUlSpeedBps: number;
  todayUsage: DayRecord;
  monthUsageBytes: number;
  dailyHistoryList: DayRecord[];
  speedHistory: SpeedPoint[];
  connectedDevices?: ConnectedDevice[];
}

export async function processRouterUpdate(): Promise<LiveTrackerResult> {
  const store = ensureStore();
  const routerIp = store.settings.routerIp || "192.168.0.1";

  const live = await fetchRouterLiveStats(routerIp);

  const todayKey = getTodayKey();
  const hourKey = getCurrentHourKey();

  if (!store.dailyHistory[todayKey]) {
    store.dailyHistory[todayKey] = {
      date: todayKey,
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
      peakSpeedBps: 0,
      samplesCount: 0,
      firstTimestamp: Date.now(),
      lastTimestamp: Date.now(),
      hourly: {},
    };
  }

  const todayRecord = store.dailyHistory[todayKey];
  if (!todayRecord.hourly[hourKey]) {
    todayRecord.hourly[hourKey] = { downloadBytes: 0, uploadBytes: 0 };
  }

  let currentDlSpeed = 0;
  let currentUlSpeed = 0;

  if (live.connected && live.wan) {
    const curRx = live.wan.wanRxBytes;
    const curTx = live.wan.wanTxBytes;
    const nowTs = live.wan.timestamp;

    if (store.lastSnapshot) {
      const prevRx = store.lastSnapshot.wanRxBytes;
      const prevTx = store.lastSnapshot.wanTxBytes;
      const deltaSec = Math.max(1, (nowTs - store.lastSnapshot.timestamp) / 1000);

      // Handle router reboot or counter rollover
      let deltaRx = 0;
      let deltaTx = 0;

      if (curRx >= prevRx) {
        deltaRx = curRx - prevRx;
      } else {
        // Router rebooted or WAN reset: current reading is the delta
        deltaRx = curRx;
      }

      if (curTx >= prevTx) {
        deltaTx = curTx - prevTx;
      } else {
        deltaTx = curTx;
      }

      // Avoid anomalous spikes if interval was huge (> 10 mins disconnected)
      if (deltaSec < 600) {
        currentDlSpeed = deltaRx / deltaSec;
        currentUlSpeed = deltaTx / deltaSec;

        todayRecord.downloadBytes += deltaRx;
        todayRecord.uploadBytes += deltaTx;
        todayRecord.totalBytes = todayRecord.downloadBytes + todayRecord.uploadBytes;

        todayRecord.hourly[hourKey].downloadBytes += deltaRx;
        todayRecord.hourly[hourKey].uploadBytes += deltaTx;

        const totalSpeed = currentDlSpeed + currentUlSpeed;
        if (totalSpeed > todayRecord.peakSpeedBps) {
          todayRecord.peakSpeedBps = totalSpeed;
        }
      }
    } else {
      // First snapshot after starting the tracker: initialize today's baseline with current flow or minimal delta
      // If todayRecord is empty and router has flow_dl/flow_ul, initialize with router's day/session flow
      if (todayRecord.totalBytes === 0 && live.wan.flowDlMb > 0) {
        todayRecord.downloadBytes = Math.round(live.wan.flowDlMb * 1024 * 1024);
        todayRecord.uploadBytes = Math.round(live.wan.flowUlMb * 1024 * 1024);
        todayRecord.totalBytes = todayRecord.downloadBytes + todayRecord.uploadBytes;
        todayRecord.hourly[hourKey].downloadBytes = todayRecord.downloadBytes;
        todayRecord.hourly[hourKey].uploadBytes = todayRecord.uploadBytes;
      }
    }

    todayRecord.samplesCount += 1;
    todayRecord.lastTimestamp = nowTs;

    store.lastSnapshot = {
      wanRxBytes: curRx,
      wanTxBytes: curTx,
      timestamp: nowTs,
    };

    // Update real-time speed history (keep last 25 data points)
    const timeLabel = new Date().toLocaleTimeString("en-US", { hour12: false });
    store.speedHistory.push({
      time: timeLabel,
      dlSpeedBps: Math.round(currentDlSpeed),
      ulSpeedBps: Math.round(currentUlSpeed),
    });
    if (store.speedHistory.length > 25) {
      store.speedHistory = store.speedHistory.slice(-25);
    }

    saveStore(store);
  }

  // Calculate current month's total usage
  const currentMonthPrefix = todayKey.substring(0, 7); // YYYY-MM
  let monthUsageBytes = 0;
  Object.keys(store.dailyHistory).forEach((key) => {
    if (key.startsWith(currentMonthPrefix)) {
      monthUsageBytes += store.dailyHistory[key].totalBytes;
    }
  });

  // Convert dailyHistory object to sorted list (newest first)
  const dailyHistoryList = Object.values(store.dailyHistory).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Optional: check connected devices if password configured
  let connectedDevices: ConnectedDevice[] | undefined = undefined;
  if (store.settings.routerPassword) {
    try {
      const devRes = await loginAndGetDevices(routerIp, store.settings.routerPassword);
      if (devRes.success) {
        connectedDevices = devRes.devices;
      }
    } catch {
      // ignore
    }
  }

  return {
    connected: live.connected,
    error: live.error,
    settings: store.settings,
    device: live.device,
    wan: live.wan,
    currentDlSpeedBps: Math.round(currentDlSpeed),
    currentUlSpeedBps: Math.round(currentUlSpeed),
    todayUsage: todayRecord,
    monthUsageBytes,
    dailyHistoryList,
    speedHistory: store.speedHistory,
    connectedDevices,
  };
}

export function updateSettings(newSettings: Partial<TrackerSettings>): TrackerSettings {
  const store = ensureStore();
  store.settings = { ...store.settings, ...newSettings };
  saveStore(store);
  return store.settings;
}

export function recalibrateDay(date: string, downloadGB: number, uploadGB: number): DayRecord {
  const store = ensureStore();
  const dlBytes = Math.round(downloadGB * 1024 * 1024 * 1024);
  const ulBytes = Math.round(uploadGB * 1024 * 1024 * 1024);

  store.dailyHistory[date] = {
    date,
    downloadBytes: dlBytes,
    uploadBytes: ulBytes,
    totalBytes: dlBytes + ulBytes,
    peakSpeedBps: store.dailyHistory[date]?.peakSpeedBps || 0,
    samplesCount: (store.dailyHistory[date]?.samplesCount || 0) + 1,
    firstTimestamp: store.dailyHistory[date]?.firstTimestamp || Date.now(),
    lastTimestamp: Date.now(),
    hourly: store.dailyHistory[date]?.hourly || {},
  };

  saveStore(store);
  return store.dailyHistory[date];
}

export function getExportData(format: "csv" | "json"): string {
  const store = ensureStore();
  const list = Object.values(store.dailyHistory).sort((a, b) => b.date.localeCompare(a.date));

  if (format === "json") {
    return JSON.stringify(list, null, 2);
  }

  // CSV format
  const headers = ["Date", "Download (MB)", "Upload (MB)", "Total (MB)", "Download (GB)", "Upload (GB)", "Total (GB)", "Peak Speed (MB/s)"];
  const rows = list.map((item) => {
    const dlMb = (item.downloadBytes / (1024 * 1024)).toFixed(2);
    const ulMb = (item.uploadBytes / (1024 * 1024)).toFixed(2);
    const totMb = (item.totalBytes / (1024 * 1024)).toFixed(2);
    const dlGb = (item.downloadBytes / (1024 * 1024 * 1024)).toFixed(3);
    const ulGb = (item.uploadBytes / (1024 * 1024 * 1024)).toFixed(3);
    const totGb = (item.totalBytes / (1024 * 1024 * 1024)).toFixed(3);
    const peakMb = (item.peakSpeedBps / (1024 * 1024)).toFixed(2);
    return [item.date, dlMb, ulMb, totMb, dlGb, ulGb, totGb, peakMb].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
