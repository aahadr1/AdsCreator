// =============================================================================
// STYLE BIBLE - Visual Consistency System
// =============================================================================

import type {
  UgcProject,
  CreativeBrief,
  ActorOption,
  StyleBible,
  Scene,
  Keyframe,
} from '@/types/ugc';
import { generateId, setStyleBible } from './projectStore';

// -----------------------------------------------------------------------------
// Style Bible Generation
// -----------------------------------------------------------------------------

export type StyleBibleInput = {
  brief: CreativeBrief;
  actor: ActorOption;
  customOverrides?: Partial<StyleBible>;
};

export function generateStyleBible(input: StyleBibleInput): Omit<StyleBible, 'id' | 'projectId' | 'createdAt' | 'updatedAt'> {
  const { brief, actor, customOverrides } = input;
  
  // Derive environment from brand tone and product type
  let environment = 'Clean, modern indoor space with natural lighting';
  if (brief.brandTone.includes('premium')) {
    environment = 'Luxurious, minimalist space with soft directional lighting and neutral tones';
  } else if (brief.brandTone.includes('edgy')) {
    environment = 'Urban, industrial setting with dramatic shadows and bold colors';
  } else if (brief.brandTone.includes('playful')) {
    environment = 'Bright, colorful space with warm natural light and lifestyle elements';
  } else if (brief.brandTone.includes('clinical')) {
    environment = 'Clean, professional setting with even, bright lighting';
  }
  
  // Derive wardrobe from actor style and brand tone
  let wardrobe = actor.wardrobeDescription || 'Casual, relatable everyday clothing';
  if (brief.brandTone.includes('premium')) {
    wardrobe = 'Elevated casual wear, quality fabrics, minimal accessories';
  } else if (brief.brandTone.includes('authentic')) {
    wardrobe = 'Comfortable, authentic everyday clothes that feel real';
  }
  
  // Derive lighting style
  let lighting = 'Natural daylight, soft shadows, 3-point setup feel';
  if (brief.brandTone.includes('premium')) {
    lighting = 'Soft, diffused lighting with subtle rim light, golden hour quality';
  } else if (brief.brandTone.includes('edgy')) {
    lighting = 'High contrast, dramatic shadows, bold color temperature';
  }
  
  // Derive camera style from filming preferences
  let cameraStyle = 'Handheld selfie-style, slight movement for authenticity, eye-level angle';
  const shotTypes = ['close-up', 'medium'];
  
  // Build negative prompt
  const negativeConstraints = [
    'blurry',
    'low quality',
    'overexposed',
    'underexposed',
    'distorted face',
    'extra limbs',
    'watermark',
    'text artifacts',
    'cartoon',
    'anime',
    'CGI',
    'unrealistic',
  ];
  
  // Add compliance-based negatives
  if (brief.complianceDomain === 'health') {
    negativeConstraints.push('medical claims', 'before-after exaggeration');
  }
  
  return {
    actorAnchorUrl: actor.imageUrl,
    actorDescription: `${actor.label}: ${actor.description}. ${actor.demographics.gender}, ${actor.demographics.ageRange}, ${actor.demographics.style} style.`,
    wardrobeDescription: wardrobe,
    environmentDescription: environment,
    lightingDescription: lighting,
    cameraStyle,
    shotTypes,
    negativePrompt: negativeConstraints.join(', '),
    ...customOverrides,
  };
}

// -----------------------------------------------------------------------------
// Apply Style Bible to Prompts
// -----------------------------------------------------------------------------

export type PromptWithStyle = {
  positivePrompt: string;
  negativePrompt: string;
  styleTokens: string[];
};

