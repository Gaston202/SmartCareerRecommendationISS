import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get('specialty');
    const status = searchParams.get('status') || 'active';

    let query = supabase
      .from('mentors')
      .select(`
        *,
        mentor_specialties (*),
        mentor_reviews (count)
      `)
      .eq('status', status);

    if (specialty) {
      // Filter by specialty requires joining with mentor_specialties
      const { data, error } = await supabase
        .from('mentor_specialties')
        .select('mentor_id')
        .eq('specialty', specialty);

      if (error) throw error;

      const mentorIds = data.map((m) => m.mentor_id);
      query = query.in('id', mentorIds);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching mentors:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mentors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('mentors')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating mentor:', error);
    return NextResponse.json(
      { error: 'Failed to create mentor' },
      { status: 500 }
    );
  }
}
