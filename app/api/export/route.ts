import { NextResponse } from "next/server";
import { getExportData } from "@/lib/data-tracker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") === "json" ? "json" : "csv";

  const content = getExportData(format);

  if (format === "json") {
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mtn_wifi_usage_${Date.now()}.json"`,
      },
    });
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mtn_wifi_usage_${Date.now()}.csv"`,
    },
  });
}
