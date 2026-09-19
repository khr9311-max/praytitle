import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import CommunityTabs from '@/components/CommunityTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // 항상 최신 데이터 패치

const DEFAULT_COMMUNITIES = [
  '가족', '26하GBS', '기도후원자', '26엘더조', 
  '26한사랑국리더십', '26한사랑국운영팀', '직장'
];

export const MY_NAME = '김홍래';

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
  
  // 사람별로 누적 이력 개수 및 최근 일자 그룹화
  // 단, '김홍래'(본인)는 어떤 공동체든 하나로 통합하여 표시
  const peopleMap = new Map();
  if (data) {
    for (const req of data) {
      const isMe = req.name === MY_NAME;
      const key = isMe ? `ME__${req.name}` : `${req.community}__${req.name}`;

      if (!peopleMap.has(key)) {
         peopleMap.set(key, {
            name: req.name,
            community: isMe ? (selectedCommunity === '전체' ? '모든 공동체 통합' : selectedCommunity) : req.community,
            lastUpdated: req.created_at,
            count: 1,
            isMe
         });
      } else {
         const item = peopleMap.get(key);
         item.count += 1;
         if (new Date(req.created_at) > new Date(item.lastUpdated)) {
            item.lastUpdated = req.created_at;
         }
      }
    }
  }

  // 본인('김홍래')을 가장 맨 앞에 강조 배치, 나머지는 최신순 정렬
  const peopleList = Array.from(peopleMap.values()).sort((a, b) => {
    if (a.isMe) return -1;
    if (b.isMe) return 1;
    return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
  });

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
        {peopleList.map(person => {
          const href = person.isMe
            ? `/person/${encodeURIComponent(person.name)}?all=true`
            : `/person/${encodeURIComponent(person.name)}?community=${encodeURIComponent(person.community)}`;

          return (
            <Link href={href} key={`${person.name}-${person.community}`}>
              <div className={`rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col h-full group ${
                person.isMe 
                  ? 'bg-gradient-to-br from-blue-50 to-white border-2 border-blue-400 ring-2 ring-blue-100/50' 
                  : 'bg-white border border-gray-200 hover:border-blue-400'
              }`}>
                 <div className="flex justify-between items-start mb-1.5">
                   <div className="flex items-center gap-1 max-w-[70%] truncate">
                     {person.isMe && (
                       <span className="text-[10px] bg-blue-600 text-white font-black px-1.5 py-0.2 rounded-md">
                         나
                       </span>
                     )}
                     <span className={`text-xs font-bold truncate ${person.isMe ? 'text-blue-700' : 'text-blue-600'}`}>
                       {person.community}
                     </span>
                   </div>
                   <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100 flex-shrink-0">
                     누적 {person.count}건
                   </span>
                 </div>

                 <div className="text-lg font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                   {person.name}
                   {person.isMe && <span className="text-sm">✨</span>}
                 </div>

                 <div className="mt-auto pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{new Date(person.lastUpdated).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    <span className="text-blue-500 font-medium group-hover:translate-x-0.5 transition-transform flex items-center">
                      이력 보기 →
                    </span>
                 </div>
              </div>
            </Link>
          );
        })}
        {peopleList.length === 0 && (
          <div className="col-span-2 text-center py-12 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
            등록된 기도제목이 없습니다.
          </div>
        )}
      </div>
    </main>
  );
}
