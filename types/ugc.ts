// =============================================================================
// UGC DATA MODEL - Capability-Based (No Rigid Phases)
// =============================================================================

// -----------------------------------------------------------------------------
// Job & Status Types
// -----------------------------------------------------------------------------

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed';

export type JobInfo = {
  jobId: string;
  status: JobStatus;
  progress?: number; // 0-100
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
};

// -----------------------------------------------------------------------------
// Project Format & Settings
// -----------------------------------------------------------------------------

export type AspectRatio = '9:16' | '1:1' | '16:9';
export type TargetDuration = 15 | 30 | 45 | 60;
export type Language = 'en' | 'fr' | 'es' | 'de' | 'pt' | 'it' | 'nl' | 'ar' | 'zh' | 'ja' | 'ko';

export type ProjectSettings = {
  aspectRatio: AspectRatio;
  targetDuration: TargetDuration;
  fps: 24 | 30 | 60;
  resolution: '720p' | '1080p' | '4k';
  language: Language;
  region?: string;
};

// -----------------------------------------------------------------------------
// Creative Brief (Versioned)
// -----------------------------------------------------------------------------

export type ProductType = 'physical' | 'digital' | 'service' | 'app' | 'course';
export type BrandTone = 'playful' | 'premium' | 'clinical' | 'edgy' | 'minimal' | 'bold' | 'authentic';
export type PrimaryGoal = 'sales' | 'leads' | 'installs' | 'awareness' | 'engagement';

