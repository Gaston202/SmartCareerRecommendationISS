import { NextRequest, NextResponse } from "next/server";
import { careersService } from "@/services/supabase";

// GET /api/careers - Get all careers
export async function GET() {
  try {
    const careers = await careersService.getAll();
    return NextResponse.json(careers);
  } catch (error) {
    console.error("Error fetching careers:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch careers";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
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

    const newCareer = await careersService.create({
      title: body.title,
      description: body.description,
      category: body.category,
      requiredSkills: body.requiredSkills || [],
      averageSalary: body.averageSalary || 0,
      growthRate: body.growthRate || 0,
      demandLevel: body.demandLevel || "medium",
    });

    return NextResponse.json(newCareer, { status: 201 });
  } catch (error) {
    console.error("Error creating career:", error);
    const message = error instanceof Error ? error.message : "Failed to create career";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
