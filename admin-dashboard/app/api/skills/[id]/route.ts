import { NextRequest, NextResponse } from "next/server";
import { skillsService } from "@/services/supabase";

// GET /api/skills/[id] - Get single skill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const skill = await skillsService.getById(id);
    return NextResponse.json(skill);
  } catch (error) {
    console.error("Error fetching skill:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch skill";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PUT /api/skills/[id] - Update skill
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedSkill = await skillsService.update(id, body);
    return NextResponse.json(updatedSkill);
  } catch (error) {
    console.error("Error updating skill:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update skill";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/skills/[id] - Delete skill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await skillsService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting skill:", error);
    const message = error instanceof Error ? error.message : "Failed to delete skill";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
