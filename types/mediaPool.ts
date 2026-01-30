/**
 * Media Pool Types
 * 
 * A natural, flexible asset tracking system for the AI assistant.
 * Philosophy: Minimal rigid structure - only for technical necessities.
 * Everything creative is natural text that the AI reads organically.
 */

/**
 * Media Pool - Central asset tracking for a conversation
 * 
 * Tracks all assets (images, scripts, videos, uploads) with natural descriptions
 * instead of rigid structured metadata.
 */
export interface MediaPool {
  /** All assets, keyed by ID for fast lookup */
  assets: Record<string, MediaAsset>;
  
  /** Quick lookups by type - flexible, no rigid enum */
  byType: Record<string, string[]>; // e.g., "avatar", "product", "mood board", etc.
  
  /** All assets in this conversation */
  byConversation: string[];
  
  // ===== Active Selections (Technical Necessity) =====
  
  /** The confirmed/active avatar for this conversation */
  activeAvatarId?: string;
  
  /** The confirmed/active product image for this conversation */
  activeProductId?: string;
  
  /** The approved script for this conversation */
  approvedScriptId?: string;
  
  /** When the media pool was last modified */
  lastUpdated: string;
}

/**
 * Media Asset - A single asset in the media pool
 * 
 * Key principle: Natural descriptions instead of structured metadata.
 * The AI reads descriptions naturally rather than parsing rigid fields.
 */
export interface MediaAsset {
  // ===== Technical Fields (Minimal, Necessary) =====
  
  /** Unique ID */
  id: string;
  
  /** 
   * Asset type - FREE-FORM string, not rigid enum
   * Examples: "avatar", "product", "mood board", "reference photo", 
   * "scene description", "script", "user upload", etc.
   */
  type: string;
  
  /** URL if this is an image/video asset */
  url?: string;
  
  /** Text content if this is a script/description asset */
  content?: string;
  
  /** Generation/upload status */
  status: 'pending' | 'generating' | 'ready' | 'failed';
  
  // ===== Natural Descriptions (NOT Structured Fields) =====
  
  /** 
   * NATURAL LANGUAGE description of the asset
   * 
   * Examples:
   * - "Woman in her 30s, warm smile, casual home setting, natural lighting"
   * - "30-second UGC script about BB cream solving acne problems"
   * - "Modern living room with afternoon sunlight, warm tones"
   * 
   * The AI reads this naturally, no need to parse structured fields.
   */
  description: string;
  
  /** 
   * NATURAL GPT-4o analysis (optional)
   * 
   * For images: Natural visual description from GPT-4o Vision
   * For scripts: Natural analysis of tone, structure, duration
   * 
   * Example: "This image shows a person in natural lighting with a genuine 
   * smile. Perfect for UGC-style avatar. No products or props visible. 
   * Clean, professional-casual aesthetic."
   */
  analysis?: string;
  
  // ===== Context (Minimal Structure) =====
  
  /** Associated storyboard ID (if applicable) */
  storyboardId?: string;
  
  /** Associated scene number (if applicable) */
  sceneNumber?: number;
  
  /** Frame position if this is a scene frame */
  framePosition?: 'first' | 'last';
  
  /** Tool call that created this asset (for tracking) */
  toolCallId?: string;
  
  // ===== User Interaction =====
  
  /** Whether user explicitly approved this asset */
  approved?: boolean;
  
  /** When user approved (if applicable) */
  approvedAt?: string;
  
