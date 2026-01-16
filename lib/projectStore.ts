// =============================================================================
// PROJECT STORE - Supabase-backed with in-memory fallback
// =============================================================================

import type {
  UgcProject,
  CreativeBrief,
  ActorOption,
  StyleBible,
  DirectionLock,
  Storyboard,
  Scene,
  Clip,
  FinalEdit,
  ProjectSettings,
  VersionEntry,
} from '@/types/ugc';

// In-memory store for development (no Supabase required)
const memoryStore: Map<string, UgcProject> = new Map();
const versionStore: Map<string, VersionEntry[]> = new Map();

// -----------------------------------------------------------------------------
// ID Generation
// -----------------------------------------------------------------------------

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// -----------------------------------------------------------------------------
// Project CRUD
// -----------------------------------------------------------------------------

export async function createProject(
  userId: string,
  name: string,
  settings?: Partial<ProjectSettings>
): Promise<UgcProject> {
  const project: UgcProject = {
    id: generateId(),
    name,
    userId,
    settings: {
      aspectRatio: settings?.aspectRatio || '9:16',
      targetDuration: settings?.targetDuration || 30,
      fps: settings?.fps || 30,
      resolution: settings?.resolution || '1080p',
      language: settings?.language || 'en',
      region: settings?.region,
    },
    actors: [],
    clips: [],
    briefVersion: 0,
    storyboardVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  memoryStore.set(project.id, project);
  return project;
}

export async function getProject(projectId: string): Promise<UgcProject | null> {
  return memoryStore.get(projectId) || null;
}

export async function getProjectsByUser(userId: string): Promise<UgcProject[]> {
  const projects: UgcProject[] = [];
  for (const project of memoryStore.values()) {
    if (project.userId === userId) {
      projects.push(project);
    }
  }
  return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function updateProject(
  projectId: string,
  updates: Partial<UgcProject>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const updated = {
    ...project,
    ...updates,
    updatedAt: new Date(),
  };
  
  memoryStore.set(projectId, updated);
  return updated;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  return memoryStore.delete(projectId);
}

// -----------------------------------------------------------------------------
// Brief Operations
// -----------------------------------------------------------------------------

export async function updateBrief(
  projectId: string,
  briefData: Partial<CreativeBrief>,
  createVersion = true
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const newVersion = createVersion ? project.briefVersion + 1 : project.briefVersion;
  
  const brief: CreativeBrief = {
    id: project.brief?.id || generateId(),
    version: newVersion,
    productName: briefData.productName || project.brief?.productName || '',
    productType: briefData.productType || project.brief?.productType || 'physical',
    brandTone: briefData.brandTone || project.brief?.brandTone || ['authentic'],
    targetAudience: briefData.targetAudience || project.brief?.targetAudience || '',
    primaryGoal: briefData.primaryGoal || project.brief?.primaryGoal || 'sales',
    cta: briefData.cta || project.brief?.cta || 'Shop now',
    keyClaims: briefData.keyClaims || project.brief?.keyClaims || [],
    ...briefData,
    createdAt: project.brief?.createdAt || new Date(),
    updatedAt: new Date(),
  };
  
  // Save version snapshot
  if (createVersion && project.brief) {
    await saveVersionSnapshot(projectId, 'brief', project.brief.id, project.briefVersion, project.brief);
  }
  
  return updateProject(projectId, {
    brief,
    briefVersion: newVersion,
  });
}

// -----------------------------------------------------------------------------
// Actor Operations
// -----------------------------------------------------------------------------

export async function addActors(
  projectId: string,
  actors: Omit<ActorOption, 'createdAt'>[]
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const newActors = actors.map(a => ({
    ...a,
    createdAt: new Date(),
  }));
  
  return updateProject(projectId, {
    actors: [...project.actors, ...newActors],
  });
}

export async function updateActor(
  projectId: string,
  actorId: string,
  updates: Partial<ActorOption>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const actors = project.actors.map(a =>
    a.id === actorId ? { ...a, ...updates } : a
  );
  
  return updateProject(projectId, { actors });
}

export async function selectActor(
  projectId: string,
  actorId: string
): Promise<UgcProject | null> {
  return updateProject(projectId, { selectedActorId: actorId });
}

export async function removeActor(
  projectId: string,
  actorId: string
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const actors = project.actors.filter(a => a.id !== actorId);
  const selectedActorId = project.selectedActorId === actorId ? undefined : project.selectedActorId;
  
  return updateProject(projectId, { actors, selectedActorId });
}

// -----------------------------------------------------------------------------
// Style Bible Operations
// -----------------------------------------------------------------------------

export async function setStyleBible(
  projectId: string,
  styleBible: Omit<StyleBible, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const bible: StyleBible = {
    id: project.styleBible?.id || generateId(),
    projectId,
    ...styleBible,
    createdAt: project.styleBible?.createdAt || new Date(),
    updatedAt: new Date(),
  };
  
  return updateProject(projectId, { styleBible: bible });
}

// -----------------------------------------------------------------------------
// Direction Lock Operations
// -----------------------------------------------------------------------------

export async function setDirectionLock(
  projectId: string,
  direction: Omit<DirectionLock, 'id' | 'projectId' | 'lockedAt'>
): Promise<UgcProject | null> {
  const lock: DirectionLock = {
    id: generateId(),
    projectId,
    ...direction,
    lockedAt: new Date(),
  };
  
  return updateProject(projectId, { directionLock: lock });
}

// -----------------------------------------------------------------------------
// Storyboard Operations
// -----------------------------------------------------------------------------

export async function createStoryboard(
  projectId: string,
  scenes: Omit<Scene, 'createdAt' | 'updatedAt'>[]
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const newVersion = project.storyboardVersion + 1;
  
  // Save previous version if exists
  if (project.storyboard) {
    await saveVersionSnapshot(
      projectId,
      'storyboard',
      project.storyboard.id,
      project.storyboardVersion,
      project.storyboard
    );
  }
  
  const now = new Date();
  const storyboard: Storyboard = {
    id: generateId(),
    projectId,
    version: newVersion,
    scenes: scenes.map(s => ({
      ...s,
      createdAt: now,
      updatedAt: now,
    })),
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
    isApproved: false,
    createdAt: now,
    updatedAt: now,
  };
  
  return updateProject(projectId, {
    storyboard,
    storyboardVersion: newVersion,
  });
}

export async function updateScene(
  projectId: string,
  sceneId: string,
  updates: Partial<Scene>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project?.storyboard) return null;
  
  const scenes = project.storyboard.scenes.map(s =>
    s.id === sceneId ? { ...s, ...updates, updatedAt: new Date() } : s
  );
  
  const storyboard: Storyboard = {
    ...project.storyboard,
    scenes,
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
    updatedAt: new Date(),
  };
  
  return updateProject(projectId, { storyboard });
}

export async function approveStoryboard(projectId: string): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project?.storyboard) return null;
  
  const storyboard: Storyboard = {
    ...project.storyboard,
    isApproved: true,
    approvedAt: new Date(),
    updatedAt: new Date(),
  };
  
  return updateProject(projectId, { storyboard });
}

