import { ChangeEvent, useId, useRef, useState, useEffect } from "react";
import { AlertTriangle, Clipboard, FileText, Loader2, Pause, Play, RotateCcw, Trash2, Volume2, Sparkles, Copy, ClipboardPaste, Music, Wand2, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WizardState } from "@/store/wizardStore";
import { VoiceOption } from "@/lib/api";
import {
  DEFAULT_LOAN_REMINDER_ASSET_PATHS,
  REMOTION_TEMPLATE_OPTIONS,
  getDefaultRemotionTranscript,
  getDefaultAvatarScript,
  type RemotionTemplateKey,
} from "@/lib/templates";

const RESET_GENERATION_STATE = {
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled" as const,
  generationStatus: "idle" as const,
  generationError: "",
};

type WizardFieldKey =
  | "customerName"
  | "lan"
  | "daysOverdue"
  | "collectionStatus"
  | "clientName"
  | "tos"
  | "loanAmount"
  | "contactDetails"
  | "productType";

interface FieldDefinition {
  key: WizardFieldKey;
  label: string;
  tags: string[];
  placeholder: string;
  required?: boolean;
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: "customerName",
    label: "Customer Name",
    tags: ["customer_name", "customer"],
    placeholder: "Ramesh Kumar",
    required: true,
  },
  {
    key: "lan",
    label: "Loan Account Number",
    tags: ["lan", "account_number"],
    placeholder: "LAN12345",
    required: true,
  },
  {
    key: "clientName",
    label: "Client Name",
    tags: ["client_name", "client"],
    placeholder: "ABC Finance",
    required: true,
  },
  {
    key: "tos",
    label: "Total Outstanding",
    tags: ["tos", "balance", "outstanding"],
    placeholder: "38,450",
    required: true,
  },
  {
    key: "loanAmount",
    label: "Loan Amount",
    tags: ["loan_amount", "loan_amt", "amt"],
    placeholder: "1,20,000",
  },
  {
    key: "contactDetails",
    label: "Helpline / Contact",
    tags: ["contact_details", "helpline", "contact"],
    placeholder: "1800-555-999",
  },
  {
    key: "productType",
    label: "Product Type",
    tags: ["product_type", "product"],
    placeholder: "loan / insurance / credit card",
  },
];

const DEMO_FIELD_VALUES: Record<WizardFieldKey, string> = {
  customerName: "Ramesh Kumar",
  lan: "LAN12345",
  daysOverdue: "35",
  collectionStatus: "75",
  clientName: "ABC Finance",
  tos: "38450",
  loanAmount: "120000",
  contactDetails: "1800-555-999",
  productType: "loan",
};

interface StepTranscriptProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
  voices?: VoiceOption[];
}

function isRequiredInCurrentMode(field: FieldDefinition, state: WizardState): boolean {
  // Keep "required" indicators aligned with wizardStore.canProceed().
  if (state.videoType === "remotion" && state.videoVariety === "universal") return false;

  if (state.videoType === "avatar") {
    return field.key === "customerName" || field.key === "lan" || field.key === "clientName";
  }

  if (state.videoType === "hybrid_remotion_avatar_pip") {
    return field.key === "customerName" || field.key === "lan" || field.key === "daysOverdue" || field.key === "tos";
  }

  // Remotion (personalized)
  return (
    field.key === "customerName" ||
    field.key === "lan" ||
    field.key === "clientName" ||
    field.key === "tos" ||
    field.key === "loanAmount" ||
    field.key === "contactDetails" ||
    field.key === "productType"
  );
}

function getFieldValue(state: WizardState, key: WizardFieldKey): string {
  switch (key) {
    case "customerName":
      return state.customerName;
    case "lan":
      return state.lan;
    case "daysOverdue":
      return state.daysOverdue;
    case "collectionStatus":
      return state.collectionStatus;
    case "clientName":
      return state.clientName;
    case "tos":
      return state.tos;
    case "loanAmount":
      return state.loanAmount;
    case "contactDetails":
      return state.contactDetails;
    case "productType":
      return state.productType;
  }
}

