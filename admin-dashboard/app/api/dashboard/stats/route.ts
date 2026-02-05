import { NextRequest, NextResponse } from "next/server";
import { dashboardService } from "@/services/supabase";

// GET /api/dashboard/stats - Get dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const stats = await dashboardService.getStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
