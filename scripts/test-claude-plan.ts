/**
 * Test script to verify Claude's plan output is correctly fetched and preserved
 * Run with: npx tsx scripts/test-claude-plan.ts
 */

import Replicate from 'replicate';
import { buildUnifiedPlannerSystemPrompt } from '../lib/assistantTools';

const SONNET_4_5_MODEL = 'anthropic/claude-4.5-sonnet';

async function testClaudePlan() {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error('❌ Missing REPLICATE_API_TOKEN');
    process.exit(1);
  }

  const replicate = new Replicate({ auth: token });
  const plannerSystem = buildUnifiedPlannerSystemPrompt();
  
  // Test with the same request that was failing
  const testRequest = `USER: create an image of a woman, thirty y o ugc style, in an everyday room background, unperfect woman and background , then create a text to speech of a script you have to create about tales family cards game, and then fusion the image and the audio using wan 2.2 s2v lipsync model to create a lipsynced video`;
  
  const plannerUser = `${testRequest}

Generate the complete workflow plan with detailed, ready-to-use prompts. Return only valid JSON.`;

  console.log('🧪 Testing Claude 4.5 Sonnet plan generation...');
  console.log('📝 Request:', testRequest);
  console.log('');

  try {
    const planOutput = await replicate.run(SONNET_4_5_MODEL as `${string}/${string}`, {
      input: {
        system_prompt: plannerSystem,
        prompt: plannerUser,
        max_tokens: 12000,
      },
    });

    // Extract text
    let rawText = '';
    if (Array.isArray(planOutput)) {
      rawText = planOutput.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('');
    } else if (typeof planOutput === 'string') {
      rawText = planOutput;
    } else if (planOutput && typeof planOutput === 'object') {
      rawText = JSON.stringify(planOutput);
    }

    console.log('📥 Raw response length:', rawText.length);
    console.log('📥 First 500 chars:', rawText.slice(0, 500));
    console.log('');

    // Parse JSON
    let claudePlan: any = null;
    try {
      claudePlan = JSON.parse(rawText);
    } catch {
      // Try extracting from markdown
      const jsonMatch = rawText.match(/```(?:json)?\s*({[\s\S]*})\s*```/);
      if (jsonMatch) {
        claudePlan = JSON.parse(jsonMatch[1]);
      } else {
        // Try finding JSON object
        const braceStart = rawText.indexOf('{');
        const braceEnd = rawText.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
          claudePlan = JSON.parse(rawText.slice(braceStart, braceEnd + 1));
        }
      }
    }

    if (!claudePlan) {
      console.error('❌ Failed to parse Claude\'s output');
      console.error('Raw text:', rawText);
      process.exit(1);
    }

    console.log('✅ Successfully parsed Claude\'s plan');
    console.log('📊 Summary:', claudePlan.summary);
    console.log('📊 Steps count:', claudePlan.steps?.length || 0);
    console.log('');

    if (!claudePlan.steps || !Array.isArray(claudePlan.steps)) {
      console.error('❌ Claude\'s plan missing steps array');
      console.error('Plan:', JSON.stringify(claudePlan, null, 2));
      process.exit(1);
    }

    console.log('📋 CLAUDE\'S STEPS:');
    claudePlan.steps.forEach((step: any, idx: number) => {
      console.log(`  ${idx + 1}. ${step.id} (${step.tool}) - ${step.model}`);
      console.log(`     Title: ${step.title}`);
      console.log(`     Inputs:`, JSON.stringify(step.inputs || {}, null, 2));
      console.log(`     Dependencies:`, step.dependencies || []);
      console.log('');
    });

    // Verify expected steps
    const expectedTools = ['image', 'tts', 'lipsync'];
    const actualTools = claudePlan.steps.map((s: any) => s.tool);
    const missingTools = expectedTools.filter(t => !actualTools.includes(t));

    if (missingTools.length > 0) {
      console.error(`❌ Missing expected tools: ${missingTools.join(', ')}`);
      console.error(`   Expected: ${expectedTools.join(', ')}`);
      console.error(`   Got: ${actualTools.join(', ')}`);
      process.exit(1);
    }

    console.log('✅ All expected steps present!');
    console.log(`✅ Claude generated ${claudePlan.steps.length} steps as expected`);
    
    return claudePlan;
  } catch (err: any) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testClaudePlan();

