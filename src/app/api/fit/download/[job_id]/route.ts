import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase';

export const runtime = 'nodejs';

// Environment variable guards
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!service) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY missing (server only)');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { job_id: string } }
) {
  try {
    const jobId = params.job_id;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];

    // Verify token and get user
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.getUser(token);
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get job data and verify ownership using admin client
    const { data: job, error: jobError } = await supabaseAdmin!
      .schema('fit')
      .from('jobs')
      .select('id, user_id, preview_path, status')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify ownership manually
    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!job.preview_path) {
      return NextResponse.json(
        { error: 'No preview available for this job' },
        { status: 404 }
      );
    }

    // Get file from storage
    const { data: fileData, error: downloadError } =
      await supabaseAdmin!.storage
        .from('fit-previews')
        .download(job.preview_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const buffer = await fileData.arrayBuffer();

    // Generate user-friendly filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `AI피팅시뮬레이션_${timestamp}.webp`;
    const encodedFilename = encodeURIComponent(filename);

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