export type CreativeBrief = {
  id: string;
  version: number;
  
  // Product info
  productName: string;
  productType: ProductType;
  productCategory?: string;
  landingPageUrl?: string;
  productDescription?: string;
  
  // Brand
  brandName?: string;
  brandTone: BrandTone[];
  
  // Audience
  targetAudience: string;
  audienceAge?: string;
  audienceGender?: string;
  audienceInterests?: string[];
  
  // Campaign
  primaryGoal: PrimaryGoal;
  offer?: string;
  cta: string;
  ctaCustom?: string;
  
  // Claims & proof
  keyClaims: string[];
  proofTypes?: ('testimonial' | 'statistic' | 'demo' | 'before-after' | 'ugc')[];
  
  // Constraints
  mustSay?: string[];
  mustNotSay?: string[];
  disclaimers?: string[];
  competitorRules?: string;
  complianceDomain?: 'health' | 'finance' | 'alcohol' | 'gambling' | 'none';
  
  // Assets
  productImages?: string[];
  logoUrl?: string;
  brandGuideUrl?: string;
  previousAds?: string[];
  
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Actor / Creator
// -----------------------------------------------------------------------------

export type ActorDemographics = {
  ageRange: string;
  gender: 'male' | 'female' | 'non-binary';
  ethnicity?: string;
  style: string;
};

export type ActorOption = {
  id: string;
  label: string;
  description: string;
  personaTags: string[];
  demographics: ActorDemographics;
  
  // Visual anchors
  imageUrl?: string;
  imageJobId?: string;
  imageStatus: JobStatus;
  prompt: string;
  
  // Voice
  voiceVibe?: string;
  
  // Consistency
  consistencyToken?: string;
  wardrobeDescription?: string;
  settingDescription?: string;
  
  createdAt: Date;
};

// -----------------------------------------------------------------------------
// Style Bible (Visual Consistency)
// -----------------------------------------------------------------------------

export type StyleBible = {
  id: string;
  projectId: string;
  
  // Actor anchor
  actorAnchorUrl?: string;
  actorDescription: string;
  
  // Environment
  wardrobeDescription: string;
  environmentDescription: string;
  lightingDescription: string;
  
  // Camera
  cameraStyle: string;
  shotTypes: string[];
  
  // Typography
  fontFamily?: string;
  textStyle?: string;
  
  // Negative constraints
  negativePrompt: string;
  
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Direction Lock
// -----------------------------------------------------------------------------

export type FilmingStyle = 'talking-head' | 'product-demo' | 'lifestyle' | 'split-screen' | 'mixed';
export type StructureTemplate = 'hook-problem-solution-cta' | 'hook-demo-cta' | 'story-arc' | 'listicle' | 'custom';

export type DirectionLock = {
  id: string;
  projectId: string;
  
  filmingStyle: FilmingStyle;
  structureTemplate: StructureTemplate;
  settingDescription: string;
  
  // Voice & subtitles
  voiceMode: 'actor-speaks' | 'voiceover' | 'text-only' | 'mixed';
  subtitlesEnabled: boolean;
  subtitleStyle?: 'ugc-bold' | 'minimal' | 'kinetic';
  
  // Product visibility
  productVisibility: 'always' | 'sometimes' | 'never';
  
  // Style Bible reference
  styleBibleId?: string;
  
  lockedAt: Date;
};

// -----------------------------------------------------------------------------
// Scene & Keyframes
// -----------------------------------------------------------------------------

export type BeatType = 'hook' | 'problem' | 'solution' | 'proof' | 'demo' | 'cta' | 'transition';
export type ShotType = 'close-up' | 'medium' | 'wide' | 'over-shoulder' | 'pov' | 'product-insert';

export type Keyframe = {
  id: string;
  position: 'first' | 'mid' | 'last';
  imageUrl?: string;
  imageJobId?: string;
  status: JobStatus;
  prompt: string;
};

export type Scene = {
  id: string;
  order: number;
  version: number;
  
  // Beat info
  beatType: BeatType;
  objective: string;
  duration: number; // seconds
  
  // Script
  script: string;
  voiceover?: string;
  onScreenText?: string;
  actionNotes?: string;
  complianceNotes?: string;
  
  // Visual
  shotType: ShotType;
  cameraDescription?: string;
  settingOverride?: string;
  
  // Keyframes
  keyframes: Keyframe[];
  
  // Video generation
  veoPrompt?: string;
  negativePrompt?: string;
  
  // Status
  isApproved: boolean;
  approvedAt?: Date;
  
  // Validation
  validationErrors?: string[];
  
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Storyboard (Versioned)
// -----------------------------------------------------------------------------

export type Storyboard = {
  id: string;
  projectId: string;
  version: number;
  
  scenes: Scene[];
  totalDuration: number;
  
  isApproved: boolean;
  approvedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Video Clip
// -----------------------------------------------------------------------------

export type ClipFeedback = 
  | 'too-much-motion'
  | 'actor-looks-different'
  | 'product-unclear'
  | 'lighting-inconsistent'
  | 'text-artifacts'
  | 'audio-issue'
  | 'other';

export type Clip = {
  id: string;
  sceneId: string;
  version: number;
  
  // Generation
  jobId?: string;
  status: JobStatus;
  progress?: number;
  
  // Output
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  
  // Feedback
  feedback?: ClipFeedback[];
  feedbackNotes?: string;
  autoFixSuggestion?: string;
  
  createdAt: Date;
};

// -----------------------------------------------------------------------------
// Final Edit / Assembly
// -----------------------------------------------------------------------------

export type TransitionType = 'cut' | 'swipe' | 'fade' | 'none';

export type OverlayConfig = {
  benefitBullets?: boolean;
  priceOfferBadge?: boolean;
  ctaEndCard?: boolean;
};

export type EndCard = {
  brandName: string;
  ctaText: string;
  offerText?: string;
  disclaimer?: string;
  logoUrl?: string;
};

export type SubtitleConfig = {
  enabled: boolean;
  style: 'ugc-bold' | 'minimal' | 'kinetic';
  burnIn: boolean;
};

export type FinalEdit = {
  id: string;
  projectId: string;
  storyboardVersion: number;
  
  // Clip order
  clipOrder: string[]; // clip IDs in order
  
  // Transitions
  transitions: Record<string, TransitionType>; // after clip ID -> transition type
  
  // Audio
  musicTrackUrl?: string;
  musicVolume?: number;
  
  // Subtitles
  subtitles: SubtitleConfig;
  
  // Overlays
  overlays: OverlayConfig;
  endCard?: EndCard;
  
  // Export
  exportFormats: AspectRatio[];
  
  // Output
  finalVideoUrl?: string;
  exportJobId?: string;
  exportStatus: JobStatus;
  
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Version Entry (for history tracking)
// -----------------------------------------------------------------------------

export type VersionEntry = {
  id: string;
  projectId: string;
  entityType: 'brief' | 'storyboard' | 'clip';
  entityId: string;
  version: number;
  snapshot: any; // JSON snapshot of the entity at this version
  reason?: string;
  createdAt: Date;
};

// -----------------------------------------------------------------------------
// Project (Main Entity) - CAPABILITY-BASED
// -----------------------------------------------------------------------------

export type UgcProject = {
  id: string;
  name: string;
  userId: string;
  
  // Settings
  settings: ProjectSettings;
  
  // Core entities (optional - capability-based)
  brief?: CreativeBrief;
  actors: ActorOption[];
  selectedActorId?: string;
  styleBible?: StyleBible;
  directionLock?: DirectionLock;
  storyboard?: Storyboard;
  clips: Clip[];
  finalEdit?: FinalEdit;
  
  // Version tracking
  briefVersion: number;
  storyboardVersion: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
};

// -----------------------------------------------------------------------------
// Capability Selectors (Derived from Project State)
// -----------------------------------------------------------------------------

export function getProjectCapabilities(project: UgcProject | null) {
  if (!project) {
    return {
      hasBrief: false,
      hasActors: false,
      hasSelectedActor: false,
      hasStyleBible: false,
      hasDirectionLock: false,
      hasStoryboard: false,
      isStoryboardApproved: false,
      hasAllKeyframes: false,
      hasClips: false,
      hasAllClipsReady: false,
      hasFinalEdit: false,
      hasFinalExport: false,
      canGenerateActors: false,
      canGenerateStoryboard: false,
      canGenerateVideos: false,
      canAssemble: false,
    };
  }
  
  const hasBrief = !!project.brief?.productName && !!project.brief?.targetAudience;
  const hasActors = project.actors.length > 0;
  const hasSelectedActor = !!project.selectedActorId && project.actors.some(a => a.id === project.selectedActorId);
  const hasStyleBible = !!project.styleBible;
  const hasDirectionLock = !!project.directionLock;
  const hasStoryboard = !!project.storyboard && project.storyboard.scenes.length > 0;
  const isStoryboardApproved = !!project.storyboard?.isApproved;
  
  const hasAllKeyframes = hasStoryboard && project.storyboard!.scenes.every(
    s => s.keyframes.length >= 2 && s.keyframes.every(k => k.status === 'complete')
  );
  
  const hasClips = project.clips.length > 0;
  const hasAllClipsReady = hasStoryboard && 
    project.storyboard!.scenes.every(s => 
      project.clips.some(c => c.sceneId === s.id && c.status === 'complete')
    );
  
  const hasFinalEdit = !!project.finalEdit;
  const hasFinalExport = !!project.finalEdit?.finalVideoUrl;
  
  // Action availability
  const canGenerateActors = hasBrief;
  const canGenerateStoryboard = hasSelectedActor && hasDirectionLock;
  const canGenerateVideos = isStoryboardApproved && hasAllKeyframes;
  const canAssemble = hasAllClipsReady;
  
  return {
    hasBrief,
    hasActors,
    hasSelectedActor,
    hasStyleBible,
    hasDirectionLock,
    hasStoryboard,
    isStoryboardApproved,
    hasAllKeyframes,
    hasClips,
    hasAllClipsReady,
    hasFinalEdit,
    hasFinalExport,
    canGenerateActors,
    canGenerateStoryboard,
    canGenerateVideos,
    canAssemble,
  };
}

export type ProjectCapabilities = ReturnType<typeof getProjectCapabilities>;

// -----------------------------------------------------------------------------
// Agent Response Protocol
// -----------------------------------------------------------------------------

export type WidgetType =
  | 'intake'
  | 'brief_summary'
  | 'actor_selection'
  | 'clarification'
  | 'direction_lock'
  | 'storyboard'
  | 'scene_card'
  | 'approval_gate'
  | 'generation_queue'
  | 'assembly'
  | 'qcm'
  | 'status'
  | 'error';

export type WidgetBlock = {
  id: string;
  type: WidgetType;
  data: any;
  timestamp: Date;
};

export type QcmOption = {
  id: string;
  label: string;
  description?: string;
  value: any;
};

export type QcmBlock = {
  id: string;
  type: 'qcm';
  data: {
    question: string;
    options: QcmOption[];
    allowMultiple: boolean;
    required: boolean;
  };
  timestamp: Date;
};

export type ToolCall = {
  id: string;
  tool: 'generate_actors' | 'generate_keyframes' | 'generate_video' | 'assemble' | 'regenerate_scene' | 'regenerate_keyframe';
  params: Record<string, any>;
  status: JobStatus;
  result?: any;
};

export type AgentResponse = {
  message: string;
  contextPatch?: Partial<UgcProject>;
  blocks?: WidgetBlock[];
  toolCalls?: ToolCall[];
  capabilities?: ProjectCapabilities;
  suggestedActions?: string[];
};

// -----------------------------------------------------------------------------
// Chat Message
// -----------------------------------------------------------------------------

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: { type: 'image' | 'video' | 'file'; url: string; label?: string }[];
  blocks?: WidgetBlock[];
  toolCalls?: ToolCall[];
};

// -----------------------------------------------------------------------------
// Validation Types
// -----------------------------------------------------------------------------

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type SceneValidation = {
  sceneId: string;
  hasScript: boolean;
  hasKeyframes: boolean;
  hasProductVisibility: boolean;
  hasActionNotes: boolean;
  hasVeoPrompt: boolean;
  errors: string[];
};

export function validateSceneForApproval(scene: Scene, brief?: CreativeBrief): SceneValidation {
  const errors: string[] = [];
  
  const hasScript = !!scene.script || !!scene.voiceover;
  const hasKeyframes = scene.keyframes.filter(k => k.status === 'complete').length >= 2;
  const hasActionNotes = !!scene.actionNotes;
  const hasVeoPrompt = !!scene.veoPrompt;
  
  // Product visibility check for physical products
  let hasProductVisibility = true;
  if (brief?.productType === 'physical') {
    // At least one keyframe should show product (simplified check)
    hasProductVisibility = scene.keyframes.some(k => 
      k.prompt.toLowerCase().includes('product') || 
      k.prompt.toLowerCase().includes(brief.productName?.toLowerCase() || '')
    );
  }
  
  if (!hasScript) errors.push('Scene needs dialogue, VO, or text plan');
  if (!hasKeyframes) errors.push('Scene needs at least first and last keyframes');
  if (!hasActionNotes) errors.push('Scene needs action notes');
  if (!hasVeoPrompt) errors.push('Scene needs a Veo prompt');
  if (!hasProductVisibility && brief?.productType === 'physical') {
    errors.push('Physical product must be visible in at least one keyframe');
  }
  
  return {
    sceneId: scene.id,
    hasScript,
    hasKeyframes,
    hasProductVisibility,
    hasActionNotes,
    hasVeoPrompt,
    errors,
  };
}

export function validateStoryboardForApproval(storyboard: Storyboard, brief?: CreativeBrief): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (storyboard.scenes.length === 0) {
    errors.push('Storyboard has no scenes');
  }
  
  for (const scene of storyboard.scenes) {
    const sceneValidation = validateSceneForApproval(scene, brief);
    if (sceneValidation.errors.length > 0) {
      errors.push(`Scene ${scene.order + 1}: ${sceneValidation.errors.join(', ')}`);
    }
  }
  
  // Duration check
  if (storyboard.totalDuration < 10) {
    warnings.push('Total duration is very short (< 10s)');
  }
  
  // Hook check
  const hasHook = storyboard.scenes.some(s => s.beatType === 'hook');
  if (!hasHook) {
    warnings.push('Storyboard has no hook scene');
  }
  
  // CTA check
  const hasCta = storyboard.scenes.some(s => s.beatType === 'cta');
  if (!hasCta) {
    warnings.push('Storyboard has no CTA scene');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