export async function approveScene(
  projectId: string,
  sceneId: string
): Promise<UgcProject | null> {
  return updateScene(projectId, sceneId, {
    isApproved: true,
    approvedAt: new Date(),
  });
}

// -----------------------------------------------------------------------------
// Clip Operations
// -----------------------------------------------------------------------------

export async function addClip(
  projectId: string,
  clip: Omit<Clip, 'createdAt'>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const newClip: Clip = {
    ...clip,
    createdAt: new Date(),
  };
  
  return updateProject(projectId, {
    clips: [...project.clips, newClip],
  });
}

export async function updateClip(
  projectId: string,
  clipId: string,
  updates: Partial<Clip>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const clips = project.clips.map(c =>
    c.id === clipId ? { ...c, ...updates } : c
  );
  
  return updateProject(projectId, { clips });
}

// -----------------------------------------------------------------------------
// Final Edit Operations
// -----------------------------------------------------------------------------

export async function setFinalEdit(
  projectId: string,
  edit: Omit<FinalEdit, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>
): Promise<UgcProject | null> {
  const project = memoryStore.get(projectId);
  if (!project) return null;
  
  const finalEdit: FinalEdit = {
    id: project.finalEdit?.id || generateId(),
    projectId,
    ...edit,
    createdAt: project.finalEdit?.createdAt || new Date(),
    updatedAt: new Date(),
  };
  
  return updateProject(projectId, { finalEdit });
}

// -----------------------------------------------------------------------------
// Version Management
// -----------------------------------------------------------------------------

async function saveVersionSnapshot(
  projectId: string,
  entityType: 'brief' | 'storyboard' | 'clip',
  entityId: string,
  version: number,
  snapshot: any,
  reason?: string
): Promise<void> {
  const key = `${projectId}:${entityType}`;
  const versions = versionStore.get(key) || [];
  
  versions.push({
    id: generateId(),
    projectId,
    entityType,
    entityId,
    version,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    reason,
    createdAt: new Date(),
  });
  
  versionStore.set(key, versions);
}

export async function getVersionHistory(
  projectId: string,
  entityType: 'brief' | 'storyboard' | 'clip'
): Promise<VersionEntry[]> {
  const key = `${projectId}:${entityType}`;
  return versionStore.get(key) || [];
}

export async function getVersion(
  projectId: string,
  entityType: 'brief' | 'storyboard' | 'clip',
  version: number
): Promise<VersionEntry | null> {
  const versions = await getVersionHistory(projectId, entityType);
  return versions.find(v => v.version === version) || null;
}

// -----------------------------------------------------------------------------
// Fork Detection (for post-approval changes)
// -----------------------------------------------------------------------------

export function shouldForkStoryboard(project: UgcProject): boolean {
  return project.storyboard?.isApproved === true;
}

export function shouldForkBrief(project: UgcProject): boolean {
  // Brief changes after storyboard exists may require re-generation
  return !!project.storyboard;
}
