import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { HeaderBar } from "@/components/HeaderBar";
import { StepLayout } from "@/components/StepLayout";
import { WorkflowSidebar } from "@/components/WorkflowSidebar";
import { StepAvatar } from "@/components/steps/StepAvatar";
import { StepLanguage } from "@/components/steps/StepLanguage";
import { StepPreview } from "@/components/steps/StepPreview";
import { StepShare } from "@/components/steps/StepShare";
import { StepSubtitle } from "@/components/steps/StepSubtitle";
import { StepTranscript } from "@/components/steps/StepTranscript";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getDefaultAvatarScript,
  getDefaultRemotionTranscript,
  resolveNarratorGender,
} from "@/lib/templates";
import {
  type AvatarOption,
  compareVoicesForLanguage,
  createAvatarJob,
  type DirectVideoPayload,
  fetchAvatarJobStatus,
  type RemotionVideoPayload,
  fetchAvatars,
  fetchVoices,
  generateRemotionVideo,
  isVoiceCompatibleWithLanguage,
  saveDraft,
  stylizeVideo,
  type VideoJobResult,
  type VoiceOption,
} from "@/lib/api";
import { STEPS, useWizardStore } from "@/store/wizardStore";

const getStepMeta = (step: number, videoType: "avatar" | "remotion") => {
  const meta = [
    {
      title: "Select Language",
      subtitle: "Choose your desired language.",
      next: videoType === "remotion" ? "Next: Transcript →" : "Next: Avatar →",
    },
    {
      title: "Choose Your Avatar",
      subtitle: "Select an avatar and matching voice for your video.",
      next: "Next: Transcript →",
    },
    {
      title: "Add Transcript",
      subtitle: "Customize your script and lead details.",
      next: videoType === "avatar" ? "Generate Video ✨" : "Next: Subtitle & Logo →",
    },
    {
      title: videoType === "avatar" ? "Preview Video" : "Subtitles & Branding",
      subtitle: videoType === "avatar" ? "Review your finished output." : "Configure captions and logo placement.",
      next: videoType === "avatar" ? "Next: Share →" : "Next: Preview →",
    },
    {
      title: "Preview Video",
      subtitle: "Review your finished output.",
      next: "Next: Share →",
    },
    {
      title: "Share & Export",
      subtitle: "Download or share your video.",
      next: "",
    },
  ];
  return meta[step] ?? meta[0];
};

const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "1:1": { width: 1080, height: 1080 },
};

const RESET_GENERATION_STATE = {
  avatarJobId: "",
  generatedVideo: null,
  styledVideoUrl: "",
  styledVideoPath: "",
  subtitleSource: "disabled" as const,
  generationStatus: "idle" as const,
  generationError: "",
};

const EMPTY_AVATAR_SELECTION = {
  avatarId: "",
  avatarName: "",
  avatarGender: null as "male" | "female" | null,
};

const EMPTY_VOICE_SELECTION = {
  voiceId: "",
  voiceName: "",
  voiceGender: null as "male" | "female" | null,
};

function isConnectivityError(error: unknown): boolean {
  return error instanceof Error && /could not reach the server|failed to fetch|networkerror|load failed/i.test(error.message);
}

function findAvatarById(avatars: AvatarOption[], avatarId: string): AvatarOption | null {
  const trimmedId = avatarId.trim();
  if (!trimmedId) {
    return null;
  }

  return avatars.find((avatar) => avatar.id === trimmedId) ?? null;
}

function findVoiceById(voices: VoiceOption[], voiceId: string): VoiceOption | null {
  if (!voiceId) {
    return null;
  }

  return voices.find((voice) => voice.id === voiceId) ?? null;
}

function buildAvatarDefaultTranscript(
  language: string,
  avatarGender: "male" | "female" | null,
  voiceGender: "male" | "female" | null,
): string {
  return getDefaultAvatarScript(language, resolveNarratorGender(voiceGender ?? avatarGender));
}

