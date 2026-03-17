import { useState, useCallback, useEffect } from "react";
import type { VideoJobResult } from "@/lib/api";
import {
  getDefaultAvatarScript,
  getDefaultRemotionTranscript,
  resolveNarratorGender,
} from "@/lib/templates";

export const WIZARD_STORAGE_KEY = "avatar-wizard-storage";

export interface WizardState {
  currentStep: number;
  language: string;
  llmModel: string;
  outputLanguage: string;
  videoTone: string;
  temperature: number;
  systemPrompt: string;
  avatarId: string;
  avatarName: string;
  avatarGender: "male" | "female" | null;
  avatarFilter: string;
  voiceId: string;
  voiceName: string;
  voiceGender: "male" | "female" | null;
  transcript: string;
  remotionTranscript: string;
  avatarTranscriptCustomized: boolean;
  remotionTranscriptCustomized: boolean;
  subtitleColor: string;
  subtitlePosition: string;
  subtitleLanguage: string;
  logoPosition: string;
  logoOpacity: number;
  logoFileName: string;
  aspectRatio: string;
  exportFormat: string;
  customerName: string;
  lan: string;
  clientName: string;
  tos: string;
  loanAmount: string;
  contactDetails: string;
  templateName: string;
  backgroundColor: string;
  includeCaptions: boolean;
  titlePrefix: string;
  productType: string;
  videoType: "avatar" | "remotion";
  videoVariety: "personalized" | "universal";
  generatedVideo: VideoJobResult | null;
  styledVideoUrl: string;
  styledVideoPath: string;
  subtitleSource: "provider" | "transcript" | "disabled";
  generationStatus: "idle" | "submitting" | "styling" | "completed" | "failed";
  generationError: string;
}

const defaultState: WizardState = {
  currentStep: 0,
  language: "Hindi",
  llmModel: "Claude 3.5 Sonnet",
  outputLanguage: "Hindi",
  videoTone: "Professional",
  temperature: 50,
  systemPrompt: "",
  avatarId: "",
  avatarName: "",
  avatarGender: null,
  avatarFilter: "Female",
  voiceId: "",
  voiceName: "",
  voiceGender: null,
  transcript: getDefaultAvatarScript("Hindi", "female"),
  remotionTranscript: getDefaultRemotionTranscript("Hindi", "universal"),
  avatarTranscriptCustomized: false,
  remotionTranscriptCustomized: false,
  subtitleColor: "White",
  subtitlePosition: "Bottom",
  subtitleLanguage: "Hindi",
  logoPosition: "Top Right",
  logoOpacity: 80,
  logoFileName: "",
  aspectRatio: "16:9",
  exportFormat: "MP4",
  customerName: "",
  lan: "",
  clientName: "",
  tos: "",
  loanAmount: "",
  contactDetails: "1800-555-999",
  templateName: "universal_template.txt",
  backgroundColor: "#F4F4F4",
  includeCaptions: true,
  titlePrefix: "Legal Notice",
  productType: "loan",
  videoType: "avatar",
  videoVariety: "universal",
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled",
  generationStatus: "idle",
  generationError: "",
};

function restoreSavedState(savedState: Partial<WizardState>): WizardState {
  const savedAvatarGender = savedState.avatarGender ?? null;
  const savedVoiceGender = savedState.voiceGender ?? null;
  const defaultAvatarTranscript = getDefaultAvatarScript(
    savedState.language ?? defaultState.language,
    resolveNarratorGender(savedVoiceGender ?? savedAvatarGender),
  );
  const savedVariety = (savedState.videoVariety ?? defaultState.videoVariety) as "personalized" | "universal";
  const defaultRemotionTranscript = getDefaultRemotionTranscript(savedState.language ?? defaultState.language, savedVariety);
  const restored = {
    ...defaultState,
    ...savedState,
    avatarGender: savedAvatarGender,
    voiceGender: savedVoiceGender,
    avatarTranscriptCustomized:
      typeof savedState.avatarTranscriptCustomized === "boolean"
        ? savedState.avatarTranscriptCustomized
        : Boolean(savedState.transcript && savedState.transcript !== defaultAvatarTranscript),
    remotionTranscriptCustomized:
      typeof savedState.remotionTranscriptCustomized === "boolean"
        ? savedState.remotionTranscriptCustomized
        : Boolean(savedState.remotionTranscript && savedState.remotionTranscript !== defaultRemotionTranscript),
    logoFileName: "",
  };

  if (restored.generationStatus === "styling") {
    if (restored.generatedVideo?.video_url) {
      restored.generationStatus = "completed";
      restored.styledVideoUrl = "";
      restored.styledVideoPath = "";
      restored.subtitleSource = "disabled";
      restored.generationError = "";
    } else if (restored.generatedVideo?.video_id) {
      restored.generationStatus = "submitting";
      restored.styledVideoUrl = "";
      restored.styledVideoPath = "";
      restored.subtitleSource = "disabled";
      restored.generationError = "";
    } else {
      restored.generationStatus = "failed";
      restored.generationError =
        restored.generationError ||
        "The previous styling run was interrupted. Your draft is still saved locally.";
    }
  }

  if (restored.generationStatus === "submitting" && !restored.generatedVideo?.video_id) {
    restored.generationStatus = "failed";
    restored.generationError =
      restored.generationError ||
      "The previous generation request was interrupted before the video ID was returned. Your draft is still saved locally.";
  }

  return restored;
}

export const STEPS = [
  { label: "Language", key: "language" },
  { label: "Avatar", key: "avatar" },
  { label: "Transcript", key: "transcript" },
  { label: "Subtitle & Logo", key: "subtitle" },
  { label: "Preview", key: "preview" },
  { label: "Share", key: "share" },
] as const;

export function useWizardStore() {
  const [state, setState] = useState<WizardState>(() => {
    const saved = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<WizardState>;
        return restoreSavedState(parsed);
      } catch (e) {
        console.error("Failed to parse wizard state", e);
      }
    }
    return defaultState;
  });

  useEffect(() => {
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => {
      const next = prev.currentStep + 1;
      if (next === 1 && prev.videoType === "remotion") {
        return { ...prev, currentStep: 2 };
      }
      return { ...prev, currentStep: Math.min(next, STEPS.length - 1) };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const previous = prev.currentStep - 1;
      if (previous === 1 && prev.videoType === "remotion") {
        return { ...prev, currentStep: 0 };
      }
      return { ...prev, currentStep: Math.max(previous, 0) };
    });
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: Math.max(0, Math.min(step, STEPS.length - 1)) }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  const canProceed = useCallback((): boolean => {
    const s = state;
    switch (s.currentStep) {
      case 1:
        return s.videoType === "remotion" || !!s.avatarId;
      case 2:
      case 3:
        const isUniversal = s.videoVariety === "universal";
        const hasTranscript = (s.videoType === "remotion" ? s.remotionTranscript : s.transcript).trim().length > 0;
        
        if (isUniversal) {
          return hasTranscript;
        }

        return (
          hasTranscript &&
          s.customerName.trim().length > 0 &&
          s.lan.trim().length > 0 &&
          s.clientName.trim().length > 0 &&
          (s.videoType === "avatar" ||
            (
              s.tos.trim().length > 0 &&
              s.loanAmount.trim().length > 0 &&
              s.contactDetails.trim().length > 0 &&
              s.productType.trim().length > 0
            ))
        );
      case 4:
        return s.generationStatus === "completed";
      default: return true;
    }
  }, [state]);

  return { state, update, nextStep, prevStep, goToStep, reset, canProceed };
}
