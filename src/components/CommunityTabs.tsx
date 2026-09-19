'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Props {
  communities: string[];
  selectedCommunity: string;
}

export default function CommunityTabs({ communities, selectedCommunity }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommunityName.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCommunityName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || '추가 실패');
      } else {
        setNewCommunityName('');
        setIsModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`'${name}' 공동체를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/communities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || '삭제 실패');
      }
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-6 pb-2 px-2 overflow-x-auto scrollbar-hide">
        {communities.map((c) => (
          <Link
            key={c}
            href={`/?community=${encodeURIComponent(c)}`}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCommunity === c
                ? 'bg-blue-600 text-white shadow-md scale-105'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {c}
          </Link>
        ))}

        {/* 공동체 관리/추가 버튼 */}
        <button
          onClick={() => setIsModalOpen(true)}
          title="공동체 추가 및 관리"
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500 border border-gray-200 transition-colors shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </div>

      {/* 모달 창 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">공동체 관리</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* 새 공동체 추가 폼 */}
            <form onSubmit={handleAdd} className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                새 공동체 추가
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="예: 청년부, 찬양팀"
                  value={newCommunityName}
                  onChange={(e) => setNewCommunityName(e.target.value)}
                  className="flex-1 px-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={15}
                />
                <button
                  type="submit"
                  disabled={loading || !newCommunityName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  추가
                </button>
              </div>
              {errorMsg && <p className="text-xs text-red-500 mt-1.5">{errorMsg}</p>}
            </form>

            {/* 기존 공동체 목록 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                현재 등록된 공동체
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {communities
                  .filter((c) => c !== '전체')
                  .map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-700"
                    >
                      <span className="font-medium">{c}</span>
                      <button
                        onClick={() => handleDelete(c)}
                        title="삭제"
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors text-xs"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
