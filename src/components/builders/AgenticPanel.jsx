import React from 'react';
import BaseBuilderPanel from './BaseBuilderPanel';

const AGENTIC_CONFIG = {
  modeId: 'agentic',
  title: 'Agent Designer',
  subtitle: 'Design and score AI agents',
  icon: '🤖',
  fields: [
    { name: 'agentName', label: 'Agent Name', type: 'text', placeholder: 'e.g., code-reviewer, data-analyst, deployment-bot', required: true },
    { name: 'purpose', label: 'Purpose', type: 'textarea', placeholder: 'What does this agent do? What problem does it solve?\n\ne.g., "Automatically reviews pull requests for security issues, suggests fixes, and generates compliance reports."', required: true },
    { name: 'tools', label: 'Tools (one per line: name — description)', type: 'textarea', placeholder: 'read_file — Read a file from the codebase\nrun_tests — Execute the test suite\nsearch_code — Search for patterns across files\ncreate_issue — Create a GitHub issue' },
    { name: 'instructions', label: 'Agent Instructions', type: 'textarea', placeholder: 'How should this agent behave? What rules should it follow?\n\ne.g., "Always read the full file before suggesting changes. Never modify test files without asking. Explain every change in plain English."', required: true, large: true },
    { name: 'workflow', label: 'Workflow Steps (one per line)', type: 'textarea', placeholder: '1. Analyze the input request\n2. Read relevant files\n3. Plan the approach\n4. Execute changes\n5. Verify with tests\n6. Report results' },
    { name: 'guardrails', label: 'Safety Guardrails', type: 'textarea', placeholder: 'What should this agent NEVER do?\n\ne.g., "Never delete files without confirmation. Never push to main branch. Never expose secrets or API keys."' },
  ],
  categories: [
    { key: 'purposeClarity', label: 'Purpose', icon: 'Compass' },
    { key: 'toolDesign', label: 'Tool Design', icon: 'Wrench' },
    { key: 'workflowLogic', label: 'Workflow', icon: 'GitBranch' },
    { key: 'safetyGuardrails', label: 'Safety', icon: 'Shield' },
  ],
  buildContent: (formData) => {
    const lines = [];
    lines.push(`# ${formData.agentName || 'Untitled Agent'}`);
    lines.push('');
    lines.push('## Purpose');
    lines.push('');
    lines.push(formData.purpose || '');
    lines.push('');

    if (formData.tools?.trim()) {
      lines.push('## Tools');
      lines.push('');
      const toolLines = formData.tools.split('\n').filter(l => l.trim());
      for (const tool of toolLines) {
        const sep = tool.indexOf('—') !== -1 ? '—' : '-';
        const parts = tool.split(sep);
        if (parts.length >= 2) {
          lines.push(`- **${parts[0].trim()}**: ${parts.slice(1).join(sep).trim()}`);
        } else {
          lines.push(`- ${tool.trim()}`);
        }
      }
      lines.push('');
    }

    lines.push('## Instructions');
    lines.push('');
    lines.push(formData.instructions || '');
    lines.push('');

    if (formData.workflow?.trim()) {
      lines.push('## Workflow');
      lines.push('');
      lines.push(formData.workflow);
      lines.push('');
    }

    if (formData.guardrails?.trim()) {
      lines.push('## Safety Guardrails');
      lines.push('');
      lines.push(formData.guardrails);
      lines.push('');
    }

    return lines.join('\n');
  },
  parseLoaded: (content) => {
    const result = { agentName: '', purpose: '', tools: '', instructions: '', workflow: '', guardrails: '' };
    if (!content) return result;

    const nameMatch = content.match(/^# (.+)$/m);
    if (nameMatch) result.agentName = nameMatch[1];

    const sections = content.split(/\n## /);

    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const headerEnd = section.indexOf('\n');
      const header = section.substring(0, headerEnd).trim().toLowerCase();
      const body = section.substring(headerEnd).trim();

      if (header.includes('purpose')) result.purpose = body;
      else if (header.includes('tool')) {
        result.tools = body.split('\n')
          .filter(l => l.trim())
          .map(l => l.replace(/^-\s*\*\*(.+?)\*\*:\s*/, '$1 — ').replace(/^-\s*/, ''))
          .join('\n');
      }
      else if (header.includes('instruction')) result.instructions = body;
      else if (header.includes('workflow')) result.workflow = body;
      else if (header.includes('safety') || header.includes('guardrail')) result.guardrails = body;
    }

    return result;
  },
  fileExtension: '.md',
  defaultFilename: 'agent',
  nameField: 'agentName',
};

export default function AgenticPanel(props) {
  return <BaseBuilderPanel {...props} config={AGENTIC_CONFIG} />;
}
