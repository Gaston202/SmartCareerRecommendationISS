import { NextRequest, NextResponse } from "next/server";
import { usersService } from "@/services/supabase";

// GET /api/users - Get all users
export async function GET() {
  try {
    const users = await usersService.getAll();
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    return NextResponse.json(
      { error: message },
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = newUser as unknown as { password?: string; [key: string]: unknown };
    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
