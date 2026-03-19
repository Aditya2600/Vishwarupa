import { useEffect, useState } from "react";
import { Clapperboard, Film } from "lucide-react";
import { WizardState } from "@/store/wizardStore";
import { ProcessingScreen } from "@/components/ProcessingScreen";

const RESET_GENERATION_STATE = {
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled" as const,
  generationStatus: "idle" as const,
  generationError: "",
};

const RATIOS = ["16:9", "9:16", "1:1"];

interface StepPreviewProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function StepPreview({ state, update }: StepPreviewProps) {
  const activeTranscript = state.videoType === "remotion" ? state.remotionTranscript : state.transcript;
  const isRemotion = state.videoType === "remotion";
  const statusLabel = getGenerationStatusLabel(state.generationStatus, isRemotion);
  const avatarName =
    isRemotion
      ? "Text to Video"
      : state.avatarName || state.avatarId || "None";
  const wordCount = activeTranscript.trim() ? activeTranscript.trim().split(/\s+/).length : 0;
  const duration = `~${Math.max(1, Math.round(wordCount / 130))} min`;
  const generatedVideo = state.generatedVideo;
  const previewUrl = state.styledVideoUrl || generatedVideo?.video_url || "";
  const isProcessing = state.generationStatus === "submitting" || state.generationStatus === "styling";
  const estimatedMinutes = isRemotion ? 5 : Math.max(2, Math.round(wordCount / 130) * 2);
  const estimatedSeconds =
    state.generationStatus === "styling"
      ? 15
      : estimatedMinutes * 60;
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  const [phaseProgress, setPhaseProgress] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setPhaseStartedAt(null);
      setPhaseProgress(0);
      return;
    }

    setPhaseStartedAt(Date.now());
  }, [isProcessing, state.generationStatus]);

  useEffect(() => {
    if (!isProcessing || phaseStartedAt === null) {
      return;
    }

    const tick = () => {
      const elapsedMs = Date.now() - phaseStartedAt;
      if (state.generationStatus === "styling") {
        const stylingProgress = Math.min(97, 88 + (elapsedMs / 45000) * 9);
        setPhaseProgress(stylingProgress);
        return;
      }

      const targetDurationMs = estimatedMinutes * 60 * 1000;
      const progressCap = isRemotion ? 96 : 88;
      const settleWindowMs = isRemotion ? 2 * 60 * 1000 : 0;
      const initialCap = isRemotion ? 90 : progressCap;
      const initialProgress = Math.min(initialCap, (elapsedMs / targetDurationMs) * initialCap);
      const overflowMs = Math.max(0, elapsedMs - targetDurationMs);
      const overflowProgress =
        isRemotion && settleWindowMs > 0
          ? Math.min(progressCap - initialCap, (overflowMs / settleWindowMs) * (progressCap - initialCap))
          : 0;
      const submittingProgress = Math.min(progressCap, initialProgress + overflowProgress);
      setPhaseProgress(submittingProgress);
    };

    tick();
    const intervalId = window.setInterval(tick, 500);
    return () => window.clearInterval(intervalId);
  }, [estimatedMinutes, isProcessing, isRemotion, phaseStartedAt, state.generationStatus]);

  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Main preview */}
      <div className="flex-1 space-y-4">
        <div className="flex gap-2">
          {RATIOS.map((r) => (
            <button
              key={r}
              disabled={isProcessing}
              onClick={() => update({ aspectRatio: r, ...RESET_GENERATION_STATE })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${state.aspectRatio === r
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {r}
            </button>
          ))}
        </div>

        <div
          className={`relative rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden ${state.aspectRatio === "16:9"
              ? "aspect-video"
              : state.aspectRatio === "9:16"
                ? "aspect-[9/16] max-h-[420px]"
                : "aspect-square max-h-[420px]"
            }`}
        >
          {isProcessing ? (
            <ProcessingScreen
              status={state.generationStatus}
              estimatedTime={estimatedMinutes.toString()}
              isLongVideo={wordCount > 300}
              videoType={state.videoType}
            />
          ) : previewUrl ? (
            <video
              key={previewUrl}
              controls
              src={previewUrl}
              poster={generatedVideo?.thumbnail_url ?? undefined}
              preload="metadata"
              playsInline
              className={`w-full h-full ${state.videoType === "remotion" ? "object-contain bg-black" : "object-cover"}`}
            />
          ) : generatedVideo?.thumbnail_url ? (
            <img
              src={generatedVideo.thumbnail_url}
              alt={generatedVideo.title ?? "Generated video preview"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                {isRemotion
                  ? <Film className="h-9 w-9 text-primary opacity-70" />
                  : <Clapperboard className="h-9 w-9 text-primary opacity-70" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {isRemotion
                  ? "Generate the Text Video below to preview the multi-scene output here."
                  : "Generate the video to preview it here."}
              </p>
            </div>
          )}
        </div>

        {state.generationStatus === "failed" && state.generationError ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-5 py-4">
            <p className="text-sm font-semibold text-foreground">Generation failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.generationError}</p>
          </div>
        ) : null}

        {isProcessing ? (
          <div className="rounded-xl border border-border bg-card/70 px-5 py-4">
            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <span>{isRemotion ? "Text to Video Progress" : "Generation Progress"}</span>
              <span>{Math.max(1, Math.round(phaseProgress))}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/75 via-primary to-primary/75 transition-[width] duration-500 ease-out"
                style={{ width: `${phaseProgress}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Estimated time: {estimatedSeconds >= 60 ? `~${Math.round(estimatedSeconds / 60)} min` : `~${estimatedSeconds}s`}
            </p>
          </div>
        ) : null}
      </div>

      {/* Summary */}
      <div className="w-64 shrink-0">
        <div className="surface-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Video Summary</h3>
          <SummaryRow label="Style" value={state.videoType === "remotion" ? "Text to Video" : "Avatar"} />
          <SummaryRow label="Language" value={state.language} />
          {state.videoType === "avatar" ? <SummaryRow label="Avatar" value={avatarName} /> : null}
          {state.videoType === "avatar" && state.voiceName ? <SummaryRow label="Voice" value={state.voiceName} /> : null}
          <SummaryRow label="Duration" value={duration} />
          {state.videoType === "remotion" ? (
            <SummaryRow
              label="Subtitles"
              value={state.includeCaptions ? `${state.subtitleColor} · ${state.subtitlePosition}` : "Disabled"}
            />
          ) : null}
          {state.videoType === "remotion" ? <SummaryRow label="Logo" value={state.logoFileName || "None"} /> : null}
          <SummaryRow label="Aspect Ratio" value={state.aspectRatio} />
          <SummaryRow label="Status" value={statusLabel} />
          {state.styledVideoUrl ? <SummaryRow label="Styled Output" value={state.subtitleSource} /> : null}
          {generatedVideo?.video_id ? <SummaryRow label="Video ID" value={generatedVideo.video_id} /> : null}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-muted-foreground whitespace-nowrap shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right break-all">{value}</span>
    </div>
  );
}

function getGenerationStatusLabel(
  status: WizardState["generationStatus"],
  isRemotion: boolean,
): string {
  if (status === "submitting") {
    return isRemotion ? "Rendering" : "Processing";
  }

  if (status === "styling") {
    return "Styling";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Idle";
}
