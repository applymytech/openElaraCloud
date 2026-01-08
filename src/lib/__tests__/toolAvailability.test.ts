// Quick Test: Tool Availability with Different API Key Scenarios
// Run this in browser console on chat page to see tool filtering in action

import { getAvailableTools } from '../tools';
import type { Tool } from '../apiClient';

console.log('=== TESTING TOOL AVAILABILITY ===\n');

// Scenario 1: Check current available tools
const { tools, unavailableReasons } = getAvailableTools();

console.log(`✅ Available Tools: ${tools.length}`);
tools.forEach((t: Tool) => {
  console.log(`  - ${t.function.name}`);
});

console.log(`\n❌ Unavailable Tools: ${unavailableReasons.length}`);
unavailableReasons.forEach((reason: string) => {
  console.log(`  ${reason}`);
});

// Scenario 2: Test what LLM sees in system prompt
console.log('\n=== SYSTEM PROMPT PREVIEW ===\n');

if (tools.length > 0) {
  console.log('## Available Tools:\n');
  tools.forEach((t: Tool) => {
    console.log(`- ${t.function.name}: ${t.function.description.substring(0, 80)}...`);
  });
}

if (unavailableReasons.length > 0) {
  console.log('\n## Tools Currently Unavailable:\n');
  unavailableReasons.forEach((reason: string) => {
    console.log(reason);
  });
  console.log('\nIf the user asks for something requiring these tools, politely explain you need the API key(s) to help with that request.');
}

// Scenario 3: Test tool execution error messages
console.log('\n=== ERROR MESSAGE EXAMPLES ===\n');

const toolRequirements = {
  search_web: 'exa',
  read_url: 'exa',
  make_image: 'together',
  make_video: 'together',
  save_thought: 'none'
};

Object.entries(toolRequirements).forEach(([tool, key]: [string, string]) => {
  if (key === 'none') {
    console.log(`✅ ${tool}: Always available (no API key required)`);
  } else {
    const hasKey = tools.some((t: Tool) => t.function.name === tool);
    if (!hasKey) {
      const errorMsg = tool.includes('_web') || tool.includes('_url')
        ? 'I need an Exa API key'
        : 'I need a Together.ai API key';
      console.log(`❌ ${tool}: ${errorMsg} to use this tool`);
    } else {
      console.log(`✅ ${tool}: Ready to use`);
    }
  }
});

console.log('\n=== RECOMMENDATION ===\n');
if (unavailableReasons.length === 0) {
  console.log('🎉 All tools available! Deep Thought has full agentic capabilities.');
} else if (tools.length === 1) {
  console.log('⚠️  Only save_thought available. Add Exa and Together.ai keys for full capabilities.');
} else if (tools.length > 1 && tools.length < 5) {
  console.log('⚡ Partial capabilities. Add missing API keys to unlock all tools.');
}

export {};
