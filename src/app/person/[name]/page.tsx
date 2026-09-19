import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MY_NAME = '김홍래';

export default async function PersonPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ name: string }>, 
  searchParams: Promise<{ community?: string; all?: string }> 
}) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const { community, all } = await searchParams;
  const isMe = decodedName === MY_NAME;

  // 1. 해당 인물의 기도제목 조회
  let query = supabase
    .from('prayer_requests')
    .select('*')
    .eq('name', decodedName)
    .order('created_at', { ascending: false });

  // 본인(김홍래)이거나 all=true인 경우 모든 공동체 기록을 통합하여 시간순 조회
  if (!isMe && !all && community && community !== '전체') {
    query = query.eq('community', community);
  }

  const { data } = await query;

  // 2. 다른 사람일 경우에만 다른 공동체 기록 존재 여부 확인
  let otherCommunities: string[] = [];
  if (!isMe && community && community !== '전체') {
    const { data: otherData } = await supabase
      .from('prayer_requests')
      .select('community')
      .eq('name', decodedName)
      .neq('community', community);

    if (otherData && otherData.length > 0) {
      otherCommunities = Array.from(new Set(otherData.map(d => d.community)));
    }
  }

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-10 px-4 py-4 flex items-center gap-3">
        <Link href={`/?community=${encodeURIComponent(community || '전체')}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">{decodedName}</h1>
          {isMe ? (
            <span className="text-[11px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full shadow-sm">
              나 (전체 공동체 통합)
            </span>
          ) : (
            community && community !== '전체' && (
              <p className="text-xs text-blue-600 font-semibold">{community}</p>
            )
          )}
        </div>
      </header>

      <div className="p-4 space-y-6 mt-2">
        {/* 다른 사람일 때 다른 공동체 바로가기 배너 */}
        {!isMe && otherCommunities.length > 0 && (
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900">
            <div className="font-semibold mb-1">💡 다른 공동체 기록 확인</div>
            <div className="text-gray-600 mb-2">동일한 이름으로 등록된 다른 공동체 기록이 있습니다:</div>
            <div className="flex flex-wrap gap-1.5">
              {otherCommunities.map(c => (
                <Link
                  key={c}
                  href={`/person/${encodeURIComponent(decodedName)}?community=${encodeURIComponent(c)}`}
                  className="px-2.5 py-1 bg-white border border-blue-200 text-blue-600 font-medium rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                >
                  [{c}] 바로가기 →
                </Link>
              ))}
            </div>
          </div>
        )}

        {data?.map((req) => {
          const date = new Date(req.created_at);
          const monthYear = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
          
          return (
            <div key={req.id} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-40px] before:w-0.5 before:bg-gray-200 last:before:hidden">
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-100 border-4 border-white shadow-sm flex items-center justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              </div>
              
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-800 bg-white border border-gray-200 shadow-sm px-3 py-1 rounded-full">
                  {monthYear}
                </span>
                <span className="text-xs text-gray-400">
                  {date.toLocaleDateString('ko-KR', { day: 'numeric' })}일
                </span>
                {/* 본인이거나 전체보기일 때는 어떤 공동체에서 쓴 기도제목인지 뱃지 표시 */}
                {(isMe || !community || community === '전체') && (
                  <span className="text-[11px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md font-bold">
                    {req.community}
                  </span>
                )}
              </div>
              
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-3 whitespace-pre-wrap text-gray-700 leading-relaxed text-[15px]">
                {req.content}
              </div>
            </div>
          );
        })}

        {(!data || data.length === 0) && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
            기도제목 내역이 없습니다.
          </div>
        )}
      </div>
    </main>
  );
}
