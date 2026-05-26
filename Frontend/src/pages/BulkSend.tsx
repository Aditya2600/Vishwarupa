import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { useSearchParams } from "react-router-dom";
import { buildApiUrl, fetchAvatars, fetchVoices, isVoiceCompatibleWithLanguage, compareVoicesForLanguage, type AvatarOption, type VoiceOption, fetchMyVideos, createCampaign, pushCampaignLeads, updateCampaignStatus, fetchVideo, generateDirectVideo, generateRemotionVideo } from "@/lib/api";
import {
  Sparkles,
  MessageSquare,
  Settings2,
  Users,
  Video,
  ChevronRight,
  ArrowLeft,
  Smartphone,
  Info,
  Pause,
  LoaderCircle,
  Play,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronLeft,
  User,
  Mic,
  Camera,
  ArrowRight,
  FileCheck,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { requestJson } from "@/lib/api";

type Step = "config" | "assets" | "upload" | "mapping" | "preview" | "launch";
const SAMPLE_BULK_CSV_URL = buildApiUrl("/sample-csvs/bulk-campaign");
const CSV_PREVIEW_ROW_LIMIT = 8;
const PRIORITY_PREVIEW_COLUMNS = [
  "name",
  "phone",
  "lan",
  "client_name",
  "language",
  "total_outstanding_amount",
  "loan_amount",
];

const DEFAULT_CAMPAIGN_STRATEGIES = [
  {
    id: "wsp_test2",
    templateId: "1438951627977491",
    name: "wsp_test2",
    desc: "Account Status Update Strategy",
    color: "emerald",
    whatsapp:
      "Hello,\n\nAn update regarding your account has been shared by CredResolve.\nKindly watch the video and take the necessary action.\n\nThank you.",
    scriptPersonalized:
      "Hello {{customer_name}}. An update regarding your account has been shared by CredResolve. Kindly watch the information in this video and take the necessary action. Thank you.",
    scriptUniversal:
      "Hello. An update regarding your account has been shared by CredResolve. Kindly watch the information in this video and take the necessary action. Thank you.",
  },
] as const;

const TEMPLATE_DISPLAY_NAME_BY_ID: Record<string, string> = {
  wsp_test2: "Account Status Update",
};

function normalizeCsvKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveCsvHeader(
  headers: string[],
  mapping: Record<string, string>,
  systemKey: string,
): string | null {
  const mappedHeader = mapping[systemKey];
  if (mappedHeader) {
    return mappedHeader;
  }

  const normalizedSystemKey = normalizeCsvKey(systemKey);
  const exactHeader = headers.find((header) => normalizeCsvKey(header) === normalizedSystemKey);
  if (exactHeader) {
    return exactHeader;
  }

  return headers.find((header) => normalizeCsvKey(header).includes(normalizedSystemKey)) ?? null;
}

function orderPreviewHeaders(headers: string[], mapping: Record<string, string>): string[] {
  const prioritizedHeaders = PRIORITY_PREVIEW_COLUMNS
    .map((systemKey) => resolveCsvHeader(headers, mapping, systemKey))
    .filter((header): header is string => Boolean(header));

  const seen = new Set(prioritizedHeaders.map((header) => normalizeCsvKey(header)));
  const remainingHeaders = headers.filter((header) => !seen.has(normalizeCsvKey(header)));

  return [...prioritizedHeaders, ...remainingHeaders];
}

function getRowValue(
  row: Record<string, unknown>,
  headers: string[],
  mapping: Record<string, string>,
  systemKey: string,
): string {
  const header = resolveCsvHeader(headers, mapping, systemKey);
  if (!header) {
    return "";
  }

  const value = row[header];
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}

function slugifyPreviewValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildVideoLinkPreview(
  row: Record<string, unknown>,
  index: number,
  headers: string[],
  mapping: Record<string, string>,
  mode: "personalized" | "universal",
  referenceVideoUrl?: string | null,
): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://vishvarupa.credresolve.com";
  const csvVideoUrl =
    getRowValue(row, headers, mapping, "video_url")
    || getRowValue(row, headers, mapping, "final_video_url")
    || getRowValue(row, headers, mapping, "source_video_url");

  if (csvVideoUrl) {
    return csvVideoUrl;
  }

  if (mode === "universal" && referenceVideoUrl) {
    return referenceVideoUrl;
  }

  if (mode === "universal") {
    return `${origin}/bulk/preview/reference/universal`;
  }

  const leadKey = slugifyPreviewValue(
    getRowValue(row, headers, mapping, "lan")
    || getRowValue(row, headers, mapping, "phone")
    || getRowValue(row, headers, mapping, "name")
    || `lead-${index + 1}`,
  );

  return `${origin}/bulk/preview/generated/${leadKey || `lead-${index + 1}`}`;
}

function getVideoLinkPreviewLabel(
  row: Record<string, unknown>,
  headers: string[],
  mapping: Record<string, string>,
  mode: "personalized" | "universal",
  referenceVideoUrl?: string | null,
): string {
  if (
    getRowValue(row, headers, mapping, "video_url")
    || getRowValue(row, headers, mapping, "final_video_url")
    || getRowValue(row, headers, mapping, "source_video_url")
  ) {
    return "CSV Video URL";
  }

  if (mode === "universal" && referenceVideoUrl) {
    return "Live reference URL";
  }

  return "Preview URL";
}

function normalizePhoneNumber(value: unknown): string {
  const rawValue = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!rawValue) {
    return "";
  }

  const digits = rawValue.replace(/\D/g, "");
  if (digits.length === 10) {
    return digits;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits || rawValue;
}

function buildLeadVariables(row: Record<string, unknown>, videoUrl?: string | null): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value == null) {
      continue;
    }
    const normalizedValue = typeof value === "string" ? value.trim() : String(value);
    if (!normalizedValue) {
      continue;
    }
    variables[key] = normalizedValue;
  }

  if (videoUrl) {
    variables.video_url = videoUrl;
  }

  return variables;
}

