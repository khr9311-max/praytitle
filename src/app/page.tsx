import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // 항상 최신 데이터 패치

const COMMUNITIES = [
  '전체', '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ community?: string }> }) {
  const params = await searchParams;
  const selectedCommunity = params.community || '전체';

  let query = supabase.from('prayer_requests').select('name, community, created_at').order('created_at', { ascending: false });
  if (selectedCommunity !== '전체') {
    query = query.eq('community', selectedCommunity);
  }

  const { data, error } = await query;
  
  // 사람별로 가장 최근 데이터만 남기기 (이름 기준 그룹화)
  const peopleMap = new Map();
  if (data) {
    for (const req of data) {
      if (!peopleMap.has(req.name)) {
         peopleMap.set(req.name, {
            name: req.name,
            community: req.community,
            lastUpdated: req.created_at
         });
      }
    }
  }

  const peopleList = Array.from(peopleMap.values());

  return (
    <main className="max-w-md mx-auto p-4 pb-20 min-h-screen bg-gray-50">
      <header className="mb-6 pt-6 px-2">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">기도제목 아카이브 🙏</h1>
        <p className="text-sm text-gray-500 mt-1">공동체별로 기도제목을 확인하세요</p>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 px-2 scrollbar-hide">
        {COMMUNITIES.map(c => (
          <Link 
            key={c}
            href={`/?community=${c}`}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCommunity === c 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {c}
          </Link>
        ))}
      </div>

      {/* People Grid */}
      <div className="grid grid-cols-2 gap-3 px-2">
        {peopleList.map(person => (
          <Link href={`/person/${person.name}?community=${person.community}`} key={`${person.name}-${person.community}`}>
            <div className="border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col h-full">
               <div className="text-xs text-blue-600 font-bold mb-1">{person.community}</div>
               <div className="text-lg font-bold text-gray-800 mb-3">{person.name}</div>
               <div className="mt-auto text-[11px] text-gray-400 font-medium">
                  최근 업데이트: {new Date(person.lastUpdated).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
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
