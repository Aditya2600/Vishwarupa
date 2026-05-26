import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { WizardState } from "@/store/wizardStore";

const MODELS = ["Claude 3.5 Sonnet", "GPT-4.1", "Grok 4.1", "Llama 3.1 70B"];
const TONES = ["Professional", "Casual", "Empathetic", "Urgent", "Educational"];

interface StepLLMProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function StepLLM({ state, update }: StepLLMProps) {
  return (
    <div className="grid grid-cols-2 gap-8 max-w-4xl">
      {/* Left column */}
      <div className="space-y-6">
        <Field label="AI Model">
          <select
            value={state.llmModel}
            onChange={(e) => update({ llmModel: e.target.value })}
            className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>

        <Field label="Output Language">
          <select
            value={state.outputLanguage}
            onChange={(e) => update({ outputLanguage: e.target.value })}
            className="w-full rounded-xl bg-secondary border border-border px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option>{state.language}</option>
            <option>English</option>
            <option>Hindi</option>
          </select>
        </Field>

        <Field label="Video Tone">
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <button
                key={tone}
                onClick={() => update({ videoTone: tone })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  state.videoTone === tone
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Right column */}
      <div className="space-y-6">
        <Field label="Creativity Temperature">
          <div className="px-1">
            <Slider
              value={[state.temperature]}
              onValueChange={([v]) => update({ temperature: v })}
              max={100}
              step={1}
              className="mb-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>
        </Field>

        <Field label="Custom System Prompt">
          <Textarea
            value={state.systemPrompt}
            onChange={(e) => update({ systemPrompt: e.target.value })}
            placeholder="e.g. Always mention our helpline number. Keep messages under 200 words. Avoid aggressive language..."
            className="bg-secondary border-border min-h-[140px] resize-none rounded-xl"
          />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}
