import BaseBuilderPanel from "./BaseBuilderPanel";
import { parsePlannerLoaded } from "../../lib/planner-parse-loaded.js";

const PLANNER_CONFIG = {
  modeId: "planner",
  title: "Plan Designer",
  subtitle: "Design, validate, and score implementation plans",
  icon: "📋",
  fields: [
    {
      name: "planName",
      label: "Plan Name",
      type: "text",
      placeholder: "e.g., Auth Migration, Dashboard Redesign, API v2 Rollout",
      required: true,
    },
    {
      name: "goal",
      label: "Goal / Objective",
      type: "textarea",
      placeholder:
        'What will be built or accomplished?\n\ne.g., "Migrate user authentication from session-based to JWT tokens while maintaining backward compatibility during a 2-week transition period."',
      required: true,
    },
    {
      name: "scope",
      label: "Scope (in/out)",
      type: "textarea",
      placeholder:
        "What is IN scope and OUT of scope?\n\nIn scope:\n- JWT token generation and validation\n- Session migration script\n\nOut of scope:\n- OAuth2 provider integration\n- Mobile app auth changes",
    },
    {
      name: "steps",
      label: "Implementation Steps",
      type: "textarea",
      placeholder:
        "1. Create database migration for token table\n2. Implement JWT signing and verification middleware\n3. Add token refresh endpoint\n4. Update existing auth routes to issue JWTs\n5. Write migration script for active sessions\n6. Deploy with feature flag for gradual rollout",
      required: true,
      large: true,
    },
    {
      name: "dependencies",
      label: "Dependencies & Prerequisites",
      type: "textarea",
      placeholder:
        "What must be in place before implementation?\n\n- Database server running PostgreSQL 14+\n- jsonwebtoken npm package installed\n- Environment variables: JWT_SECRET, TOKEN_EXPIRY",
    },
    {
      name: "testing",
      label: "Testing Strategy",
      type: "textarea",
      placeholder:
        "How will you verify the plan works?\n\n- Unit tests for token generation/validation\n- Integration tests for auth flow\n- Load test with 1000 concurrent sessions\n- Manual QA of login/logout/refresh cycle",
    },
    {
      name: "risks",
      label: "Risk Assessment",
      type: "textarea",
      placeholder:
        "What could go wrong and how will you handle it?\n\n- Risk: Active sessions invalidated during migration\n  Mitigation: Run migration during low-traffic window, keep session fallback for 48h\n\n- Risk: JWT secret rotation\n  Mitigation: Support multiple signing keys with key ID header",
    },
  ],
  categories: [
    { key: "clarity", label: "Clarity", icon: "Eye" },
    { key: "feasibility", label: "Feasibility", icon: "CheckCircle" },
    { key: "completeness", label: "Completeness", icon: "Layers" },
    { key: "structure", label: "Structure", icon: "ListOrdered" },
  ],
  buildContent: (formData) => {
    const lines = [];
    lines.push(`# ${formData.planName || "Untitled Plan"}`);
    lines.push("");
    lines.push("## Goal");
    lines.push("");
    lines.push(formData.goal || "");
    lines.push("");

    if (formData.scope?.trim()) {
      lines.push("## Scope");
      lines.push("");
      lines.push(formData.scope);
      lines.push("");
    }

    lines.push("## Implementation Steps");
    lines.push("");
    lines.push(formData.steps || "");
    lines.push("");

    if (formData.dependencies?.trim()) {
      lines.push("## Dependencies");
      lines.push("");
      lines.push(formData.dependencies);
      lines.push("");
    }

    if (formData.testing?.trim()) {
      lines.push("## Testing Strategy");
      lines.push("");
      lines.push(formData.testing);
      lines.push("");
    }

    if (formData.risks?.trim()) {
      lines.push("## Risk Assessment");
      lines.push("");
      lines.push(formData.risks);
      lines.push("");
    }

    return lines.join("\n");
  },
  parseLoaded: parsePlannerLoaded,
  fileExtension: ".md",
  defaultFilename: "plan",
  nameField: "planName",
};

export default function PlannerPanel(props) {
  return <BaseBuilderPanel {...props} config={PLANNER_CONFIG} />;
}
