/**
 * Workflow State Helper
 * 
 * Helps the assistant track progress through dynamic, user-specific workflows.
 * The assistant creates workflows based on user requests, then follows them automatically.
 */

export interface WorkflowState {
  goal: string;
  checklist: WorkflowChecklistItem[];
  currentStep: number;
  status: 'planning' | 'in_progress' | 'completed' | 'blocked';
  blockedReason?: string;
}

export interface WorkflowChecklistItem {
  id: string;
  item: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assetId?: string; // Link to media pool asset
  completedAt?: string;
}

/**
 * Create a dynamic workflow based on user request
 * 
 * The assistant analyzes the request and creates an appropriate checklist
 */
export function createWorkflowFromRequest(params: {
  userRequest: string;
  hasAvatar?: boolean;
  hasScript?: boolean;
  hasProduct?: boolean;
}): WorkflowState {
  
  const checklist: WorkflowChecklistItem[] = [];
  const lowerRequest = params.userRequest.toLowerCase();
  
  // Determine what's needed based on request
  const needsVideo = lowerRequest.includes('video') || lowerRequest.includes('ugc') || lowerRequest.includes('ad');
  const needsStoryboard = needsVideo || lowerRequest.includes('storyboard') || lowerRequest.includes('scene');
  const needsAvatar = !params.hasAvatar && (lowerRequest.includes('woman') || lowerRequest.includes('man') || lowerRequest.includes('person') || lowerRequest.includes('ugc'));
  const needsScript = !params.hasScript && (needsStoryboard || needsVideo);
  const needsProduct = !params.hasProduct && (lowerRequest.includes('product') || lowerRequest.includes('trying') || lowerRequest.includes('showcase'));
  
  let stepId = 1;
  
  // Build dynamic checklist
  if (needsAvatar) {
    checklist.push({
      id: String(stepId++),
      item: 'Avatar image',
      status: params.hasAvatar ? 'completed' : 'pending',
    });
  }
  
  if (needsScript) {
    checklist.push({
      id: String(stepId++),
      item: 'Script/dialogue',
      status: params.hasScript ? 'completed' : 'pending',
    });
  }
  
  if (needsProduct) {
    checklist.push({
      id: String(stepId++),
      item: 'Product image (optional but recommended)',
      status: params.hasProduct ? 'completed' : 'pending',
    });
  }
  
  if (needsStoryboard) {
    checklist.push({
      id: String(stepId++),
      item: 'Storyboard creation',
      status: 'pending',
    });
  }
  
  if (needsVideo) {
    checklist.push({
      id: String(stepId++),
      item: 'Video generation',
      status: 'pending',
    });
  }
  
  return {
    goal: params.userRequest,
    checklist,
    currentStep: 0,
    status: 'planning',
  };
}

/**
 * Update workflow state when an item is completed
 */
export function markItemCompleted(
  workflow: WorkflowState,
  itemId: string,
  assetId?: string
): WorkflowState {
  const updatedChecklist = workflow.checklist.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        status: 'completed' as const,
        completedAt: new Date().toISOString(),
        assetId: assetId,
      };
    }
    return item;
  });
  
  // Find next pending item
  const nextPendingIndex = updatedChecklist.findIndex(item => item.status === 'pending');
  const currentStep = nextPendingIndex >= 0 ? nextPendingIndex : updatedChecklist.length - 1;
  
  // Check if all completed
  const allCompleted = updatedChecklist.every(item => item.status === 'completed' || item.status === 'skipped');
  
  return {
    ...workflow,
    checklist: updatedChecklist,
    currentStep,
    status: allCompleted ? 'completed' : 'in_progress',
  };
}

/**
 * Mark current item as in progress
 */
export function markItemInProgress(
  workflow: WorkflowState,
  itemId: string
): WorkflowState {
  const updatedChecklist = workflow.checklist.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        status: 'in_progress' as const,
      };
    }
    return item;
  });
  
  return {
    ...workflow,
    checklist: updatedChecklist,
    status: 'in_progress',
  };
}

/**
 * Get the next pending item in the workflow
 */
export function getNextPendingItem(workflow: WorkflowState): WorkflowChecklistItem | null {
  return workflow.checklist.find(item => item.status === 'pending') || null;
}

/**
 * Get current in-progress item
 */
export function getCurrentItem(workflow: WorkflowState): WorkflowChecklistItem | null {
  return workflow.checklist.find(item => item.status === 'in_progress') || null;
}

/**
 * Check if workflow is complete
 */
export function isWorkflowComplete(workflow: WorkflowState): boolean {
  return workflow.checklist.every(item => 
    item.status === 'completed' || item.status === 'skipped'
  );
}

/**
 * Get workflow progress summary (for reflexion block)
 */
export function getWorkflowProgress(workflow: WorkflowState): string {
  const lines = workflow.checklist.map(item => {
    const statusIcon = 
      item.status === 'completed' ? '✅' :
      item.status === 'in_progress' ? '🔄' :
      item.status === 'skipped' ? '⏭️' : '□';
    
    const assetNote = item.assetId ? ` (asset: ${item.assetId.substring(0, 8)}...)` : '';
    
    return `${statusIcon} ${item.item}${assetNote}`;
  });
  
  return lines.join('\n');
}

/**
 * Generate helpful next step message
 */
export function getNextStepGuidance(workflow: WorkflowState): string {
  const nextItem = getNextPendingItem(workflow);
  
  if (!nextItem) {
    return isWorkflowComplete(workflow) 
      ? 'All steps completed! Workflow is done.'
      : 'No pending items. Check for in-progress items.';
  }
  
  // Map item names to tool names
  const toolMapping: Record<string, string> = {
    'avatar': 'image_generation (purpose: avatar)',
    'script': 'script_creation',
    'storyboard': 'video_scenarist → video_director → storyboard_prompt_creator',
    'video': 'video_generation',
    'product': 'image_generation (purpose: product)',
  };
  
  const itemLower = nextItem.item.toLowerCase();
  let suggestedTool = 'unknown';
  
  for (const [key, tool] of Object.entries(toolMapping)) {
    if (itemLower.includes(key)) {
      suggestedTool = tool;
      break;
    }
  }
  
  return `Next step: ${nextItem.item}. Suggested tool: ${suggestedTool}`;
}

/**
 * Auto-detect what's been completed from media pool
 * 
 * Synchronizes workflow state with media pool reality
 */
export function syncWorkflowWithMediaPool(
  workflow: WorkflowState,
  mediaPool: any
): WorkflowState {
  
  const updatedChecklist = workflow.checklist.map(item => {
    const itemLower = item.item.toLowerCase();
    
    // Check if avatar is completed
    if (itemLower.includes('avatar') && mediaPool.activeAvatarId) {
      return {
        ...item,
        status: 'completed' as const,
        assetId: mediaPool.activeAvatarId,
        completedAt: item.completedAt || new Date().toISOString(),
      };
    }
    
    // Check if script is completed
    if (itemLower.includes('script') && mediaPool.approvedScriptId) {
      return {
        ...item,
        status: 'completed' as const,
        assetId: mediaPool.approvedScriptId,
        completedAt: item.completedAt || new Date().toISOString(),
      };
    }
    
    // Check if product is completed
    if (itemLower.includes('product') && mediaPool.activeProductId) {
      return {
        ...item,
        status: 'completed' as const,
        assetId: mediaPool.activeProductId,
        completedAt: item.completedAt || new Date().toISOString(),
      };
    }
    
    return item;
  });
  
  return {
    ...workflow,
    checklist: updatedChecklist,
  };
}
