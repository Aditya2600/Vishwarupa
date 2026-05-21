import type { LoanReminderAssetKey, LoanReminderAssetPaths, RemotionTemplateKey } from "@/lib/templates";

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
  languages: string[];
  previewUrl: string | null;
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
  voice_gender?: "male" | "female";
  template_key?: RemotionTemplateKey;
}

export type HybridAspectMode = "landscape_16_9" | "portrait_9_16" | "auto";

export interface HybridRemotionAvatarPipPayload {
  customer_name: string;
  account_number: string;
  days_overdue: number;
  collection_status?: string | null;
  amount_due: string;
  avatar_id: string;
  voice_id: string;
  agent_name?: string;
  agent_role?: string;
  language?: string;
  aspect_mode?: HybridAspectMode;
  viewport_width?: number | null;
  viewport_height?: number | null;
}

export interface HybridRemotionAvatarPipResponse {
  success: boolean;
  raw_avatar_video_id: string | null;
  raw_avatar_path: string | null;
  final_video_path: string;
  final_video_url: string;
  width: number;
  height: number;
  duration_seconds?: number | null;
  template_key?: RemotionTemplateKey;
  max_loan_amount?: string;
  max_tenure?: string;
  max_emi?: string;
  loan_id?: string;
  month_24_loan_amount?: string;
  month_30_loan_amount?: string;
  month_36_loan_amount?: string;
  month_42_loan_amount?: string;
  month_48_loan_amount?: string;
  month_60_loan_amount?: string;
  emi_calculation24?: string;
  emi_calculation30?: string;
  emi_calculation36?: string;
  emi_calculation42?: string;
  emi_calculation48?: string;
  emi_calculation60?: string;
  cta_phone_number?: string;
}

export interface AvatarJobAck {
  _id: string;
  status: "queued";
}

export interface AvatarJobStatus {
  _id: string;
  status: "queued" | "processing" | "completed" | "failed";
  video_url?: string | null;
  thumbnail_url?: string | null;
  title?: string | null;
  error?: string | null;
}

export interface VideoJobResult {
  request_mode: "direct" | "template" | "remotion" | "hybrid_remotion_avatar_pip";
  video_id?: string;
  _id?: string;
  status: string;
  video_url: string | null;
  thumbnail_url: string | null;
  title: string | null;
  raw_response: Record<string, unknown>;
  saved_to: string | null;
  video_path?: string | null;
  audio_path?: string | null;
  interactive_url?: string | null;
  error?: string | null;
}

