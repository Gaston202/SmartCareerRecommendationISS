import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface MentorSpecialty {
  specialty: string;
  is_primary: boolean;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { id } = params;
    const specialties = await request.json() as MentorSpecialty[];

    // Delete existing specialties
    const { error: deleteError } = await supabase
      .from('mentor_specialties')
      .delete()
      .eq('mentor_id', id);

    if (deleteError) throw deleteError;

    // Insert new specialties if any
    if (specialties.length > 0) {
      const { error: insertError } = await supabase
        .from('mentor_specialties')
        .insert(
          specialties.map((s) => ({
            mentor_id: id,
            specialty: s.specialty,
            is_primary: s.is_primary,
          }))
        );

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating mentor specialties:', error);
    return NextResponse.json(
      { error: 'Failed to update mentor specialties' },
      { status: 500 }
    );
  }
}
