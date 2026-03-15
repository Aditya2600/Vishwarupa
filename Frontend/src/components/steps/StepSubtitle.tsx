import { ChangeEvent, useId, useRef } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { WizardState } from "@/store/wizardStore";
import { Button } from "@/components/ui/button";

const RESET_GENERATION_STATE = {
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled" as const,
  generationStatus: "idle" as const,
  generationError: "",
};

const COLORS = [
  { name: "White", color: "bg-white" },
  { name: "Blue", color: "bg-blue-500" },
  { name: "Green", color: "bg-emerald-500" },
  { name: "Red", color: "bg-red-500" },
  { name: "Yellow", color: "bg-yellow-400" },
  { name: "Teal", color: "bg-teal-400" },
];
const POSITIONS = ["Top", "Center", "Bottom"];
const LOGO_POSITIONS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

interface StepSubtitleProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
  onLogoSelected: (file: File | null) => void;
}

function getPreviewPosition(position: string): string {
  switch (position) {
    case "Top":
      return "items-start pt-6";
    case "Center":
      return "items-center";
    default:
      return "items-end pb-8";
  }
}

function getLogoPreviewPosition(position: string): string {
  switch (position) {
    case "Top Left":
      return "top-4 left-4";
    case "Bottom Left":
      return "bottom-4 left-4";
    case "Bottom Right":
      return "bottom-4 right-4";
    default:
      return "top-4 right-4";
  }
}

export function StepSubtitle({ state, update, onLogoSelected }: StepSubtitleProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onLogoSelected(file);
    update({
      logoFileName: file?.name ?? "",
      ...RESET_GENERATION_STATE,
    });
    event.target.value = "";
  };

  const clearLogo = () => {
    onLogoSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    update({
      logoFileName: "",
      ...RESET_GENERATION_STATE,
    });
  };

  const subtitlePreviewClass =
    state.subtitleColor === "Blue"
      ? "text-blue-400"
      : state.subtitleColor === "Green"
        ? "text-emerald-400"
        : state.subtitleColor === "Red"
          ? "text-red-400"
          : state.subtitleColor === "Yellow"
            ? "text-yellow-300"
            : state.subtitleColor === "Teal"
              ? "text-teal-400"
              : "text-foreground";

  return (
    <div className="grid grid-cols-2 gap-8 max-w-5xl">
      {/* Left – preview + subtitle controls */}
      <div className="space-y-6">
        <div className="rounded-xl bg-background border border-border aspect-video flex justify-center p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60" />
          {state.logoFileName ? (
            <div
              className={`absolute ${getLogoPreviewPosition(state.logoPosition)} px-2 py-1 text-[10px] font-semibold tracking-[0.22em] text-foreground`}
              style={{ opacity: state.logoOpacity / 100, textShadow: "0 4px 12px rgba(15, 23, 42, 0.95)" }}
            >
              LOGO
            </div>
          ) : null}
          {state.includeCaptions ? (
            <div className={`relative z-10 flex h-full w-full justify-center ${getPreviewPosition(state.subtitlePosition)}`}>
              <p
                className={`max-w-[90%] text-center text-[11px] font-semibold leading-tight ${subtitlePreviewClass}`}
                style={{ textShadow: "0 4px 12px rgba(15, 23, 42, 0.95)" }}
              >
                Your payment requires immediate attention.
              </p>
            </div>
          ) : (
            <div className="relative z-10 flex h-full w-full items-center justify-center">
              <p className="text-xs font-medium text-muted-foreground">Captions disabled</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Enable Captions</p>
            <p className="text-xs text-muted-foreground">Burn auto-generated subtitles into your video.</p>
          </div>
          <Switch
            checked={state.includeCaptions}
            onCheckedChange={(checked) => update({ includeCaptions: checked, ...RESET_GENERATION_STATE })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Subtitle Color</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => update({ subtitleColor: c.name, ...RESET_GENERATION_STATE })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  state.subtitleColor === c.name
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${c.color}`} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Subtitle Position</label>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <button
                key={p}
                onClick={() => update({ subtitlePosition: p, ...RESET_GENERATION_STATE })}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  state.subtitlePosition === p
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right – logo */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Company Logo</label>
          <label
            htmlFor={fileInputId}
            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-secondary/50 hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <input
              ref={fileInputRef}
              id={fileInputId}
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              className="sr-only"
              onChange={handleLogoChange}
            />
            <Upload className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Upload PNG or JPG</p>
            <p className="text-xs text-muted-foreground mt-1">Max 2MB</p>
          </label>
          {state.logoFileName ? (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <ImagePlus className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{state.logoFileName}</p>
                  <p className="text-xs text-muted-foreground">Will be overlaid onto the final exported video.</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={clearLogo} aria-label="Remove logo">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Logo Position</label>
          <div className="grid grid-cols-2 gap-2">
            {LOGO_POSITIONS.map((p) => (
              <button
                key={p}
                onClick={() => update({ logoPosition: p, ...RESET_GENERATION_STATE })}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  state.logoPosition === p
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Logo Opacity — {state.logoOpacity}%
          </label>
          <Slider
            value={[state.logoOpacity]}
            onValueChange={([v]) => update({ logoOpacity: v, ...RESET_GENERATION_STATE })}
            max={100}
            step={1}
          />
        </div>
      </div>
    </div>
  );
}