export interface InteractiveLoanOffer {
  id: string;
  title: string;
  video_url: string;
  customer_name: string;
  client_name: string;
  contact_details: string;
  primary_color: string;
  secondary_color: string;
  loan_offer: Record<string, string | number | null>;
  subtitles?: Array<{ text: string; start: number; end: number }>;
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
  loanReminderImagePaths?: LoanReminderAssetPaths;
  loanReminderImageFiles?: Partial<Record<LoanReminderAssetKey, File | null>>;
  voice_gender?: "male" | "female";
  video_variety?: "personalized" | "universal";
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

export interface AppConfig {
  default_avatar_id: string | null;
  default_voice_id: string | null;
  default_template_id: string | null;
  default_language: string;
}

function resolveApiBaseUrl(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return "/api";
}

export const API_BASE_URL = resolveApiBaseUrl();
const GENERATION_FAILED_MESSAGE = "We couldn't generate the video right now. Please try again.";
const GENERATION_TIMEOUT_MESSAGE = "The video is taking longer than expected. Please try again in a moment.";
const SERVER_UNREACHABLE_MESSAGE = "Could not reach the server. Check that the backend is running and try again.";

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

const MULTILINGUAL_LANGUAGE_NAME = "Multilingual";
const MULTILINGUAL_LANGUAGE_PATTERNS = [/multi[\s-]?lingual/i, /multiple languages?/i, /all languages?/i];
const INDIAN_LANGUAGE_NAMES = ["Hindi", "Marathi", "Tamil", "Telugu", "Kannada", "Bengali", "Gujarati", "Malayalam", "Punjabi"];
const INDIAN_MARKERS = [
  "india",
  "indian",
  "en-in",
  "hi-in",
  "mr-in",
  "ta-in",
  "te-in",
  "kn-in",
  "bn-in",
  "gu-in",
  "ml-in",
  "pa-in",
];
const INDIAN_NAME_HINTS = [
  "aadya",
  "aaditya",
  "aakash",
  "aarti",
  "abhishek",
  "aditi",
  "aditya",
  "ananya",
  "anil",
  "ankit",
  "arjun",
  "aryan",
  "diya",
  "dhwani",
  "gagan",
  "ishani",
  "ishita",
  "kabir",
  "karan",
  "mahesh",
  "rahul",
  "ishita",
  "kabir",
  "karan",
  "kritika",
  "kavya",
  "madhur",
  "manohar",
  "maya",
  "midhun",
  "mohan",
  "niranjan",
  "pallavi",
  "priya",
  "ramesh",
  "rohan",
  "sapna",
  "shruti",
  "sobhana",
  "swara",
  "tanisha",
  "valluvar",
  "vihaan",
  "yashpal",
];
const INDIAN_AVATAR_DISPLAY_NAMES = {
  female: [
    "Aarohi",
    "Aditi",
    "Ananya",
    "Diya",
    "Ishita",
    "Kavya",
    "Naina",
    "Priya",
    "Saanvi",
    "Shruti",
  ],
  male: [
    "Aarav",
    "Aditya",
    "Arjun",
    "Kabir",
    "Madhav",
    "Rohan",
    "Samar",
    "Sanjay",
    "Varun",
    "Vihaan",
    "Yash",
  ],
  neutral: [
    "Aman",
    "Dev",
    "Kiran",
    "Manav",
    "Neel",
    "Pavan",
    "Rahil",
    "Rishi",
    "Shiv",
    "Tanuj",
  ],
} as const;

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
  if (MULTILINGUAL_LANGUAGE_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return MULTILINGUAL_LANGUAGE_NAME;
  }

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

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      uniqueValues.push(value);
    }
  }

  return uniqueValues;
}

function normalizeVoiceNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return dedupeStrings(value.flatMap((entry) => extractStrings(entry)));
  }

  const record = asRecord(value);
  if (Object.keys(record).length > 0) {
    return dedupeStrings(Object.values(record).flatMap((entry) => extractStrings(entry)));
  }

  const normalized = asString(value);
  return normalized ? [normalized] : [];
}

function collectMetadataStrings(record: Record<string, unknown>, keys: string[]): string[] {
  return dedupeStrings(keys.flatMap((key) => extractStrings(record[key])));
}

function includesAny(text: string, candidates: string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate));
}

function hasIndianNameHint(name: string): boolean {
  return includesAny(name.toLowerCase(), INDIAN_NAME_HINTS);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function localizeAvatarDisplayNames(avatars: AvatarOption[]): AvatarOption[] {
  const assignedNameCounts = new Map<string, number>();

  return avatars.map((avatar) => {
    if (hasIndianNameHint(avatar.name)) {
      return avatar;
    }

    const pool =
      avatar.gender === "female"
        ? INDIAN_AVATAR_DISPLAY_NAMES.female
        : avatar.gender === "male"
          ? INDIAN_AVATAR_DISPLAY_NAMES.male
          : INDIAN_AVATAR_DISPLAY_NAMES.neutral;
    const baseName = pool[hashString(avatar.id) % pool.length];
    const nextCount = (assignedNameCounts.get(baseName) ?? 0) + 1;
    assignedNameCounts.set(baseName, nextCount);

    return {
      ...avatar,
      name: nextCount === 1 ? baseName : `${baseName} ${nextCount}`,
    };
  });
}

function hasIndianMetadata(record: Record<string, unknown>, keys: string[]): boolean {
  const metadataText = collectMetadataStrings(record, keys).join(" ").toLowerCase();
  return includesAny(metadataText, INDIAN_MARKERS);
}

function normalizeLanguageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return dedupeStrings(value.flatMap((entry) => normalizeLanguageList(entry)));
  }

  const record = asRecord(value);
  if (Object.keys(record).length > 0) {
    return dedupeStrings([
      ...normalizeLanguageList(record.language),
      ...normalizeLanguageList(record.language_name),
      ...normalizeLanguageList(record.locale),
      ...normalizeLanguageList(record.lang),
      ...normalizeLanguageList(record.language_code),
      ...normalizeLanguageList(record.name),
    ]);
  }

  const normalized = normalizeLanguageName(value);
  return normalized ? [normalized] : [];
}

