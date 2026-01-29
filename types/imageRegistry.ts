/**
 * Image Registry Types
 * 
 * A centralized system for tracking all generated images in a conversation.
 * This enables the AI assistant to reference any previously generated image
 * as input for new generations, ensuring consistency across storyboards and scenes.
 */

/**
 * Types of images that can be registered
 */
export type ImageRegistryType = 
  | 'avatar'           // Main character/creator avatar
  | 'product'          // Product image for consistency
  | 'scene_first_frame' // First frame of a scene
  | 'scene_last_frame'  // Last frame of a scene  
  | 'standalone'       // Standalone image generation
  | 'b_roll'           // B-roll/supplementary imagery
  | 'reference'        // User-provided reference image
  | 'other';           // Other types

/**
 * Generation status for an image
 */
export type ImageGenerationStatus = 'pending' | 'generating' | 'succeeded' | 'failed';

/**
 * GPT-4o image analysis result
 */
export interface GPT4oAnalysis {
  /** When the analysis was performed */
  analyzed_at: string;
  
  /** Primary subject type in the image */
  subject_type: 'person' | 'product' | 'scene' | 'object' | 'mixed';
  
  /** Inferred purpose/use case for this image */
  inferred_purpose: 'avatar' | 'product' | 'setting' | 'style_ref' | 'prop' | 'unknown';
  
  /** Detailed visual description */
  visual_details: {
    /** Main subjects visible */
    subjects: string[];
    /** Clothing description (if person visible) */
    clothing?: string;
    /** Setting/environment description */
    setting?: string;
    /** Lighting description */
    lighting?: string;
    /** Props/objects visible */
    props?: string[];
    /** Camera composition notes */
    composition?: string;
  };
  
  /** Recommended uses for this image */
  suggested_uses: string[];
  
  /** Whether a phone is visible in the image */
  has_phone_visible: boolean;
  
  /** Confidence score for the analysis (0-1) */
  confidence_score: number;
  
  /** Full GPT-4o description (raw) */
  full_description: string;
}

/**
 * A single registered image entry
 */
export interface RegisteredImage {
  /** Unique ID for this registry entry */
  id: string;
  
  /** The URL of the generated image (once available) */
  url?: string;
  
  /** Raw URL from the provider (may expire) */
  rawUrl?: string;
  
  /** Replicate prediction ID for polling status */
  predictionId?: string;
  
  /** Current generation status */
  status: ImageGenerationStatus;
  
  /** Type of image */
  type: ImageRegistryType;
  
  /** The prompt used to generate this image */
  prompt?: string;
  
  /** Description of the image content */
  description?: string;
  
  /** GPT-4o vision analysis of the image */
  gpt4o_analysis?: GPT4oAnalysis;
  
  /** Aspect ratio used */
  aspectRatio?: string;
  
  /** Error message if generation failed */
  error?: string;
  
  /** When the image was created */
  createdAt: string;
  
  /** When the image was last updated */
  updatedAt: string;
  
  // ===== Scene/Storyboard Context =====
  
  /** ID of the storyboard this image belongs to (if any) */
  storyboardId?: string;
  
  /** Scene number within the storyboard (if applicable) */
  sceneNumber?: number;
  
  /** Scene name for easier reference */
  sceneName?: string;
  
  /** Frame position within scene: 'first' or 'last' */
  framePosition?: 'first' | 'last';
  
  // ===== Reference Tracking =====
  
  /** IDs of images used as input references for this generation */
  inputReferenceIds?: string[];
  
  /** IDs of images that used this image as an input reference */
  usedAsReferenceBy?: string[];
  
  // ===== Metadata =====
  
  /** Additional metadata for extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * The complete image registry for a conversation
 */
export interface ImageRegistry {
  /** All registered images, keyed by ID for fast lookup */
  images: Record<string, RegisteredImage>;
  
  /** Quick lookup by storyboard ID */
  byStoryboard: Record<string, string[]>; // storyboardId -> imageIds
  
  /** Quick lookup by scene (storyboardId:sceneNumber) */
  byScene: Record<string, { firstFrame?: string; lastFrame?: string }>;
  
