import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const specialty = searchParams.get('specialty');

    let query = supabase
      .from('group_chats')
      .select(`
        *,
        mentors (*)
      `);

    if (specialty) {
      query = query.eq('specialty', specialty);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching group chats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group chats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('group_chats')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating group chat:', error);
    return NextResponse.json(
      { error: 'Failed to create group chat' },
      { status: 500 }
    );
  }
}
