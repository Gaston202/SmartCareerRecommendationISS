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
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch recommendations";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// POST /api/recommendations - Create new recommendation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    const newRecommendation = await recommendationsService.create({
      userId: body.userId,
      careers: body.careers || [],
      courses: body.courses || [],
      matchScore: body.matchScore || 0,
      status: body.status || "pending",
    });

    return NextResponse.json(newRecommendation, { status: 201 });
  } catch (error) {
    console.error("Error creating recommendation:", error);
    const message = error instanceof Error ? error.message : "Failed to create recommendation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