  /** Quick lookup by type */
  byType: Record<ImageRegistryType, string[]>;
  
  /** The confirmed/active avatar for this conversation */
  activeAvatarId?: string;
  
  /** The confirmed/active product image for this conversation */
  activeProductId?: string;
  
  /** When the registry was last modified */
  lastUpdated: string;
}

/**
 * Query options for finding images in the registry
 */
export interface ImageRegistryQuery {
  /** Filter by image type */
  type?: ImageRegistryType;
  
  /** Filter by storyboard ID */
  storyboardId?: string;
  
  /** Filter by scene number */
  sceneNumber?: number;
  
  /** Filter by frame position */
  framePosition?: 'first' | 'last';
  
  /** Filter by status */
  status?: ImageGenerationStatus;
  
  /** Only include images with URLs available */
  hasUrl?: boolean;
}

/**
 * Result of getting reference images for a new generation
 */
export interface ReferenceImagesResult {
  /** Avatar image URL (if uses avatar and confirmed) */
  avatarUrl?: string;
  
  /** Avatar description */
  avatarDescription?: string;
  
  /** Product image URL (if needs product) */
  productUrl?: string;
  
  /** Product description */
  productDescription?: string;
  
  /** Previous scene's last frame URL (for smooth transitions) */
  prevSceneLastFrameUrl?: string;
  
  /** Current scene's first frame URL (for last frame generation) */
  firstFrameUrl?: string;
  
