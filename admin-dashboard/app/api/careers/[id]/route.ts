import { NextRequest, NextResponse } from "next/server";
import { mockCareers } from "@/lib/mockData";

// GET /api/careers/[id] - Get single career
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const career = mockCareers.find((c) => c.id === id);

    if (!career) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    return NextResponse.json(career);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch career" }, { status: 500 });
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
    const careerIndex = mockCareers.findIndex((c) => c.id === id);

    if (careerIndex === -1) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    const updatedCareer = {
      ...mockCareers[careerIndex],
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(updatedCareer);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update career" }, { status: 500 });
  }
}

// DELETE /api/careers/[id] - Delete career
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const careerIndex = mockCareers.findIndex((c) => c.id === id);

    if (careerIndex === -1) {
      return NextResponse.json({ error: "Career not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete career" }, { status: 500 });
  }
}
