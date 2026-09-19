import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_COMMUNITIES = [
  '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data, error } = await supabase
    .from('communities')
    .select('id, name')
    .order('id', { ascending: true });

  if (error || !data || data.length === 0) {
    return NextResponse.json({ communities: DEFAULT_COMMUNITIES.map((name, i) => ({ id: i + 1, name })) });
  }

  return NextResponse.json({ communities: data });
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    const cleanName = name?.trim();
    if (!cleanName) {
      return NextResponse.json({ error: '공동체 이름을 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('communities')
      .insert([{ name: cleanName }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: '이미 존재하는 공동체입니다.' }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, community: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) {
      return NextResponse.json({ error: '삭제할 공동체 이름이 없습니다.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('communities')
      .delete()
      .eq('name', name);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
