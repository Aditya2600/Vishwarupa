import { useState, useCallback, useEffect } from "react";
import type { HybridAspectMode, VideoJobResult } from "@/lib/api";
import {
  DEFAULT_LOAN_REMINDER_ASSET_PATHS,
  getDefaultAvatarScript,
  getDefaultRemotionTranscript,
  type LoanReminderAssetKey,
  type LoanReminderAssetPaths,
  type RemotionTemplateKey,
  resolveNarratorGender,
} from "@/lib/templates";

export const WIZARD_STORAGE_KEY = "avatar-wizard-storage";
export type VideoType = "avatar" | "remotion" | "hybrid_remotion_avatar_pip";

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
  aspectMode: HybridAspectMode;
  exportFormat: string;
  customerName: string;
  lan: string;
  daysOverdue: string;
  collectionStatus: string;
  clientName: string;
  tos: string;
  loanAmount: string;
  paymentUrl: string;
  contactDetails: string;
  templateName: string;
  backgroundColor: string;
  includeCaptions: boolean;
  titlePrefix: string;
  productType: string;
  remotionTemplateKey: RemotionTemplateKey;
  loanReminderImagePaths: LoanReminderAssetPaths;
  loanReminderImageFileNames: Partial<Record<LoanReminderAssetKey, string>>;
  salesImagePaths: Record<string, string>;
  salesImageFileNames: Partial<Record<string, string>>;
  emiImagePaths: Record<string, string>;
  emiImageFileNames: Partial<Record<string, string>>;
  interactiveBackgroundColor: string;
  interactiveCtaColor: string;
  videoType: VideoType;
  videoVariety: "personalized" | "universal";
  avatarJobId: string;
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
  remotionTranscript: getDefaultRemotionTranscript("Hindi", "personalized"),
  avatarTranscriptCustomized: false,
  remotionTranscriptCustomized: false,
  subtitleColor: "White",
  subtitlePosition: "Bottom",
  subtitleLanguage: "Hindi",
  logoPosition: "Top Right",
  logoOpacity: 80,
  logoFileName: "",
  aspectRatio: "16:9",
  aspectMode: "portrait_9_16",
  exportFormat: "MP4",
  customerName: "",
  lan: "",
  daysOverdue: "",
  collectionStatus: "",
  clientName: "",
  tos: "",
  loanAmount: "",
  paymentUrl: "",
  contactDetails: "1800-555-999",
  templateName: "universal_template.txt",
  backgroundColor: "#F4F4F4",
  includeCaptions: true,
  titlePrefix: "Legal Notice",
  productType: "loan",
  remotionTemplateKey: "account_notice",
  loanReminderImagePaths: DEFAULT_LOAN_REMINDER_ASSET_PATHS,
  loanReminderImageFileNames: {},
  salesImagePaths: {
    scene1: "scene1.png",
    scene2: "scene2.png",
    scene3: "scene3.png",
    scene4: "scene4.png",
    scene5: "scene5.png",
  },
  salesImageFileNames: {},
  emiImagePaths: {
    whatsappPaynow: "paynow_whatsapp.png",
    smsLink: "link_sms.png",
    upiApps: "upi_app.png",
    openappSearch: "open_app_search.png",
    enterlan: "enter_lan.png",
    paymentSuccess: "payment_success_image.png",
    shopVisit: "shop_visit.png",
  },
  emiImageFileNames: {},
  interactiveBackgroundColor: "#f5f7fb",
  interactiveCtaColor: "#702082",
  videoType: "avatar",
  videoVariety: "universal",
  avatarJobId: "",
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled",
  generationStatus: "idle",
  generationError: "",
};