  /** Error message if generation failed */
  error?: string;
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

// ===== Helper Functions =====

/**
 * Create an empty media pool
 */
export function createEmptyMediaPool(): MediaPool {
  return {
    assets: {},
    byType: {},
    byConversation: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Add an asset to the media pool
 */
export function addAssetToPool(
  pool: MediaPool,
  asset: Omit<MediaAsset, 'id' | 'createdAt' | 'updatedAt'>
): { pool: MediaPool; assetId: string } {
  const assetId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const newAsset: MediaAsset = {
    ...asset,
    id: assetId,
    createdAt: now,
    updatedAt: now,
  };
  
  const newPool: MediaPool = {
    ...pool,
    assets: { ...pool.assets, [assetId]: newAsset },
    byType: { ...pool.byType },
    byConversation: [...pool.byConversation, assetId],
    lastUpdated: now,
  };
  
  // Update type index
  const typeAssets = newPool.byType[asset.type] || [];
  newPool.byType[asset.type] = [...typeAssets, assetId];
  
  return { pool: newPool, assetId };
}

/**
 * Update an existing asset in the pool
 */
export function updateAsset(
  pool: MediaPool,
  assetId: string,
  updates: Partial<Omit<MediaAsset, 'id' | 'createdAt'>>
): MediaPool {
  const existing = pool.assets[assetId];
  if (!existing) return pool;
  
  const now = new Date().toISOString();
  const updatedAsset: MediaAsset = {
    ...existing,
    ...updates,
    updatedAt: now,
  };
  
  return {
    ...pool,
    assets: { ...pool.assets, [assetId]: updatedAsset },
    lastUpdated: now,
  };
}

/**
 * Approve an asset (user confirmation)
 */
export function approveAsset(pool: MediaPool, assetId: string): MediaPool {
  const asset = pool.assets[assetId];
  if (!asset) return pool;
  
  const now = new Date().toISOString();
  
  return updateAsset(pool, assetId, {
    approved: true,
    approvedAt: now,
  });
}

/**
 * Set the active avatar for the conversation
 */
export function setActiveAvatar(pool: MediaPool, assetId: string): MediaPool {
  const asset = pool.assets[assetId];
  if (!asset) return pool;
  
  return {
    ...pool,
    activeAvatarId: assetId,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Set the active product for the conversation
 */
export function setActiveProduct(pool: MediaPool, assetId: string): MediaPool {
  const asset = pool.assets[assetId];
  if (!asset) return pool;
  
  return {
    ...pool,
    activeProductId: assetId,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Set the approved script for the conversation
 */
export function setApprovedScript(pool: MediaPool, assetId: string): MediaPool {
  const asset = pool.assets[assetId];
  if (!asset) return pool;
  
  return {
    ...pool,
    approvedScriptId: assetId,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get available assets by type (flexible query)
 */
export function getAssetsByType(pool: MediaPool, type: string): MediaAsset[] {
  const assetIds = pool.byType[type] || [];
  return assetIds
    .map(id => pool.assets[id])
    .filter(asset => asset !== undefined);
}

/**
 * Get all approved assets
 */
export function getApprovedAssets(pool: MediaPool): MediaAsset[] {
  return Object.values(pool.assets).filter(asset => asset.approved === true);
}

/**
 * Get all ready assets (generated/uploaded successfully)
 */
export function getReadyAssets(pool: MediaPool): MediaAsset[] {
  return Object.values(pool.assets).filter(asset => asset.status === 'ready');
}

/**
 * Get asset by ID
 */
export function getAsset(pool: MediaPool, assetId: string): MediaAsset | null {
  return pool.assets[assetId] || null;
}

/**
 * Get the active avatar asset
 */
export function getActiveAvatar(pool: MediaPool): MediaAsset | null {
  if (!pool.activeAvatarId) return null;
  return getAsset(pool, pool.activeAvatarId);
}

/**
 * Get the active product asset
 */
export function getActiveProduct(pool: MediaPool): MediaAsset | null {
  if (!pool.activeProductId) return null;
  return getAsset(pool, pool.activeProductId);
}

/**
 * Get the approved script asset
 */
export function getApprovedScript(pool: MediaPool): MediaAsset | null {
  if (!pool.approvedScriptId) return null;
  return getAsset(pool, pool.approvedScriptId);
}

/**
 * Build natural context string for AI from media pool
 * 
 * Returns human-readable description of all available assets
 * for the AI to read and understand naturally.
 */
export function buildNaturalMediaPoolContext(pool: MediaPool): string {
  const assets = Object.values(pool.assets).filter(a => a.status === 'ready');
  
  if (assets.length === 0) {
    return 'No assets available yet.';
  }
  
  const lines = assets.map(asset => {
    const approvedBadge = asset.approved ? ' [APPROVED]' : '';
    const activeBadge = 
      asset.id === pool.activeAvatarId ? ' [ACTIVE AVATAR]' :
      asset.id === pool.activeProductId ? ' [ACTIVE PRODUCT]' :
      asset.id === pool.approvedScriptId ? ' [APPROVED SCRIPT]' : '';
    
    return `- ${asset.type}${approvedBadge}${activeBadge}: ${asset.description}`;
  });
  
  return lines.join('\n');
}

/**
 * Check if required assets are available for storyboard creation
 */
export function checkRequiredAssets(
  pool: MediaPool,
  requirements: {
    needsAvatar?: boolean;
    needsScript?: boolean;
    needsProduct?: boolean;
  }
): string[] {
  const missing: string[] = [];
  
  if (requirements.needsAvatar && !pool.activeAvatarId) {
    missing.push('avatar/character image');
  }
  
  if (requirements.needsScript && !pool.approvedScriptId) {
    missing.push('approved script');
  }
  
  if (requirements.needsProduct && !pool.activeProductId) {
    missing.push('product image');
  }
  
  return missing;
}