function updateField(
  update: (partial: Partial<WizardState>) => void,
  key: WizardFieldKey,
  value: string,
): void {
  switch (key) {
    case "customerName":
      update({ customerName: value, ...RESET_GENERATION_STATE });
      return;
    case "lan":
      update({ lan: value, ...RESET_GENERATION_STATE });
      return;
    case "daysOverdue":
      update({ daysOverdue: value, ...RESET_GENERATION_STATE });
      return;
    case "collectionStatus":
      update({ collectionStatus: value, ...RESET_GENERATION_STATE });
      return;
    case "clientName":
      update({ clientName: value, ...RESET_GENERATION_STATE });
      return;
    case "tos":
      update({ tos: value, ...RESET_GENERATION_STATE });
      return;
    case "loanAmount":
      update({ loanAmount: value, ...RESET_GENERATION_STATE });
      return;
    case "contactDetails":
      update({ contactDetails: value, ...RESET_GENERATION_STATE });
      return;
    case "productType":
      update({ productType: value, ...RESET_GENERATION_STATE });
      return;
  }
}

export function StepTranscript({ state, update, voices = [] }: StepTranscriptProps) {
  const importInputId = useId();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isRemotion = state.videoType === "remotion";
  const isHybrid = state.videoType === "hybrid_remotion_avatar_pip";

  const handleVoicePreview = async (overrideText?: string) => {
    if (isPreviewing) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // If we're not forcefully regenerating with overrideText, and we have paused audio, just resume
    if (!overrideText && !isPlaying && audioRef.current && audioRef.current.src && !isRemotion) {
      audioRef.current.play();
      setIsPlaying(true);
      return;
    }

    setIsPreviewing(true);
    try {
      const formData = new FormData();
      formData.set("language", state.language);
      formData.set("gender", state.voiceGender || "female");
      
      const textToPlay = overrideText || (isRemotion ? state.remotionTranscript : state.transcript);
      formData.set("text", textToPlay.slice(0, 800));

      if (state.voiceId) {
        formData.set("voice_id", state.voiceId);
      }

      const response = await fetch("/api/preview/voice", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Voice preview failed");

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.pause();
      audioRef.current.src = audioUrl;
      audioRef.current.load();
      
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
      
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          setIsPlaying(false);
        });
      }
      setIsPlaying(true);
    } catch (error) {
      toast.error("Unable to play voice preview.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const transcript = isRemotion ? state.remotionTranscript : state.transcript;
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const duration = Math.max(1, Math.round(wordCount / 130));
  const isLongTranscript = wordCount > 300;

  // Auto-sync transcripts if language changes and they haven't been customized
  useEffect(() => {
    const updates: Partial<WizardState> = {};
    let hasUpdates = false;

    // 1. Sync Avatar Transcript
    const currentAvatarText = state.transcript;
    const avatarContainsPunjabi = /[\u0A00-\u0A7F]/.test(currentAvatarText);
    const isActuallyPunjabi = state.language === "Punjabi";
    const shouldForceResetAvatar = avatarContainsPunjabi && !isActuallyPunjabi;

    if (!state.avatarTranscriptCustomized || shouldForceResetAvatar) {
      const mode = state.videoVariety;
      const langDefault = getDefaultAvatarScript(state.language, state.voiceGender, mode);
      if (state.transcript !== langDefault) {
        updates.transcript = langDefault;
        updates.avatarTranscriptCustomized = false; // reset flag if we forced it
        hasUpdates = true;
      }
    }

    // 2. Sync Remotion Transcripts
    if (isRemotion) {
      const currentRemotionText = state.remotionTranscript;
      // Defensive: Check if text contains Punjabi characters (Gurmukhi) while language is NOT Punjabi
      const containsPunjabi = /[\u0A00-\u0A7F]/.test(currentRemotionText);
      const isActuallyPunjabi = state.language === "Punjabi";
      const shouldForceReset = containsPunjabi && !isActuallyPunjabi;

      const gen = state.voiceGender || "female";
      if (state.videoVariety === "universal") {
        if (!state.remotionTranscriptCustomized || shouldForceReset) {
          const langUniversal = getDefaultRemotionTranscript(state.language, "universal", gen, state.remotionTemplateKey);
          if (state.remotionTranscript !== langUniversal) {
            updates.remotionTranscript = langUniversal;
            updates.remotionTranscriptCustomized = false; // reset flag if we forced it
            hasUpdates = true;
          }
        }
      } else {
        // Personalized mode
        if (!state.remotionTranscriptCustomized || shouldForceReset) {
          const langDefault = getDefaultRemotionTranscript(state.language, "personalized", gen, state.remotionTemplateKey);
          if (state.remotionTranscript !== langDefault) {
            updates.remotionTranscript = langDefault;
            updates.remotionTranscriptCustomized = false; // reset flag if we forced it
            hasUpdates = true;
          }
        }
      }
    }

    if (hasUpdates) {
      update(updates);
    }
  }, [state.language, state.videoVariety, isRemotion, state.voiceGender, state.avatarTranscriptCustomized, state.remotionTranscriptCustomized, state.transcript, state.remotionTranscript, update]);

  const getErrorClass = (value: string, required = false) =>
    required && !value.trim()
      ? "ring-1 ring-destructive border-transparent focus-visible:ring-destructive bg-destructive/5"
      : "bg-secondary border-border";

  const handleTranscriptChange = (value: string) => {
    if (isRemotion) {
      update({
        remotionTranscript: value,
        remotionTranscriptCustomized: true,
        ...RESET_GENERATION_STATE,
      });
      return;
    }
    update({
      transcript: value,
      avatarTranscriptCustomized: true,
      ...RESET_GENERATION_STATE,
    });
  };
  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        toast.info("Clipboard is empty.");
        return;
      }
      handleTranscriptChange(clipboardText);
      toast.success("Transcript pasted from clipboard.");
    } catch {
      toast.error("Clipboard access is not available in this browser.");
    }
  };

  const handleResetToDefault = () => {
    if (isRemotion) {
      const defaultValue = getDefaultRemotionTranscript(state.language, state.videoVariety, state.voiceGender, state.remotionTemplateKey);
      update({
        remotionTranscript: defaultValue,
        remotionTranscriptCustomized: false,
        ...RESET_GENERATION_STATE,
      });
      toast.success(`Transcript reset to ${state.language} (${state.videoVariety}) default.`);
      return;
    }
    const defaultValue = getDefaultAvatarScript(state.language, state.voiceGender, state.videoVariety);
    update({
      transcript: defaultValue,
      avatarTranscriptCustomized: false,
      ...RESET_GENERATION_STATE,
    });
    toast.success(`Transcript reset to ${state.language} default.`);
  };


