import { BookOpen } from "lucide-react";
import CreateWizard from "@/components/wizards/CreateWizard";
import BuildWizard from "@/components/wizards/BuildWizard";
import BuildPanel from "@/components/panels/BuildPanel";
import TutorialPanel from "@/components/shared/TutorialPanel";
import {
  BUILD_TUTORIAL_STEPS,
  CREATE_TUTORIAL_STEPS,
} from "../data/tutorialSteps";
import ReviewPanel from "@/components/panels/ReviewPanel";
import SecurityPanel from "@/components/panels/SecurityPanel";
import ValidatePanel from "@/components/panels/ValidatePanel";
import ExperimentPanel from "@/components/panels/ExperimentPanel";
import PromptingPanel from "@/components/builders/PromptingPanel";
import SkillzPanel from "@/components/builders/SkillzPanel";
import AgenticPanel from "@/components/builders/AgenticPanel";
import PlannerPanel from "@/components/builders/PlannerPanel";
import DashboardView from "@/components/dashboard/DashboardView";
import TerminalPanel from "@/components/panels/TerminalPanel";
import EmptyStateScene from "@/components/3d/EmptyStateScene";
import TypingIndicator3D from "@/components/3d/TypingIndicator3D";
import MessageBubble from "@/components/chat/MessageBubble";
import { CopyButton } from "./chat-ui-helpers";
import { BUILDER_MODES, MODES } from "./modes";

