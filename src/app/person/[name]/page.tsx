import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PersonPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ name: string }>, 
  searchParams: Promise<{ community?: string }> 
}) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const { community } = await searchParams;

  let query = supabase
    .from('prayer_requests')
    .select('*')
    .eq('name', decodedName)
    .order('created_at', { ascending: false });

  if (community) {
    query = query.eq('community', community);
  }

  const { data, error } = await query;

  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-10 px-4 py-4 flex items-center gap-3">
        <Link href={`/?community=${community || '전체'}`} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{decodedName}</h1>
          {community && <p className="text-xs text-blue-600 font-semibold">{community}</p>}
        </div>
      </header>

      <div className="p-4 space-y-6 mt-4">
        {data?.map((req) => {
          const date = new Date(req.created_at);
          const monthYear = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
          
          return (
            <div key={req.id} className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-[-40px] before:w-0.5 before:bg-gray-200 last:before:hidden">
              <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-blue-100 border-4 border-white shadow-sm flex items-center justify-center z-10">
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              </div>
              
              <div className="mb-2">
                <span className="text-sm font-bold text-gray-800 bg-white border border-gray-200 shadow-sm px-3 py-1 rounded-full">
                  {monthYear}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {date.toLocaleDateString('ko-KR', { day: 'numeric' })}일
                </span>
              </div>
              
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mt-3 whitespace-pre-wrap text-gray-700 leading-relaxed text-[15px]">
                {req.content}
              </div>
            </div>
          );
        })}

        {(!data || data.length === 0) && (
          <div className="text-center py-10 text-gray-500">
            기도제목 내역이 없습니다.
          </div>
        )}
      </div>
    </main>
  );
}