const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    handleTranscriptChange(text);
    toast.success(`${file.name} imported.`);
  } catch {
    toast.error("Unable to read that transcript file.");
  } finally {
    event.target.value = "";
  }
};

const handleDemoTab =
  (fieldKey: WizardFieldKey) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key !== "Tab" ||
      event.shiftKey ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }

    updateField(update, fieldKey, DEMO_FIELD_VALUES[fieldKey]);
  };

const handleRemotionTemplateSelect = (templateKey: RemotionTemplateKey) => {
  const isPersonalizedTemplate =
    templateKey === "payment_guidance" ||
    templateKey === "payment_link_guidance" ||
    templateKey === "overdue_template" ||
    templateKey === "loan_offer_interactive" ||
    templateKey === "loan_reminder";
  const nextVariety = isPersonalizedTemplate ? "personalized" : state.videoVariety;
  const nextTitlePrefix =
    templateKey === "payment_guidance"
      ? "Payment Guidance"
      : templateKey === "payment_link_guidance"
        ? "Payment Link Guidance"
        : templateKey === "loan_reminder"
          ? "Loan Reminder"
          : templateKey === "overdue_template"
            ? "Credit Card Overdue Notice"
            : templateKey === "loan_offer_interactive"
              ? "Loan Offer"
              : state.titlePrefix;
  update({
    remotionTemplateKey: templateKey,
    videoVariety: nextVariety,
    remotionTranscript: getDefaultRemotionTranscript(
      state.language,
      nextVariety,
      state.voiceGender,
      templateKey,
    ),
    remotionTranscriptCustomized: false,
    titlePrefix: nextTitlePrefix,
    productType: "loan",
    ...(templateKey === "loan_reminder"
      ? {
        aspectRatio: "9:16",
        loanReminderImagePaths: DEFAULT_LOAN_REMINDER_ASSET_PATHS,
        loanReminderImageFileNames: {},
      }
      : {}),
    ...RESET_GENERATION_STATE,
  });
  toast.success(`${REMOTION_TEMPLATE_OPTIONS.find((option) => option.key === templateKey)?.name ?? "Template"} selected.`);
};

