import { NextRequest, NextResponse } from "next/server";
import { coursesService } from "@/services/supabase";

// GET /api/courses - Get all courses
export async function GET(request: NextRequest) {
  try {
    const courses = await coursesService.getAll();
    return NextResponse.json(courses);
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

// POST /api/courses - Create new course
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.provider) {
      return NextResponse.json(
        { error: "Missing required fields: title, provider" },
        { status: 400 }
      );
    }

    const newCourse = await coursesService.create({
      title: body.title,
      provider: body.provider,
      description: body.description || "",
      skillsTargeted: body.skillsTargeted || [],
      duration: body.duration || "Unknown",
      level: body.level || "beginner",
      url: body.url || "",
      price: body.price,
      rating: body.rating,
    });

    return NextResponse.json(newCourse, { status: 201 });
  } catch (error: any) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
