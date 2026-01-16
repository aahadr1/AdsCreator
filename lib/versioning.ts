// =============================================================================
// VERSIONING SYSTEM - Track changes and manage forks
// =============================================================================

import type {
  UgcProject,
  CreativeBrief,
  Storyboard,
  Clip,
  VersionEntry,
} from '@/types/ugc';
import { getVersionHistory, getVersion } from './projectStore';

// -----------------------------------------------------------------------------
// Version Comparison
// -----------------------------------------------------------------------------

export type VersionDiff = {
  field: string;
  oldValue: any;
  newValue: any;
};

export function compareBriefs(
  oldBrief: CreativeBrief,
  newBrief: CreativeBrief
): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  const keys: (keyof CreativeBrief)[] = [
    'productName',
    'productType',
    'targetAudience',
    'brandTone',
    'primaryGoal',
    'offer',
    'cta',
    'keyClaims',
  ];
  
  for (const key of keys) {
    const oldVal = JSON.stringify(oldBrief[key]);
    const newVal = JSON.stringify(newBrief[key]);
    if (oldVal !== newVal) {
      diffs.push({
        field: key,
        oldValue: oldBrief[key],
        newValue: newBrief[key],
      });
    }
  }
  
  return diffs;
}

export function compareStoryboards(
  oldStoryboard: Storyboard,
  newStoryboard: Storyboard
): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  
  // Scene count change
  if (oldStoryboard.scenes.length !== newStoryboard.scenes.length) {
    diffs.push({
      field: 'sceneCount',
      oldValue: oldStoryboard.scenes.length,
      newValue: newStoryboard.scenes.length,
    });
  }
  
  // Scene-by-scene comparison
  const maxScenes = Math.max(oldStoryboard.scenes.length, newStoryboard.scenes.length);
  for (let i = 0; i < maxScenes; i++) {
    const oldScene = oldStoryboard.scenes[i];
    const newScene = newStoryboard.scenes[i];
    
    if (!oldScene && newScene) {
      diffs.push({
        field: `scene_${i}_added`,
        oldValue: null,
        newValue: newScene.beatType,
      });
    } else if (oldScene && !newScene) {
      diffs.push({
        field: `scene_${i}_removed`,
        oldValue: oldScene.beatType,
        newValue: null,
      });
    } else if (oldScene && newScene) {
      // Compare scene fields
      if (oldScene.script !== newScene.script) {
        diffs.push({
          field: `scene_${i}_script`,
          oldValue: oldScene.script,
          newValue: newScene.script,
        });
      }
      if (oldScene.veoPrompt !== newScene.veoPrompt) {
        diffs.push({
          field: `scene_${i}_prompt`,
          oldValue: oldScene.veoPrompt,
          newValue: newScene.veoPrompt,
        });
      }
      if (oldScene.duration !== newScene.duration) {
        diffs.push({
          field: `scene_${i}_duration`,
          oldValue: oldScene.duration,
          newValue: newScene.duration,
        });
      }
    }
  }
  
  return diffs;
}

// -----------------------------------------------------------------------------
// Out-of-Date Detection
// -----------------------------------------------------------------------------

export type OutOfDateWarning = {
  entityType: 'storyboard' | 'clips' | 'finalEdit';
  reason: string;
  severity: 'info' | 'warning' | 'critical';
  suggestedAction: string;
};

export function checkOutOfDate(project: UgcProject): OutOfDateWarning[] {
  const warnings: OutOfDateWarning[] = [];
  
  // Check if storyboard is out of date with brief
  if (project.storyboard && project.brief) {
    const storyboardCreatedAt = new Date(project.storyboard.createdAt).getTime();
    const briefUpdatedAt = new Date(project.brief.updatedAt).getTime();
    
    if (briefUpdatedAt > storyboardCreatedAt) {
      warnings.push({
        entityType: 'storyboard',
        reason: 'Brief was modified after storyboard was created',
        severity: 'warning',
        suggestedAction: 'Regenerate storyboard or review for consistency',
      });
    }
  }
  
  // Check if clips are out of date with storyboard
  if (project.clips.length > 0 && project.storyboard) {
    const storyboardUpdatedAt = new Date(project.storyboard.updatedAt).getTime();
    const oldClips = project.clips.filter(c => {
      const clipCreatedAt = new Date(c.createdAt).getTime();
      return clipCreatedAt < storyboardUpdatedAt;
    });
    
    if (oldClips.length > 0) {
      warnings.push({
        entityType: 'clips',
        reason: `${oldClips.length} clip(s) were generated before storyboard changes`,
        severity: 'warning',
        suggestedAction: 'Regenerate affected clips',
      });
    }
  }
  
  // Check if final edit references outdated clips
  if (project.finalEdit && project.clips.length > 0) {
    const referencedClipIds = new Set(project.finalEdit.clipOrder);
    const currentClipIds = new Set(project.clips.filter(c => c.status === 'complete').map(c => c.id));
    
    const missingClips = [...referencedClipIds].filter(id => !currentClipIds.has(id));
    if (missingClips.length > 0) {
      warnings.push({
        entityType: 'finalEdit',
        reason: `Final edit references ${missingClips.length} clip(s) that are no longer available`,
        severity: 'critical',
        suggestedAction: 'Update final edit clip order',
      });
    }
  }
  
  return warnings;
}

