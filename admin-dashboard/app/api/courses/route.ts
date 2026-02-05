import { NextRequest, NextResponse } from "next/server";
import { mockCourses } from "@/lib/mockData";

// GET /api/courses - Get all courses
export async function GET(request: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return NextResponse.json(mockCourses);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
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

    const newCourse = {
      id: `course-${Date.now()}`,
      title: body.title,
      provider: body.provider,
      description: body.description || "",
      skillsTargeted: body.skillsTargeted || [],
      duration: body.duration || "Unknown",
      level: body.level || "beginner",
      url: body.url || "",
      price: body.price,
      rating: body.rating,
    };

    return NextResponse.json(newCourse, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create course" }, { status: 500 });
  }
}