function normalizeVoiceLanguages(rawVoice: Record<string, unknown>): string[] {
  const nestedVoice = asRecord(rawVoice.voice);

  return dedupeStrings([
    ...normalizeLanguageList(rawVoice.language),
    ...normalizeLanguageList(rawVoice.language_name),
    ...normalizeLanguageList(rawVoice.locale),
    ...normalizeLanguageList(rawVoice.lang),
    ...normalizeLanguageList(rawVoice.language_code),
    ...normalizeLanguageList(rawVoice.languages),
    ...normalizeLanguageList(rawVoice.language_list),
    ...normalizeLanguageList(rawVoice.supported_languages),
    ...normalizeLanguageList(rawVoice.supported_locales),
    ...normalizeLanguageList(rawVoice.support_locale),
    ...normalizeLanguageList(rawVoice.locales),
    ...normalizeLanguageList(rawVoice.language_support),
    ...normalizeLanguageList(nestedVoice.language),
    ...normalizeLanguageList(nestedVoice.language_name),
    ...normalizeLanguageList(nestedVoice.locale),
    ...normalizeLanguageList(nestedVoice.lang),
    ...normalizeLanguageList(nestedVoice.language_code),
    ...normalizeLanguageList(nestedVoice.languages),
    ...normalizeLanguageList(nestedVoice.language_list),
    ...normalizeLanguageList(nestedVoice.supported_languages),
    ...normalizeLanguageList(nestedVoice.supported_locales),
    ...normalizeLanguageList(nestedVoice.support_locale),
    ...normalizeLanguageList(nestedVoice.locales),
    ...normalizeLanguageList(nestedVoice.language_support),
  ]);
}

function extractVoicePreviewUrl(rawVoice: Record<string, unknown>): string | null {
  const nestedVoice = asRecord(rawVoice.voice);

  return (
    asString(rawVoice.preview_audio_url) ??
    asString(rawVoice.preview_audio) ??
    asString(rawVoice.preview_url) ??
    asString(rawVoice.audio_preview_url) ??
    asString(rawVoice.sample_audio_url) ??
    asString(rawVoice.sample_url) ??
    asString(rawVoice.demo_audio_url) ??
    asString(rawVoice.demo_url) ??
    asString(rawVoice.voice_preview_url) ??
    asString(rawVoice.audio_url) ??
    asString(nestedVoice.preview_audio_url) ??
    asString(nestedVoice.preview_audio) ??
    asString(nestedVoice.preview_url) ??
    asString(nestedVoice.audio_preview_url) ??
    asString(nestedVoice.sample_audio_url) ??
    asString(nestedVoice.sample_url) ??
    asString(nestedVoice.demo_audio_url) ??
    asString(nestedVoice.demo_url) ??
    asString(nestedVoice.voice_preview_url) ??
    asString(nestedVoice.audio_url)
  );
}

function isMultilingualLanguage(language: string): boolean {
  return normalizeLanguageName(language) === MULTILINGUAL_LANGUAGE_NAME;
}

