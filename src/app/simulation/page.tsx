'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function SimulationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uploadedPaths, setUploadedPaths] = useState<{
    person: string;
    items: string[];
  } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<{
    success: boolean;
    previewUrl?: string;
    jobId?: string;
    duration_ms?: number;
    error?: string;
  } | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load data from session storage
  useEffect(() => {
    const storedPaths = sessionStorage.getItem('uploadedPaths');

    if (storedPaths) {
      try {
        setUploadedPaths(JSON.parse(storedPaths));
      } catch (err) {
        console.error('Failed to parse uploaded paths:', err);
        router.push('/upload');
      }
    } else {
      router.push('/upload');
    }
  }, [router]);

  const handleSimulation = async () => {
    if (!uploadedPaths) return;

    try {
      setIsSimulating(true);
      setSimulationResult(null);

      // Get auth token
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call simulation API
      const response = await fetch('/api/fit/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          personPath: uploadedPaths.person,
          itemPaths: uploadedPaths.items,
        }),
      });

      const result = await response.json();
      setSimulationResult(result);

      if (result.success && result.jobId) {
        // Redirect to result page
        router.push(`/result/${result.jobId}`);
      }
    } catch (error) {
      console.error('Simulation error:', error);
      let errorMessage = 'Simulation failed';

      if (error instanceof Error) {
        if (error.message.includes('Not authenticated')) {
          errorMessage = 'Please log in to start simulation';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage =
            'Network error. Please check your connection and try again';
        } else if (error.message.includes('permission denied')) {
          errorMessage = 'Access denied. Please check your permissions';
        } else {
          errorMessage = error.message;
        }
      }

      setSimulationResult({
        success: false,
        error: errorMessage,
      });
    } finally {
      setIsSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!user || !uploadedPaths) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            시뮬레이션 준비 완료
          </h1>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">
              선택된 설정
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="font-medium text-gray-700">인물 이미지:</span>
                <span className="ml-2 text-gray-600">
                  {uploadedPaths.person}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-700">
                  아이템 이미지:
                </span>
                <span className="ml-2 text-gray-600">
                  {uploadedPaths.items.length}개
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">
                🎨 AI 시뮬레이션
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Gemini AI를 사용하여 선택한 아이템으로 피팅 시뮬레이션을
                생성합니다.
              </p>
              <button
                onClick={handleSimulation}
                disabled={isSimulating}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSimulating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    시뮬레이션 생성 중...
                  </>
                ) : (
                  '시뮬레이션 시작하기'
                )}
              </button>
            </div>
          </div>

          {simulationResult && (
            <div className="mb-6">
              {simulationResult.success ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">
                    ✅ 시뮬레이션 완료
                  </h3>
                  <p className="text-sm text-green-700">
                    시뮬레이션이 성공적으로 완료되었습니다. 결과 페이지로
                    이동합니다...
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-medium text-red-800 mb-2">
                    ❌ 시뮬레이션 실패
                  </h3>
                  <p className="text-sm text-red-700">
                    {simulationResult.error ||
                      '알 수 없는 오류가 발생했습니다.'}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push('/upload')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              이미지 다시 선택
            </button>

            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
