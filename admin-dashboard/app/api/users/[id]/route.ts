import { NextRequest, NextResponse } from "next/server";
import { usersService } from "@/services/supabase";

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await usersService.getById(id);
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch user";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedUser = await usersService.update(id, body);
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === "PGRST116") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Failed to update user";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await usersService.delete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    const message = error instanceof Error ? error.message : "Failed to delete user";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
