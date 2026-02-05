import { NextRequest, NextResponse } from "next/server";
import { mockRecommendations } from "@/lib/mockData";

// GET /api/recommendations - Get all recommendations
export async function GET(request: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return NextResponse.json(mockRecommendations);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 }
    );
  }
}
