import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { STEPS } from "@/store/wizardStore";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

interface StepLayoutProps {
  step: number;
  videoType: "avatar" | "remotion";
  title: string;
  subtitle: string;
  children: ReactNode;
  onNext: () => void;
  onBack: () => void;
  nextLabel?: string;
  canProceed?: boolean;
  isLast?: boolean;
  lastAction?: () => void;
  lastLabel?: string;
  onFinish?: () => void;
  primaryActionBusy?: boolean;
  primaryBusyLabel?: string;
  onCancel?: () => void;
}

export function StepLayout({
  step,
  videoType,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel,
  canProceed = true,
  isLast = false,
  lastAction,
  lastLabel,
  onFinish,
  primaryActionBusy = false,
  primaryBusyLabel = "Working...",
  onCancel,
}: StepLayoutProps) {
  const visibleSteps = STEPS.map((stepItem, index) => ({ ...stepItem, originalIndex: index }))
    .filter((stepItem) => !(videoType === "remotion" && stepItem.key === "avatar"))
    .filter((stepItem) => !(videoType === "avatar" && stepItem.key === "subtitle"));
  const visibleStepIndex = visibleSteps.findIndex((stepItem) => stepItem.originalIndex === step);
  const currentVisibleStep = visibleSteps[Math.max(0, visibleStepIndex)] ?? visibleSteps[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="pb-20"
          >
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">{title}</h2>
            <p className="text-muted-foreground mb-6 sm:mb-8 text-sm">{subtitle}</p>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-8 flex items-center justify-between bg-card shrink-0">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={step === 0}
          className="text-muted-foreground hidden sm:flex"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>

        <p className="text-xs text-muted-foreground hidden sm:block">
          Step {Math.max(0, visibleStepIndex) + 1} of {visibleSteps.length} — {currentVisibleStep?.label ?? "Workflow"}
        </p>

        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Button
            variant="outline"
            onClick={onBack}
            disabled={step === 0}
            className="sm:hidden text-muted-foreground flex-1"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          {isLast ? (
            <>
              <Button
                onClick={onFinish || lastAction || onNext}
                disabled={primaryActionBusy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-purple-sm font-semibold flex-1"
              >
                {primaryActionBusy ? primaryBusyLabel : lastLabel || "Export Video"}
              </Button>
              {primaryActionBusy && onCancel && (
                <Button variant="destructive" onClick={onCancel} className="flex-1 max-w-[140px]">
                  Stop
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={onNext}
                disabled={!canProceed || primaryActionBusy}
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-purple-sm font-semibold disabled:opacity-40 flex-1"
              >
                {primaryActionBusy ? primaryBusyLabel : nextLabel || "Next"}
              </Button>
              {primaryActionBusy && onCancel && (
                <Button variant="destructive" onClick={onCancel} className="flex-1 max-w-[140px]">
                  Stop
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
