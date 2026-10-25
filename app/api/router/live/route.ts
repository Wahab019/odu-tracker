import { NextResponse } from "next/server";
import { processRouterUpdate } from "@/lib/data-tracker";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await processRouterUpdate();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, error: error?.message || "Failed to update router data" },
      { status: 500 }
    );
  }
}
