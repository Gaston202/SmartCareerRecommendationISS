import { NextRequest, NextResponse } from "next/server";
import { recommendationsService } from "@/services/supabase";

// GET /api/recommendations/[id] - Get single recommendation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recommendation = await recommendationsService.getById(id);
    return NextResponse.json(recommendation);
  } catch (error) {
    console.error("Error fetching recommendation:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch recommendation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PUT /api/recommendations/[id] - Update recommendation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedRecommendation = await recommendationsService.update(id, body);
    return NextResponse.json(updatedRecommendation);
  } catch (error) {
    console.error("Error updating recommendation:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update recommendation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/recommendations/[id] - Delete recommendation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await recommendationsService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting recommendation:", error);
    const message = error instanceof Error ? error.message : "Failed to delete recommendation";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
