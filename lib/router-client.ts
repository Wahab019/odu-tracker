import http from "http";
import crypto from "crypto";

export interface RouterDeviceInfo {
  boardType: string;
  realDevice: string;
  imei: string;
  imsi: string;
  deviceSn: string;
  networkType: string;
  rsrp: string;
  rsrp5g: string;
  sinr: string;
  signalLevel: string;
  currentBand: string;
  currentBand5g: string;
  uptimeSeconds: number;
  onlineDuration: string;
  systime: string;
}

export interface RouterWanStats {
  wanRxBytes: number;
  wanTxBytes: number;
  wanTotalBytes: number;
  flowDlMb: number;
  flowUlMb: number;
  monthlyTotalFlowMb: number;
  timestamp: number;
}

export interface RouterLiveResponse {
  connected: boolean;
  error?: string;
  device?: RouterDeviceInfo;
  wan?: RouterWanStats;
}

export interface ConnectedDevice {
  ip: string;
  mac: string;
  hostName: string;
  connectTime: string;
  interface: string;
}

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex");
}

function sha256(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function getSessionId(): string {
  return md5(Math.random().toString()) + md5(Math.random().toString());
}

export async function sendRouterCgi(
  routerIp: string,
  payload: Record<string, any>,
  timeoutMs = 4000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: routerIp || "192.168.0.1",
        port: 80,
        path: "/cgi-bin/http.cgi",
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          Referer: `http://${routerIp || "192.168.0.1"}/`,
          "User-Agent": "Mozilla/5.0 (MTN-ODU-Tracker)",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ raw: body });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Router connection timed out"));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Fetch live data from the router without needing authentication.
 * Commands 80, 133, and 205 give real-time byte counters and cell status.
 */
export async function fetchRouterLiveStats(routerIp = "192.168.0.1"): Promise<RouterLiveResponse> {
  try {
    const [res80, res133, res205, res113] = await Promise.allSettled([
      sendRouterCgi(routerIp, { cmd: 80, method: "GET", sessionId: "" }),
      sendRouterCgi(routerIp, { cmd: 133, method: "GET", sessionId: "" }),
      sendRouterCgi(routerIp, { cmd: 205, method: "GET", sessionId: "" }),
      sendRouterCgi(routerIp, { cmd: 113, method: "GET", sessionId: "" }),
    ]);

    const data80 = res80.status === "fulfilled" ? res80.value : {};
    const data133 = res133.status === "fulfilled" ? res133.value : {};
    const data205 = res205.status === "fulfilled" ? res205.value : {};
    const data113 = res113.status === "fulfilled" ? res113.value : {};

    if (!data133 && !data205 && !data80) {
      return { connected: false, error: "Failed to communicate with router" };
    }

    const rxBytes = Number(data133.wan_rx_bytes || data133.netWanRxBytes || 0);
    const txBytes = Number(data133.wan_tx_bytes || data133.netWanTxBytes || 0);
    const flowDlMb = Number(data205.flow_dl || 0);
    const flowUlMb = Number(data205.flow_ul || 0);
    const monTotalMb = Number(data205.mon_total_flow || 0);

    const device: RouterDeviceInfo = {
      boardType: data80.board_type || data113.board_type || "ZLT X17U",
      realDevice: data80.REAL_DEVICE_5G || data80.real_device || "MTN 5G ODU",
      imei: data133.module_imei || "",
      imsi: data133.IMSI || data80.IMSI || "",
      deviceSn: data133.device_sn || "",
      networkType: data133.network_type_str || data113.network_type_str || "5G",
      rsrp: data133.RSRP ? `${data133.RSRP} dBm` : "- dBm",
      rsrp5g: data133.RSRP_5G ? `${data133.RSRP_5G} dBm` : "",
      sinr: data133.SINR ? `${data133.SINR} dB` : "",
      signalLevel: String(data113.signal_lvl || data205.signal_lvl || "4"),
      currentBand: data133.currentband || data205.currentband || "",
      currentBand5g: data133.currentband_5g || data205.currentband_5g || "",
      uptimeSeconds: Number(data133.uptime || data113.uptime || 0),
      onlineDuration: data205.onlineDuration || "",
      systime: data205.systime || new Date().toISOString(),
    };

    const wan: RouterWanStats = {
      wanRxBytes: rxBytes,
      wanTxBytes: txBytes,
      wanTotalBytes: rxBytes + txBytes,
      flowDlMb,
      flowUlMb,
      monthlyTotalFlowMb: monTotalMb,
      timestamp: Date.now(),
    };

    return {
      connected: true,
      device,
      wan,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.message || "Cannot connect to router at " + routerIp,
    };
  }
}

/**
 * Optional login if user provided their router password.
 * Allows retrieving connected stations (phones, PCs, smart devices).
 */
export async function loginAndGetDevices(routerIp = "192.168.0.1", password?: string): Promise<{
  success: boolean;
  devices: ConnectedDevice[];
  error?: string;
}> {
  if (!password) {
    return { success: false, devices: [], error: "No password provided" };
  }

  try {
    // 1. Wakeup httpd
    await sendRouterCgi(routerIp, { cmd: 104, method: "GET", sessionId: "" });

    // 2. Login lock token
    const lock = await sendRouterCgi(routerIp, { cmd: 232, method: "GET", sessionId: "" });
    if (!lock?.token) {
      return { success: false, devices: [], error: "Failed to get router login challenge" };
    }

    // 3. Login
    const sessionId = getSessionId();
    const hashedPassword = sha256(lock.token + password);
    const loginRes = await sendRouterCgi(routerIp, {
      sessionId,
      username: "admin",
      passwd: hashedPassword,
      isAutoUpgrade: "1",
      method: "POST",
      cmd: 100,
      isCheckPasswd: "1",
    });

    if (loginRes?.login_fail === "fail" || !loginRes?.sessionId) {
      return { success: false, devices: [], error: "Invalid router admin password" };
    }

    const activeSessionId = loginRes.sessionId;

    // 4. Fetch connected devices (cmd 223: getAllDevice)
    const devicesRes = await sendRouterCgi(routerIp, {
      cmd: 223,
      method: "GET",
      sessionId: activeSessionId,
    });

    const devList: ConnectedDevice[] = [];
    if (devicesRes && Array.isArray(devicesRes.device_list)) {
      for (const d of devicesRes.device_list) {
        devList.push({
          ip: d.ip || d.ip_addr || "",
          mac: d.mac || d.mac_addr || "",
          hostName: d.host_name || d.name || "Device",
          connectTime: d.connect_time || "",
          interface: d.interface || (d.type === "1" ? "Wi-Fi 5G" : d.type === "0" ? "Wi-Fi 2.4G" : "LAN"),
        });
      }
    }

    // Logout cleanly
    try {
      await sendRouterCgi(routerIp, { cmd: 101, method: "POST", sessionId: activeSessionId });
    } catch {
      // ignore
    }

    return {
      success: true,
      devices: devList,
    };
  } catch (err: any) {
    return {
      success: false,
      devices: [],
      error: err?.message || "Failed to query connected devices",
    };
  }
}
