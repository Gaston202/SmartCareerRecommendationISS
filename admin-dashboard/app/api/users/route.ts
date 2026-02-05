import { NextRequest, NextResponse } from "next/server";
import { usersService } from "@/services/supabase";

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const users = await usersService.getAll();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.name) {
      return NextResponse.json(
        { error: "Missing required fields: email, name" },
        { status: 400 }
      );
    }

    // Create new user (password is optional, will be hashed if provided)
    const newUser = await usersService.create({
      email: body.email,
      name: body.name,
      role: body.role || "user",
      status: "active",
      avatar: body.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(body.name)}`,
      phone: body.phone,
      password: body.password, // Will be hashed in the service
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = newUser as any;
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}
