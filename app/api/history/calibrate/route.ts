import { NextResponse } from "next/server";
import { recalibrateDay } from "@/lib/data-tracker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { date, downloadGB, uploadGB } = await request.json();
    if (!date || downloadGB === undefined) {
      return NextResponse.json({ success: false, error: "Missing date or downloadGB" }, { status: 400 });
    }
    const record = recalibrateDay(date, Number(downloadGB), Number(uploadGB || 0));
    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Recalibration failed" }, { status: 500 });
  }
}