export default function ModeRouter({
  mode,
  isElectron,
  history,
  onResumeConversation,
  setMode,
  review,
  pentest,
  validate,
  experiment,
  terminal,
  builder,
  create,
  build,
  chat,
}) {
  if (mode === "dashboard") {
    return (
      <DashboardView
        modes={MODES}
        currentMode={mode}
        onModeSelect={setMode}
        isElectron={isElectron}
        history={history}
        onResumeConversation={onResumeConversation}
      />
    );
  }

  if (mode === "review") {
    return <ReviewPanel {...review} />;
  }

  if (mode === "pentest") {
    return <SecurityPanel {...pentest} />;
  }

  if (mode === "validate") {
    return <ValidatePanel {...validate} />;
  }

  if (mode === "experiment") {
    return <ExperimentPanel {...experiment} />;
  }

  if (mode === "terminal") {
    return <TerminalPanel projectFolder={terminal.projectFolder} />;
  }

  if (BUILDER_MODES.includes(mode)) {
    if (mode === "prompting") {
      return <PromptingPanel {...builder} />;
    }
    if (mode === "skillz") {
      return <SkillzPanel {...builder} />;
    }
    if (mode === "agentic") {
      return <AgenticPanel {...builder} />;
    }
    return <PlannerPanel {...builder} />;
  }

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {mode === "create" ? (
        <>
          <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Create project</span>
              <button
                type="button"
                onClick={create.onToggleTutorial}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${create.showTutorial ? "bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900" : "bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse"}`}
                aria-label={
                  create.showTutorial
                    ? "Hide tutorial"
                    : "Show step-by-step tutorial"
                }
              >
                <BookOpen className="w-5 h-5 shrink-0" aria-hidden />
                {create.showTutorial ? "Tutorial on" : "Start tutorial"}
              </button>
            </div>
          </div>
          {create.showTutorial && (
            <TutorialPanel
              mode="create"
              currentStep={create.tutorialStep}
              onStepChange={create.onTutorialStepChange}
              onPrefillStep={create.onPrefillStep}
              onClose={create.onCloseTutorial}
              totalSteps={5}
            />
          )}
          <CreateWizard
            defaultOutputRoot={create.defaultOutputRoot}
            onSuccess={create.onSuccess}
            onGeneratePRP={create.onGeneratePRP}
            onToast={create.onToast}
            step={create.showTutorial ? create.tutorialStep : undefined}
            onStepChange={
              create.showTutorial ? create.onSetTutorialStep : undefined
            }
            prefill={create.wizardPrefill}
            tutorialActive={create.showTutorial}
            tutorialSuggestions={
              create.showTutorial
                ? (CREATE_TUTORIAL_STEPS[create.tutorialStep - 1]?.prefill ??
                  null)
                : null
            }
          />
        </>
      ) : mode === "build" ? (
        build.showBuildWizard ? (
          <>
            <div className="sticky top-0 z-10 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-2 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  New build project
                </span>
                <button
                  type="button"
                  onClick={build.onToggleTutorial}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-base shadow-lg transition-all ${build.showTutorial ? "bg-amber-500 text-slate-900 ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900" : "bg-amber-400 text-slate-900 hover:bg-amber-300 ring-2 ring-amber-400/50 animate-pulse"}`}
                  aria-label={
                    build.showTutorial
                      ? "Hide tutorial"
                      : "Show step-by-step tutorial"
                  }
                >
                  <BookOpen className="w-5 h-5 shrink-0" aria-hidden />
                  {build.showTutorial ? "Tutorial on" : "Start tutorial"}
                </button>
              </div>
            </div>
            {build.showTutorial && (
              <TutorialPanel
                mode="build"
                currentStep={build.tutorialStep}
                onStepChange={build.onTutorialStepChange}
                onPrefillStep={build.onPrefillStep}
                onClose={build.onCloseTutorial}
                totalSteps={4}
              />
            )}
            <BuildWizard
              defaultOutputRoot={build.defaultOutputRoot}
              onSuccess={build.onSuccess}
              onToast={build.onToast}
              onCancel={build.onCancelWizard}
              step={build.showTutorial ? build.tutorialStep : undefined}
              onStepChange={
                build.showTutorial ? build.onSetTutorialStep : undefined
              }
              prefill={build.wizardPrefill}
              tutorialActive={build.showTutorial}
              tutorialSuggestions={
                build.showTutorial
                  ? (BUILD_TUTORIAL_STEPS[build.tutorialStep - 1]?.prefill ??
                    null)
                  : null
              }
            />
          </>
        ) : (
          <BuildPanel
            projects={build.projects}
            activeProject={build.activeProject}
            onSelectProject={build.onSelectProject}
            onNewProject={build.onNewProject}
            onViewFiles={build.onViewFiles}
            onRefresh={build.onRefresh}
            onToast={build.onToast}
            selectedModel={build.selectedModel}
            ollamaConnected={build.ollamaConnected}
          />
        )
      ) : (
        <>
          {chat.messages.length === 0 ? (
            <EmptyStateScene
              mode={mode}
              currentMode={chat.currentMode}
              connected={chat.connected}
              selectedModel={chat.selectedModel}
              onSettingsClick={chat.onSettingsClick}
              onGoCreate={() => setMode("create")}
              onGoBuild={() => setMode("build")}
            />
          ) : null}
          {chat.messages.map((msg, i) =>
            msg._toolContext ? null : (
              <div key={i} className="relative group">
                <MessageBubble
                  role={msg.role}
                  content={msg.content}
                  streaming={
                    chat.streaming &&
                    i === chat.messages.length - 1 &&
                    msg.role === "assistant"
                  }
                  images={msg.images}
                  onImageClick={chat.onImageClick}
                />
                {msg.role === "assistant" && !chat.streaming && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            ),
          )}
          {chat.streaming &&
            chat.messages[chat.messages.length - 1]?.role !== "assistant" && (
              <TypingIndicator3D mode={mode} />
            )}
          {chat.terminalOutput && (
            <div className="mx-4 my-2 glass rounded-xl border border-indigo-500/20 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border-b border-indigo-500/20">
                <span className="text-xs font-mono text-indigo-300">
                  {chat.terminalOutput.status === "running" ? (
                    <>
                      <span className="inline-block animate-spin mr-1">
                        &#x27F3;
                      </span>{" "}
                      Running command...
                    </>
                  ) : chat.terminalOutput.status === "error" ? (
                    <span className="text-red-400">✕ Command failed</span>
                  ) : chat.terminalOutput.status === "timeout" ? (
                    <span className="text-yellow-400">⏱ Command timed out</span>
                  ) : (
                    <span className="text-green-400">✓ Command completed</span>
                  )}
                </span>
              </div>
              {chat.terminalOutput.command && (
                <pre className="px-3 py-2 text-xs text-slate-400 font-mono whitespace-pre-wrap border-b border-indigo-500/10">
                  $ {chat.terminalOutput.command}
                </pre>
              )}
              {chat.terminalOutput.output && (
                <pre className="px-3 py-2 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto scrollbar-thin">
                  {chat.terminalOutput.output}
                </pre>
              )}
            </div>
          )}
          <div ref={chat.messagesEndRef} />
        </>
      )}
    </div>
  );
}
