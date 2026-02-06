import { NextRequest, NextResponse } from "next/server";
import { skillsService } from "@/services/supabase";

// GET /api/skills - Get all skills
export async function GET() {
  try {
    const skills = await skillsService.getAll();
    return NextResponse.json(skills);
  } catch (error) {
    console.error("Error fetching skills:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch skills";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// POST /api/skills - Create new skill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields: name, category" },
        { status: 400 }
      );
    }

    const newSkill = await skillsService.create({
      name: body.name,
      category: body.category,
      description: body.description || "",
      relatedCareers: body.relatedCareers || [],
    });

    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    console.error("Error creating skill:", error);
    const message = error instanceof Error ? error.message : "Failed to create skill";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
