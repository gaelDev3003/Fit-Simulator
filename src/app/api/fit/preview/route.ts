import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase';

export const runtime = 'nodejs';

// Environment variable guards
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error('Supabase env missing (url)');
console.log('[SUPABASE_URL_HOST]', new URL(url).host);

interface PreviewRequest {
  job_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token and get user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: PreviewRequest = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    // Get job details and verify ownership using admin client
    const { data: job, error: jobError } = await supabaseAdmin!
      .schema('fit')
      .from('jobs')
      .select('id, user_id, preview_path, status')
      .eq('id', job_id)
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

    // Download the image from storage
    const { data: imageData, error: downloadError } =
      await supabaseAdmin!.storage
        .from('fit-previews')
        .download(job.preview_path);

    if (downloadError || !imageData) {
      console.error('Failed to download preview image:', downloadError);
      return NextResponse.json(
        { error: 'Failed to load preview image' },
        { status: 500 }
      );
    }

    // Convert to buffer
    const arrayBuffer = await imageData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return the image with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, no-store',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Preview endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error during preview loading' },
      { status: 500 }
    );
  }
}