  /** IDs of all images being used as references */
  referenceIds: string[];
}

// ===== Helper Functions =====

/**
 * Create an empty image registry
 */
export function createEmptyRegistry(): ImageRegistry {
  return {
    images: {},
    byStoryboard: {},
    byScene: {},
    byType: {
      avatar: [],
      product: [],
      scene_first_frame: [],
      scene_last_frame: [],
      standalone: [],
      b_roll: [],
      reference: [],
      other: [],
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Add an image to the registry
 */
export function registerImage(
  registry: ImageRegistry,
  image: Omit<RegisteredImage, 'id' | 'createdAt' | 'updatedAt'>
): { registry: ImageRegistry; imageId: string } {
  const imageId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const newImage: RegisteredImage = {
    ...image,
    id: imageId,
    createdAt: now,
    updatedAt: now,
  };
  
  const newRegistry: ImageRegistry = {
    ...registry,
    images: { ...registry.images, [imageId]: newImage },
    byType: { ...registry.byType },
    byStoryboard: { ...registry.byStoryboard },
    byScene: { ...registry.byScene },
    lastUpdated: now,
  };
  
  // Update type index
  newRegistry.byType[image.type] = [...(registry.byType[image.type] || []), imageId];
  
  // Update storyboard index
  if (image.storyboardId) {
    newRegistry.byStoryboard[image.storyboardId] = [
      ...(registry.byStoryboard[image.storyboardId] || []),
      imageId,
    ];
    
    // Update scene index
    if (image.sceneNumber !== undefined && image.framePosition) {
      const sceneKey = `${image.storyboardId}:${image.sceneNumber}`;
      newRegistry.byScene[sceneKey] = {
        ...registry.byScene[sceneKey],
        [image.framePosition === 'first' ? 'firstFrame' : 'lastFrame']: imageId,
      };
    }
  }
  
  return { registry: newRegistry, imageId };
}

/**
 * Update an existing image in the registry
 */
export function updateRegisteredImage(
  registry: ImageRegistry,
  imageId: string,
  updates: Partial<Omit<RegisteredImage, 'id' | 'createdAt'>>
): ImageRegistry {
  const existing = registry.images[imageId];
  if (!existing) return registry;
  
  const now = new Date().toISOString();
  const updatedImage: RegisteredImage = {
    ...existing,
    ...updates,
    updatedAt: now,
  };
  
  return {
    ...registry,
    images: { ...registry.images, [imageId]: updatedImage },
    lastUpdated: now,
  };
}

/**
 * Find images matching a query
 */
export function queryImages(registry: ImageRegistry, query: ImageRegistryQuery): RegisteredImage[] {
  let imageIds: string[] = Object.keys(registry.images);
  
  // Filter by type
  if (query.type) {
    imageIds = imageIds.filter(id => registry.images[id].type === query.type);
  }
  
  // Filter by storyboard
  if (query.storyboardId) {
    const storyboardImageIds = new Set(registry.byStoryboard[query.storyboardId] || []);
    imageIds = imageIds.filter(id => storyboardImageIds.has(id));
  }
  
  // Filter by scene
  if (query.sceneNumber !== undefined) {
    imageIds = imageIds.filter(id => registry.images[id].sceneNumber === query.sceneNumber);
  }
  
  // Filter by frame position
  if (query.framePosition) {
    imageIds = imageIds.filter(id => registry.images[id].framePosition === query.framePosition);
  }
  
  // Filter by status
  if (query.status) {
    imageIds = imageIds.filter(id => registry.images[id].status === query.status);
  }
  
  // Filter by URL availability
  if (query.hasUrl) {
    imageIds = imageIds.filter(id => {
      const url = registry.images[id].url;
      return url && url.startsWith('http');
    });
  }
  
  return imageIds.map(id => registry.images[id]);
}

/**
 * Get the previous scene's last frame for smooth transitions
 */
export function getPreviousSceneLastFrame(
  registry: ImageRegistry,
  storyboardId: string,
  currentSceneNumber: number
): RegisteredImage | null {
  if (currentSceneNumber <= 1) return null;
  
  const prevSceneKey = `${storyboardId}:${currentSceneNumber - 1}`;
  const prevSceneFrames = registry.byScene[prevSceneKey];
  
  if (!prevSceneFrames?.lastFrame) return null;
  
  const image = registry.images[prevSceneFrames.lastFrame];
  return image?.url ? image : null;
}

/**
 * Get the current scene's first frame (for last frame generation)
 */
export function getCurrentSceneFirstFrame(
  registry: ImageRegistry,
  storyboardId: string,
  sceneNumber: number
): RegisteredImage | null {
  const sceneKey = `${storyboardId}:${sceneNumber}`;
  const sceneFrames = registry.byScene[sceneKey];
  
  if (!sceneFrames?.firstFrame) return null;
  
  const image = registry.images[sceneFrames.firstFrame];
  return image?.url ? image : null;
}

/**
 * Get all reference images needed for a frame generation
 */
export function getReferenceImagesForGeneration(
  registry: ImageRegistry,
  params: {
    storyboardId?: string;
    sceneNumber?: number;
    framePosition: 'first' | 'last';
    usesAvatar?: boolean;
    needsProduct?: boolean;
    usePrevSceneTransition?: boolean;
  }
): ReferenceImagesResult {
  const result: ReferenceImagesResult = { referenceIds: [] };
  
  // Get avatar if needed and available
  if (params.usesAvatar && registry.activeAvatarId) {
    const avatar = registry.images[registry.activeAvatarId];
    if (avatar?.url) {
      result.avatarUrl = avatar.url;
      result.avatarDescription = avatar.description;
      result.referenceIds.push(avatar.id);
    }
  }
  
  // Get product if needed and available
  if (params.needsProduct && registry.activeProductId) {
    const product = registry.images[registry.activeProductId];
    if (product?.url) {
      result.productUrl = product.url;
      result.productDescription = product.description;
      result.referenceIds.push(product.id);
    }
  }
  
  // For first frame generation with smooth transition
  if (params.framePosition === 'first' && params.usePrevSceneTransition && params.storyboardId && params.sceneNumber) {
    const prevSceneLastFrame = getPreviousSceneLastFrame(registry, params.storyboardId, params.sceneNumber);
    if (prevSceneLastFrame?.url) {
      result.prevSceneLastFrameUrl = prevSceneLastFrame.url;
      result.referenceIds.push(prevSceneLastFrame.id);
    }
  }
  
  // For last frame generation, use first frame of same scene
  if (params.framePosition === 'last' && params.storyboardId && params.sceneNumber) {
    const firstFrame = getCurrentSceneFirstFrame(registry, params.storyboardId, params.sceneNumber);
    if (firstFrame?.url) {
      result.firstFrameUrl = firstFrame.url;
      result.referenceIds.push(firstFrame.id);
    }
  }
  
  return result;
}

/**
 * Set the active avatar for a conversation
 */
export function setActiveAvatar(registry: ImageRegistry, imageId: string): ImageRegistry {
  const image = registry.images[imageId];
  if (!image || image.type !== 'avatar') return registry;
  
  return {
    ...registry,
    activeAvatarId: imageId,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Set the active product image for a conversation
 */
export function setActiveProduct(registry: ImageRegistry, imageId: string): ImageRegistry {
  const image = registry.images[imageId];
  if (!image || image.type !== 'product') return registry;
  
  return {
    ...registry,
    activeProductId: imageId,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Find the best image for a specific purpose using GPT-4o analysis
 */
export function findBestImageForPurpose(
  registry: ImageRegistry,
  purpose: 'avatar' | 'product' | 'setting' | 'prop',
  context?: string
): RegisteredImage | null {
  const allImages = Object.values(registry.images)
    .filter(img => img.url && img.gpt4o_analysis);
  
  if (allImages.length === 0) return null;
  
  // Filter by inferred purpose
  let candidates = allImages.filter(img => 
    img.gpt4o_analysis?.inferred_purpose === purpose
  );
  
  // If no exact matches, try subject_type
  if (candidates.length === 0) {
    const subjectTypeMap: Record<string, string> = {
      avatar: 'person',
      product: 'product',
      setting: 'scene',
      prop: 'object'
    };
    const targetSubjectType = subjectTypeMap[purpose];
    candidates = allImages.filter(img => 
      img.gpt4o_analysis?.subject_type === targetSubjectType
    );
  }
  
  if (candidates.length === 0) return null;
  
  // Return highest confidence match
  candidates.sort((a, b) => 
    (b.gpt4o_analysis?.confidence_score || 0) - (a.gpt4o_analysis?.confidence_score || 0)
  );
  
  return candidates[0];
}

/**
 * Get suggested reference images for a scene based on its description
 */
export function getSuggestedReferencesForScene(
  registry: ImageRegistry,
  sceneDescription: string,
  sceneType: string
): {
  avatarUrl?: string;
  productUrl?: string;
  settingUrl?: string;
  propUrls?: string[];
} {
  const result: any = {};
  
  // Check if scene needs avatar (mentions person, character, speaker, etc.)
  const needsAvatar = /\b(person|character|woman|man|speaker|creator|he|she)\b/i.test(sceneDescription);
  if (needsAvatar) {
    const avatar = findBestImageForPurpose(registry, 'avatar');
    if (avatar?.url) result.avatarUrl = avatar.url;
  }
  
  // Check if scene needs product (mentions product, bottle, item, etc.)
  const needsProduct = /\b(product|bottle|item|package|box)\b/i.test(sceneDescription) ||
    sceneType === 'product_showcase';
  if (needsProduct) {
    const product = findBestImageForPurpose(registry, 'product');
    if (product?.url) result.productUrl = product.url;
  }
  
  // Extract prop mentions from description
  const propUrls: string[] = [];
  const allImages = Object.values(registry.images).filter(img => img.url && img.gpt4o_analysis);
  
  for (const img of allImages) {
    const props = img.gpt4o_analysis?.visual_details?.props || [];
    for (const prop of props) {
      if (sceneDescription.toLowerCase().includes(prop.toLowerCase())) {
        if (img.url) propUrls.push(img.url);
        break;
      }
    }
  }
  
  if (propUrls.length > 0) result.propUrls = propUrls;
  
  return result;
}

/**
 * Find images that have specific props visible
 */
export function findImagesWithProp(
  registry: ImageRegistry,
  propName: string
): RegisteredImage[] {
  return Object.values(registry.images).filter(img => {
    const props = img.gpt4o_analysis?.visual_details?.props || [];
    return props.some(p => p.toLowerCase().includes(propName.toLowerCase()));
  });
}
