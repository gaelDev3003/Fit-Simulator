'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase';

interface JobData {
  id: string;
  user_id: string;
  person_path: string;
  item_paths: string[];
  pose_id?: string;
  preview_path: string;
  duration_ms: number;
  status: string;
  created_at: string;
}


export default function ResultPage() {
  const params = useParams();
  const jobId = params.job_id as string;

  const [jobData, setJobData] = useState<JobData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.getSession();

      if (sessionError || !session) {
        setError('Please log in to view this simulation result.');
        return;
      }

      console.log('Session found:', !!session, 'User ID:', session?.user?.id);

      // Use server API to get job data instead of direct client access
      const response = await fetch(`/api/fit/job/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view this simulation result.');
        } else if (response.status === 403) {
          setError(
            'Access denied. You can only view your own simulation results.'
          );
        } else if (response.status === 404) {
          setError('Job not found');
        } else {
          setError('Failed to load result data');
        }
        return;
      }

      const data = await response.json();
      if (!data.success || !data.job) {
        setError('Job not found or access denied');
        return;
      }

      setJobData(data.job);

      // Use signed URL from job API response
      if (data.signedUrl) {
        setPreviewUrl(data.signedUrl);
        setExpiresAt(data.expiresAt);
      } else if (data.job.preview_path) {
        setError('Failed to load preview image');
        return;
      }
    } catch (error) {
      console.error('Error loading job data:', error);
      setError('Failed to load result data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!jobData) return;

    try {
      // Get current session for authentication
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.getSession();

      if (sessionError || !session) {
        setError('Please log in to download this result.');
        return;
      }

      // Call download API
      const response = await fetch(`/api/fit/download/${jobData.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to download this result.');
        } else if (response.status === 403) {
          setError('Access denied. You can only download your own results.');
        } else if (response.status === 404) {
          setError('File not found.');
        } else {
          setError('Failed to download file.');
        }
        return;
      }

      // Get the blob data
      const blob = await response.blob();

      // Generate filename with timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `AI피팅시뮬레이션_${timestamp}.webp`;

      // Detect browser and use appropriate download method
      const userAgent = navigator.userAgent.toLowerCase();

      // Try File System Access API for Chrome (with better error handling)
      if (userAgent.includes('chrome') && !userAgent.includes('edg') && 'showSaveFilePicker' in window) {
        try {
          const fileHandle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [
              {
                description: 'WebP 이미지 파일',
                accept: {
                  'image/webp': ['.webp'],
                },
              },
            ],
          });

          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          alert(
            `파일이 성공적으로 저장되었습니다!\n파일명: ${filename}\n저장 위치: 사용자가 선택한 폴더`
          );
          return;
        } catch (error: any) {
          if (error.name !== 'AbortError') {
            console.error('File System Access API error:', error);
            // Fallback to traditional download
          }
        }
      }

      // Use traditional download method for all browsers
      downloadFile(blob, filename);
    } catch (error) {
      console.error('Failed to download file:', error);
      setError('Failed to download file.');
    }
  };

  const copyToClipboardFallback = async (text: string): Promise<boolean> => {
    try {
      // Create a temporary textarea element
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // Select and copy the text
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      return successful;
    } catch (error) {
      console.error('Fallback copy failed:', error);
      return false;
    }
  };

  const downloadFile = (blob: Blob, filename: string) => {
    // Detect browser for better user experience
    const userAgent = navigator.userAgent.toLowerCase();

    // Create download link with user-friendly filename
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    // Add to DOM, click, and remove
    document.body.appendChild(link);

    // Use a small delay to ensure the link is ready
    setTimeout(() => {
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Show browser-specific success message
      let message = `다운로드가 시작되었습니다!\n\n파일명: ${filename}\n\n`;

      if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        message += `Safari에서는 다운로드 폴더에 저장됩니다.\n저장 위치를 변경하려면 Safari 설정에서 다운로드 폴더를 변경하세요.`;
      } else if (userAgent.includes('firefox')) {
        message += `Firefox에서는 다운로드 폴더에 저장됩니다.\n저장 위치를 변경하려면 Firefox 설정에서 다운로드 폴더를 변경하세요.`;
      } else if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        message += `Chrome에서는 다운로드 폴더에 저장됩니다.\n저장 위치를 변경하려면 Chrome 설정에서 다운로드 폴더를 변경하세요.`;
      } else {
        message += `브라우저의 다운로드 폴더에 저장됩니다.\n저장 위치를 변경하려면 브라우저 설정에서 다운로드 폴더를 변경하세요.`;
      }

      alert(message);
    }, 100);
  };

  const handleShare = async () => {
    if (!jobData) return;
    setSharing(true);
    try {
      // Get current session for authentication
      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.getSession();

      if (sessionError || !session) {
        setError('Please log in to share this result.');
        return;
      }

      // Call /api/fit/share to get signed URL
      const response = await fetch('/api/fit/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ job_id: jobData.id }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to share this result.');
        } else if (response.status === 403) {
          setError('Access denied. You can only share your own results.');
        } else {
          setError('Failed to create share link.');
        }
        return;
      }

      const data = await response.json();
      if (!data.success || !data.signedUrl) {
        setError('Failed to create share link.');
        return;
      }

      // Detect browser and use appropriate sharing method
      const userAgent = navigator.userAgent.toLowerCase();

      setShareUrl(data.signedUrl);

      // Update expiration time if provided
      if (data.expiresAt) {
        setExpiresAt(data.expiresAt);
      }

      // Try clipboard API with Safari-specific handling
      let clipboardSuccess = false;

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // For Safari, we need to ensure the clipboard API works
          if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            // Safari requires a more careful approach
            try {
              await navigator.clipboard.writeText(data.signedUrl);
              clipboardSuccess = true;
              alert('공유 링크가 클립보드에 복사되었습니다!');
            } catch (safariError) {
              console.log('Safari clipboard failed, trying fallback method');
              // Use the traditional method for Safari
              clipboardSuccess = await copyToClipboardFallback(data.signedUrl);
              if (clipboardSuccess) {
                alert('공유 링크가 클립보드에 복사되었습니다!');
              }
            }
          } else {
            // For other browsers
            await navigator.clipboard.writeText(data.signedUrl);
            clipboardSuccess = true;
            alert('Share link copied to clipboard!');
          }
        } else {
          throw new Error('Clipboard API not supported');
        }
      } catch (clipboardError) {
        console.error('Clipboard error:', clipboardError);

        // Try fallback method
        clipboardSuccess = await copyToClipboardFallback(data.signedUrl);

        if (clipboardSuccess) {
          if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            alert('공유 링크가 클립보드에 복사되었습니다!');
          } else {
            alert('Share link copied to clipboard!');
          }
        } else {
          // Final fallback: show the URL in a text input for easy copying
          if ((userAgent.includes('safari') && !userAgent.includes('chrome')) || userAgent.includes('firefox')) {
            alert(
              `공유 링크가 생성되었습니다!\n\n아래 링크를 복사하여 공유하세요:\n\n${data.signedUrl}\n\n(링크가 자동으로 복사되지 않았습니다. 수동으로 복사해주세요.)`
            );
          } else {
            alert(
              `Share link created! Please copy this URL:\n\n${data.signedUrl}`
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to create share link:', error);
      setError('Failed to create share link.');
    } finally {
      setSharing(false);
    }
  };

  const formatExpirationTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading result...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!jobData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Data</h1>
          <p className="text-gray-600 mb-6">No simulation data found.</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Fit Simulator</h1>
            </Link>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              ← 홈으로 돌아가기
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎉 AI 피팅 완료!
          </h1>
          <p className="text-lg text-gray-600">
            인공지능이 생성한 피팅 시뮬레이션 결과입니다
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {previewUrl ? (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="relative inline-block">
                  <Image
                    src={previewUrl}
                    alt="AI 피팅 시뮬레이션 결과"
                    width={768}
                    height={768}
                    className="mx-auto rounded-xl shadow-2xl"
                    priority
                  />
                  <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    AI 생성
                  </div>
                </div>
              </div>

              {expiresAt && (
                <div className="text-center mb-6">
                  <p className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 inline-block">
                    ⏰ 이미지 만료 시간: {formatExpirationTime(expiresAt)}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  title="공유 링크를 생성하고 클립보드에 복사합니다. Safari에서는 수동 복사가 필요할 수 있습니다."
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                    />
                  </svg>
                  {sharing ? '공유 링크 생성 중...' : '결과 공유하기'}
                </button>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleDownload}
                    title="Chrome에서는 저장 위치를 선택할 수 있습니다. 다른 브라우저에서는 기본 다운로드 폴더에 저장됩니다."
                    className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                  >
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    이미지 다운로드
                  </button>

                  <button
                    onClick={() => window.open(previewUrl || '#', '_blank')}
                    title="새 창에서 이미지를 열어서 우클릭으로 저장하세요"
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-600 bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    새 창에서 열기
                  </button>
                </div>
              </div>

              {shareUrl && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                    📤 공유 링크가 생성되었습니다
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm bg-white"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(shareUrl)}
                      className="px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      복사하기
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    링크를 복사하여 친구들과 결과를 공유해보세요!
                  </p>
                </div>
              )}

              <div className="mt-8 text-center">
                <Link
                  href="/upload"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  새로운 이미지로 다시 시도하기
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">📷</div>
              <p className="text-gray-600 text-lg">
                이미지를 불러올 수 없습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