// Helper to get fallback values for Avatar mode if blank
const getDisplayValue = (fieldKey: WizardFieldKey) => {
  const val = getFieldValue(state, fieldKey);
  // For Avatar mode (NOT remotion), show default if empty
  if (state.videoType === "avatar" && !val.trim()) {
    return DEMO_FIELD_VALUES[fieldKey];
  }
  return val;
};

return (
  <div className="max-w-5xl">
    {isRemotion ? (
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {REMOTION_TEMPLATE_OPTIONS.map((template) => {
          const isSelected = state.remotionTemplateKey === template.key;
          return (
            <button
              key={template.key}
              type="button"
              onClick={() => handleRemotionTemplateSelect(template.key)}
              className={`rounded-xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/30 hover:bg-surface-hover"
              }`}
            >
              <p className="text-sm font-semibold text-foreground">{template.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{template.description}</p>
            </button>
          );
        })}
      </div>
    ) : null}

    {isHybrid ? (
      <div className="mb-6">
        <label className="text-sm font-medium text-muted-foreground mb-3 block">Hybrid Output Shape</label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "portrait_9_16", label: "Portrait 9:16" },
            { value: "landscape_16_9", label: "Landscape 16:9" },
            { value: "auto", label: "Auto" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                update({
                  aspectMode: option.value as WizardState["aspectMode"],
                  aspectRatio:
                    option.value === "landscape_16_9"
                      ? "16:9"
                      : option.value === "portrait_9_16"
                        ? "9:16"
                        : state.aspectRatio,
                  ...RESET_GENERATION_STATE,
                })
              }
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                state.aspectMode === option.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    ) : null}

    {!isHybrid ? (
    <div className="mb-6 flex justify-center">
      <Tabs
        value={state.videoVariety}
        onValueChange={(val) => {
          const newVariety = val as "personalized" | "universal";
          const updatePayload: Partial<WizardState> = {
            videoVariety: newVariety,
            ...RESET_GENERATION_STATE
          };

          // Auto-populate when switching tabs if content is default or empty
          const gen = state.voiceGender || "female";
          const currentUniversal = getDefaultRemotionTranscript(state.language, "universal", gen, state.remotionTemplateKey);
          const currentPersonalized = getDefaultRemotionTranscript(state.language, "personalized", gen, state.remotionTemplateKey);

          if (newVariety === "universal") {
            if (isRemotion) {
              // If switching to universal and transcript is empty or still personalized default, update it
              if (!state.remotionTranscript.trim() || state.remotionTranscript === currentPersonalized) {
                updatePayload.remotionTranscript = currentUniversal;
                updatePayload.remotionTranscriptCustomized = false;
              }
            } else {
              const avatarPersonalized = getDefaultAvatarScript(state.language, gen, "personalized");
              if (!state.transcript.trim() || state.transcript === avatarPersonalized) {
                updatePayload.transcript = currentUniversal;
                updatePayload.avatarTranscriptCustomized = false;
              }
            }
          } else if (newVariety === "personalized") {
            if (isRemotion) {
              if (!state.remotionTranscript.trim() || state.remotionTranscript === currentUniversal) {
                updatePayload.remotionTranscript = currentPersonalized;
                updatePayload.remotionTranscriptCustomized = false;
              }
            } else {
              const avatarPersonalized = getDefaultAvatarScript(state.language, gen, "personalized");
              if (!state.transcript.trim() || state.transcript === currentUniversal) {
                updatePayload.transcript = avatarPersonalized;
                updatePayload.avatarTranscriptCustomized = false;
              }
            }
          }

          update(updatePayload);

        }}
        className="w-full max-w-md"
      >
        <TabsList className="grid w-full grid-cols-2 p-1 bg-secondary/50 rounded-xl">
          <TabsTrigger
            value="personalized"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
          >
            Personalized
          </TabsTrigger>
          <TabsTrigger
            value="universal"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all duration-200"
          >
            Universal
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
    ) : null}

    {isHybrid || state.videoVariety === "personalized" ? (
      <div className="mb-6">
        <div className="surface-card p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Lead Personalization</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_DEFINITIONS.map((field) => (
              <Field key={field.key} label={field.label} required={isRequiredInCurrentMode(field, state)}>
                <Input
                  value={getDisplayValue(field.key)}
                  onChange={(event) => updateField(update, field.key, event.target.value)}
                  onKeyDown={handleDemoTab(field.key)}
                  placeholder={field.placeholder}
                  className={getErrorClass(getFieldValue(state, field.key), isRequiredInCurrentMode(field, state))}
                />
              </Field>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="mb-6 flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="p-2 bg-primary/10 rounded-lg">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Universal Mode Active</p>
          <p className="text-xs text-muted-foreground">The video will be generated using the exact transcript provided below without any personalization.</p>
        </div>
      </div>
    )}

    <div className="flex flex-wrap gap-2 mb-4">
      <Button size="sm" type="button" variant="outline" disabled className="opacity-60 cursor-not-allowed">
        <Sparkles className="mr-1.5 h-4 w-4" />
        AI Prompting
        <span className="ml-1.5 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">Soon</span>
      </Button>
      <Button size="sm" type="button" variant="outline" onClick={() => void handlePaste()}>
        <ClipboardPaste className="mr-1.5 h-4 w-4" />
        Paste Script
      </Button>
      {isRemotion && (
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => void handleVoicePreview()}
          disabled={isPreviewing}
          className="border-primary/50 text-primary hover:bg-primary/5"
        >
          {isPreviewing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="mr-1.5 h-4 w-4" />
          ) : (
            <Play className="mr-1.5 h-4 w-4" />
          )}
          {isPlaying ? "Stop Voice" : "Preview Voice"}
        </Button>
      )}
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => importInputRef.current?.click()}
      >
        <FileText className="mr-1.5 h-4 w-4" />
        Import .txt
      </Button>
      <input
        ref={importInputRef}
        id={importInputId}
        type="file"
        accept=".txt,text/plain"
        className="sr-only"
        onChange={handleImport}
      />
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={handleResetToDefault}
      >
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Reset to {state.language} Default
      </Button>
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => handleTranscriptChange("")}
        className="border-border text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        Delete
      </Button>
    </div>

    <Textarea
      value={transcript}
      onChange={(event) => handleTranscriptChange(event.target.value)}
      placeholder={`Type or paste your script here...\n\nBoth {tag} and {{tag}} placeholder styles are supported.`}
      className={`${getErrorClass(transcript, true)} min-h-[300px] resize-none rounded-xl text-sm leading-relaxed`}
    />

    {(isHybrid || state.videoVariety === "personalized") && (
      <div className="mt-4 rounded-xl border border-secondary bg-secondary/30 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold text-foreground">Supported Placeholders</p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Click a tag to copy it
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          {FIELD_DEFINITIONS.map((field) => (
            <PlaceholderTag
              key={field.key}
              tag={field.tags[0]}
              shorthand={field.tags.slice(1).join(", ")}
            />
          ))}
        </div>
      </div>
    )}

    <div className="flex justify-end gap-4 mt-3 text-xs">
      <span className={isLongTranscript ? "text-amber-500 font-medium flex items-center" : "text-muted-foreground"}>
        {isLongTranscript && <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
        {wordCount} words {isLongTranscript ? "(Generation may take longer)" : ""}
      </span>
      <span className="text-muted-foreground">~{duration} min video</span>
    </div>
  </div>
);
}

function PlaceholderTag({ tag, shorthand }: { tag: string; shorthand?: string }) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`{{${tag}}}`);
      toast.success(`Copied {{${tag}}}`);
    } catch {
      toast.error("Clipboard access failed.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-start gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-left hover:border-primary/40 hover:bg-background"
    >
      <Copy className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <span>
        <code className="block text-[12px] font-semibold text-primary">{`{{${tag}}}`}</code>
        {shorthand ? <span className="text-[10px] text-muted-foreground">alt: {shorthand}</span> : null}
      </span>
    </button>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}