export function isVoiceCompatibleWithLanguage(
  voice: Pick<VoiceOption, "language" | "languages" | "name">,
  selectedLanguage: string,
): boolean {
  const normalizedSelectedLanguage = normalizeLanguageName(selectedLanguage);
  if (!normalizedSelectedLanguage) {
    return false;
  }

  const englishBlacklist = ["abhishek", "mahesh", "warrior rohan", "akash", "kavya", "maryann", "mary ann"];
  if (
    voice.name && 
    normalizedSelectedLanguage === "English" && 
    englishBlacklist.some(blacklisted => voice.name.toLowerCase().includes(blacklisted))
  ) {
    return false;
  }

  // Explicitly whitelist the user's highly preferred voices for Hindi only
  const whiteListedIndianVoices = [
    "aaditya k", "aahana verma", "adv. aditi mehra", "anika mehra", "aditi - calm"
  ];
  
  if (
    voice.name && whiteListedIndianVoices.includes(voice.name.toLowerCase()) &&
    normalizedSelectedLanguage === "Hindi"
  ) {
    return true;
  }

  const normalizedLanguages = dedupeStrings(
    (voice.languages ?? [])
      .map((language) => normalizeLanguageName(language))
      .filter((language): language is string => Boolean(language)),
  );

  if (normalizedLanguages.includes(normalizedSelectedLanguage)) {
    return true;
  }

  if (normalizedLanguages.some((language) => isMultilingualLanguage(language))) {
    return true;
  }

  const normalizedPrimaryLanguage = normalizeLanguageName(voice.language);
  return normalizedPrimaryLanguage === normalizedSelectedLanguage || isMultilingualLanguage(voice.language);
}

export function compareVoicesForLanguage(
  left: Pick<VoiceOption, "language" | "languages" | "name">,
  right: Pick<VoiceOption, "language" | "languages" | "name">,
  selectedLanguage: string,
): number {
  const normalizedSelectedLanguage = normalizeLanguageName(selectedLanguage);
  const leftPrimaryMatch = normalizeLanguageName(left.language) === normalizedSelectedLanguage;
  const rightPrimaryMatch = normalizeLanguageName(right.language) === normalizedSelectedLanguage;

  if (leftPrimaryMatch !== rightPrimaryMatch) {
    return leftPrimaryMatch ? -1 : 1;
  }

  const leftCompatible = isVoiceCompatibleWithLanguage(left, selectedLanguage);
  const rightCompatible = isVoiceCompatibleWithLanguage(right, selectedLanguage);

  if (leftCompatible !== rightCompatible) {
    return leftCompatible ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
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

function isGenerationRequest(path: string): boolean {
  const normalizedPath = path.split("?")[0] ?? path;
  return (
    normalizedPath.startsWith("/generate/") ||
    normalizedPath === "/jobs/avatar" ||
    /^\/jobs\/[^/]+$/.test(normalizedPath) ||
    /^\/videos\/[^/]+\/status$/.test(normalizedPath) ||
    /^\/videos\/[^/]+\/stylize$/.test(normalizedPath)
  );
}

function toSafeErrorMessage(path: string, payload: unknown, status: number): string {
  const extracted = extractErrorMessage(payload)?.trim();
  const lowered = extracted?.toLowerCase() ?? "";
  const isGenerationFlow = isGenerationRequest(path);

  if (isGenerationFlow) {
    if (/insufficient credit/i.test(lowered)) {
      return "You don't have enough credits to generate this video.";
    }
    if (/voice(\s|_|-)?id|voice is not available|voice not available|voice unavailable/i.test(lowered)) {
      return "The selected voice is unavailable right now. Please choose another voice and try again.";
    }
    if (/timed out|timeout|longer than expected/i.test(lowered) || status === 504) {
      return GENERATION_TIMEOUT_MESSAGE;
    }
    return GENERATION_FAILED_MESSAGE;
  }

  return extracted ?? `Request failed with status ${status}`;
}

function normalizeNetworkError(error: unknown): Error {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return new Error(SERVER_UNREACHABLE_MESSAGE);
    }
    return error;
  }

  return new Error(SERVER_UNREACHABLE_MESSAGE);
}

function logApiFailure(path: string, init: RequestInit | undefined, details: Record<string, unknown>): void {
  console.error("[api] Request failed", {
    path,
    method: init?.method ?? "GET",
    ...details,
  });
}

