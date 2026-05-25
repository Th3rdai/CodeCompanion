// Icon mapping for dashboard modes
// Maps mode IDs to Lucide React icon components
import {
  Home,
  MessageCircle,
  Search,
  Shield,
  Hammer,
  Sparkles,
  GitBranch,
  FlaskConical,
  CheckCircle,
  Terminal,
  FileText,
  Target,
  Bot,
  ClipboardList,
  Eye,
  Lock,
  Type,
  Lightbulb,
} from "lucide-react";

export const DASHBOARD_ICONS = {
  dashboard: Home,
  chat: MessageCircle,
  review: Search,
  pentest: Shield,
  build: Hammer,
  create: Sparkles,
  diagram: GitBranch,
  experiment: FlaskConical,
  validate: CheckCircle,
  terminal: Terminal,
  prompting: FileText,
  skillz: Target,
  agentic: Bot,
  planner: ClipboardList,
  explain: Eye,
  bugs: Lock,
  refactor: Sparkles, // Clean Up - reusing Sparkles
  "translate-tech": Type,
  "translate-biz": Lightbulb,
};

/**
 * Get icon component by mode ID
 * @param {string} modeId - Mode identifier
 * @returns {React.Component} Lucide icon component
 */
export function getModeIcon(modeId) {
  return DASHBOARD_ICONS[modeId] || MessageCircle;
}
