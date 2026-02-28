import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get chat info
    const { data: chat, error: chatError } = await supabase
      .from('group_chats')
      .select(`
        *,
        mentors (*)
      `)
      .eq('id', id)
      .single();

    if (chatError) throw chatError;

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('group_chat_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (messagesError) throw messagesError;

    return NextResponse.json({
      chat,
      messages: messages?.reverse() || [],
    });
  } catch (error) {
    console.error('Error fetching group chat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group chat' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { id } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('group_chats')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating group chat:', error);
    return NextResponse.json(
      { error: 'Failed to update group chat' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { id } = params;

    const { error } = await supabase
      .from('group_chats')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting group chat:', error);
    return NextResponse.json(
      { error: 'Failed to delete group chat' },
      { status: 500 }
    );
  }
}
