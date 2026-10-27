import type { Metadata } from "next";
import { Eczar, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const eczar = Eczar({
  variable: "--font-eczar",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MTN ODU Pulse • 5G WiFi Daily Data Tracker",
  description: "Real-time telemetry and daily data usage monitor for MTN Broadband 5G/4G Outdoor Units (ZLT X17U).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${eczar.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#0b0d10] text-[#ede7dc] selection:bg-[#f4efe4] selection:text-[#0b0d10]"
      >
        {children}
      </body>
    </html>
  );
}
