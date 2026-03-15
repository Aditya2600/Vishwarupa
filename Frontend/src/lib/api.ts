export interface AvatarOption {
  id: string;
  name: string;
  category: string;
  gender: "male" | "female" | null;
  previewImageUrl: string | null;
  isPremium: boolean;
  raw: Record<string, unknown>;
}

export interface VoiceOption {
  id: string;
  name: string;
  language: string;
  gender: "male" | "female";
  raw: Record<string, unknown>;
}

export interface TemplateOption {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  updatedAt: string | null;
  raw: Record<string, unknown>;
}

export interface DirectVideoPayload {
  customer_name: string;
  lan: string;
  client_name: string;
  tos?: string;
  loan_amount?: string;
  contact_details?: string;
  product_type?: string;
  avatar_id?: string;
  voice_id?: string;
  language?: string;
  template_name?: string;
  script_text?: string;
  background_color?: string;
  include_captions?: boolean;
  title_prefix?: string;
  video_width?: number;
  video_height?: number;
}

export interface VideoJobResult {
  request_mode: "direct" | "template" | "remotion";
  video_id: string;
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  raw_response: Record<string, unknown>;
  saved_to: string | null;
  video_path?: string | null;
  audio_path?: string | null;
}

export interface StyledVideoResult {
  video_id: string;
  status: "styled";
  source_video_path: string;
  source_video_url: string;
  final_video_path: string;
  final_video_url: string;
  subtitle_file_path: string | null;
  logo_file_path: string | null;
  subtitle_source: "provider" | "transcript" | "disabled";
}

export interface RemotionVideoPayload extends DirectVideoPayload {
  subtitleColor: string;
  subtitlePosition: string;
  logoPosition: string;
  logoOpacity: number;
  logoFile?: File | null;
}

export interface StylizeVideoPayload {
  includeCaptions: boolean;
  subtitleColor: string;
  subtitlePosition: string;
  transcript?: string;
  logoPosition: string;
  logoOpacity: number;
  logoFile?: File | null;
}

export const API_BASE_URL = "/api";

const LANGUAGE_CODE_TO_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  bn: "Bengali",
  gu: "Gujarati",
  ml: "Malayalam",
  pa: "Punjabi",
};

function clearStoredAuth(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function normalizeGender(value: unknown): "male" | "female" | null {
  const normalized = asString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/(^|\b)(female|woman|girl|f)(\b|$)/.test(normalized)) {
    return "female";
  }

  if (/(^|\b)(male|man|boy|m)(\b|$)/.test(normalized)) {
    return "male";
  }

  return null;
}

function normalizeLanguageName(value: unknown): string | null {
  const normalized = asString(value);
  if (!normalized) {
    return null;
  }

  const cleaned = normalized.replace(/_/g, "-").trim();
  const code = cleaned.toLowerCase().slice(0, 2);
  if (LANGUAGE_CODE_TO_NAME[code]) {
    return LANGUAGE_CODE_TO_NAME[code];
  }

  const exactMatch = Object.values(LANGUAGE_CODE_TO_NAME).find(
    (language) => language.toLowerCase() === cleaned.toLowerCase(),
  );
  if (exactMatch) {
    return exactMatch;
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  const record = asRecord(payload);
  return (
    asString(record.detail) ??
    asString(record.message) ??
    asString(record.error) ??
    asString(asRecord(record.data).message)
  );
}

function normalizeNetworkError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return new Error("Could not reach the server. Check that the backend is running and try again.");
    }
    return error;
  }

  return new Error("Could not reach the server. Check that the backend is running and try again.");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...init,
      headers,
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuth();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    const isRemotionGenerate = path.startsWith("/generate/remotion");
    if (isRemotionGenerate && response.status >= 500) {
      throw new Error("Text video generation failed. Please try again in a moment.");
    }

    if (typeof payload === "string" && payload.trim().startsWith("<")) {
      if (response.status === 504) {
        throw new Error("The render is taking longer than the frontend proxy timeout. Rebuild the frontend container with the updated timeout and try again.");
      }
      throw new Error(`Request failed with status ${response.status}`);
    }
    throw new Error(extractErrorMessage(payload) ?? `Request failed with status ${response.status}`);
  }

  return payload as T;
}

function extractAvatarArray(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const candidates: unknown[] = [
    root.avatars,
    data.avatars,
    data.list,
    data.items,
    root.items,
    root.data,
  ];

  const array = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(array)) {
    return [];
  }

  return array
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