export function applyStyleBibleToKeyframePrompt(
  basePrompt: string,
  styleBible: StyleBible,
  scene: Scene
): PromptWithStyle {
  const styleTokens: string[] = [];
  
  // Add actor anchor
  if (styleBible.actorAnchorUrl) {
    styleTokens.push(`Same person as reference image`);
  }
  styleTokens.push(styleBible.actorDescription);
  
  // Add environment
  styleTokens.push(`Setting: ${styleBible.environmentDescription}`);
  
  // Add wardrobe
  styleTokens.push(`Wearing: ${styleBible.wardrobeDescription}`);
  
  // Add lighting
  styleTokens.push(`Lighting: ${styleBible.lightingDescription}`);
  
  // Add camera style
  styleTokens.push(`Camera: ${styleBible.cameraStyle}`);
  
  // Add shot type from scene
  styleTokens.push(`Shot type: ${scene.shotType}`);
  
  // Compose final prompt
  const positivePrompt = [
    basePrompt,
    '',
    'STYLE CONSISTENCY:',
    ...styleTokens,
  ].join('\n');
  
  return {
    positivePrompt,
    negativePrompt: styleBible.negativePrompt,
    styleTokens,
  };
}

export function applyStyleBibleToVideoPrompt(
  basePrompt: string,
  styleBible: StyleBible,
  scene: Scene,
  keyframes: Keyframe[]
): PromptWithStyle {
  const styleTokens: string[] = [];
  
  // Reference keyframes
  const completedKeyframes = keyframes.filter(k => k.status === 'complete' && k.imageUrl);
  if (completedKeyframes.length > 0) {
    styleTokens.push(`Start frame: Match first keyframe exactly`);
    if (completedKeyframes.length > 1) {
      styleTokens.push(`End frame: Match last keyframe exactly`);
    }
  }
  
  // Actor consistency
  styleTokens.push(`Actor: ${styleBible.actorDescription}`);
  styleTokens.push(`Must maintain exact same: face, hair, wardrobe, accessories`);
  
  // Environment consistency
  styleTokens.push(`Environment: ${styleBible.environmentDescription}`);
  styleTokens.push(`Lighting: ${styleBible.lightingDescription}`);
  
  // Camera motion
  styleTokens.push(`Camera: ${styleBible.cameraStyle}`);
  if (scene.cameraDescription) {
    styleTokens.push(`Camera motion: ${scene.cameraDescription}`);
  }
  
  // Compose final prompt
  const positivePrompt = [
    basePrompt,
    '',
    'CONTINUITY REQUIREMENTS:',
    ...styleTokens,
    '',
    `Duration: ${scene.duration} seconds`,
  ].join('\n');
  
  return {
    positivePrompt,
    negativePrompt: styleBible.negativePrompt + ', flickering, inconsistent lighting, face morphing, wardrobe change',
    styleTokens,
  };
}

// -----------------------------------------------------------------------------
// Style Bible Validation
// -----------------------------------------------------------------------------

export type StyleBibleValidation = {
  isComplete: boolean;
  missingFields: string[];
  warnings: string[];
};

export function validateStyleBible(styleBible: StyleBible | undefined): StyleBibleValidation {
  if (!styleBible) {
    return {
      isComplete: false,
      missingFields: ['Style Bible not created'],
      warnings: [],
    };
  }
  
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  if (!styleBible.actorDescription) {
    missingFields.push('Actor description');
  }
  
  if (!styleBible.wardrobeDescription) {
    missingFields.push('Wardrobe description');
  }
  
  if (!styleBible.environmentDescription) {
    missingFields.push('Environment description');
  }
  
  if (!styleBible.lightingDescription) {
    missingFields.push('Lighting description');
  }
  
  if (!styleBible.actorAnchorUrl) {
    warnings.push('No actor anchor image - consistency may vary');
  }
  
  if (!styleBible.negativePrompt) {
    warnings.push('No negative prompt defined');
  }
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

// -----------------------------------------------------------------------------
// Create Style Bible for Project
// -----------------------------------------------------------------------------

export async function createStyleBibleForProject(
  projectId: string,
  project: UgcProject
): Promise<StyleBible | null> {
  if (!project.brief || !project.selectedActorId) {
    return null;
  }
  
  const actor = project.actors.find(a => a.id === project.selectedActorId);
  if (!actor) {
    return null;
  }
  
  const styleBibleData = generateStyleBible({
    brief: project.brief as CreativeBrief,
    actor,
  });
  
  const updated = await setStyleBible(projectId, styleBibleData);
  return updated?.styleBible || null;
}
