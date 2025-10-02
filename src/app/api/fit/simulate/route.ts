import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, supabaseAuth } from '@/lib/supabase';
import { geminiClient } from '@/lib/gemini/client';
import { errorLogger } from '@/lib/utils/errorLogger';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Environment variable guards
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) throw new Error('Supabase env missing (url)');
console.log('[SUPABASE_URL_HOST]', new URL(url).host);

interface SimulateRequest {
  personPath: string;
  itemPaths: string[];
}

interface SimulateResponse {
  success: boolean;
  previewUrl?: string;
  jobId?: string;
  duration_ms?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let jobId: string | undefined;
  let user: any = null;

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
      data: { user: userData },
      error: authError,
    } = await supabaseAuth.getUser(token);
    user = userData;

    if (authError || !user) {
      errorLogger.logAuthError(authError || new Error('User not found'), {
        action: 'simulate',
        component: 'api/fit/simulate',
      });
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SimulateRequest = await request.json();
    const { personPath, itemPaths = [] } = body;

    // Validate ownership - all paths must start with user_id
    if (!personPath || !personPath.startsWith(`${user.id}/`)) {
      const duration = Date.now() - startTime;
      await recordSimulationMetrics(
        null,
        user.id,
        duration,
        'denied',
        'Person path ownership validation failed'
      );

      return NextResponse.json(
        {
          error: 'Ownership validation failed',
          details: `Person path must start with "${user.id}/" but got: ${personPath || 'empty'}`,
        },
        { status: 403 }
      );
    }

    // Validate item paths
    for (const itemPath of itemPaths) {
      if (!itemPath || !itemPath.startsWith(`${user.id}/`)) {
        const duration = Date.now() - startTime;
        await recordSimulationMetrics(
          null,
          user.id,
          duration,
          'denied',
          'Item path ownership validation failed'
        );

        return NextResponse.json(
          {
            error: 'Ownership validation failed',
            details: `Item path must start with "${user.id}/" but got: ${itemPath || 'empty'}`,
          },
          { status: 403 }
        );
      }
    }

    // Generate job ID
    jobId = crypto.randomUUID();

    // Generate image using Gemini API
    const geminiResult = await geminiClient.generateImage({
      personPath,
      itemPaths,
      user_id: user.id,
      user_token: token,
    });

    let previewUrl: string;
    let status: string;

    if (!geminiResult.success) {
      // Record failed job in metrics
      const duration = Date.now() - startTime;
      await recordSimulationMetrics(
        jobId,
        user.id,
        duration,
        'error',
        `Gemini generation failed: ${geminiResult.error}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Image generation failed',
          details: geminiResult.error,
          duration_ms: duration,
        },
        { status: 500 }
      );
    }

    // Store generated image in Supabase Storage (bucket-internal key only)
    // Phase 4: Use format "fit-previews/<user_id>/<uuid>.webp"
    const previewPath = `${user.id}/${jobId}.webp`;
    const { error: uploadError } = await supabaseAdmin!.storage
      .from('fit-previews')
      .upload(previewPath, geminiResult.imageBuffer!, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      errorLogger.logStorageError(uploadError, {
        userId: user.id,
        jobId,
        action: 'upload_preview',
        component: 'api/fit/simulate',
        additionalData: { previewPath },
      });

      const duration = Date.now() - startTime;
      await recordSimulationMetrics(
        jobId,
        user.id,
        duration,
        'error',
        `Storage upload failed: ${uploadError.message}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to store preview image',
          details: `Upload to fit-previews bucket failed: ${uploadError.message}`,
          duration_ms: duration,
        },
        { status: 500 }
      );
    }

    // Verify the upload was successful by checking if file exists
    const { data: fileData, error: fileCheckError } =
      await supabaseAdmin!.storage.from('fit-previews').list(user.id, {
        search: `${jobId}.webp`,
        limit: 1,
      });

    if (fileCheckError || !fileData || fileData.length === 0) {
      console.error('Failed to verify preview image upload:', fileCheckError);
      const duration = Date.now() - startTime;
      await recordSimulationMetrics(
        jobId,
        user.id,
        duration,
        'error',
        'Preview image upload verification failed'
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify preview image storage',
          details: 'Preview image was not found after upload',
          duration_ms: duration,
        },
        { status: 500 }
      );
    }

    // Create signed URL for private preview with env-based TTL
    const days = Number(process.env.NEXT_PUBLIC_SHARE_LINK_TTL_DAYS || '1');
    const expiresIn = Math.max(60, Math.floor(days * 86400)); // clamp >=60s

    const { data: signedUrlData, error: signedUrlError } =
      await supabaseAdmin!.storage
        .from('fit-previews')
        .createSignedUrl(previewPath, expiresIn);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      const duration = Date.now() - startTime;
      await recordSimulationMetrics(
        jobId,
        user.id,
        duration,
        'error',
        `Signed URL creation failed: ${signedUrlError?.message}`
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create preview URL',
          details: signedUrlError?.message || 'Unknown error',
          duration_ms: duration,
        },
        { status: 500 }
      );
    }

    previewUrl = signedUrlData.signedUrl;
    status = geminiClient.isLiveMode ? 'completed' : 'completed_stub';

    // Record job in jobs table using admin client
    const duration = Date.now() - startTime;
    const { error: jobInsertError } = await supabaseAdmin!
      .schema('fit')
      .from('jobs')
      .insert({
        id: jobId,
        user_id: user.id,
        app_id: 'fit',
        person_path: personPath,
        item_paths: itemPaths,
        pose_id: null,
        preview_path: previewPath,
        duration_ms: duration,
        status: status,
        created_at: new Date().toISOString(),
      });

    if (jobInsertError) {
      console.error('Failed to record job in database:', jobInsertError);
      // Don't fail the request, just log the error
    }

    // Record successful job in metrics
    await recordSimulationMetrics(
      jobId,
      user.id,
      duration,
      status,
      'Simulation completed'
    );

    const response: SimulateResponse = {
      success: true,
      previewUrl,
      jobId,
      duration_ms: duration,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Simulate endpoint error:', error);

    // Record failed job in metrics
    const duration = Date.now() - startTime;
    if (user) {
      await recordSimulationMetrics(
        jobId || null,
        user.id,
        duration,
        'error',
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during simulation',
        duration_ms: duration,
      },
      { status: 500 }
    );
  }
}

/**
 * Records simulation metrics in the database
 */
async function recordSimulationMetrics(
  jobId: string | null,
  userId: string,
  durationMs: number,
  status: string,
  details: string
) {
  try {
    // Insert metrics record directly (assume table exists)
    const { error } = await supabaseAdmin!
      .schema('fit')
      .from('sim_metrics')
      .insert({
        job_id: jobId,
        user_id: userId,
        duration_ms: durationMs,
        status,
        details,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to record simulation metrics:', error);
    }
  } catch (error) {
    console.error('Error recording simulation metrics:', error);
  }
}
