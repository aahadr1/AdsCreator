import { NextResponse } from 'next/server';
import { WEB_SAFE_FONTS } from '@/types/editor';

export const runtime = 'edge';

/**
 * GET /api/editor/fonts
 * Get available fonts for text editor
 */
export async function GET() {
  try {
    // In production, this could also fetch Google Fonts API
    // For now, return web-safe fonts
    const fonts = WEB_SAFE_FONTS.map((font) => ({
      family: font,
      category: 'web-safe',
      variants: ['regular', 'bold'],
    }));

    // Add some common Google Fonts
    const googleFonts = [
      { family: 'Roboto', category: 'google', variants: ['300', '400', '500', '700', '900'] },
      { family: 'Open Sans', category: 'google', variants: ['300', '400', '600', '700', '800'] },
      { family: 'Lato', category: 'google', variants: ['300', '400', '700', '900'] },
      { family: 'Montserrat', category: 'google', variants: ['400', '500', '600', '700', '800'] },
      { family: 'Poppins', category: 'google', variants: ['300', '400', '500', '600', '700'] },
      { family: 'Oswald', category: 'google', variants: ['300', '400', '500', '600', '700'] },
      { family: 'Raleway', category: 'google', variants: ['300', '400', '500', '600', '700'] },
      { family: 'Inter', category: 'google', variants: ['300', '400', '500', '600', '700', '800'] },
    ];

    return NextResponse.json({
      fonts: [...fonts, ...googleFonts],
      total: fonts.length + googleFonts.length,
    });
  } catch (error) {
    console.error('Fonts API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch fonts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

