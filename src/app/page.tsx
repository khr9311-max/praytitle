import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import CommunityTabs from '@/components/CommunityTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // 항상 최신 데이터 패치

const DEFAULT_COMMUNITIES = [
  '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ community?: string }> }) {
  const params = await searchParams;
  const selectedCommunity = params.community || '전체';

  // 1. 등록된 공동체 목록 불러오기 (DB 또는 기본값)
  let communityList = ['전체', ...DEFAULT_COMMUNITIES];
  try {
    const { data: commData } = await supabase
      .from('communities')
      .select('name')
      .order('id', { ascending: true });

    if (commData && commData.length > 0) {
      communityList = ['전체', ...commData.map(c => c.name)];
    }
  } catch (err) {
    console.error('Failed to fetch communities:', err);
  }

  // 2. 기도제목 조회
  let query = supabase.from('prayer_requests').select('name, community, created_at').order('created_at', { ascending: false });
  if (selectedCommunity !== '전체') {
    query = query.eq('community', selectedCommunity);
  }

  const { data } = await query;
  
  // (공동체 + 이름) 기준으로 그룹화하여 동명이인 또는 공동체별 인물 분리
  const peopleMap = new Map();
  if (data) {
    for (const req of data) {
      const key = `${req.community}__${req.name}`;
      if (!peopleMap.has(key)) {
         peopleMap.set(key, {
            name: req.name,
            community: req.community,
            lastUpdated: req.created_at,
            count: 1
         });
      } else {
         peopleMap.get(key).count += 1;
      }
    }
  }

  const peopleList = Array.from(peopleMap.values());

  return (
    <main className="max-w-md mx-auto p-4 pb-20 min-h-screen bg-gray-50">
      <header className="mb-6 pt-6 px-2">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">기도제목 아카이브 🙏</h1>
        <p className="text-sm text-gray-500 mt-1">카드를 누르면 그동안 쌓인 모든 기도제목 이력을 볼 수 있습니다.</p>
      </header>

      {/* Tabs with Community Management Modal */}
      <CommunityTabs communities={communityList} selectedCommunity={selectedCommunity} />

      {/* People Grid */}
      <div className="grid grid-cols-2 gap-3 px-2">
        {peopleList.map(person => (
          <Link href={`/person/${encodeURIComponent(person.name)}?community=${encodeURIComponent(person.community)}`} key={`${person.name}-${person.community}`}>
            <div className="border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all bg-white flex flex-col h-full hover:border-blue-400 group">
               <div className="flex justify-between items-start mb-1.5">
                 <span className="text-xs text-blue-600 font-bold truncate max-w-[70%]">{person.community}</span>
                 <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100 flex-shrink-0">
                   누적 {person.count}건
                 </span>
               </div>
               <div className="text-lg font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors">{person.name}</div>
               <div className="mt-auto pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>{new Date(person.lastUpdated).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                  <span className="text-blue-500 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                    이력 보기 →
                  </span>
               </div>
            </div>
          </Link>
        ))}
        {peopleList.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
            등록된 기도제목이 없습니다.
          </div>
        )}
      </div>
    </main>
  );
}
