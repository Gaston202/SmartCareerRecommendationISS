import { NextRequest, NextResponse } from "next/server";
import { mockSkills } from "@/lib/mockData";

// GET /api/skills - Get all skills
export async function GET(request: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return NextResponse.json(mockSkills);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
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

    const newSkill = {
      id: `skill-${Date.now()}`,
      name: body.name,
      category: body.category,
      description: body.description || "",
      relatedCareers: body.relatedCareers || [],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(newSkill, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
}
