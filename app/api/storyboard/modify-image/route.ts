import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { createR2Client, ensureR2Bucket, r2PutObject, r2PublicUrl } from '@/lib/r2';

/**
 * POST /api/storyboard/modify-image - Upload and modify frame images
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createSupabaseServer();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const storyboardId = formData.get('storyboard_id') as string;
    const sceneNumber = parseInt(formData.get('scene_number') as string);
    const framePosition = formData.get('frame_position') as 'first' | 'last';
    const imageFile = formData.get('image') as File;
    const modificationText = formData.get('modification_text') as string;

    if (!storyboardId || !sceneNumber || !framePosition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify ownership
    const { data: storyboard, error: fetchError } = await supabase
      .from('storyboards')
      .select('*')
      .eq('id', storyboardId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !storyboard) {
      return NextResponse.json({ error: 'Storyboard not found' }, { status: 404 });
    }

    let imageUrl: string | null = null;

    // Upload image if provided
    if (imageFile && imageFile.size > 0) {
      const fileExtension = imageFile.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const fileName = `storyboard/${storyboardId}/scene${sceneNumber}_${framePosition}_${timestamp}_${randomSuffix}.${fileExtension}`;
      
      try {
        // Use R2 instead of Vercel Blob
        const r2AccountId = process.env.R2_ACCOUNT_ID || '';
        const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || '';
        const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
        const bucket = process.env.R2_BUCKET || 'assets';
        const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL || null;
        const origin = new URL(req.url).origin;

        if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
          return NextResponse.json({ error: 'Storage misconfigured' }, { status: 500 });
        }

        const r2 = createR2Client({ 
          accountId: r2AccountId, 
          accessKeyId: r2AccessKeyId, 
          secretAccessKey: r2SecretAccessKey, 
          bucket, 
          publicBaseUrl 
        });

        await ensureR2Bucket(r2, bucket);

        const arrayBuffer = await imageFile.arrayBuffer();
        const contentType = imageFile.type || 'image/jpeg';
        
        await r2PutObject({ 
          client: r2, 
          bucket, 
          key: fileName, 
          body: new Uint8Array(arrayBuffer), 
          contentType,
          cacheControl: 'public, max-age=31536000'
        });

        // Use proxy URL for reliability
        const proxyUrl = `${origin.replace(/\/$/, '')}/api/r2/get?key=${encodeURIComponent(fileName)}`;
        imageUrl = publicBaseUrl ? r2PublicUrl({ publicBaseUrl, bucket, key: fileName }) : proxyUrl;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
      }
    }

    // Update the storyboard scene with the new image
    const scenes = storyboard.scenes || [];
    const sceneIndex = scenes.findIndex((s: any) => s.scene_number === sceneNumber);

    if (sceneIndex === -1) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 });
    }

    // Update the appropriate frame
    if (imageUrl) {
      if (framePosition === 'first') {
        scenes[sceneIndex].first_frame_url = imageUrl;
        if (modificationText) {
          scenes[sceneIndex].first_frame_prompt = modificationText;
        }
      } else {
        scenes[sceneIndex].last_frame_url = imageUrl;
        if (modificationText) {
          scenes[sceneIndex].last_frame_prompt = modificationText;
        }
      }
    }

    // Save the updated storyboard
    const { data: updatedStoryboard, error: updateError } = await supabase
      .from('storyboards')
      .update({ 
        scenes,
        updated_at: new Date().toISOString() 
      })
      .eq('id', storyboardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating storyboard:', updateError);
      return NextResponse.json({ error: 'Failed to update storyboard' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      storyboard: updatedStoryboard,
      imageUrl,
      message: 'Image updated successfully',
    });
  } catch (error: any) {
    console.error('POST /api/storyboard/modify-image error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