function getShareableVideoUrl(video: any): string | null {
  return video?.interactive_url ?? video?.video_url ?? null;
}

function extractCampaignCode(data: unknown): string {
  if (typeof data === "string") {
    return data.trim();
  }

  if (!data || typeof data !== "object") {
    return "";
  }

  const record = data as Record<string, unknown>;
  const candidateKeys = ["campaignCode", "campaign_code", "code", "id", "campaignId"];

  for (const key of candidateKeys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export default function BulkSend() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const videoIdFromUrl = searchParams.get("video_id");
  const isFromVideo = !!videoIdFromUrl;

  const steps: Step[] = isFromVideo
    ? ["upload", "mapping", "launch"]
    : ["config", "assets", "upload", "mapping", "preview", "launch"];

  const [currentStep, setCurrentStep] = useState<Step>(isFromVideo ? "upload" : "config");
  const [engine, setEngine] = useState<"avatar" | "remotion">("avatar");
  const [mode, setMode] = useState<"personalized" | "universal">("personalized");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [csvData, setCsvData] = useState<any[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-US");
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(
    "Hello,\n\nAn update regarding your account has been shared by CredResolve.\nKindly watch the video and take the necessary action.\n\nThank you."
  );
  const [videoScript, setVideoScript] = useState<string>(
    "Hello {{customer_name}}. An update regarding your account has been shared by CredResolve. Kindly watch the information in this video and take the necessary action. Thank you."
  );
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedMsgTemplate, setSelectedMsgTemplate] = useState<string>("wsp_test2");
  const [playingVoiceId, setPlayingVoiceId] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch the specific reference video details - using placeholderData for instant load
  const referenceVideoQuery = useQuery({
    queryKey: ["video", videoIdFromUrl],
    queryFn: () => fetchVideo(videoIdFromUrl!),
    enabled: !!videoIdFromUrl,
    retry: 1,
    placeholderData: () => {
      // Instant load if this exists in our main videos cache
      const myVideos = qc.getQueryData<any[]>(["my-videos"]);
      return myVideos?.find(v => (v._id || v.video_id) === videoIdFromUrl);
    }
  });
  const referenceShareUrl = getShareableVideoUrl(referenceVideoQuery.data);


  useEffect(() => {
    if (videoIdFromUrl && referenceVideoQuery.data) {
      const refVideo = referenceVideoQuery.data;
      if (refVideo) {
        // Auto-detect engine
        const isRemotion = refVideo.request_mode === "remotion" || (refVideo.request_mode as string)?.includes("remotion");
        setEngine(isRemotion ? "remotion" : "avatar");

        // Existing-video flow should send the chosen video to WhatsApp, not generate new drafts.
        if (isFromVideo) {
          setMode("universal");
        } else if (refVideo.raw_response?.input_params?.video_variety) {
          setMode(refVideo.raw_response.input_params.video_variety);
        }

        // Auto-detect language
        const detectedLang = refVideo.language || refVideo.request_payload?.language || refVideo.raw_response?.input_params?.language || refVideo.request_params?.language;
        if (detectedLang) {
          setSelectedLanguage(detectedLang);
        }

        // Auto-detect avatar assets
        if (!isRemotion && refVideo.raw_response?.input_params) {
          const params = refVideo.raw_response.input_params;
          if (params.avatar_id) setSelectedAvatar(params.avatar_id);
          if (params.voice_id) setSelectedVoice(params.voice_id);
        }

        // Jump to Upload step if we have a reference video (Skip config/assets)
        setCurrentStep("upload");
      }
    }
  }, [videoIdFromUrl, referenceVideoQuery.data]);


  const INDIAN_SEARCH_NAMES = [
    "Shruti", "Aditi", "Priya", "Aakash", "Mohan", "Abhishek", "Sneha", "Ananya",
    "Vihaan", "Arjun", "Karan", "Ishani", "Sanjay", "Ankit", "Rohan", "Maya",
    "Kavya", "Diya", "Ishita", "Ansh", "Kabir"
  ];

  // Fetch dynamic WhatsApp strategies from API
  const whatsappTemplatesQuery = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/meta/whatsapp-templates"), {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) {
        console.error("WhatsApp templates fetch failed:", res.status, await res.text());
        throw new Error(`Failed to fetch templates: ${res.status}`);
      }
      return res.json();
    },
    retry: 1,
  });

  const rawTemplates = whatsappTemplatesQuery.data;
  const CAMPAIGN_STRATEGIES: any[] =
    Array.isArray(rawTemplates) && rawTemplates.length > 0 ? rawTemplates : DEFAULT_CAMPAIGN_STRATEGIES;

  // Auto-select first template when data arrives
  React.useEffect(() => {
    if (CAMPAIGN_STRATEGIES.length > 0 && !selectedMsgTemplate) {
      handleTemplateSelect(CAMPAIGN_STRATEGIES[0].id);
    }
  }, [CAMPAIGN_STRATEGIES.length]);




  const PhoneMockup = ({ message }: { message: string }) => (
    <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[10px] rounded-[2rem] h-[500px] w-[250px] shadow-xl overflow-hidden scale-95 origin-top">
      <div className="w-[120px] h-[15px] bg-gray-800 top-0 left-1/2 -translate-x-1/2 absolute rounded-b-[0.8rem] z-20"></div>

      <div className="h-full w-full bg-[#e5ddd5] flex flex-col pt-8">
        <div className="bg-[#075e54] p-2 flex items-center gap-2 text-white">
          <ChevronLeft className="w-4 h-4" />
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-slate-500" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold truncate blur-sm select-none">919220697744</span>
            <span className="text-[8px] opacity-80">Active now</span>
          </div>
        </div>

        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          <div className="bg-white p-2 rounded-lg shadow-sm max-w-[90%] relative self-start">
            <div className="flex items-center gap-2 mb-1.5 p-1.5 bg-secondary/10 rounded-md border border-border/50">
              <div className="w-7 h-7 bg-orange-100 rounded flex items-center justify-center shrink-0">
                <Video className="w-3.5 h-3.5 text-orange-600" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-black leading-none uppercase tracking-tighter">Video</span>
                <span className="text-[6px] text-muted-foreground font-bold truncate">Supported file types: MP4, 3GPP</span>
              </div>
            </div>
            <p className="text-[10px] leading-snug text-slate-800 whitespace-pre-wrap">
              {message}
            </p>
            <div className="mt-1 flex justify-end">
              <span className="text-[7px] text-slate-400">12:04 PM • Read ✓✓</span>
            </div>
          </div>
        </div>

        <div className="p-2 bg-white flex items-center gap-2">
          <div className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 text-[10px]">+</div>
          <div className="flex-1 h-6 bg-slate-100 rounded-full border border-slate-200"></div>
          <Camera className="w-4 h-4 text-[#075e54]" />
          <Mic className="w-4 h-4 text-[#075e54]" />
        </div>
      </div>
    </div>
  );

  const insertVariable = (variable: string) => {
    setWhatsappTemplate(prev => prev + ` {{${variable}}}`);
    toast.info(`Added {{${variable}}} to message`);
  };

  const handleTemplateSelect = (id: string) => {
    const strategy = CAMPAIGN_STRATEGIES.find((s: any) => s.id === id);
    if (strategy) {
      setWhatsappTemplate(strategy.whatsapp);
      setVideoScript(mode === "personalized" ? strategy.scriptPersonalized : strategy.scriptUniversal);
      setSelectedMsgTemplate(id);
      toast.success(`Switched to ${(TEMPLATE_DISPLAY_NAME_BY_ID[id] ?? strategy.name)} strategy`);
    }
  };

  const handleLaunchCampaign = async () => {
    setIsLaunching(true);
    let successCount = 0;
    let failCount = 0;
    const shouldUseCampaignSend = mode === "universal" || isFromVideo;
    const referenceVideoUrl = getShareableVideoUrl(referenceVideoQuery.data);

    const promise = (async () => {
      if (shouldUseCampaignSend) {
        if (isFromVideo && !referenceVideoUrl) {
          throw new Error("The selected video is not ready yet. Wait for the video URL to be available before sending it to WhatsApp.");
        }

        const strategy = CAMPAIGN_STRATEGIES.find((s: any) => s.id === selectedMsgTemplate);
        const now = Date.now();
        const campaignPayload = {
          name: `${TEMPLATE_DISPLAY_NAME_BY_ID[selectedMsgTemplate] || strategy?.name || selectedMsgTemplate} ${new Date(now).toLocaleDateString("en-GB")}`,
          description: `Bulk send campaign for ${TEMPLATE_DISPLAY_NAME_BY_ID[selectedMsgTemplate] || strategy?.name || selectedMsgTemplate} in ${selectedLanguage}.`,
          startDate: new Date(now + 60_000).toISOString(),
          endDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
          templateId: strategy?.id || selectedMsgTemplate || "wsp_test2",
          communicationType: "WHATSAPP",
          campaignType: "WHATSAPP",
        };
        console.info("[bulk-send] createCampaign payload", campaignPayload);
        const campaignResponse = await createCampaign(campaignPayload);
        console.info("[bulk-send] createCampaign response", campaignResponse);

        const campaignCode = extractCampaignCode(campaignResponse.data);
        console.info("[bulk-send] extracted campaignCode", campaignCode, campaignResponse.data);
        if (!campaignCode) {
          throw new Error("Campaign code was not returned after campaign creation.");
        }

        const leads = csvData.flatMap((row) => {
          const mappedPhone = normalizePhoneNumber(row[mapping["phone"]]);
          const mappedName = row[mapping["name"]];
          const mappedLan = row[mapping["lan"]];

          if (!mappedPhone) {
            failCount++;
            return [];
          }

          const uniqueId = String(mappedLan || mappedName || mappedPhone || "Customer").trim();

          return [{
            phoneNumber: mappedPhone,
            uniqueId: uniqueId || "Customer",
            variables: buildLeadVariables(row, referenceVideoUrl),
          }];
        });

        if (!leads.length) {
          throw new Error("No valid leads with phone numbers were found in the uploaded CSV.");
        }

        await pushCampaignLeads({
          campaignCode,
          leads,
        });

        await updateCampaignStatus(campaignCode, "STARTED");

        successCount = leads.length;
        return { successCount, failCount, mode, launchType: "campaign" as const };
      }

      for (const row of csvData) {
        try {
          const mappedName = row[mapping["name"]];
          const mappedPhone = row[mapping["phone"]];
          const mappedLoan = row[mapping["loan_amount"]];
          const mappedLan = row[mapping["lan"]];
          const mappedClient = row[mapping["client_name"]] || "Bank";

          if (!mappedPhone) continue;

          // Personalized Mode: Create NEW video for every lead
          if (engine === "avatar") {
            await generateDirectVideo({
              customer_name: mappedName || "Customer",
              lan: mappedLan || "N/A",
              client_name: mappedClient,
              loan_amount: mappedLoan || "0",
              avatar_id: selectedAvatar,
              voice_id: selectedVoice,
              language: selectedLanguage,
              script_text: videoScript.replace(/{{customer_name}}/g, mappedName || "Customer")
                .replace(/{{loan_amount}}/g, mappedLoan || "0")
                .replace(/{{lan}}/g, mappedLan || "N/A"),
              title_prefix: "Bulk Campaign"
            }, false); // wait=false for speed
          } else {
            await generateRemotionVideo({
              customer_name: mappedName || "Customer",
              lan: mappedLan || "N/A",
              client_name: mappedClient,
              loan_amount: mappedLoan || "0",
              language: selectedLanguage,
              script_text: videoScript.replace(/{{customer_name}}/g, mappedName || "Customer")
                .replace(/{{loan_amount}}/g, mappedLoan || "0")
                .replace(/{{lan}}/g, mappedLan || "N/A"),
              title_prefix: "Bulk Campaign",
              subtitleColor: "White",
              subtitlePosition: "Bottom",
              logoPosition: "Top Right",
              logoOpacity: 80
            });

          }
          successCount++;
        } catch (err) {
          console.error("Failed to process row:", row, err);
          failCount++;
        }
      }
      return { successCount, failCount, mode };
    })();

    toast.promise(promise, {
      loading: shouldUseCampaignSend
        ? isFromVideo
          ? `Creating WhatsApp campaign and sending the selected video to ${csvData.length} leads...`
          : `Creating campaign and pushing ${csvData.length} leads...`
        : `Queuing ${csvData.length} personalized AI video jobs...`,
      success: (data) => data.launchType === "campaign"
        ? `WhatsApp campaign started for ${data.successCount} leads. ${data.failCount} skipped.`
        : `${data.successCount} Personalization jobs queued! They will be sent to WhatsApp as they finish.`,
      error: "Campaign failed to start.",
    });

    try {
      await promise;
    } finally {
      setIsLaunching(false);
      setTimeout(() => window.location.href = "/", 4000);
    }
  };



  const avatarsQuery = useQuery({
    queryKey: ["avatars"],
    queryFn: fetchAvatars,
    enabled: true,
  });

  const voicesQuery = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    enabled: true,
  });

  const handlePreviewVoice = async (voice: VoiceOption) => {
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoiceId("");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setPlayingVoiceId(voice.id);

    try {
      let audioSrc = "";
      if (voice.previewUrl) {
        audioSrc = buildApiUrl(`/proxy-audio?url=${encodeURIComponent(voice.previewUrl)}`);
      } else {
        const form = new FormData();
        form.set("language", selectedLanguage);
        form.set("gender", voice.gender || "female");
        form.set("text", selectedLanguage?.toLowerCase().includes("hi")
          ? "नमस्ते, यह मेरी आवाज़ का एक नमूना है।"
          : "Hello, this is a sample of my voice."
        );
        form.set("voice_id", voice.id);

        const res = await fetch(buildApiUrl("/preview/voice"), {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: form,
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        audioSrc = URL.createObjectURL(blob);
      }

      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      audio.onended = () => setPlayingVoiceId("");
      audio.onerror = () => setPlayingVoiceId("");
      await audio.play();
    } catch (err) {
      setPlayingVoiceId("");
      toast.error("Voice preview unavailable");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Basic CSV header parsing
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim());
        const firstLine = lines[0];
        const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
        setCsvHeaders(headers);

        const dataRows = lines.slice(1).map(line => {
          const vals = line.split(',');
          const obj: any = {};
          headers.forEach((h, i) => obj[h] = vals[i]?.trim().replace(/"/g, ''));
          return obj;
        });
        setCsvData(dataRows);


        // Auto-mapping
        const newMapping: Record<string, string> = {};
        const systemVars = ["name", "phone", "loan_amount", "lan", "client_name"];
        systemVars.forEach(sysVar => {
          const match = headers.find(h => h.toLowerCase().includes(sysVar.toLowerCase()));
          if (match) newMapping[sysVar] = match;
        });
        setMapping(newMapping);
      };
      reader.readAsText(selectedFile);

      toast.success("CSV uploaded successfully!");
      setCurrentStep("mapping");
    }
  };

  const renderConfig = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className={cn("cursor-pointer border-2 transition-all hover:shadow-md", engine === "avatar" ? "border-primary bg-primary/5" : "border-border")}
          onClick={() => setEngine("avatar")}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle>AI Presenter</CardTitle>
            <CardDescription>Use an AI-powered talking avatar to deliver your personalized message.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={cn("cursor-pointer border-2 transition-all hover:shadow-md", engine === "remotion" ? "border-primary bg-primary/5" : "border-border")}
          onClick={() => setEngine("remotion")}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
              <Play className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Dynamic Creative</CardTitle>
            <CardDescription>Scale your reach with cinematic, data-driven video backgrounds.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-4">
        <Label className="text-lg font-semibold">Campaign Type</Label>
        <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn("flex items-center space-x-3 p-4 rounded-xl border-2 transition-all", mode === "personalized" ? "border-primary bg-primary/5" : "border-border")}>
            <RadioGroupItem value="personalized" id="personalized" />
            <Label htmlFor="personalized" className="flex-1 cursor-pointer">
              <div className="font-bold">Personalized Video</div>
              <div className="text-xs text-muted-foreground">Each recipient gets a unique video with their specific data.</div>
            </Label>
          </div>
          <div className={cn("flex items-center space-x-3 p-4 rounded-xl border-2 transition-all", mode === "universal" ? "border-primary bg-primary/5" : "border-border")}>
            <RadioGroupItem value="universal" id="universal" />
            <Label htmlFor="universal" className="flex-1 cursor-pointer">
              <div className="font-bold">Universal Video</div>
              <div className="text-xs text-muted-foreground">The same video is sent to everyone listed in the CSV.</div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => setCurrentStep("assets")}>
          Continue to Assets <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const [genderFilter, setGenderFilter] = useState<"male" | "female">("male");

  const renderAssets = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4 bg-secondary/20 rounded-3xl border border-secondary shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Persona Gender</Label>
          <div className="flex items-center gap-2 p-1.5 bg-background rounded-2xl border">
            {["male", "female"].map(g => (
              <Button
                key={g}
                variant={genderFilter === g ? "default" : "ghost"}
                size="sm"
                onClick={() => setGenderFilter(g as any)}
                className="rounded-xl text-xs font-bold capitalize h-8 px-6"
              >
                {g}
              </Button>
            ))}
          </div>
        </div>

        <div className="w-[200px] flex flex-col gap-1.5">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Campaign Language</Label>
          <select
            className="w-full bg-background border rounded-2xl p-1.5 text-xs font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm h-11"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            <option value="en-US">English</option>
            <option value="hi-IN">Hindi</option>
            <option value="mr-IN">Marathi</option>
            <option value="ta-IN">Tamil</option>
            <option value="te-IN">Telugu</option>
            <option value="kn-IN">Kannada</option>
            {engine === "remotion" && <option value="bn-IN">Bengali</option>}
            <option value="gu-IN">Gujarati</option>
            {engine === "remotion" && <option value="ml-IN">Malayalam</option>}
            {/* Punjabi removed from both */}
          </select>
        </div>
      </div>

      {engine === "avatar" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold">Select Avatar</Label>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Indian Presenters</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(() => {
                const uniqueAvatarNames = new Set<string>();
                return (avatarsQuery.data || [])
                  .filter((avatar: any) => {
                    const targetGender = genderFilter.toLowerCase();
                    if (!avatar.gender || avatar.gender.toLowerCase() !== targetGender) return false;

                    const name = (avatar.name || "").toLowerCase().trim();
                    if (uniqueAvatarNames.has(name) || name === "riya" || name === "meera" || name === "aditya k" || name === "karan" || name === "priya" || name === "rohan" || name === "kabir") return false;

                    uniqueAvatarNames.add(name);
                    return true;
                  })
                  .sort((a, b) => {
                    const getRank = (avatar: any) => {
                      const name = (avatar.name || "").toLowerCase();
                      const isMale = avatar.gender && avatar.gender.toLowerCase() === "male";
                      if (isMale) {
                        if (name.includes("aditya")) return 1;
                        if (name.includes("arjun")) return 2;
                        if (name.includes("mahesh")) return 3;
                        if (name.includes("rahul")) return 4;
                        return 99;
                      } else {
                        if (name.includes("kavya")) return 1;
                        if (name.includes("adv. aditi")) return 2;
                        if (name.includes("shruti")) return 3;
                        if (name.includes("sneha")) return 4;
                        return 99;
                      }
                    };
                    return getRank(a) - getRank(b);
                  })
                  .slice(0, 6);
              })().map((av: any) => (
                <div
                  key={av.id}
                  onClick={() => setSelectedAvatar(av.id)}
                  className={cn(
                    "relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105",
                    selectedAvatar === av.id ? "border-primary" : "border-transparent"
                  )}
                >
                  <img src={av.previewImageUrl || (av as any).preview_image_url || ""} alt={av.name} className="w-full h-full object-cover" />
                  {selectedAvatar === av.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-white drop-shadow-md" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-1 bg-black/60 text-[10px] text-white truncate text-center font-bold">
                    {av.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-bold">Select Voice</Label>
              {voicesQuery.isLoading && <LoaderCircle className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                const uniqueVoiceNames = new Set<string>();
                return (voicesQuery.data || [])
                  .filter((voice: any) => {
                    const isLangCompatible = isVoiceCompatibleWithLanguage(voice, selectedLanguage);
                    if (!isLangCompatible) return false;

                    const vName = voice.name.toLowerCase().trim();
                    // Aggressively deduplicate 'peppy priya' variants as in main flow
                    if (vName.includes("peppy priya")) {
                      if (uniqueVoiceNames.has("peppy priya")) return false;
                      uniqueVoiceNames.add("peppy priya");
                    } else {
                      if (uniqueVoiceNames.has(vName)) return false;
                      uniqueVoiceNames.add(vName);
                    }

                    const voiceGen = (voice.gender || "").toLowerCase();
                    if (voiceGen !== genderFilter) return false;

                    // Indian specific whitelists for Hindi ONLY
                    if (selectedLanguage.toLowerCase().includes("hi")) {
                      if (voiceGen === "male") {
                        const allowedMales = ["aaditya k", "caremelo la rosa", "manu", "niraj", "raju", "ranbir m", "ranga", "rick", "viraj"];
                        if (!allowedMales.some(allowed => vName.includes(allowed))) return false;
                      } else {
                        const allowedFemales = ["adv. aditi mehra", "devi", "kanika", "monika sogam", "muskaan", "saira"];
                        if (!allowedFemales.some(allowed => vName.includes(allowed.toLowerCase()))) return false;
                      }
                    }
                    return true;
                  })
                  .sort((left, right) => compareVoicesForLanguage(left, right, selectedLanguage))
                  .slice(0, 20);
              })().map((v: any) => (
                <div
                  key={v.id}
                  className={cn(
                    "p-3 rounded-xl border-2 text-sm transition-all flex items-center justify-between group",
                    selectedVoice === v.id ? "border-primary bg-primary/5" : "hover:border-secondary-foreground/20 bg-background hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setSelectedVoice(v.id)}>
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center transition-transform group-hover:scale-110">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{v.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{selectedLanguage.split('-')[0]} Voice</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-8 h-8 rounded-full"
                      onClick={() => handlePreviewVoice(v)}
                    >
                      {playingVoiceId === v.id ? <Pause className="w-3 h-3 text-primary" /> : <Play className="w-3 h-3 text-muted-foreground" />}
                    </Button>
                    {selectedVoice === v.id && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-6 pt-6 border-t mt-8 animate-in fade-in duration-700">
        <Label className="text-base font-bold flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Campaign Strategy Template
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CAMPAIGN_STRATEGIES.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={cn(
                "cursor-pointer border-2 transition-all hover:shadow-lg h-full group relative overflow-hidden",
                selectedMsgTemplate === tmpl.id ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-primary/30"
              )}
              onClick={() => handleTemplateSelect(tmpl.id)}
            >
              <CardContent className="pt-6 text-center space-y-2">
                <div className={cn("w-12 h-12 rounded-full mx-auto flex items-center justify-center transition-transform group-hover:scale-110",
                  tmpl.color === 'blue' ? "bg-blue-100 text-blue-600 shadow-sm shadow-blue-200" :
                    tmpl.color === 'green' ? "bg-green-100 text-green-600 shadow-sm shadow-green-200" :
                      tmpl.color === 'red' ? "bg-red-100 text-red-600 shadow-sm shadow-red-200" :
                        "bg-purple-100 text-purple-600 shadow-sm shadow-purple-200"
                )}>
                  <Settings2 className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm tracking-tight">{tmpl.name}</h4>
                <p className="text-[10px] text-muted-foreground leading-tight px-1 line-clamp-2">{tmpl.desc}</p>

                <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-secondary/50 rounded-full border border-border/50">
                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground">{genderFilter} script</span>
                </div>

                {selectedMsgTemplate === tmpl.id && (
                  <div className="absolute top-2 right-2 scale-in duration-200">
                    <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-secondary/5 p-5 rounded-2xl border-2 border-dashed border-primary/10 relative">
          <div className="absolute -top-2 left-6 px-2 bg-background border rounded text-[8px] uppercase font-black tracking-widest text-primary">
            AI Video Script Preview
          </div>
          <div className="text-xs text-foreground/80 bg-background/50 p-4 rounded-xl border-2 border-border/50 leading-relaxed italic whitespace-pre-wrap font-serif">
            {mode === "personalized"
              ? (CAMPAIGN_STRATEGIES.find(t => t.id === selectedMsgTemplate)?.scriptPersonalized || "Select strategy")
              : (CAMPAIGN_STRATEGIES.find(t => t.id === selectedMsgTemplate)?.scriptUniversal || "Select strategy")
            }
          </div>
          <div className="mt-3 flex items-center gap-2 px-1">
            <Info className="w-3 h-3 text-primary animate-bounce-slow" />
            <p className="text-[9px] text-muted-foreground">The AI will use this transcript to generate the speech for your **{selectedLanguage}** video.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep("config")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button size="lg" disabled={engine === "avatar" && (!selectedAvatar || !selectedVoice)} onClick={() => setCurrentStep("upload")}>
          Continue to Upload <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderUpload = () => {
    const refVideo = isFromVideo ? referenceVideoQuery.data : null;
    const isVideoLoading = isFromVideo && referenceVideoQuery.isLoading;


    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className={cn("grid gap-6", isFromVideo ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
          {isVideoLoading && (
            <div className="lg:col-span-7">
              <Card className="h-full border-2 border-primary/20 shadow-xl overflow-hidden bg-card/50 flex flex-col">
                <div className="aspect-video bg-muted animate-pulse flex items-center justify-center">
                  <LoaderCircle className="w-8 h-8 text-primary animate-spin" />
                </div>
                <div className="p-6 space-y-4">
                  <div className="h-6 w-2/3 bg-muted animate-pulse rounded" />
                  <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                </div>
              </Card>
            </div>
          )}

          {refVideo && (

            <div className="lg:col-span-7">
              <Card className="h-full overflow-hidden border-2 border-primary/20 shadow-xl flex flex-col group bg-card/50 backdrop-blur-sm">
                <div className="aspect-video bg-black relative overflow-hidden">
                  {refVideo.video_url && <video src={refVideo.video_url} className="w-full h-full object-cover" controls />}
                  {!refVideo.video_url && <div className="w-full h-full flex items-center justify-center text-white/50 text-xs text-center p-4">Reference video ready - No preview available</div>}
                  <div className="absolute top-4 left-4 z-10">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Reference Video
                    </div>
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-4">
                    <h4 className="font-bold text-xl leading-tight mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">{refVideo.title || "Bulk Send Template"}</h4>
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      <Video className="w-3.5 h-3.5" /> {engine === "avatar" ? "AI Avatar" : "Text to Video"}
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-border/50 flex flex-wrap items-center gap-2">
                    <div className="px-3 py-1 bg-secondary text-secondary-foreground text-[10px] uppercase font-black tracking-widest rounded-lg border border-border">
                      Language: {selectedLanguage}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className={cn("flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-[2rem] bg-secondary/5 group hover:border-primary/40 transition-all duration-500 hover:bg-secondary/10", isFromVideo ? "lg:col-span-5" : "w-full")}>
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-inner">
              <FileSpreadsheet className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="mb-2 text-2xl font-bold">Upload audience data</CardTitle>
            <CardDescription className="mb-10 max-w-sm text-base leading-relaxed">
              Prepare a CSV with customer info like name, phone, and specific placeholders for your video.
            </CardDescription>
            <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
              <Label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 h-14 w-full flex items-center justify-center rounded-2xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 group-hover:translate-y-[-2px] whitespace-nowrap">
                {file ? "Change CSV File" : "Select CSV File"}
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </Label>
              <Button variant="outline" className="h-14 w-full border-2 rounded-2xl font-bold" asChild>
                <a href={SAMPLE_BULK_CSV_URL} download="sample.csv">
                  Download Sample
                </a>
              </Button>
            </div>
            {file && (
              <div className="mt-4 flex items-center gap-2 text-green-600 font-bold bg-green-500/5 px-4 py-2 rounded-full border border-green-500/10">
                <CheckCircle2 className="w-4 h-4" /> {file.name}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center bg-card/40 backdrop-blur-sm p-6 rounded-3xl border border-border mt-8">
          <Button variant="ghost" onClick={() => setCurrentStep(isFromVideo ? "assets" : "assets")} className="rounded-2xl font-bold h-12 px-6" disabled={isFromVideo}>
            <ArrowLeft className="mr-2 w-4 h-4" /> {isFromVideo ? "Reference Video Context" : "Back to Assets"}
          </Button>
          <Button
            size="lg"
            disabled={!file}
            onClick={() => setCurrentStep("mapping")}
            className="rounded-2xl font-black h-12 px-10 shadow-lg shadow-primary/20 transition-all active:scale-95 bg-primary hover:bg-primary/90"
          >
            Continue to Mapping <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMapping = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold">Map CSV Columns</Label>
            <span className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Auto-detected
            </span>
          </div>
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border relative overflow-hidden group">
            {["name", "phone", "loan_amount", "lan", "client_name"].map(sysVar => (
              <div key={sysVar} className="flex items-center gap-3">
                <div className="flex-1 text-sm font-mono bg-primary/5 border border-primary/20 px-3 py-2 rounded-lg text-primary truncate max-w-[140px]">
                  {"{{"} {sysVar} {"}}"}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <select
                    className="w-full bg-background border-2 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    value={mapping[sysVar] || ""}
                    onChange={(e) => setMapping(prev => ({ ...prev, [sysVar]: e.target.value }))}
                  >
                    <option value="">-- Choose Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold text-left block w-full">WhatsApp Campaign Strategy</Label>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-widest leading-none shrink-0">
              Auto-filled
            </span>
          </div>

          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground text-left block">Select Template</Label>
              <select
                className="w-full bg-background border-2 rounded-xl h-11 px-4 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-bold"
                value={selectedMsgTemplate}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                {CAMPAIGN_STRATEGIES.map((tmpl: any) => (
                  <option key={tmpl.id} value={tmpl.id}>{TEMPLATE_DISPLAY_NAME_BY_ID[tmpl.id] ?? tmpl.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-center">
              <PhoneMockup message={whatsappTemplate} />
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] text-muted-foreground w-full text-left uppercase font-black tracking-tighter">Insert Variable Tag:</span>
              {["name", "video_url", "loan_amount", "lan", "client_name"].map(v => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="text-[10px] font-bold bg-secondary hover:bg-primary hover:text-white px-2 py-1 rounded-lg border transition-all uppercase"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700/80 text-left">Message will be sent to the phone numbers in your mapped <strong>phone</strong> column.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep("upload")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button size="lg" onClick={() => setCurrentStep(isFromVideo ? "launch" : "preview")}>
          Continue to Preview <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-8 animate-in mt-2 fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-lg font-bold">Video Preview</Label>
            <span className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 font-black animate-pulse uppercase">Live Simulation</span>
          </div>
          <Card className="w-full bg-black border-none overflow-hidden relative shadow-2xl">
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-8 text-white space-y-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Account: {mapping['lan'] || 'LANXXXX'}</h2>
                <p className="text-xl font-medium text-white/90">Amount Due: <span className="text-primary font-bold">₹{mapping['loan_amount'] || '0,000'}</span></p>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-widest text-white/40">CredResolve | {selectedMsgTemplate}</span>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>
              <Play className="w-12 h-12 text-white/20 animate-pulse" />
              <div className="absolute top-8 left-8">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Label className="text-lg font-bold">WhatsApp Preview</Label>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 relative min-h-[300px] flex flex-col shadow-sm">
            <div className="flex-1 font-sans text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap">
              {whatsappTemplate.replace('{{name}}', '[Customer Name]').replace('{{lan}}', mapping['lan'] || '[LAN]').replace('{{loan_amount}}', mapping['loan_amount'] || '[Amount]').replace('{{video_url}}', 'https://vishwarupe.ai/v/example')}
            </div>
            <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 text-[10px] text-emerald-600/70 font-bold uppercase tracking-widest">
                <Smartphone className="w-3 h-3" /> Sending to {mapping['phone'] || 'Mapped Column'}
              </div>
            </div>
            <div className="absolute -top-3 -left-3">
              <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl text-[11px] text-muted-foreground italic flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            This preview uses mapping data to simulate the final look. Final videos will vary based on exact CSV values.
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t pt-8">
        <Button variant="ghost" onClick={() => setCurrentStep("mapping")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to Mapping
        </Button>
        <Button size="lg" className="px-12" onClick={() => setCurrentStep("launch")}>
          Looks Good, Review Launch <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderLaunch = () => {
    const shouldUseCampaignSend = mode === "universal" || isFromVideo;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className="rounded-[2rem] border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-8 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-primary">
                <FileCheck className="w-3.5 h-3.5" />
                Final Lead Review
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight text-foreground">CSV review before launch</h2>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Verify the first {CSV_PREVIEW_ROW_LIMIT} leads and the video link preview for each row before starting the campaign.
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-primary">
              Pending Launch
            </div>
          </div>
        </section>

        <section className="rounded-2xl border-2 overflow-hidden shadow-xl bg-card">
          <div className="p-6 bg-primary/5 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold">Campaign Ready</h3>
                <p className="text-xs text-muted-foreground">Review the summary below before firing.</p>
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest">
              Pending
            </div>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Generation Engine</Label>
              <div className="mt-2 font-bold flex items-center gap-2">
                {engine === "avatar" ? (
                  <><Users className="w-4 h-4 text-purple-500" /> AI Presenter</>
                ) : (
                  <><Video className="w-4 h-4 text-blue-500" /> Dynamic Creative</>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Total Recipients</Label>
              <div className="mt-2 font-bold flex items-center gap-2 text-primary">
                <FileSpreadsheet className="w-4 h-4 text-green-500" /> {csvData.length} Rows Detected
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Campaign Mode</Label>
              <div className="mt-2 font-bold flex items-center gap-2 capitalize">
                <Play className="w-4 h-4 text-primary" /> {mode}
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Primary Language</Label>
              <div className="mt-2 font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" /> {selectedLanguage}
              </div>
            </div>
          </div>
        </section>

        {csvData.length > 0 ? (
          <Card className="overflow-hidden border-2 shadow-xl bg-card/80 backdrop-blur-sm">
            <CardHeader className="border-b bg-primary/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black tracking-tight">Preview your first leads</CardTitle>
                  <CardDescription>
                    Showing the first {Math.min(csvData.length, CSV_PREVIEW_ROW_LIMIT)} rows with prioritized lead columns
                    and a video link preview for each lead.
                  </CardDescription>
                </div>
                <div className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-bold text-muted-foreground">
                  {csvData.length > CSV_PREVIEW_ROW_LIMIT
                    ? `${csvData.length - CSV_PREVIEW_ROW_LIMIT} more leads follow the same mapping logic`
                    : "All uploaded leads are shown below"}
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table className="min-w-[1200px]">
                <TableHeader className="bg-secondary/10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-14 text-[10px] font-black uppercase tracking-widest text-muted-foreground">#</TableHead>
                    {orderPreviewHeaders(csvHeaders, mapping).map((header) => (
                      <TableHead
                        key={header}
                        className="min-w-[160px] text-[10px] font-black uppercase tracking-widest text-muted-foreground"
                      >
                        {header}
                      </TableHead>
                    ))}
                    <TableHead className="sticky right-0 z-20 min-w-[320px] border-l bg-secondary/95 text-[10px] font-black uppercase tracking-widest text-primary shadow-[-16px_0_20px_-18px_rgba(15,23,42,0.35)] backdrop-blur">
                      Video Link Preview
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, CSV_PREVIEW_ROW_LIMIT).map((row, index) => {
                    const previewLink = buildVideoLinkPreview(
                      row,
                      index,
                      csvHeaders,
                      mapping,
                      mode,
                      referenceShareUrl,
                    );
                    const previewLinkLabel = getVideoLinkPreviewLabel(
                      row,
                      csvHeaders,
                      mapping,
                      mode,
                      referenceShareUrl,
                    );

                    return (
                      <TableRow key={`launch-preview-${index}`} className="align-top">
                        <TableCell className="font-black text-primary">{index + 1}</TableCell>
                        {orderPreviewHeaders(csvHeaders, mapping).map((header) => {
                          const cellValue =
                            typeof row[header] === "string"
                              ? row[header].trim()
                              : row[header] == null
                                ? ""
                                : String(row[header]);

                          return (
                            <TableCell key={`${header}-${index}`} className="min-w-[160px] max-w-[180px]">
                              <div className="truncate text-sm text-foreground" title={cellValue || "-"}>
                                {cellValue || <span className="text-muted-foreground">-</span>}
                              </div>
                            </TableCell>
                          );
                        })}
                        <TableCell className="sticky right-0 z-10 min-w-[320px] border-l bg-background/95 shadow-[-16px_0_20px_-18px_rgba(15,23,42,0.22)] backdrop-blur">
                          <div className="space-y-1">
                            <div className="break-all font-mono text-xs text-foreground">{previewLink}</div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                              {previewLinkLabel}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 shadow-sm">
            <CardContent className="p-8 text-center text-muted-foreground">
              No CSV data available yet. Upload and map a CSV before launching the campaign.
            </CardContent>
          </Card>
        )}

        <section className="rounded-3xl border border-primary/15 bg-primary/[0.04] p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Video link guidance</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {shouldUseCampaignSend && referenceShareUrl
                  ? "All recipients will receive the same video link."
                  : shouldUseCampaignSend
                    ? "A shared preview link is shown here. The same video link will be used for every recipient."
                    : "Preview links are for review only. Final video URLs are created after generation."}
              </p>
            </div>
          </div>
        </section>

        <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700/80">
            <strong>Important:</strong> {shouldUseCampaignSend
              ? "Launching this campaign will push the selected video to the mapped WhatsApp numbers immediately."
              : "Launching this campaign will immediately queue all jobs to AWS SQS. Avatar videos can take 2-10 mins each to process depending on length. Text renders are usually faster (~45s each)."}
          </p>
        </div>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={() => setCurrentStep("mapping")}>
            <ArrowLeft className="mr-2 w-4 h-4" /> Back to Mapping
          </Button>
          <Button size="lg" disabled={isLaunching || csvData.length === 0} className="bg-green-600 hover:bg-green-700 text-white px-12 font-black shadow-lg shadow-green-200" onClick={handleLaunchCampaign}>
            {isLaunching ? (
              <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <>Launch Full Campaign <Sparkles className="ml-2 w-4 h-4" /></>
            )}
          </Button>

        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <HeaderBar primaryLabel="Bulk Send" />

      <main className="flex-1 w-full max-w-5xl mx-auto p-6 flex flex-col pt-8">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-left">
              Bulk Video <span className="text-primary">Campaigns</span>
            </h1>
            <p className="mt-4 text-xl text-muted-foreground max-w-2xl text-left font-medium">
              Scale your personalized communication by reaching thousands via CSV.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-secondary/20 p-2 rounded-2xl border">
            {steps.map((s, i) => (
              <div
                key={s}
                onClick={() => setCurrentStep(s)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all cursor-pointer hover:scale-105 active:scale-95",
                  currentStep === s ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-background text-muted-foreground hover:bg-secondary/50"
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {currentStep === "config" && renderConfig()}
          {currentStep === "assets" && renderAssets()}
          {currentStep === "upload" && renderUpload()}
          {currentStep === "mapping" && renderMapping()}
          {currentStep === "preview" && renderPreview()}
          {currentStep === "launch" && renderLaunch()}
        </div>

        {/* Features section removed as requested */}
      </main>
    </div>
  );
}
