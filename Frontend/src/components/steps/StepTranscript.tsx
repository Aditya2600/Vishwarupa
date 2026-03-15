import { ChangeEvent, useId, useRef } from "react";
import {
  AlertTriangle,
  ClipboardPaste,
  Copy,
  FileText,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardState } from "@/store/wizardStore";

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
  clientName: "ABC Finance",
  tos: "38450",
  loanAmount: "120000",
  contactDetails: "1800-555-999",
  productType: "loan",
};

interface StepTranscriptProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

function isRequiredInCurrentMode(field: FieldDefinition, isRemotion: boolean): boolean {
  return isRemotion || Boolean(field.required);
}

function getFieldValue(state: WizardState, key: WizardFieldKey): string {
  switch (key) {
    case "customerName":
      return state.customerName;
    case "lan":
      return state.lan;
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

export function StepTranscript({ state, update }: StepTranscriptProps) {
  const importInputId = useId();
  const importInputRef = useRef<HTMLInputElement>(null);
  const isRemotion = state.videoType === "remotion";
  const transcript = isRemotion ? state.remotionTranscript : state.transcript;
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const duration = Math.max(1, Math.round(wordCount / 130));
  const isLongTranscript = wordCount > 300;
  const requiredFields = FIELD_DEFINITIONS.filter((field) => isRequiredInCurrentMode(field, isRemotion));
  const optionalFields = FIELD_DEFINITIONS.filter((field) => !isRequiredInCurrentMode(field, isRemotion));

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

      const currentValue = getFieldValue(state, fieldKey).trim();
      if (currentValue) {
        return;
      }

      updateField(update, fieldKey, DEMO_FIELD_VALUES[fieldKey]);
    };

  return (
    <div className="max-w-5xl">
      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.95fr)]">
        <div className="surface-card p-5 space-y-5">
          <p className="text-sm font-semibold text-foreground">Lead Personalization</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {requiredFields.map((field) => (
              <Field key={field.key} label={field.label} required>
                <Input
                  value={getFieldValue(state, field.key)}
                  onChange={(event) => updateField(update, field.key, event.target.value)}
                  onKeyDown={handleDemoTab(field.key)}
                  placeholder={field.placeholder}
                  className={getErrorClass(getFieldValue(state, field.key), true)}
                />
              </Field>
            ))}
          </div>
        </div>

        {optionalFields.length > 0 ? (
          <div className="surface-card h-fit p-5 space-y-5">
            <p className="text-sm font-semibold text-foreground">Optional Fields</p>
            <div className="grid gap-4">
              {optionalFields.map((field) => (
                <Field key={field.key} label={field.label}>
                  <Input
                    value={getFieldValue(state, field.key)}
                    onChange={(event) => updateField(update, field.key, event.target.value)}
                    onKeyDown={handleDemoTab(field.key)}
                    placeholder={field.placeholder}
                    className={getErrorClass(getFieldValue(state, field.key))}
                  />
                </Field>
              ))}
            </div>
          </div>
        ) : null}
      </div>

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
          onClick={() => handleTranscriptChange("")}
          className="border-border text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Clear
        </Button>
      </div>

      <Textarea
        value={transcript}
        onChange={(event) => handleTranscriptChange(event.target.value)}
        placeholder={`Type or paste your script here...\n\nBoth {tag} and {{tag}} placeholder styles are supported.`}
        className={`${getErrorClass(transcript, true)} min-h-[300px] resize-none rounded-xl text-sm leading-relaxed`}
      />

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
