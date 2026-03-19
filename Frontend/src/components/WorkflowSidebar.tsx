import { Check } from "lucide-react";
import { STEPS } from "@/store/wizardStore";

interface WorkflowSidebarProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  videoType: "avatar" | "remotion";
}

export function WorkflowSidebar({ currentStep, onStepClick, videoType }: WorkflowSidebarProps) {
  const filteredSteps = STEPS.map((step, i) => ({ ...step, originalIndex: i }))
    .filter((step) => !(videoType === "remotion" && step.key === "avatar"))
    .filter((step) => !(videoType === "avatar" && step.key === "subtitle"));

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar hidden md:flex flex-col h-full">
      <div className="p-5 flex-1">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground mb-5 uppercase">
          Workflow
        </p>
        <nav className="space-y-1">
          {filteredSteps.map((step, i) => {
            const isActive = step.originalIndex === currentStep;
            const isCompleted = step.originalIndex < currentStep;

            return (
              <button
                key={step.key}
                onClick={() => onStepClick(step.originalIndex)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary glow-purple-sm"
                    : isCompleted
                    ? "text-foreground hover:bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                      ? "bg-success text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

    </aside>
  );
}
