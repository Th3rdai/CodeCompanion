const { test } = require("node:test");
const assert = require("node:assert");
const { isAgentAppSkillEnabled } = require("../../lib/agent-app-skills.js");

test("isAgentAppSkillEnabled requires master and family flag", () => {
  const base = { agentAppSkills: {} };
  assert.equal(isAgentAppSkillEnabled(base, "review"), false);
  assert.equal(
    isAgentAppSkillEnabled(
      { agentAppSkills: { enabled: true, review: false } },
      "review",
    ),
    false,
  );
  assert.equal(
    isAgentAppSkillEnabled(
      { agentAppSkills: { enabled: true, review: true } },
      "review",
    ),
    true,
  );
  assert.equal(
    isAgentAppSkillEnabled(
      { agentAppSkills: { enabled: true, review: true, pentest: true } },
      "pentest",
    ),
    true,
  );
});
