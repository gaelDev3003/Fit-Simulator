import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateUpload } from '@/lib/validation';
import { FileUploadMetadata } from '@/types/custom';

// Environment variable guards
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

export async function POST(request: NextRequest) {
  try {
    const { files, userId } = await request.json();

    if (!files || !Array.isArray(files)) {
      return NextResponse.json(
        { success: false, error: 'Invalid files data' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Convert client-side file data to validation format
    const fileMetadata: FileUploadMetadata[] = files.map((file: any) => ({
      id: file.id,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
      } as File,
      category: file.category,
      preview: file.preview,
      size: file.size,
      uploadedAt: new Date(file.uploadedAt),
    }));

    // Validate the upload
    const validation = validateUpload(fileMetadata);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Additional server-side checks
    // 1. Check if user exists
    const { data: user, error: userError } =
      await supabaseAdmin!.auth.admin.getUserById(userId);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 2. Check storage quota (optional - can be implemented later)
    // For now, we'll just validate the constraints

    return NextResponse.json({
      success: true,
      message: 'Upload validation passed',
    });
  } catch (error) {
    console.error('Upload validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
