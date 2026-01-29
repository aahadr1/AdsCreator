import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabaseServer';
import { put } from '@vercel/blob';

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
      const fileName = `storyboard/${storyboardId}/scene${sceneNumber}_${framePosition}_${Date.now()}.${fileExtension}`;
      
      try {
        const blob = await put(fileName, imageFile, {
          access: 'public',
          addRandomSuffix: true,
        });
        imageUrl = blob.url;
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
