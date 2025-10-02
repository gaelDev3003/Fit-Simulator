'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  FileUploadMetadata,
  ValidationError,
} from '@/types/custom';
import { supabaseStorage } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// Remove old constants and interface - now using validation.ts

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [personFile, setPersonFile] = useState<FileUploadMetadata | null>(null);
  const [itemFiles, setItemFiles] = useState<FileUploadMetadata[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Remove old validation functions - now using validation.ts

  const handlePersonFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setErrors([]);

      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setErrors([
          {
            field: 'person',
            message: '이미지 파일만 업로드 가능합니다.',
            code: 'INVALID_FILE_TYPE',
          },
        ]);
        return;
      }

      if (file.size > 8 * 1024 * 1024) {
        setErrors([
          {
            field: 'person',
            message: '파일 크기는 8MB 이하여야 합니다.',
            code: 'FILE_SIZE_EXCEEDED',
          },
        ]);
        return;
      }

      const newFile: FileUploadMetadata = {
        id: uuidv4(),
        file,
        category: 'person',
        preview: URL.createObjectURL(file),
        size: file.size,
        uploadedAt: new Date(),
      };

      setPersonFile(newFile);
    },
    []
  );

  const handleItemFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      setErrors([]);

      if (itemFiles.length + files.length > 3) {
        setErrors([
          {
            field: 'items',
            message: '아이템은 최대 3개까지 업로드 가능합니다.',
            code: 'TOO_MANY_ITEMS',
          },
        ]);
        return;
      }

      const newFiles: FileUploadMetadata[] = [];

      for (const file of files) {
        // Validate file type and size
        if (!file.type.startsWith('image/')) {
          setErrors([
            {
              field: 'items',
              message: '이미지 파일만 업로드 가능합니다.',
              code: 'INVALID_FILE_TYPE',
            },
          ]);
          return;
        }

        if (file.size > 8 * 1024 * 1024) {
          setErrors([
            {
              field: 'items',
              message: '파일 크기는 8MB 이하여야 합니다.',
              code: 'FILE_SIZE_EXCEEDED',
            },
          ]);
          return;
        }

        const newFile: FileUploadMetadata = {
          id: uuidv4(),
          file,
          category: 'item',
          preview: URL.createObjectURL(file),
          size: file.size,
          uploadedAt: new Date(),
        };

        newFiles.push(newFile);
      }

      setItemFiles((prev) => [...prev, ...newFiles]);
    },
    [itemFiles.length]
  );

  const removePersonFile = () => {
    if (personFile) {
      URL.revokeObjectURL(personFile.preview);
      setPersonFile(null);
    }
    setErrors([]);
  };

  const removeItemFile = (id: string) => {
    setItemFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
    setErrors([]);
  };

  const uploadFiles = async () => {
    if (!user) return;

    // Validate that person file is selected
    if (!personFile) {
      setErrors([
        {
          field: 'person',
          message: '인물 사진을 선택해주세요.',
          code: 'PERSON_REQUIRED',
        },
      ]);
      return;
    }

    setIsUploading(true);
    setErrors([]);

    try {
      // Upload person file
      const personFileExt = personFile.file.name.split('.').pop();
      const personFileName = `${uuidv4()}.${personFileExt}`;
      const personPath = `${user.id}/${personFileName}`;

      const { error: personError } = await supabaseStorage
        .from('fit-originals')
        .upload(personPath, personFile.file);

      if (personError) throw personError;

      // Upload item files
      const itemPaths: string[] = [];
      for (const itemFile of itemFiles) {
        const itemFileExt = itemFile.file.name.split('.').pop();
        const itemFileName = `${uuidv4()}.${itemFileExt}`;
        const itemPath = `${user.id}/${itemFileName}`;

        const { error: itemError } = await supabaseStorage
          .from('fit-originals')
          .upload(itemPath, itemFile.file);

        if (itemError) throw itemError;
        itemPaths.push(itemPath);
      }

      // Store upload results in session storage for pose selection
      sessionStorage.setItem(
        'uploadedPaths',
        JSON.stringify({
          person: personPath,
          items: itemPaths,
        })
      );

      // Redirect directly to simulation
      router.push('/simulation');
    } catch (err) {
      console.error('Upload error:', err);
      let errorMessage = '업로드 중 오류가 발생했습니다.';
      let errorCode = 'UPLOAD_ERROR';

      if (err instanceof Error) {
        if (err.message.includes('permission denied')) {
          errorMessage = '업로드 권한이 없습니다. 로그인 상태를 확인해주세요.';
          errorCode = 'PERMISSION_DENIED';
        } else if (err.message.includes('File too large')) {
          errorMessage =
            '파일 크기가 너무 큽니다. 8MB 이하의 파일을 선택해주세요.';
          errorCode = 'FILE_SIZE_EXCEEDED';
        } else if (err.message.includes('Invalid file type')) {
          errorMessage =
            '지원하지 않는 파일 형식입니다. JPG 또는 PNG 파일을 선택해주세요.';
          errorCode = 'INVALID_FILE_TYPE';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage =
            '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
          errorCode = 'NETWORK_ERROR';
        } else {
          errorMessage = err.message;
          errorCode = 'UPLOAD_ERROR';
        }
      }

      setErrors([
        {
          field: 'upload',
          message: errorMessage,
          code: errorCode as ValidationError['code'],
        },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            이미지 업로드
          </h1>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">
              업로드 규칙
            </h2>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 인물 사진: 정확히 1개 (필수)</li>
              <li>• 아이템 사진: 최대 3개</li>
              <li>• 파일 형식: JPG, PNG만 지원</li>
              <li>• 파일 크기: 5MB 이하 권장 (8MB 이하 최대)</li>
            </ul>
          </div>

          {/* Person Image Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              👤 인물 사진 (필수)
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {personFile ? (
                <div className="space-y-4">
                  <img
                    src={personFile.preview}
                    alt={personFile.file.name}
                    className="mx-auto h-32 w-32 object-cover rounded-lg"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {personFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(personFile.size / 1024 / 1024).toFixed(1)}MB
                    </p>
                  </div>
                  <button
                    onClick={removePersonFile}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                  >
                    제거
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="space-y-4">
                    <div className="text-gray-400">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                    <div>
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        인물 사진 선택
                      </span>
                      <p className="mt-1 text-xs text-gray-500">
                        JPG, PNG 파일만 지원 (최대 8MB)
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handlePersonFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Item Images Upload */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              👕 아이템 사진 (선택, 최대 3개)
            </h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <label className="cursor-pointer block">
                <div className="space-y-4">
                  <div className="text-gray-400">
                    <svg
                      className="mx-auto h-12 w-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </div>
                  <div>
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      아이템 사진 선택
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      JPG, PNG 파일만 지원 (최대 8MB, 최대 3개)
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleItemFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                오류가 발생했습니다:
              </h4>
              <ul className="text-sm text-red-600 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Uploaded Item Files Display */}
          {itemFiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                선택된 아이템 ({itemFiles.length}개)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {itemFiles.map((file) => (
                  <div key={file.id} className="relative border rounded-lg p-3">
                    <img
                      src={file.preview}
                      alt={file.file.name}
                      className="w-full h-32 object-cover rounded"
                    />
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeItemFile(file.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              뒤로가기
            </button>

            <button
              onClick={uploadFiles}
              disabled={!personFile || isUploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isUploading ? '업로드 중...' : '업로드 및 다음 단계'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