function normalizeAvatar(rawAvatar: Record<string, unknown>): AvatarOption | null {
  const id =
    asString(rawAvatar.avatar_id) ??
    asString(rawAvatar.id) ??
    asString(rawAvatar.avatarId) ??
    asString(rawAvatar.avatar_uuid);

  if (!id) {
    return null;
  }

  const name =
    asString(rawAvatar.avatar_name) ??
    asString(rawAvatar.name) ??
    asString(rawAvatar.title) ??
    id;

  const gender =
    normalizeGender(rawAvatar.gender) ??
    normalizeGender(rawAvatar.sex) ??
    normalizeGender(rawAvatar.avatar_gender) ??
    normalizeGender(rawAvatar.speaker_gender);

  let category =
    asString(rawAvatar.style) ??
    asString(rawAvatar.group) ??
    asString(rawAvatar.motion) ??
    (gender ? `${gender === "female" ? "Female" : "Male"} Avatars` : "Avatar");

  if (category.toLowerCase() === "unknown") {
    category = "My Avatars";
  }

  const previewImageUrl =
    asString(rawAvatar.preview_image_url) ??
    asString(rawAvatar.thumbnail_url) ??
    asString(rawAvatar.image_url) ??
    asString(rawAvatar.poster_url) ??
    asString(asRecord(rawAvatar.preview_image).url);

  return {
    id,
    name,
    category,
    gender,
    previewImageUrl,
    isPremium: asBoolean(rawAvatar.is_premium) || asBoolean(rawAvatar.premium),
    raw: rawAvatar,
  };
}

function extractVoiceArray(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const candidates: unknown[] = [
    root.voices,
    data.voices,
    data.list,
    data.items,
    root.items,
    root.data,
  ];

  const array = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(array)) {
    return [];
  }

  return array
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

function normalizeVoice(rawVoice: Record<string, unknown>): VoiceOption | null {
  const id =
    asString(rawVoice.voice_id) ??
    asString(rawVoice.id) ??
    asString(rawVoice.voiceId);

  if (!id) {
    return null;
  }

  const gender =
    normalizeGender(rawVoice.gender) ??
    normalizeGender(rawVoice.sex) ??
    normalizeGender(rawVoice.speaker_gender) ??
    normalizeGender(asRecord(rawVoice.voice).gender);

  const language =
    normalizeLanguageName(rawVoice.language) ??
    normalizeLanguageName(rawVoice.language_name) ??
    normalizeLanguageName(rawVoice.locale) ??
    normalizeLanguageName(rawVoice.lang) ??
    normalizeLanguageName(rawVoice.language_code) ??
    normalizeLanguageName(asRecord(rawVoice.voice).language);

  if (!gender || !language) {
    return null;
  }

  return {
    id,
    name:
      asString(rawVoice.voice_name) ??
      asString(rawVoice.name) ??
      asString(rawVoice.title) ??
      id,
    language,
    gender,
    raw: rawVoice,
  };
}

function extractTemplateArray(payload: unknown): Record<string, unknown>[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const candidates: unknown[] = [
    root.templates,
    data.templates,
    data.list,
    data.items,
    root.items,
    root.data,
  ];

  const array = candidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(array)) {
    return [];
  }

  return array
    .map((item) => asRecord(item))
    .filter((item) => Object.keys(item).length > 0);
}

function normalizeTemplate(rawTemplate: Record<string, unknown>): TemplateOption | null {
  const id =
    asString(rawTemplate.template_id) ??
    asString(rawTemplate.id) ??
    asString(rawTemplate.templateId);

  if (!id) {
    return null;
  }

  return {
    id,
    name:
      asString(rawTemplate.name) ??
      asString(rawTemplate.title) ??
      asString(rawTemplate.template_name) ??
      id,
    description:
      asString(rawTemplate.description) ??
      asString(rawTemplate.summary) ??
      asString(rawTemplate.subtitle),
    status:
      asString(rawTemplate.status) ??
      asString(rawTemplate.state),
    updatedAt:
      asString(rawTemplate.updated_at) ??
      asString(rawTemplate.updatedAt) ??
      asString(rawTemplate.created_at),
    raw: rawTemplate,
  };
}