function restoreSavedState(savedState: Partial<WizardState>): WizardState {
  const rawStep = Number(savedState.currentStep ?? defaultState.currentStep);
  const safeStep = Number.isFinite(rawStep) ? Math.max(0, Math.min(Math.floor(rawStep), 5)) : 0;
  const savedVideoType =
    savedState.videoType === "avatar" ||
    savedState.videoType === "remotion" ||
    savedState.videoType === "hybrid_remotion_avatar_pip"
      ? savedState.videoType
      : defaultState.videoType;
  const normalizedStep =
    savedVideoType === "remotion" && safeStep === 1
      ? 2
      : savedVideoType !== "remotion" && safeStep === 3
        ? 2
        : safeStep;

  const savedAvatarGender = savedState.avatarGender ?? null;
  const savedVoiceGender = savedState.voiceGender ?? null;
  const defaultAvatarTranscript = getDefaultAvatarScript(
    savedState.language ?? defaultState.language,
    resolveNarratorGender(savedVoiceGender ?? savedAvatarGender),
  );
  const savedVariety = (savedState.videoVariety ?? defaultState.videoVariety) as "personalized" | "universal";
  const savedTemplateKey = savedState.remotionTemplateKey ?? defaultState.remotionTemplateKey;
  const defaultRemotionTranscript = getDefaultRemotionTranscript(
    savedState.language ?? defaultState.language,
    savedVariety,
    savedVoiceGender,
    savedTemplateKey,
  );
  const restored = {
    ...defaultState,
    ...savedState,
    currentStep: normalizedStep,
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
    loanReminderImagePaths: {
      ...DEFAULT_LOAN_REMINDER_ASSET_PATHS,
      ...(savedState.loanReminderImagePaths ?? {}),
    },
    loanReminderImageFileNames: {},
    salesImagePaths: {
      scene1: "scene1.png",
      scene2: "scene2.png",
      scene3: "scene3.png",
      scene4: "scene4.png",
      scene5: "scene5.png",
      ...(savedState.salesImagePaths ?? {}),
    },
    salesImageFileNames: {},
    emiImagePaths: {
      whatsappPaynow: "paynow_whatsapp.png",
      smsLink: "link_sms.png",
      upiApps: "upi_app.png",
      openappSearch: "open_app_search.png",
      enterlan: "enter_lan.png",
      paymentSuccess: "payment_success_image.png",
      shopVisit: "shop_visit.png",
      ...(savedState.emiImagePaths ?? {}),
    },
    emiImageFileNames: {},
    videoType: savedVideoType,
  };

  if (restored.generationStatus === "styling") {
    if (restored.generatedVideo?.video_url) {
      restored.generationStatus = "completed";
      restored.styledVideoUrl = "";
      restored.styledVideoPath = "";
      restored.subtitleSource = "disabled";
      restored.generationError = "";
    } else if (restored.generatedVideo?._id || restored.generatedVideo?.video_id) {
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

  if (
    restored.generationStatus === "submitting" &&
    !(restored.generatedVideo?._id || restored.generatedVideo?.video_id) &&
    !(restored.videoType === "avatar" && restored.avatarJobId.trim())
  ) {
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
      if (next === 3 && prev.videoType !== "remotion") {
        return { ...prev, currentStep: 4 };
      }
      return { ...prev, currentStep: Math.min(next, STEPS.length - 1) };
    });
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => {
      const previous = prev.currentStep - 1;
      if (previous === 3 && prev.videoType !== "remotion") {
        return { ...prev, currentStep: 2 };
      }
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
        const isUniversal = s.videoType === "remotion" && s.videoVariety === "universal";
        const hasTranscript = (s.videoType === "remotion" ? s.remotionTranscript : s.transcript).trim().length > 0;
        
        if (isUniversal) {
          return hasTranscript;
        }

        return (
          hasTranscript &&
          s.customerName.trim().length > 0 &&
          s.lan.trim().length > 0 &&
          (s.videoType === "hybrid_remotion_avatar_pip" || s.clientName.trim().length > 0) &&
          (s.videoType !== "hybrid_remotion_avatar_pip" || (
            s.daysOverdue.trim().length > 0 &&
            s.tos.trim().length > 0 &&
            s.voiceId.trim().length > 0
          )) &&
          (s.videoType !== "remotion" ||
            (
              s.tos.trim().length > 0 &&
              s.loanAmount.trim().length > 0 &&
              s.contactDetails.trim().length > 0 &&
              (
                (s.remotionTemplateKey !== "loan_reminder" &&
                  s.remotionTemplateKey !== "collection_reminder") ||
                s.paymentUrl.trim().length > 0
              ) &&
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
