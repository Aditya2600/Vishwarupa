import { describe, expect, it } from "vitest";
import {
  getDefaultAvatarScript,
  getDefaultRemotionTranscript,
  REMOTION_SUPPORTED_LANGUAGES,
} from "@/lib/templates";

describe("template defaults", () => {
  it("uses Advocate KD Pathak for male avatar defaults", () => {
    const script = getDefaultAvatarScript("Hindi", "male");

    expect(script).toContain("Advocate KD Pathak");
    expect(script).not.toContain("Advocate Aditi Mehra");
  });

  it("supports the expanded remotion language set", () => {
    expect(REMOTION_SUPPORTED_LANGUAGES).toEqual(
      expect.arrayContaining(["Hindi", "English", "Marathi", "Punjabi"]),
    );
    expect(REMOTION_SUPPORTED_LANGUAGES).not.toContain("Spanish");
    expect(REMOTION_SUPPORTED_LANGUAGES).not.toContain("French");
    expect(getDefaultRemotionTranscript("Spanish")).toBe(getDefaultRemotionTranscript("Hindi"));
    expect(getDefaultRemotionTranscript("French")).toBe(getDefaultRemotionTranscript("Hindi"));
  });
});
