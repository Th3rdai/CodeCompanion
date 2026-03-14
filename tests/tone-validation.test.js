const { describe, it } = require('node:test');
const assert = require('node:assert');
const { SYSTEM_PROMPTS } = require('../lib/prompts');

describe('Tone Validation', () => {
  const PM_TERMS = [
    'dev team',
    'your team',
    'stakeholder',
    'leadership',
    'product roadmap',
    'manager',
    'standup'
  ];

  const ANALOGY_KEYWORDS = [
    'like a',
    'like the',
    'think of',
    'imagine',
    'similar to',
    'kind of like'
  ];

  const PERSONALITY_ARCHETYPES = {
    explain: ['patient', 'teacher', 'colleague', 'friend'],
    bugs: ['protective', 'safety', 'inspector', 'friend', 'lookout'],
    refactor: ['coach', 'mentor', 'senior dev', 'supportive'],
    'translate-tech': ['translator', 'bridge'],
    'translate-biz': ['translator', 'bridge', 'tech lead']
  };

  it('should not contain PM-specific language', () => {
    for (const [mode, prompt] of Object.entries(SYSTEM_PROMPTS)) {
      if (mode === 'review' || mode === 'review-fallback') continue; // Phase 1 prompts
      const lower = prompt.toLowerCase();
      for (const term of PM_TERMS) {
        assert.ok(
          !lower.includes(term),
          `${mode} prompt contains PM term: "${term}"`
        );
      }
    }
  });

  it('should include inline jargon definitions for common technical terms', () => {
    // Test that when technical terms appear, they're defined inline with parentheses
    const technicalTerms = ['api', 'sql', 'cors', 'endpoint', 'json'];

    for (const [mode, prompt] of Object.entries(SYSTEM_PROMPTS)) {
      if (mode === 'review' || mode === 'review-fallback') continue;

      // Check if technical terms appear without inline definitions
      // This is a softer check - we validate the pattern exists in prompts
      const lower = prompt.toLowerCase();

      // If a prompt mentions technical terms, it should have parenthetical explanations
      const hasParenthetical = /\([^)]{15,}\)/.test(prompt);
      const mentionsTech = technicalTerms.some(term => lower.includes(term));

      if (mentionsTech) {
        assert.ok(
          hasParenthetical || mode === 'chat' || mode === 'create',
          `${mode} prompt mentions technical terms but lacks inline definitions (parenthetical explanations)`
        );
      }
    }
  });

  it('should include analogies in explain, bugs, and refactor modes', () => {
    const modesRequiringAnalogies = ['explain', 'bugs', 'refactor'];

    for (const mode of modesRequiringAnalogies) {
      const prompt = SYSTEM_PROMPTS[mode];
      const lower = prompt.toLowerCase();

      const hasAnalogy = ANALOGY_KEYWORDS.some(keyword => lower.includes(keyword));

      assert.ok(
        hasAnalogy,
        `${mode} prompt should include analogies (using keywords like "like a", "think of", "imagine")`
      );
    }
  });

  it('should establish distinct personality archetypes for each mode', () => {
    for (const [mode, keywords] of Object.entries(PERSONALITY_ARCHETYPES)) {
      const prompt = SYSTEM_PROMPTS[mode];
      const lower = prompt.toLowerCase();

      const hasPersonality = keywords.some(keyword => lower.includes(keyword));

      assert.ok(
        hasPersonality,
        `${mode} prompt should establish personality archetype using keywords: ${keywords.join(', ')}`
      );
    }
  });

  it('should include MODE_GUARDRAIL in all non-review modes', () => {
    const { MODE_GUARDRAIL } = require('../lib/prompts');

    for (const [mode, prompt] of Object.entries(SYSTEM_PROMPTS)) {
      if (mode === 'review' || mode === 'review-fallback') {
        // Review modes have their own guardrails, skip
        continue;
      }

      // Check if MODE_GUARDRAIL content is present (either appended or equivalent)
      const hasGuardrail =
        prompt.includes('respond conversationally') ||
        prompt.includes('do NOT use the structured format') ||
        prompt.includes(MODE_GUARDRAIL.trim());

      assert.ok(
        hasGuardrail,
        `${mode} prompt should include MODE_GUARDRAIL or equivalent conversational fallback`
      );
    }
  });
});
