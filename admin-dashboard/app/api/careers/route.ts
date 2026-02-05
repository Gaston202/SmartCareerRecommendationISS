import { NextRequest, NextResponse } from "next/server";
import { mockCareers } from "@/lib/mockData";

// GET /api/careers - Get all careers
export async function GET(request: NextRequest) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return NextResponse.json(mockCareers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch careers" }, { status: 500 });
  }
}

// POST /api/careers - Create new career
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.description || !body.category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const newCareer = {
      id: `career-${Date.now()}`,
      title: body.title,
      description: body.description,
      category: body.category,
      requiredSkills: body.requiredSkills || [],
      averageSalary: body.averageSalary || 0,
      growthRate: body.growthRate || 0,
      demandLevel: body.demandLevel || "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(newCareer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create career" }, { status: 500 });
  }
}
