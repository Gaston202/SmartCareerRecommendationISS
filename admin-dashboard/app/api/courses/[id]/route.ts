import { NextRequest, NextResponse } from "next/server";
import { coursesService } from "@/services/supabase";

// GET /api/courses/[id] - Get single course
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const course = await coursesService.getById(id);
    return NextResponse.json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch course";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PUT /api/courses/[id] - Update course
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedCourse = await coursesService.update(id, body);
    return NextResponse.json(updatedCourse);
  } catch (error) {
    console.error("Error updating course:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update course";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id] - Delete course
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await coursesService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting course:", error);
    const message = error instanceof Error ? error.message : "Failed to delete course";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
