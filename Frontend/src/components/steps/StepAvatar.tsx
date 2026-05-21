import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Crown, LoaderCircle, Pause, Play } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl, compareVoicesForLanguage, isVoiceCompatibleWithLanguage, type AvatarOption, type VoiceOption } from "@/lib/api";

interface StepAvatarProps {
  avatars: AvatarOption[];
  customAvatars: any[];
  voices: VoiceOption[];
  language: string;
  isLoading: boolean;
  voicesLoading: boolean;
  errorMessage: string | null;
  voiceErrorMessage: string | null;
  selectedId: string;
  selectedVoiceId: string;
  selectedVoiceGender: "male" | "female" | null;
  selectedAvatarGender: "male" | "female" | null;
  filter: string;
  onSelect: (id: string, name: string, gender: "male" | "female" | null) => void;
  onVoiceSelect: (id: string) => void;
  onFilterChange: (f: string) => void;
}

export function StepAvatar({
  avatars,
  customAvatars,
  voices,
  language,
  isLoading,
  voicesLoading,
  errorMessage,
  voiceErrorMessage,
  selectedId,
  selectedVoiceId,
  selectedVoiceGender,
  selectedAvatarGender,
  filter,
  onSelect,
  onVoiceSelect,
  onFilterChange,
}: StepAvatarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const INDIAN_SEARCH_NAMES = [
    "Shruti", "Aditi", "Priya", "Aakash", "Mohan", "Abhishek", "Sneha", "Ananya",
    "Vihaan", "Arjun", "Karan", "Ishani", "Sanjay", "Ankit", "Rohan", "Maya",
    "Kavya", "Diya", "Ishita", "Ansh", "Kabir"
  ];

  const isIndianAvatar = (avatar: AvatarOption) => {
    return INDIAN_SEARCH_NAMES.some(name => avatar.name.includes(name));
  };


  const isCustomOrRequested = (avatar: AvatarOption) => {
    return customAvatars.some(ca => ca.avatar_id === avatar.id) ||
           avatar.category === "My Avatars" ||
           avatar.category === "Lead Avatar" ||
           avatar.category === "Talking Photo";
  };
  const uniqueAvatarNames = new Set<string>();

  const filteredAvatars = avatars.filter((avatar) => {
    const targetGender = filter.toLowerCase();

    // Dynamically check for gender overrides from the custom avatars in DB
    const dbAvatar = customAvatars.find(ca => ca.avatar_id === avatar.id);
    if (dbAvatar && dbAvatar.gender) {
      return dbAvatar.gender.toLowerCase() === targetGender;
    }

    // Strict gender match based on selected filter
    if (!avatar.gender || avatar.gender.toLowerCase() !== targetGender) return false;

    const n = (avatar.name || "").toLowerCase().trim();
    if (uniqueAvatarNames.has(n) || n === "riya" || n === "meera" || n === "aditya k" || n === "karan" || n === "priya" || n === "rohan" || n === "kabir") return false;
    uniqueAvatarNames.add(n);

    return true;
  }).sort((a, b) => {
    const getRank = (avatar: any) => {
      const name = (avatar.name || "").toLowerCase();
      const isMale = avatar.gender && avatar.gender.toLowerCase() === "male";
      
      // Fetch custom rank or priority from DB if we add that field later.
      // For now, still use smart name-based priority for the handful we care about.
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

    const rankA = getRank(a);
    const rankB = getRank(b);

    if (rankA !== rankB) return rankA - rankB;

    const aCustom = isCustomOrRequested(a);
    const bCustom = isCustomOrRequested(b);
    if (aCustom && !bCustom) return -1;
    if (!aCustom && bCustom) return 1;

    return 0;
  });

  const INDIAN_LANGUAGES = ["Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati", "Malayalam", "Punjabi"];

  const effectiveGenderFilter = filter.toLowerCase();

  const uniqueVoiceNames = new Set<string>();

  const filteredVoices = voices
    .filter(
      (voice) => {
        const isLangCompatible = isVoiceCompatibleWithLanguage(voice, language);
        if (!isLangCompatible) {
            return false;
        }

        const vName = voice.name.toLowerCase().trim();
        // Aggressively deduplicate 'peppy priya' variants
        if (vName.includes("peppy priya")) {
          if (uniqueVoiceNames.has("peppy priya")) return false;
          uniqueVoiceNames.add("peppy priya");
        } else {
          if (uniqueVoiceNames.has(vName)) return false;
          uniqueVoiceNames.add(vName);
        }

        const voiceGen = (voice.gender || "").toLowerCase();

        // Specific allowlists for Hindi voices
        if (language === "Hindi") {
          if (voiceGen === "male") {
            const allowedMales = ["aaditya k", "caremelo la rosa", "manu", "niraj", "raju", "ranbir m", "ranga", "rick", "viraj"];
            if (!allowedMales.some(allowed => vName.includes(allowed))) {
              return false;
            }
          } else if (voiceGen === "female") {
            // "anika" explicitly removed as requested
            const allowedFemales = ["adv. aditi mehra", "devi", "kanika", "monika sogam", "muskaan", "saira"];
            if (!allowedFemales.some(allowed => vName.includes(allowed.toLowerCase()))) {
              return false;
            }
          }
        }

        uniqueVoiceNames.add(vName);

        if (effectiveGenderFilter === "female") return voiceGen === "female";
        if (effectiveGenderFilter === "male") return voiceGen === "male";
        
        return (!selectedAvatarGender || voiceGen === selectedAvatarGender.toLowerCase());
      }
    )
    .sort((left, right) => compareVoicesForLanguage(left, right, language));

  const getVoiceLanguageHint = (voice: VoiceOption): string | null => {
    if (voice.language === language) {
      return null;
    }

    if (voice.languages.includes(language)) {
      return `Supports ${language}`;
    }

    return voice.language;
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    setPlayingVoiceId("");
  };

  const handlePreviewVoice = async (voice: VoiceOption) => {
    if (playingVoiceId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewError(null);
    setPlayingVoiceId(voice.id); // immediate visual feedback

    try {
      let audioSrc: string;

      if (voice.previewUrl) {
        // Fast path: use the static HeyGen preview via proxy
        audioSrc = buildApiUrl(`/proxy-audio?url=${encodeURIComponent(voice.previewUrl)}`);
      } else {
        // Fallback: generate TTS on-the-fly using the voice id
        const form = new FormData();
        form.set("language", language || "English");
        form.set("gender", voice.gender || "female");
        form.set("text", language?.toLowerCase() === "hindi" || language?.toLowerCase() === "hi-in"
          ? "नमस्ते, यह मेरी आवाज़ का एक नमूना है। अगर आपको यह पसंद है तो मुझे चुनें।"
          : "Hello, this is a sample of my voice. Select me if you like how I sound."
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
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setPlayingVoiceId("");
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setPlayingVoiceId("");
        setPreviewError(`Voice preview is unavailable for ${voice.name}.`);
      };
      await audio.play();
    } catch {
      if (audioRef.current) audioRef.current = null;
      setPlayingVoiceId("");
      setPreviewError(`Voice preview is unavailable for ${voice.name}.`);
    }
  };


  useEffect(() => stopPreview, []);
  useEffect(() => {
    if (playingVoiceId && !filteredVoices.some((voice) => voice.id === playingVoiceId)) {
      stopPreview();
    }
  }, [filteredVoices, playingVoiceId]);

  return (
    <div>
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-foreground">Voice and avatar pairing</p>
          {voicesLoading ? (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading voices...
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{filteredVoices.length} compatible voices</p>
          )}
        </div>

        {voiceErrorMessage ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{voiceErrorMessage}</span>
          </div>
        ) : null}
        {previewError ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{previewError}</span>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">Voice</label>
            <Select value={selectedVoiceId || "__none"} onValueChange={(value) => onVoiceSelect(value === "__none" ? "" : value)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder={`Select a ${language} voice`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No voice selected</SelectItem>
                {filteredVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.name} · {voice.gender === "female" ? "Female" : "Male"}
                    {getVoiceLanguageHint(voice) ? ` · ${getVoiceLanguageHint(voice)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {filter} {filter.endsWith('s') ? '' : 'is'} visible
          </div>
        </div>

        {filteredVoices.length > 0 ? (
          <div className="mt-4 rounded-xl border border-border bg-secondary/35 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Listen Before Selecting</p>
                <p className="text-xs text-muted-foreground">Preview available voice samples, then lock in the one you want.</p>
              </div>
              {playingVoiceId ? (
                <button
                  type="button"
                  onClick={stopPreview}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Stop Preview
                </button>
              ) : null}
            </div>

            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
              {filteredVoices.map((voice) => {
                const voiceLanguageHint = getVoiceLanguageHint(voice);
                const isPlaying = playingVoiceId === voice.id;
                const isSelected = selectedVoiceId === voice.id;

                return (
                  <div
                    key={`${voice.id}-preview`}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${isSelected ? "border-primary bg-primary/5" : "border-border bg-background/80"
                      }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{voice.name.split('-')[0].trim()}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voice.gender === "female" ? "Female" : "Male"}
                        {voiceLanguageHint ? ` · ${voiceLanguageHint}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={false}
                        onClick={() => void handlePreviewVoice(voice)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-secondary text-foreground hover:bg-secondary/80"
                      >
                        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onVoiceSelect(voice.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground hover:bg-secondary"
                          }`}
                      >
                        {isSelected ? "Selected" : "Select"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!voicesLoading && filteredVoices.length === 0 ? (
          <div className="mt-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            No compatible Indian-market voices were returned for {language} yet.
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Avatar library</p>
          </div>
          {isLoading ? (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading Indian avatars...
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{filteredAvatars.length} avatars available</p>
          )}
        </div>
        {errorMessage ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
      </div>


      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {filteredAvatars.length === 0 && !isLoading ? (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            No avatars matched this filter.
          </div>
        ) : null}

        {filteredAvatars.map((avatar) => {
          const isSelected = selectedId === avatar.id;
          return (
            <button
              key={avatar.id}
              onClick={() => onSelect(avatar.id, avatar.name, avatar.gender)}
              className={`relative group p-6 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${isSelected
                ? "glow-purple-border border-primary bg-primary/5"
                : "border-border bg-card hover:bg-surface-hover"
                }`}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-secondary mx-auto mb-3 overflow-hidden flex items-center justify-center">
                {avatar.previewImageUrl ? (
                  <img src={avatar.previewImageUrl} alt={avatar.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold text-foreground">
                    {avatar.name
                      .split(" ")
                      .map((part) => part.charAt(0))
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">{avatar.name}</p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <p className="text-xs text-muted-foreground">{avatar.category}</p>
                {avatar.gender ? (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {avatar.gender}
                  </span>
                ) : null}
              </div>
              {avatar.isPremium ? (
                <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent">
                  <Crown className="h-3 w-3" /> Premium
                </span>
              ) : null}
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
}