// -----------------------------------------------------------------------------
// Fork Management
// -----------------------------------------------------------------------------

export type ForkResult = {
  shouldFork: boolean;
  reason?: string;
  affectedEntities: ('storyboard' | 'clips' | 'finalEdit')[];
  requiredRegeneration: string[];
};

export function analyzeForkNeeds(
  project: UgcProject,
  changeType: 'brief' | 'actor' | 'scene' | 'keyframe'
): ForkResult {
  const affectedEntities: ForkResult['affectedEntities'] = [];
  const requiredRegeneration: string[] = [];
  
  if (changeType === 'brief') {
    // Brief changes after storyboard exists
    if (project.storyboard) {
      affectedEntities.push('storyboard');
      requiredRegeneration.push('Review storyboard for consistency with new brief');
      
      if (project.storyboard.isApproved) {
        return {
          shouldFork: true,
          reason: 'Brief changed after storyboard was approved',
          affectedEntities,
          requiredRegeneration,
        };
      }
    }
    
    if (project.clips.length > 0) {
      affectedEntities.push('clips');
      requiredRegeneration.push('Some clips may need regeneration');
    }
  }
  
  if (changeType === 'actor') {
    // Actor change affects all visuals
    if (project.storyboard) {
      affectedEntities.push('storyboard');
      requiredRegeneration.push('Regenerate all keyframes with new actor');
    }
    
    if (project.clips.length > 0) {
      affectedEntities.push('clips');
      requiredRegeneration.push('Regenerate all video clips with new actor');
    }
    
    if (project.storyboard?.isApproved) {
      return {
        shouldFork: true,
        reason: 'Actor changed after storyboard was approved',
        affectedEntities,
        requiredRegeneration,
      };
    }
  }
  
  if (changeType === 'scene') {
    // Scene edit after approval
    if (project.storyboard?.isApproved) {
      affectedEntities.push('storyboard');
      return {
        shouldFork: true,
        reason: 'Scene edited after storyboard was approved',
        affectedEntities,
        requiredRegeneration: ['Regenerate keyframes for edited scene', 'Regenerate video clip for edited scene'],
      };
    }
  }
  
  if (changeType === 'keyframe') {
    // Keyframe regeneration after clip exists
    const clipExists = project.clips.some(c => c.status === 'complete');
    if (clipExists) {
      affectedEntities.push('clips');
      requiredRegeneration.push('Regenerate video clip for scene with new keyframe');
    }
  }
  
  return {
    shouldFork: false,
    affectedEntities,
    requiredRegeneration,
  };
}

// -----------------------------------------------------------------------------
// Version History Display
// -----------------------------------------------------------------------------

export type VersionHistoryItem = {
  type: 'brief' | 'storyboard' | 'clip';
  version: number;
  createdAt: Date;
  reason?: string;
  isCurrent: boolean;
};

export async function getProjectVersionHistory(
  project: UgcProject
): Promise<VersionHistoryItem[]> {
  const history: VersionHistoryItem[] = [];
  
  // Get brief versions
  const briefVersions = await getVersionHistory(project.id, 'brief');
  for (const v of briefVersions) {
    history.push({
      type: 'brief',
      version: v.version,
      createdAt: v.createdAt,
      reason: v.reason,
      isCurrent: false,
    });
  }
  if (project.brief) {
    history.push({
      type: 'brief',
      version: project.briefVersion,
      createdAt: project.brief.updatedAt,
      isCurrent: true,
    });
  }
  
  // Get storyboard versions
  const storyboardVersions = await getVersionHistory(project.id, 'storyboard');
  for (const v of storyboardVersions) {
    history.push({
      type: 'storyboard',
      version: v.version,
      createdAt: v.createdAt,
      reason: v.reason,
      isCurrent: false,
    });
  }
  if (project.storyboard) {
    history.push({
      type: 'storyboard',
      version: project.storyboardVersion,
      createdAt: project.storyboard.updatedAt,
      isCurrent: true,
    });
  }
  
  // Sort by date
  return history.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