function mapAvatarJobToVideoResult(job: {
  job_id: string;
  status: string;
  video_id?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  title?: string | null;
}): VideoJobResult {
  const videoId = (job.video_id ?? "").trim() || job.job_id;
  return {
    request_mode: "direct",
    video_id: videoId,
    status: job.status,
    video_url: job.video_url ?? null,
    thumbnail_url: job.thumbnail_url ?? null,
    title: job.title ?? null,
    raw_response: { job_id: job.job_id, status: job.status },
    saved_to: null,
  };
}

const Index = () => {
  const { state, update, nextStep, prevStep, goToStep, reset, canProceed } = useWizardStore();
  const navigate = useNavigate();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showLogoWarning, setShowLogoWarning] = useState(false);
  const continueWithoutLogoRef = useRef(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const stylingRequestedRef = useRef(false);
  const draftSyncWarningShownRef = useRef(false);
  const statusPollingWarningShownRef = useRef(false);
  const step = state.currentStep;
  const meta = getStepMeta(step, state.videoType);
  const activeTranscript = state.videoType === "remotion" ? state.remotionTranscript : state.transcript;
  const isProcessing = state.generationStatus === "submitting" || state.generationStatus === "styling";
  const shouldGenerateOnCurrentStep = state.videoType === "avatar" ? step === 2 : step === 3;
  const requestedMode = searchParams.get("mode");
  const requestedFreshDraft = searchParams.get("fresh") === "1";

  const avatarsQuery = useQuery({
    queryKey: ["avatars"],
    queryFn: fetchAvatars,
    enabled: state.videoType === "avatar",
  });

  const voicesQuery = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    enabled: state.videoType === "avatar",
  });

  const avatars = avatarsQuery.data ?? [];
  const voices = voicesQuery.data ?? [];
  const selectedAvatar = findAvatarById(avatars, state.avatarId);
  const selectedVoice = findVoiceById(voices, state.voiceId);

  const avatarJobStatusQuery = useQuery({
    queryKey: ["avatar-job-status", state.avatarJobId],
    queryFn: () => fetchAvatarJobStatus(state.avatarJobId),
    enabled: state.videoType === "avatar" && Boolean(state.avatarJobId) && state.generationStatus === "submitting",
    refetchInterval: 5000,
  });

  const generateVideoMutation = useMutation({
    mutationFn: (payload: DirectVideoPayload) => createAvatarJob(payload),
    onMutate: () => {
      stylingRequestedRef.current = false;
      statusPollingWarningShownRef.current = false;
      update({
        avatarJobId: "",
        generatedVideo: null,
        generationStatus: "submitting",
        generationError: "",
        styledVideoUrl: "",
        styledVideoPath: "",
        subtitleSource: "disabled",
      });
    },
    onSuccess: (result) => {
      statusPollingWarningShownRef.current = false;
      update({
        avatarJobId: result.job_id,
        generationStatus: "submitting",
        generationError: "",
      });
      const wordCount = activeTranscript.trim() ? activeTranscript.trim().split(/\s+/).length : 0;
      const durationMin = Math.max(1, Math.round(wordCount / 130));
      const estTime = Math.max(2, durationMin * 2);
      toast.success(`Video creation under progress. Estimated time: ~${estTime} mins. We'll notify you when it's ready.`);
    },
    onError: (error) => {
      update({
        generationStatus: "failed",
        generationError: error instanceof Error ? error.message : "Unexpected error while generating the video.",
      });
      toast.error(error instanceof Error ? error.message : "Unexpected error while generating the video.");
    },
  });

  const generateRemotionMutation = useMutation({
    mutationFn: (payload: RemotionVideoPayload) => generateRemotionVideo(payload),
    onMutate: () => {
      stylingRequestedRef.current = false;
      statusPollingWarningShownRef.current = false;
      update({
        avatarJobId: "",
        generationStatus: "submitting",
        generationError: "",
        styledVideoUrl: "",
        styledVideoPath: "",
        subtitleSource: "disabled",
      });
    },
    onSuccess: (result) => {
      statusPollingWarningShownRef.current = false;
      update({
        generatedVideo: result,
        generationStatus: "completed",
        generationError: "",
      });
      toast.success("Text to Video render generated successfully.");
      goToStep(5);
    },
    onError: (error) => {
      update({
        generationStatus: "failed",
        generationError: error instanceof Error ? error.message : "Unexpected error while generating the text video.",
      });
      toast.error(error instanceof Error ? error.message : "Unexpected error while generating the text video.");
    },
  });

  const stylizeVideoMutation = useMutation({
    mutationFn: (videoId: string) =>
      stylizeVideo(videoId, {
        includeCaptions: state.includeCaptions,
        subtitleColor: state.subtitleColor,
        subtitlePosition: state.subtitlePosition,
        transcript: state.transcript,
        logoPosition: state.logoPosition,
        logoOpacity: state.logoOpacity,
        logoFile,
      }),
    onMutate: () => {
      update({
        generationStatus: "styling",
        generationError: "",
      });
    },
    onSuccess: (result) => {
      stylingRequestedRef.current = true;
      update({
        styledVideoUrl: result.final_video_url,
        styledVideoPath: result.final_video_path,
        subtitleSource: result.subtitle_source,
        generationStatus: "completed",
        generationError: "",
      });
      toast.success("Video generated and styled successfully.");
      goToStep(5);
    },
    onError: (error) => {
      stylingRequestedRef.current = false;
      const baseVideoUrl = state.generatedVideo?.video_url ?? "";
      if (baseVideoUrl) {
        update({
          generationStatus: "completed",
          generationError: "",
          styledVideoUrl: "",
          styledVideoPath: "",
          subtitleSource: "disabled",
        });
        toast.info("Your video is ready. Extra branding could not be applied, so we opened the standard version.");
        goToStep(5);
        return;
      }

      toast.error(error instanceof Error ? error.message : "Unexpected error while styling the video.");
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: (draft: unknown) => saveDraft(draft),
    onSuccess: () => {
      draftSyncWarningShownRef.current = false;
    },
    onError: () => {
      if (draftSyncWarningShownRef.current) {
        return;
      }

      draftSyncWarningShownRef.current = true;
      toast.info("Cloud draft sync is unavailable right now. Your current draft is still saved locally in this browser.");
    },
  });

  useEffect(() => {
    if (requestedFreshDraft) {
      // 1. Clear any stuck state from localStorage
      reset();
      
      // 2. Apply the specific pipeline they asked for
      update({ videoType: requestedMode === "remotion" ? "remotion" : "avatar" });
      
      // 3. Silently scrub '?fresh=1' from the URL so it doesn't trigger again on normal re-renders
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("fresh");
      setSearchParams(newParams, { replace: true });
    }
  }, [requestedFreshDraft, requestedMode, reset, update, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedAvatar && (state.avatarName !== selectedAvatar.name || state.avatarGender !== selectedAvatar.gender)) {
      update({
        avatarName: selectedAvatar.name,
        avatarGender: selectedAvatar.gender,
      });
    }
  }, [selectedAvatar, state.avatarGender, state.avatarName, update]);

  useEffect(() => {
    if (selectedVoice && (state.voiceName !== selectedVoice.name || state.voiceGender !== selectedVoice.gender)) {
      update({
        voiceName: selectedVoice.name,
        voiceGender: selectedVoice.gender,
      });
    }
  }, [selectedVoice, state.voiceGender, state.voiceName, update]);

  useEffect(() => {
    if (!state.voiceId || selectedVoice || voicesQuery.isLoading || voicesQuery.isError || voices.length === 0) {
      return;
    }

    update({
      ...EMPTY_VOICE_SELECTION,
      ...RESET_GENERATION_STATE,
    });
    toast.info("Your previously selected voice is no longer available, so we cleared it.");
  }, [selectedVoice, state.voiceId, update, voices.length, voicesQuery.isError, voicesQuery.isLoading]);

  useEffect(() => {
    if (
      state.videoType !== "avatar" ||
      !selectedVoice ||
      !selectedAvatar?.gender ||
      selectedVoice.gender === selectedAvatar.gender
    ) {
      return;
    }

    update({
      ...EMPTY_VOICE_SELECTION,
      ...(!state.avatarTranscriptCustomized
        ? {
          transcript: buildAvatarDefaultTranscript(state.language, selectedAvatar.gender, null),
          avatarTranscriptCustomized: false,
        }
        : {}),
      ...RESET_GENERATION_STATE,
    });
  }, [
    selectedAvatar?.gender,
    selectedVoice,
    state.avatarTranscriptCustomized,
    state.language,
    state.videoType,
    update,
  ]);

  useEffect(() => {
    if (state.videoType !== "avatar" || !selectedVoice || isVoiceCompatibleWithLanguage(selectedVoice, state.language)) {
      return;
    }

    update({
      ...EMPTY_VOICE_SELECTION,
      ...(!state.avatarTranscriptCustomized
        ? {
          transcript: buildAvatarDefaultTranscript(state.language, state.avatarGender, null),
          avatarTranscriptCustomized: false,
        }
        : {}),
      ...RESET_GENERATION_STATE,
    });
  }, [
    selectedVoice,
    state.avatarGender,
    state.avatarTranscriptCustomized,
    state.language,
    state.videoType,
    update,
  ]);

  useEffect(() => {
    if (step < 4) {
      const timer = setTimeout(() => {
        saveDraftMutation.mutate(state);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [saveDraftMutation.mutate, state, step]);

  useEffect(() => {
    if (!avatarJobStatusQuery.data || state.generationStatus !== "submitting" || state.videoType !== "avatar") {
      return;
    }

    const nextStatus = avatarJobStatusQuery.data.status.toLowerCase();
    if (nextStatus === "completed") {
      statusPollingWarningShownRef.current = false;
      update({
        avatarJobId: "",
        generatedVideo: mapAvatarJobToVideoResult(avatarJobStatusQuery.data),
        generationStatus: "completed",
        generationError: "",
      });
      toast.success("Video generated successfully.");
      goToStep(5);
      return;
    }

    if (nextStatus === "failed") {
      statusPollingWarningShownRef.current = false;
      const errorMessage = avatarJobStatusQuery.data.error || "Unexpected error while generating the video.";
      update({
        avatarJobId: "",
        generationStatus: "failed",
        generationError: errorMessage,
      });
      toast.error(errorMessage);
    }
  }, [avatarJobStatusQuery.data, goToStep, state.generationStatus, state.videoType, update]);

  useEffect(() => {
    if (!avatarJobStatusQuery.error || state.generationStatus !== "submitting" || state.videoType !== "avatar") {
      return;
    }

    if (isConnectivityError(avatarJobStatusQuery.error)) {
      if (!statusPollingWarningShownRef.current) {
        statusPollingWarningShownRef.current = true;
        toast.info("Connection lost while checking video status. We'll keep your draft and resume polling when the server is reachable again.");
      }
      return;
    }

    const errorMessage =
      avatarJobStatusQuery.error instanceof Error
        ? avatarJobStatusQuery.error.message
        : "Unexpected error while checking video status.";
    update({
      avatarJobId: "",
      generationStatus: "failed",
      generationError: errorMessage,
    });
    toast.error(errorMessage);
  }, [avatarJobStatusQuery.error, state.generationStatus, state.videoType, update]);

  useEffect(() => {
    if (state.videoType === "avatar" && step === 3) {
      goToStep(2);
      return;
    }
    if (state.videoType === "remotion" && step === 1) {
      goToStep(2);
    }
  }, [goToStep, state.videoType, step]);

  useEffect(() => {
    if (requestedMode !== "avatar" && requestedMode !== "remotion") {
      return;
    }

    stylingRequestedRef.current = false;
    generateVideoMutation.reset();
    generateRemotionMutation.reset();
    stylizeVideoMutation.reset();
    setLogoFile(null);
    continueWithoutLogoRef.current = false;

    if (requestedFreshDraft) {
      reset();
    }

    const language = requestedFreshDraft ? "Hindi" : state.language;
    const preservedAvatar =
      requestedFreshDraft || requestedMode === "remotion"
        ? EMPTY_AVATAR_SELECTION
        : {
          avatarId: state.avatarId,
          avatarName: state.avatarName,
          avatarGender: state.avatarGender,
        };
    const preservedVoice =
      requestedFreshDraft || requestedMode === "remotion"
        ? EMPTY_VOICE_SELECTION
        : {
          voiceId: state.voiceId,
          voiceName: state.voiceName,
          voiceGender: state.voiceGender,
        };

    update({
      currentStep: 0,
      language,
      outputLanguage: language,
      videoType: requestedMode,
      ...preservedAvatar,
      ...preservedVoice,
      transcript: requestedFreshDraft
        ? getDefaultAvatarScript(language, "female")
        : state.avatarTranscriptCustomized
          ? state.transcript
          : buildAvatarDefaultTranscript(language, preservedAvatar.avatarGender, preservedVoice.voiceGender),
      remotionTranscript: requestedFreshDraft
        ? getDefaultRemotionTranscript(language, state.videoVariety, state.voiceGender)
        : state.remotionTranscriptCustomized
          ? state.remotionTranscript
          : getDefaultRemotionTranscript(language, state.videoVariety, state.voiceGender),
      avatarTranscriptCustomized: requestedFreshDraft ? false : state.avatarTranscriptCustomized,
      remotionTranscriptCustomized: requestedFreshDraft ? false : state.remotionTranscriptCustomized,
      ...RESET_GENERATION_STATE,
    });

    setSearchParams({}, { replace: true });
  }, [
    requestedFreshDraft,
    requestedMode,
    reset,
    setSearchParams,
    update,
  ]);

  const handleCreateVideo = () => {
    stylingRequestedRef.current = false;
    generateVideoMutation.reset();
    generateRemotionMutation.reset();
    stylizeVideoMutation.reset();
    setLogoFile(null);
    continueWithoutLogoRef.current = false;
    reset();
    toast.success("New video draft started!");
  };

  const handleCancel = () => {
    stylingRequestedRef.current = false;
    generateVideoMutation.reset();
    generateRemotionMutation.reset();
    stylizeVideoMutation.reset();
    continueWithoutLogoRef.current = false;
    update({
      avatarJobId: "",
      generationStatus: "idle",
      generationError: "",
    });
    toast.info("Generation interrupted.");
  };

  const handleLanguageSelect = (language: string) => {
    const shouldClearVoice = Boolean(selectedVoice && !isVoiceCompatibleWithLanguage(selectedVoice, language));
    const nextVoiceGender = shouldClearVoice ? null : selectedVoice?.gender ?? state.voiceGender;

    update({
      language,
      outputLanguage: language,
      ...(shouldClearVoice ? EMPTY_VOICE_SELECTION : {}),
      ...(!state.avatarTranscriptCustomized
        ? {
          transcript: buildAvatarDefaultTranscript(language, state.avatarGender, nextVoiceGender),
          avatarTranscriptCustomized: false,
        }
        : {}),
      ...(!state.remotionTranscriptCustomized
        ? {
          remotionTranscript: getDefaultRemotionTranscript(language, state.videoVariety, nextVoiceGender),
          remotionTranscriptCustomized: false,
        }
        : {}),
      ...RESET_GENERATION_STATE,
    });

    if (shouldClearVoice) {
      toast.info(`The previous voice is not available in ${language}, so we cleared it for you.`);
    }
  };

  const handleVideoTypeChange = (videoType: "avatar" | "remotion") => {
    update({
      videoType,
      ...(!state.avatarTranscriptCustomized
        ? {
          transcript: buildAvatarDefaultTranscript(state.language, state.avatarGender, state.voiceGender),
          avatarTranscriptCustomized: false,
        }
        : {}),
      ...(!state.remotionTranscriptCustomized
        ? {
          remotionTranscript: getDefaultRemotionTranscript(state.language, state.videoVariety, state.voiceGender),
          remotionTranscriptCustomized: false,
        }
        : {}),
      ...RESET_GENERATION_STATE,
    });
  };

  const handleAvatarSelect = (
    avatarId: string,
    avatarName: string,
    avatarGender: "male" | "female" | null,
  ) => {
    const trimmedId = avatarId.trim();
    let nextVoiceGender = state.voiceGender;
    let didClearVoice = false;

    const partial = {
      avatarId: trimmedId,
      avatarName: trimmedId ? avatarName || trimmedId : "",
      avatarGender,
      ...RESET_GENERATION_STATE,
    };

    if (trimmedId && avatarGender && state.voiceId && state.voiceGender && state.voiceGender !== avatarGender) {
      Object.assign(partial, EMPTY_VOICE_SELECTION);
      nextVoiceGender = null;
      didClearVoice = true;
    }

    if (!state.avatarTranscriptCustomized) {
      Object.assign(partial, {
        transcript: buildAvatarDefaultTranscript(state.language, avatarGender, nextVoiceGender),
        avatarTranscriptCustomized: false,
      });
    }

    update(partial);

    if (didClearVoice) {
      toast.info(`We cleared the incompatible ${state.voiceGender} voice because ${avatarName || "that avatar"} is ${avatarGender}.`);
    }
  };

  const handleVoiceSelect = (voiceId: string) => {
    const compatibleVoiceChoices = voices
      .filter((candidate) => isVoiceCompatibleWithLanguage(candidate, state.language))
      .sort((left, right) => compareVoicesForLanguage(left, right, state.language));
    const voice = compatibleVoiceChoices.find((candidate) => candidate.id === voiceId) ?? findVoiceById(voices, voiceId);
    let nextAvatarGender = state.avatarGender;
    let didClearAvatar = false;

    const partial = {
      voiceId: voice?.id ?? "",
      voiceName: voice?.name ?? "",
      voiceGender: voice?.gender ?? null,
      ...RESET_GENERATION_STATE,
    };

    if (voice && state.avatarId && state.avatarGender && state.avatarGender !== voice.gender) {
      Object.assign(partial, EMPTY_AVATAR_SELECTION);
      nextAvatarGender = null;
      didClearAvatar = true;
    }

    if (!state.avatarTranscriptCustomized) {
      Object.assign(partial, {
        transcript: buildAvatarDefaultTranscript(state.language, nextAvatarGender, voice?.gender ?? null),
        avatarTranscriptCustomized: false,
      });
    }

    update(partial);

    if (didClearAvatar) {
      toast.info(`We cleared the incompatible ${state.avatarGender} avatar because ${voice.name} is a ${voice.gender} voice.`);
    }
  };

  const handleGenerate = () => {
    if (state.videoType === "avatar" && !state.avatarId.trim()) {
      toast.error("Select an avatar before generating the video.");
      goToStep(1);
      return;
    }

    if (
      state.videoType === "avatar" &&
      selectedAvatar?.gender &&
      state.voiceGender &&
      selectedAvatar.gender !== state.voiceGender
    ) {
      toast.error("The selected avatar and voice do not match. Pick a matching pair before generating.");
      goToStep(1);
      return;
    }

    const isUniversal = state.videoVariety === "universal";
    const hasTranscript = activeTranscript.trim().length > 0;

    if (isUniversal) {
      if (!hasTranscript) {
        toast.error("Complete the transcript before generating the video.");
        goToStep(2);
        return;
      }
    } else {
      if (
        !state.customerName.trim() ||
        !state.lan.trim() ||
        !state.clientName.trim() ||
        (state.videoType === "remotion" &&
          (!state.tos.trim() ||
            !state.loanAmount.trim() ||
            !state.contactDetails.trim() ||
            !state.productType.trim())) ||
        !hasTranscript
      ) {
        toast.error("Complete the lead details and transcript before generating the video.");
        goToStep(2);
        return;
      }
    }

    if (state.videoType === "remotion" && !logoFile && !continueWithoutLogoRef.current) {
      setShowLogoWarning(true);
      return;
    }

    const dimensions = ASPECT_RATIO_DIMENSIONS[state.aspectRatio] ?? ASPECT_RATIO_DIMENSIONS["16:9"];
    const payload: DirectVideoPayload = {
      customer_name: state.customerName.trim(),
      lan: state.lan.trim(),
      client_name: state.clientName.trim(),
      tos: state.tos.trim() || undefined,
      loan_amount: state.loanAmount.trim() || undefined,
      contact_details: state.contactDetails.trim() || undefined,
      product_type: state.productType.trim() || undefined,
      avatar_id: state.videoType === "avatar" ? state.avatarId.trim() || undefined : undefined,
      voice_id: state.videoType === "avatar" ? state.voiceId || undefined : undefined,
      template_name: state.videoType === "avatar" ? state.templateName : undefined,
      language: state.language,
      script_text: activeTranscript.trim() || undefined,
      background_color: state.backgroundColor,
      include_captions: state.videoType === "remotion" ? state.includeCaptions : false,
      title_prefix: state.videoType === "avatar" ? state.titlePrefix.trim() || undefined : undefined,
      video_width: dimensions.width,
      video_height: dimensions.height,
      voice_gender: state.videoType === "remotion" ? (state.voiceGender || "female") : undefined,
    };

    if (state.videoType === "remotion") {
      generateRemotionMutation.mutate({
        ...payload,
        video_variety: state.videoVariety,
        subtitleColor: state.subtitleColor,
        subtitlePosition: state.subtitlePosition,
        logoPosition: state.logoPosition,
        logoOpacity: state.logoOpacity,
        logoFile,
      });
    } else {
      generateVideoMutation.mutate(payload);
    }

    goToStep(4);
  };

  const handleNextPrimary = () => {
    if (shouldGenerateOnCurrentStep) {
      handleGenerate();
      return;
    }
    nextStep();
  };

  const handleWorkflowStepClick = (targetStep: number) => {
    if (isProcessing && targetStep === 5) {
      toast.info("The video is still processing. You'll reach Share automatically when it's ready.");
      return;
    }

    if (state.videoType === "remotion" && targetStep === 1) {
      goToStep(2);
      return;
    }
    if (state.videoType === "avatar" && targetStep === 3) {
      goToStep(2);
      return;
    }

    goToStep(targetStep);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepLanguage
            selected={state.language}
            onSelect={handleLanguageSelect}
            videoType={state.videoType}
            onVideoTypeChange={handleVideoTypeChange}
            gender={state.voiceGender || "female"}
            onGenderChange={(gender) => {
              const partial: any = {
                voiceGender: gender,
                avatarFilter: gender === "male" ? "Male" : "Female",
                ...RESET_GENERATION_STATE,
              };

              // Clear selection if incompatible with new gender
              if (state.avatarId && state.avatarGender && state.avatarGender !== gender) {
                Object.assign(partial, EMPTY_AVATAR_SELECTION);
              }
              if (state.voiceId && state.voiceGender && state.voiceGender !== gender) {
                Object.assign(partial, EMPTY_VOICE_SELECTION);
              }

              if (!state.avatarTranscriptCustomized) {
                partial.transcript = getDefaultAvatarScript(state.language, gender, state.videoVariety);
                partial.avatarTranscriptCustomized = false;
              }
              if (!state.remotionTranscriptCustomized) {
                partial.remotionTranscript = getDefaultRemotionTranscript(state.language, state.videoVariety, gender);
                partial.remotionTranscriptCustomized = false;
              }

              update(partial);
            }}
          />
        );
      case 1:
        return (
          <StepAvatar
            avatars={avatars}
            voices={voices}
            language={state.language}
            isLoading={avatarsQuery.isLoading}
            voicesLoading={voicesQuery.isLoading}
            errorMessage={avatarsQuery.error instanceof Error ? avatarsQuery.error.message : null}
            voiceErrorMessage={voicesQuery.error instanceof Error ? voicesQuery.error.message : null}
            selectedId={state.avatarId}
            selectedVoiceId={state.voiceId}
            selectedVoiceGender={state.voiceGender}
            selectedAvatarGender={state.avatarGender}
            filter={state.avatarFilter}
            onSelect={handleAvatarSelect}
            onVoiceSelect={handleVoiceSelect}
            onFilterChange={(filter) => {
              const gender = filter.toLowerCase() as "male" | "female";
              update({
                avatarFilter: filter,
                voiceGender: gender,
                ...(!state.avatarTranscriptCustomized
                  ? {
                    transcript: getDefaultAvatarScript(state.language, gender, state.videoVariety),
                    avatarTranscriptCustomized: false,
                  }
                  : {}),
                ...(!state.remotionTranscriptCustomized
                  ? {
                    remotionTranscript: getDefaultRemotionTranscript(state.language, state.videoVariety, gender),
                    remotionTranscriptCustomized: false,
                  }
                  : {}),
                ...RESET_GENERATION_STATE,
              });
            }}
          />
        );
      case 2:
        return <StepTranscript state={state} update={update} voices={voices} />;
      case 3:
        if (state.videoType === "remotion") {
          return <StepSubtitle state={state} update={update} onLogoSelected={setLogoFile} />;
        }
        return <StepPreview state={state} update={update} />;
      case 4:
        return <StepPreview state={state} update={update} />;
      case 5:
        return <StepShare state={state} update={update} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <HeaderBar onCreateVideo={handleCreateVideo} primaryLabel="New Draft" />
      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar currentStep={step} onStepClick={handleWorkflowStepClick} videoType={state.videoType} />
        <StepLayout
          step={step}
          videoType={state.videoType}
          title={meta.title}
          subtitle={meta.subtitle}
          onNext={handleNextPrimary}
          onBack={prevStep}
          nextLabel={shouldGenerateOnCurrentStep ? "Generate Video ✨" : meta.next}
          canProceed={canProceed()}
          isLast={step === STEPS.length - 1}
          lastLabel="Finish"
          primaryActionBusy={
            generateVideoMutation.isPending ||
            generateRemotionMutation.isPending ||
            stylizeVideoMutation.isPending ||
            isProcessing
          }
          primaryBusyLabel={
            stylizeVideoMutation.isPending || state.generationStatus === "styling"
              ? "Applying branding..."
              : "Video creation under progress..."
          }
          onCancel={step === 4 && isProcessing ? handleCancel : undefined}
          onFinish={() => navigate("/")}
        >
          {renderStep()}
        </StepLayout>
      </div>

      {state.videoType === "remotion" ? (
        <>
          <AlertDialog open={showLogoWarning} onOpenChange={setShowLogoWarning}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Missing Logo</AlertDialogTitle>
                <AlertDialogDescription>
                  Logo not uploaded. Do you want to continue without logo?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLogoWarning(false);
                    setTimeout(() => {
                      logoInputRef.current?.click();
                    }, 100);
                  }}
                >
                  Upload Logo
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowLogoWarning(false);
                    continueWithoutLogoRef.current = true;
                    handleGenerate();
                  }}
                >
                  Continue Without Logo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <input
            type="file"
            ref={logoInputRef}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setLogoFile(file);
                toast.success("Logo uploaded.");
              }
              if (logoInputRef.current) {
                logoInputRef.current.value = "";
              }
            }}
          />
        </>
      ) : null}
    </div>
  );
};

export default Index;
