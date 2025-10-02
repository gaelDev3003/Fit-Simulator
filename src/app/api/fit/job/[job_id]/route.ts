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

export async function GET(
  request: NextRequest,
  { params }: { params: { job_id: string } }
) {
  try {
    const jobId = params.job_id;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

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

    // Get job data and verify ownership
    console.log('Fetching job:', jobId, 'for user:', user.id);

    // Use admin client directly to avoid RLS issues, but verify ownership manually
    const { data: job, error: jobError } = await supabaseAdmin!
      .schema('fit')
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    console.log('Job fetch result with admin client:', {
      job: !!job,
      error: jobError,
    });

    if (jobError || !job) {
      console.error('Job fetch error:', jobError);
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify ownership manually
    if (job.user_id !== user.id) {
      console.error(
        'Ownership verification failed:',
        job.user_id,
        'vs',
        user.id
      );
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Generate signed URL for preview if available
    let signedUrl = null;
    let expiresAt = null;

    if (job.preview_path) {
      try {
        const days = Number(ttlDays);
        const expiresIn = Math.max(60, Math.floor(days * 86400)); // clamp >=60s

        const { data: signedUrlData, error: signedUrlError } =
          await supabaseAdmin!.storage
            .from('fit-previews')
            .createSignedUrl(job.preview_path, expiresIn);

        if (signedUrlError) {
          console.error('Signed URL creation error:', signedUrlError);
        } else {
          signedUrl = signedUrlData.signedUrl;
          expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        }
      } catch (error) {
        console.error('Error creating signed URL:', error);
      }
    }

    return NextResponse.json({
      success: true,
      job: job,
      signedUrl: signedUrl,
      expiresAt: expiresAt,
    });
  } catch (error) {
    console.error('Error in job API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
