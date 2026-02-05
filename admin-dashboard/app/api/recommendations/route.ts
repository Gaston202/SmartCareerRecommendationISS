import { NextRequest, NextResponse } from "next/server";
import { recommendationsService } from "@/services/supabase";

// GET /api/recommendations - Get all recommendations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const recommendations = userId
      ? await recommendationsService.getByUserId(userId)
      : await recommendationsService.getAll();

    return NextResponse.json(recommendations);
  } catch (error: any) {
    console.error("Error fetching recommendations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
