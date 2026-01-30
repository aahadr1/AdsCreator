/**
 * Enhanced Image Analysis
 * 
 * Natural GPT-4o Vision analysis for media pool assets.
 * Returns conversational descriptions instead of rigid structured data.
 */

import OpenAI from 'openai';

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Analyze image with GPT-4o Vision - Natural output
 * 
 * Returns a natural language description that the AI can read and understand.
 * No rigid structure - just conversational analysis.
 */
export async function analyzeImageNaturally(imageUrl: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image for video storyboard creation. Write a natural description covering:

**Subject & Content:**
- What's the main subject? (person, product, scene, object)
- What are they doing or what's shown?

**Visual Details:**
- Setting/environment
- Lighting quality and direction
- Clothing (if person visible)
- Props or objects present
- Composition and framing
- Mood/emotional tone
- Dominant colors

**Usability:**
- Best use for this image (avatar? product reference? setting? b-roll?)
- Suitable for UGC-style videos? Professional videos?
- Any notable strengths or limitations?

**Warnings (if any):**
- Any quality issues?
- Anything that might cause consistency problems?
- Any elements to avoid or be careful with?

Write naturally and conversationally - describe what you see like you're explaining it to a colleague, not filling out a form. Be specific but readable.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    max_tokens: 500,
  });
  
  return response.choices[0].message.content || 'Unable to analyze image.';
}

/**
 * Analyze script/text content naturally
 */
export async function analyzeScriptNaturally(scriptText: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Analyze this script for video creation. Write a natural analysis covering:

Script:
${scriptText}

**Content Analysis:**
- What's this script about? Main message?
- Estimated duration if spoken naturally
- Word count and pacing

**Tone & Style:**
- What's the tone? (casual, professional, excited, educational, etc.)
- Target audience feeling
- Energy level

**Structure:**
- How is it structured? (hook → problem → solution? story? tutorial?)
- Key phrases or memorable lines
- Call to action (if any)

**Usability:**
- Best video style for this script (UGC? Professional? Tutorial?)
- Scene count suggestion
- Visual style that would match

Write naturally - like you're discussing the script with a creative partner.`
      }
    ],
    max_tokens: 400,
    temperature: 0.6,
  });
  
  return response.choices[0].message.content || 'Unable to analyze script.';
}

/**
 * Quick image purpose detection
 * 
 * Returns the most likely purpose of an image in natural language
 */
export async function detectImagePurpose(imageUrl: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `What is this image best suited for in video creation? Just give me a brief answer (1-2 sentences).

Options to consider:
- Avatar/character reference (person for consistent character)
- Product image (product to showcase)
- Setting reference (environment/location)
- B-roll/mood (atmospheric shots)
- Style reference (visual inspiration)
- Prop reference (specific object)

Be direct and specific.`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    max_tokens: 100,
    temperature: 0.5,
  });
  
  return response.choices[0].message.content || 'General reference image';
}
