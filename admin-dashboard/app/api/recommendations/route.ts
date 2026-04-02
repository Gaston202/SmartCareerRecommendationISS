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

    // NEW: Call Python backend to generate recommendations via ai_v2 pipeline
    const backendUrl = process.env.PYTHON_BACKEND_URL || "http://192.168.0.9:8000";
    
    console.log("[api/recommendations] Calling backend at:", backendUrl);

    const backendResponse = await fetch(`${backendUrl}/recommend-careers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: body.userId,
        cv_text: body.cvText || undefined,
        user_profile: body.userProfile || undefined,
        preferences: body.preferences || undefined,
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error("[api/recommendations] Backend error:", errorData);
      throw new Error(errorData.error || `Backend returned ${backendResponse.status}`);
    }

    const backendResult = await backendResponse.json();
    
    if (!backendResult.success || !backendResult.data) {
      console.error("[api/recommendations] Invalid backend response format:", backendResult);
      throw new Error("Invalid backend response format");
    }

    const backendOutput = backendResult.data;

    // Transform backend response to storage format
    const recommendationData = {
      userId: body.userId,
      careers: backendOutput.recommended_careers.map((career: any) => ({
        id: career.id || career.title?.toLowerCase().replace(/\s+/g, "-"),
        title: career.title,
        match_score: career.match_score,
        required_skills: career.required_skills || [],
        reasoning: career.reasoning || "",
      })),
      courses: body.courses || [],  // Keep existing courses if provided
      matchScore: Math.round((backendOutput.confidence_score || 0.7) * 100),
      status: "completed",
    };

    console.log("[api/recommendations] Storing recommendation from ai_v2:", {
      userId: body.userId,
      careersCount: recommendationData.careers.length,
      matchScore: recommendationData.matchScore,
      confidence_score: backendOutput.confidence_score,
    });

    // Store the recommendation in database
    const newRecommendation = await recommendationsService.create(recommendationData);

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
