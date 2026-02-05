import { NextRequest, NextResponse } from "next/server";
import { careersService } from "@/services/supabase";

// GET /api/careers/[id] - Get single career
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const career = await careersService.getById(id);
    return NextResponse.json(career);
  } catch (error: any) {
    console.error("Error fetching career:", error);
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch career" },
      { status: 500 }
    );
  }
}

// PUT /api/careers/[id] - Update career
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const updatedCareer = await careersService.update(id, body);
    return NextResponse.json(updatedCareer);
  } catch (error: any) {
    console.error("Error updating career:", error);
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to update career" },
      { status: 500 }
    );
  }
}

// DELETE /api/careers/[id] - Delete career
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await careersService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting career:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete career" },
      { status: 500 }
    );
  }
}
