import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/services/auth-supabase";

// POST /api/auth/login - Authenticate user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Missing required fields: email, password" },
        { status: 400 }
      );
    }

    // Authenticate user
    const user = await authService.authenticate(body.email, body.password);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Return user without password
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        phone: user.phone,
      },
      message: "Login successful",
    });
  } catch (error: any) {
    console.error("Error during login:", error);
    return NextResponse.json(
      { error: error.message || "Failed to authenticate" },
      { status: 500 }
    );
  }
}