export async function getCustomAvatars(): Promise<any[]> {
  try {
    return await requestJson<any[]>("/custom-avatars");
  } catch (error) {
    console.error("Failed to fetch custom avatars:", error);
    return [];
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
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
    logApiFailure(path, init, { stage: "network", error });
    throw normalizeNetworkError(error);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text();

  if (!response.ok) {
    logApiFailure(path, init, {
      stage: "response",
      status: response.status,
      statusText: response.statusText,
      payload,
    });

    if (response.status === 401) {
      clearStoredAuth();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    if (typeof payload === "string" && payload.trim().startsWith("<")) {
      if (isGenerationRequest(path) && response.status === 504) {
        throw new Error(GENERATION_TIMEOUT_MESSAGE);
      }
      if (isGenerationRequest(path)) {
        throw new Error(GENERATION_FAILED_MESSAGE);
      }
      throw new Error("The server returned an unexpected response. Please try again.");
    }

    throw new Error(toSafeErrorMessage(path, payload, response.status));
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

  const nestedAvatar = asRecord(rawAvatar.avatar);
  const isIndian =
    category === "My Avatars" ||
    category === "Lead Avatar" ||
    category === "Talking Photo" ||
    id === "c56120f1c7564d20b1f87416a6b8d0d1" ||
    id === "932371fea0eb462ea9beccff656d4823" ||
    id === "2311cba09f374de6b971ea5fa23ff993" ||
    hasIndianMetadata(rawAvatar, [
      "avatar_name",
      "name",
      "title",
      "description",
      "country",
      "region",
      "locale",
      "language",
      "language_code",
      "nationality",
      "accent",
      "group",
      "style",
      "category",
      "tags",
      "labels",
    ]) ||
    hasIndianMetadata(nestedAvatar, [
      "avatar_name",
      "name",
      "title",
      "description",
      "country",
      "region",
      "locale",
      "language",
      "language_code",
      "nationality",
      "accent",
      "group",
      "style",
      "category",
      "tags",
      "labels",
    ]) ||
    hasIndianNameHint(name);

  let finalName = name;
  let finalCategory = category;
  let finalIsPremium = asBoolean(rawAvatar.is_premium) || asBoolean(rawAvatar.premium);

  if (id === "2311cba09f374de6b971ea5fa23ff993" || id === "c56120f1c7564d20b1f87416a6b8d0d1" || id === "932371fea0eb462ea9beccff656d4823" || id === "5308daadb44345149c419def8575b3fd") {
    finalCategory = "Avatar";
    finalIsPremium = false;
  }

  return {
    id,
    name: finalName,
    category: finalCategory,
    gender,
    previewImageUrl,
    isPremium: finalIsPremium,
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

function isVoiceUnavailable(rawVoice: Record<string, unknown>): boolean {
  const nestedVoice = asRecord(rawVoice.voice);
  const status =
    asString(rawVoice.status) ??
    asString(rawVoice.voice_status) ??
    asString(rawVoice.state) ??
    asString(nestedVoice.status) ??
    asString(nestedVoice.voice_status) ??
    asString(nestedVoice.state);

  const normalizedStatus = status?.trim().toLowerCase() ?? "";
  if (normalizedStatus) {
    if (
      /fail|error|inactive|disabled|unavailable|deleted/.test(normalizedStatus)
    ) {
      return true;
    }
  }

  const disabled =
    asBoolean(rawVoice.disabled) ||
    asBoolean(rawVoice.is_disabled) ||
    asBoolean(nestedVoice.disabled) ||
    asBoolean(nestedVoice.is_disabled);
  if (disabled) {
    return true;
  }

  if ("is_available" in rawVoice && !asBoolean(rawVoice.is_available)) {
    return true;
  }
  if ("available" in rawVoice && !asBoolean(rawVoice.available)) {
    return true;
  }
  if ("is_available" in nestedVoice && !asBoolean(nestedVoice.is_available)) {
    return true;
  }
  if ("available" in nestedVoice && !asBoolean(nestedVoice.available)) {
    return true;
  }

  return false;
}

function normalizeVoice(rawVoice: Record<string, unknown>): VoiceOption | null {
  const id =
    asString(rawVoice.voice_id) ??
    asString(rawVoice.id) ??
    asString(rawVoice.voiceId);

  if (!id) {
    return null;
  }

  if (isVoiceUnavailable(rawVoice)) {
    return null;
  }

  const gender =
    normalizeGender(rawVoice.gender) ??
    normalizeGender(rawVoice.sex) ??
    normalizeGender(rawVoice.speaker_gender) ??
    normalizeGender(asRecord(rawVoice.voice).gender);

  const languages = normalizeVoiceLanguages(rawVoice);
  const language =
    normalizeLanguageName(rawVoice.language) ??
    normalizeLanguageName(rawVoice.language_name) ??
    normalizeLanguageName(rawVoice.locale) ??
    normalizeLanguageName(rawVoice.lang) ??
    normalizeLanguageName(rawVoice.language_code) ??
    normalizeLanguageName(asRecord(rawVoice.voice).language) ??
    (languages.length === 1
      ? languages[0]
      : languages.length > 1
        ? MULTILINGUAL_LANGUAGE_NAME
        : null);

  if (!gender || !language) {
    return null;
  }

  const name =
    asString(rawVoice.voice_name) ??
    asString(rawVoice.name) ??
    asString(rawVoice.title) ??
    id;
  const nestedVoice = asRecord(rawVoice.voice);
  const supportsIndianLanguage =
    INDIAN_LANGUAGE_NAMES.includes(language) ||
    languages.some((entry) => INDIAN_LANGUAGE_NAMES.includes(entry));
  const hasIndianVoiceMetadataMatch =
    hasIndianMetadata(rawVoice, [
      "accent",
      "country",
      "region",
      "locale",
      "language",
      "language_name",
      "language_code",
      "locales",
      "supported_locales",
      "support_locale",
      "description",
      "tags",
      "labels",
    ]) ||
    hasIndianMetadata(nestedVoice, [
      "accent",
      "country",
      "region",
      "locale",
      "language",
      "language_name",
      "language_code",
      "locales",
      "supported_locales",
      "support_locale",
      "description",
      "tags",
      "labels",
    ]) ||
    hasIndianNameHint(name);

  if (!(supportsIndianLanguage || hasIndianVoiceMetadataMatch)) {
    return null;
  }

  return {
    id,
    name,
    language,
    languages,
    previewUrl: extractVoicePreviewUrl(rawVoice),
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

  return localizeAvatarDisplayNames(uniqueAvatars).sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchVoices(): Promise<VoiceOption[]> {
  const response = await requestJson<unknown>("/meta/voices");
  const parsedVoices = extractVoiceArray(response)
    .map((voice) => normalizeVoice(voice))
    .filter((voice): voice is VoiceOption => voice !== null);

  const seenIds = new Set<string>();
  const seenNameKeys = new Set<string>();
  const uniqueVoices: VoiceOption[] = [];

  for (const voice of parsedVoices) {
    const nameKey = normalizeVoiceNameKey(voice.name);
    if (seenIds.has(voice.id)) {
      continue;
    }
    if (nameKey && seenNameKeys.has(nameKey)) {
      continue;
    }

    seenIds.add(voice.id);
    if (nameKey) {
      seenNameKeys.add(nameKey);
    }
    uniqueVoices.push(voice);
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

export async function fetchConfig(): Promise<AppConfig> {
  return requestJson<AppConfig>("/meta/config");
}

export async function createAvatarJob(payload: DirectVideoPayload): Promise<AvatarJobAck> {
  return requestJson<AvatarJobAck>("/jobs/avatar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAvatarJobStatus(id: string): Promise<AvatarJobStatus> {
  return requestJson<AvatarJobStatus>(`/jobs/${id}`);
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

export async function fetchInteractiveLoanOffer(videoId: string): Promise<InteractiveLoanOffer> {
  return requestJson<InteractiveLoanOffer>(`/interactive/loan-offer/${videoId}`);
}

export async function recordInteractiveLoanOfferEvent(
  videoId: string,
  payload: {
    action: string;
    selected_loan_amount?: string;
    selected_tenure?: string;
    selected_emi?: string;
  },
): Promise<{ status: string }> {
  return requestJson<{ status: string }>(`/interactive/loan-offer/${videoId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  if (payload.voice_gender) {
    formData.set("voice_gender", payload.voice_gender);
  }
  if (payload.video_variety) {
    formData.set("video_variety", payload.video_variety);
  }
  if (payload.template_key) {
    formData.set("template_key", payload.template_key);
  }

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
  if (payload.loanReminderImagePaths) {
    formData.set("loan_reminder_image_paths", JSON.stringify(payload.loanReminderImagePaths));
  }
  if (payload.loanReminderImageFiles) {
    Object.entries(payload.loanReminderImageFiles).forEach(([key, file]) => {
      if (file) {
        formData.set(`loan_reminder_image_${key}`, file);
      }
    });
  }
  [
    "max_loan_amount",
    "max_tenure",
    "max_emi",
    "loan_id",
    "month_24_loan_amount",
    "month_30_loan_amount",
    "month_36_loan_amount",
    "month_42_loan_amount",
    "month_48_loan_amount",
    "month_60_loan_amount",
    "emi_calculation24",
    "emi_calculation30",
    "emi_calculation36",
    "emi_calculation42",
    "emi_calculation48",
    "emi_calculation60",
    "cta_phone_number",
  ].forEach((key) => {
    const value = payload[key as keyof RemotionVideoPayload];
    if (typeof value === "string" && value.trim()) {
      formData.set(key, value.trim());
    }
  });

  return requestJson<VideoJobResult>("/generate/remotion", {
    method: "POST",
    body: formData,
  });
}

export async function generateHybridRemotionAvatarPip(
  payload: HybridRemotionAvatarPipPayload,
): Promise<HybridRemotionAvatarPipResponse> {
  return requestJson<HybridRemotionAvatarPipResponse>("/generate/hybrid-remotion-avatar-pip", {
    method: "POST",
    body: JSON.stringify(payload),
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

export async function fetchVideo(id: string): Promise<any> {
  return requestJson<any>(`/videos/${id}`);
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

export interface WhatsAppTemplatePayload {
  name: string;
  fromNumber: string;
  templateExtraData: {
    mediaUrl: string;
  };
  vendor: string;
  bodyParams: Record<string, string>;
  headerParams?: Record<string, string>;
  buttonParams?: Array<Record<string, string>>;
}

export interface CampaignLeadPayload {
  phoneNumber: string;
  uniqueId: string;
  variables?: Record<string, string>;
}

export interface PushCampaignLeadsPayload {
  campaignCode: string;
  leads: CampaignLeadPayload[];
}

export interface CreateCampaignPayload {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  templateId: string;
  communicationType: "WHATSAPP";
  campaignType?: "WHATSAPP";
}

export type CampaignStatus = "CREATED" | "PAUSED" | "RESUMED" | "STARTED";

export interface CpaasApiResponse<T = unknown> {
  success: boolean;
  status: number;
  message: string;
  data: T | null;
  timestamp: string;
  code?: string;
}

async function requestCpaasJson<T>(path: string, init: RequestInit): Promise<T> {
  return requestJson<T>(`/cpaas${path}`, init);
}

export async function sendWhatsAppTemplate(payload: WhatsAppTemplatePayload): Promise<any> {
  return requestCpaasJson<any>("/whatsapp-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createCampaign(
  payload: CreateCampaignPayload,
): Promise<CpaasApiResponse<unknown>> {
  return requestCpaasJson<CpaasApiResponse<unknown>>("/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pushCampaignLeads(
  payload: PushCampaignLeadsPayload,
): Promise<CpaasApiResponse<null>> {
  return requestCpaasJson<CpaasApiResponse<null>>("/campaigns/push-lead", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCampaignStatus(
  campaignCode: string,
  status: CampaignStatus,
): Promise<CpaasApiResponse<null>> {
  const encodedCampaignCode = encodeURIComponent(campaignCode);
  const encodedStatus = encodeURIComponent(status);

  return requestCpaasJson<CpaasApiResponse<null>>(
    `/campaigns/${encodedCampaignCode}/status?status=${encodedStatus}`,
    {
      method: "POST",
    },
  );
}

export async function deleteVideo(id: string): Promise<{ status: string; message: string }> {
  return requestJson<{ status: string; message: string }>(`/videos/${id}`, {
    method: "DELETE",
  });
}
