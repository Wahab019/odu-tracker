just a data usage tracker

# MTN ODU Pulse • 5G Wi-Fi Daily Data Usage Tracker

A real-time telemetry and daily Wi-Fi data usage monitoring dashboard built specifically for **MTN Broadband 5G/4G Outdoor Units (ODU / CPE)** such as the **ZLT X17U / W154R PLUS**.

---

## ⚡ Features

- **Direct Router Telemetry**: Communicates directly with your MTN ODU at `192.168.0.1` via internal CGI endpoints—**no router login credentials required** for real-time byte counters!
- **Daily Usage Tracking**: Automatically records and aggregates download and upload volume per calendar day (`YYYY-MM-DD`).
- **Real-Time Speed Meter**: Live download & upload speeds with interactive activity pulse sparklines.
- **24-Hour Hourly Breakdown**: Interactive distribution chart showing which hours of the day burned the most data.
- **Budget Alerts & Limits**: Set custom daily budgets (e.g. 10 GB/day) with progress indicators and warnings.
- **Cell & Signal Health**: Displays real-time RSRP (-61 dBm), 5G NR RSRP, carrier aggregation bands (5G n78 + LTE B20+7), and router uptime.
- **Historical Comparison**: Day-by-day table with historical totals, peak speeds, and one-click CSV / JSON export.
- **Custom Baseline Calibration**: Easily adjust or recalibrate any day's counter to match your official MTN data balance.

---

## 🚀 Getting Started

The app is running locally on:
```
http://localhost:3001
```

To run manually:
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## ⚙️ Configuration

Click the **Settings** gear icon in the top right of the dashboard to configure:
- **Router IP**: Defaults to `192.168.0.1`.
- **Daily Budget Limit**: Set your target allowance in GB.
- **Polling Frequency**: Adjust update interval (default: 3 seconds).
- **Admin Password (Optional)**: If provided, allows querying connected Wi-Fi devices.
