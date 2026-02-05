import { NextRequest, NextResponse } from "next/server";
import { mockDashboardStats } from "@/lib/mockData";

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return NextResponse.json(mockDashboardStats);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
