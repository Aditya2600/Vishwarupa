import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Crown, LoaderCircle, Mic2, Pause, Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compareVoicesForLanguage, isVoiceCompatibleWithLanguage, type AvatarOption, type VoiceOption } from "@/lib/api";

interface StepAvatarProps {
  avatars: AvatarOption[];
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
  const filters = ["All", ...new Set(avatars.map((avatar) => avatar.category).filter(Boolean))];
  const filteredByCategory = filter === "All" ? avatars : avatars.filter((avatar) => avatar.category === filter);
  const filteredAvatars = selectedVoiceGender
    ? filteredByCategory.filter((avatar) => avatar.gender === selectedVoiceGender)
    : filteredByCategory;
  const filteredVoices = voices
    .filter(
      (voice) =>
        isVoiceCompatibleWithLanguage(voice, language) &&
        (!selectedAvatarGender || voice.gender === selectedAvatarGender),
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

  const handlePreviewVoice = (voice: VoiceOption) => {
    if (!voice.previewUrl) {
      return;
    }

    if (playingVoiceId === voice.id) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewError(null);

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingVoiceId("");
    };
    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingVoiceId("");
      setPreviewError(`Voice preview is unavailable for ${voice.name}.`);
    };

    setPlayingVoiceId(voice.id);
    void audio.play().catch(() => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPlayingVoiceId("");
      setPreviewError(`Voice preview is unavailable for ${voice.name}.`);
    });
  };

  useEffect(() => stopPreview, []);
  useEffect(() => {
    if (playingVoiceId && !filteredVoices.some((voice) => voice.id === playingVoiceId)) {
      stopPreview();
    }
  }, [filteredVoices, playingVoiceId]);

  const handleManualAvatarChange = (value: string) => {
    const matchingAvatar = avatars.find((avatar) => avatar.id === value.trim());
    onSelect(value, matchingAvatar?.name ?? "", matchingAvatar?.gender ?? null);
  };

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
            {selectedVoiceGender
              ? `${selectedVoiceGender === "female" ? "Female" : "Male"} avatars only`
              : selectedAvatarGender
              ? `${selectedAvatarGender === "female" ? "Female" : "Male"} voices only`
              : "All genders visible"}
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
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-background/80"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{voice.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {voice.gender === "female" ? "Female" : "Male"}
                        {voiceLanguageHint ? ` · ${voiceLanguageHint}` : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={!voice.previewUrl}
                        onClick={() => handlePreviewVoice(voice)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                          voice.previewUrl
                            ? "bg-secondary text-foreground hover:bg-secondary/80"
                            : "bg-secondary/60 text-muted-foreground"
                        }`}
                      >
                        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {voice.previewUrl ? (isPlaying ? "Pause" : "Play") : "No Sample"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onVoiceSelect(voice.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isSelected
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
            No compatible voices were returned for {language} yet, including multilingual fallbacks.
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
              Loading avatars...
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

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
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
              className={`relative group p-6 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] ${
                isSelected
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

      <div className="mt-6 max-w-lg space-y-2">
        <label className="block text-sm font-medium text-foreground">Manual Avatar ID</label>
        <Input
          value={selectedId}
          onChange={(event) => handleManualAvatarChange(event.target.value)}
          placeholder="Paste an avatar_id"
          className="bg-secondary border-border"
        />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Mic2 className="h-3.5 w-3.5" />
          Manual avatar IDs stay available, but they must match the selected voice gender if a listed avatar is found.
        </p>
      </div>
    </div>
  );
}
