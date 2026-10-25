import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/data-tracker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = updateSettings(body);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update settings" },
      { status: 400 }
    );
  }
}
