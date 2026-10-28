import { NextResponse } from "next/server";
import { pingModal, isLiveConfigured } from "@/lib/ai";

export async function GET() {
  if (!isLiveConfigured()) {
    return NextResponse.json({
      configured: false,
      provider: "mock",
      message: "Modal not configured; using MockModelAdapter.",
    });
  }
  const result = await pingModal();
  return NextResponse.json({ provider: "modal", ...result });
}