export async function fetchAvatars(): Promise<AvatarOption[]> {
  const response = await requestJson<unknown>("/meta/avatars");
  const parsedAvatars = extractAvatarArray(response)
    .map((avatar) => normalizeAvatar(avatar))
    .filter((avatar): avatar is AvatarOption => avatar !== null);

  // Deduplicate by avatar.id
  const seenIds = new Set<string>();
  const uniqueAvatars: AvatarOption[] = [];
  
  for (const avatar of parsedAvatars) {
    if (!seenIds.has(avatar.id)) {
      seenIds.add(avatar.id);
      uniqueAvatars.push(avatar);
    }
  }

  return uniqueAvatars.sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchVoices(): Promise<VoiceOption[]> {
  const response = await requestJson<unknown>("/meta/voices");
  const parsedVoices = extractVoiceArray(response)
    .map((voice) => normalizeVoice(voice))
    .filter((voice): voice is VoiceOption => voice !== null);

  const seenIds = new Set<string>();
  const uniqueVoices: VoiceOption[] = [];

  for (const voice of parsedVoices) {
    if (!seenIds.has(voice.id)) {
      seenIds.add(voice.id);
      uniqueVoices.push(voice);
    }
  }

  return uniqueVoices.sort((left, right) =>
    left.language === right.language
      ? left.name.localeCompare(right.name)
      : left.language.localeCompare(right.language),
  );
}

export async function fetchTemplates(): Promise<TemplateOption[]> {
  const response = await requestJson<unknown>("/meta/templates");
  return extractTemplateArray(response)
    .map((template) => normalizeTemplate(template))
    .filter((template): template is TemplateOption => template !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function generateDirectVideo(payload: DirectVideoPayload, wait = true): Promise<VideoJobResult> {
  return requestJson<VideoJobResult>(`/generate/direct?wait=${wait ? "true" : "false"}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchVideoStatus(videoId: string, requestMode: "direct" | "template" | "remotion" = "direct"): Promise<VideoJobResult> {
  return requestJson<VideoJobResult>(`/videos/${videoId}/status?request_mode=${requestMode}`);
}

export async function generateRemotionVideo(payload: RemotionVideoPayload): Promise<VideoJobResult> {
  const formData = new FormData();
  formData.set("customer_name", payload.customer_name);
  formData.set("lan", payload.lan);
  formData.set("client_name", payload.client_name);
  formData.set("language", payload.language ?? "Hindi");
  formData.set("include_captions", payload.include_captions ? "true" : "false");
  formData.set("subtitle_color", payload.subtitleColor);
  formData.set("subtitle_position", payload.subtitlePosition);
  formData.set("logo_position", payload.logoPosition);
  formData.set("logo_opacity", String(payload.logoOpacity));

  if (payload.tos?.trim()) {
    formData.set("tos", payload.tos.trim());
  }
  if (payload.loan_amount?.trim()) {
    formData.set("loan_amount", payload.loan_amount.trim());
  }
  if (payload.contact_details?.trim()) {
    formData.set("contact_details", payload.contact_details.trim());
  }
  if (payload.product_type?.trim()) {
    formData.set("product_type", payload.product_type.trim());
  }
  if (payload.script_text?.trim()) {
    formData.set("script_text", payload.script_text.trim());
  }
  if (payload.background_color?.trim()) {
    formData.set("background_color", payload.background_color.trim());
  }
  if (payload.title_prefix?.trim()) {
    formData.set("title_prefix", payload.title_prefix.trim());
  }
  if (typeof payload.video_width === "number") {
    formData.set("video_width", String(payload.video_width));
  }
  if (typeof payload.video_height === "number") {
    formData.set("video_height", String(payload.video_height));
  }
  if (payload.logoFile) {
    formData.set("logo_file", payload.logoFile);
  }

  return requestJson<VideoJobResult>("/generate/remotion", {
    method: "POST",
    body: formData,
  });
}

export async function stylizeVideo(videoId: string, payload: StylizeVideoPayload): Promise<StyledVideoResult> {
  const formData = new FormData();
  formData.set("include_captions", payload.includeCaptions ? "true" : "false");
  formData.set("subtitle_color", payload.subtitleColor);
  formData.set("subtitle_position", payload.subtitlePosition);
  formData.set("logo_position", payload.logoPosition);
  formData.set("logo_opacity", String(payload.logoOpacity));

  if (payload.transcript?.trim()) {
    formData.set("transcript", payload.transcript.trim());
  }
  if (payload.logoFile) {
    formData.set("logo_file", payload.logoFile);
  }

  return requestJson<StyledVideoResult>(`/videos/${videoId}/stylize`, {
    method: "POST",
    body: formData,
  });
}

export async function fetchMyVideos(): Promise<any[]> {
  return requestJson<any[]>("/my-videos");
}

export async function saveDraft(draft: any): Promise<{ status: string; draft_id: string }> {
  return requestJson<{ status: string; draft_id: string }>("/drafts/save", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export async function fetchDrafts(): Promise<any[]> {
  return requestJson<any[]>("/drafts");
}
