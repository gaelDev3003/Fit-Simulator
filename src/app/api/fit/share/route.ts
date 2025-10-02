import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase';

export const runtime = 'nodejs';

// Environment variable guards
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ttlDays = process.env.NEXT_PUBLIC_SHARE_LINK_TTL_DAYS;

if (!url) {
  throw new Error('Supabase env missing (url)');
}
if (!ttlDays) {
  throw new Error('NEXT_PUBLIC_SHARE_LINK_TTL_DAYS missing');
}
console.log('[SUPABASE_URL_HOST]', new URL(url).host);

interface ShareRequest {
  job_id: string;
}

interface ShareResponse {
  success: boolean;
  signedUrl?: string;
  expiresAt?: string;
  error?: string;
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
    const body: ShareRequest = await request.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { error: 'job_id is required' },
        { status: 400 }
      );
    }

    // Get job details and verify ownership using admin client
    console.log('Fetching job for share:', job_id, 'for user:', user.id);

    const { data: job, error: jobError } = await supabaseAdmin!
      .schema('fit')
      .from('jobs')
      .select('id, user_id, preview_path, status')
      .eq('id', job_id)
      .single();

    console.log('Job fetch result with admin client:', {
      job: !!job,
      error: jobError,
    });

    if (jobError || !job) {
      console.error('Job fetch error:', jobError);
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Verify ownership manually
    if (job.user_id !== user.id) {
      console.error(
        'Ownership verification failed:',
        job.user_id,
        'vs',
        user.id
      );
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!job.preview_path) {
      return NextResponse.json(
        { error: 'No preview available for this job' },
        { status: 404 }
      );
    }

    // Calculate TTL from environment variable
    const days = Number(ttlDays);
    const expiresIn = Math.max(60, Math.floor(days * 86400)); // clamp >=60s

    // Create signed URL for sharing
    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin!.storage
        .from('fit-previews')
        .createSignedUrl(job.preview_path, expiresIn);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create shareable link',
          details: signedUrlError?.message || 'Unknown error',
        },
        { status: 500 }
      );
    }

    // Calculate expiration timestamp
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const response: ShareResponse = {
      success: true,
      signedUrl: signedUrlData.signedUrl,
      expiresAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Share endpoint error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during sharing',
      },
      { status: 500 }
    );
  }
}
