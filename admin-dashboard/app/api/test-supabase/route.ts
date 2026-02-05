import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Test endpoint to verify Supabase connection
export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          error: "Missing environment variables",
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseAnonKey,
          url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "missing",
        },
        { status: 500 }
      );
    }

    // Try to create Supabase client
    const supabase = await createClient();

    // Try a simple query to test connection
    const { data, error } = await supabase.from("users").select("count").limit(1);

    if (error) {
      // Check if it's a table doesn't exist error
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        return NextResponse.json(
          {
            success: false,
            error: "Database tables not found",
            message: "Please run the SQL scripts from SUPABASE_SETUP.md to create the tables",
            errorCode: error.code,
            errorMessage: error.message,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Supabase query error",
          errorCode: error.code,
          errorMessage: error.message,
          details: error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Supabase connection successful!",
      url: supabaseUrl,
      hasData: !!data,
    });
  } catch (error: any) {
    console.error("Supabase test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to connect to Supabase",
        errorType: error.constructor.name,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

