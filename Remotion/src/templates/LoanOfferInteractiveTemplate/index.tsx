import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { LoanOfferData, LoanOfferInteractiveTemplateProps } from "./types";

const FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF_FONT = "Playfair Display, Georgia, Times New Roman, serif";

const safeText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
};

const isLightColor = (hex: string): boolean => {
  if (!hex) return false;
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length < 6) return false;
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 145;
};

const toNumeric = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const formatIndian = (value: unknown, fallback = "NA") => {
  const numeric = toNumeric(value);
  if (numeric === null) return safeText(value, fallback);
  return `₹${numeric.toLocaleString("en-IN")}`;
};

const isAvailable = (value: unknown) => {
  const cleaned = safeText(value, "").toLowerCase();
  return Boolean(cleaned && cleaned !== "na" && cleaned !== "null");
};

const buildRows = (offer: LoanOfferData) => {
  const tenures = ["12", "24", "36", "48", "60"];
  const rows = tenures
    .map((tenure) => {
      const amount =
        offer[`month_${tenure}_loan_amount` as keyof LoanOfferData];
      const emi = offer[`emi_calculation${tenure}` as keyof LoanOfferData];
      return {
        tenure,
        amount,
        emi,
      };
    })
    .filter((row) => isAvailable(row.amount));

  if (rows.length > 0) return rows;

  return [
    {
      tenure: safeText(offer.max_tenure, "60"),
      amount: offer.max_loan_amount || "500000",
      emi: offer.max_emi || "2250",
    },
  ];
};

const getSelectedRow = (offer: LoanOfferData) => {
  const rows = buildRows(offer);
  return rows[rows.length - 1] || { tenure: "60", amount: "500000", emi: "2250" };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const resolveSceneBoundaries = (
  stepBoundaries: number[],
  durationInFrames: number,
  fps: number,
) => {
  const finalFrame = Math.max(1, durationInFrames - 1);
  const totalSeconds = durationInFrames / fps;
  const finalHoldFrames = Math.round(Math.min(6, Math.max(4, totalSeconds * 0.34)) * fps);
  const selectorHoldFrames = Math.round(Math.min(5, Math.max(3, totalSeconds * 0.24)) * fps);
  const introFallback = Math.round(10.8 * fps);
  const selectorFallback = Math.round(22 * fps);

  const rawIntro = Number.isFinite(stepBoundaries[0]) ? stepBoundaries[0] : introFallback;
  const rawSelector = Number.isFinite(stepBoundaries[1]) ? stepBoundaries[1] : selectorFallback;

  const latestIntroEnd = Math.max(
    Math.round(4 * fps),
    finalFrame - finalHoldFrames - selectorHoldFrames,
  );
  const introEnd = clamp(
    rawIntro,
    Math.min(Math.round(4 * fps), latestIntroEnd),
    latestIntroEnd,
  );

  const latestSelectorEnd = Math.max(
    introEnd + Math.round(2 * fps),
    finalFrame - finalHoldFrames,
  );
  const selectorEnd = clamp(
    rawSelector,
    introEnd + Math.round(2 * fps),
    latestSelectorEnd,
  );

  return { introEnd, selectorEnd };
};

// -- UI Shell --
const Shell = ({
  children,
  hideGrid = false,
}: {
  children: React.ReactNode;
  hideGrid?: boolean;
}) => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 50% 10%, #ffffff 0%, #f5edff 38%, #dfccff 100%)",
      color: "#1a062f",
      fontFamily: FONT_FAMILY,
      overflow: "hidden",
    }}
  >
    {!hideGrid ? (
      <div style={{ position: "absolute", inset: 0, opacity: 0.28 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="premium-grid"
              width="42"
              height="42"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 42 0 L 0 0 0 42"
                fill="none"
                stroke="#cdb8ee"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#premium-grid)" />
        </svg>
      </div>
    ) : null}

    <div
      style={{
        position: "absolute",
        top: -260,
        left: -220,
        width: 760,
        height: 760,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(168, 85, 247, 0.20), transparent 65%)",
        filter: "blur(35px)",
      }}
    />

    <div
      style={{
        position: "absolute",
        bottom: -220,
        right: -260,
        width: 820,
        height: 820,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(76, 29, 149, 0.22), transparent 65%)",
        filter: "blur(45px)",
      }}
    />

    {children}
  </AbsoluteFill>
);

const StatusBar = () => (
  <div
    style={{
      position: "absolute",
      top: 38,
      left: 92,
      right: 92,
      height: 42,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      color: "#0b0b12",
      fontSize: 31,
      fontWeight: 700,
      zIndex: 5,
    }}
  >
    <div>9:41</div>

    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
        {[12, 17, 22, 28].map((h) => (
          <div
            key={h}
            style={{
              width: 6,
              height: h,
              borderRadius: 3,
              backgroundColor: "#0b0b12",
            }}
          />
        ))}
      </div>

      <svg width="30" height="24" viewBox="0 0 30 24" fill="none">
        <path
          d="M3 8.5C9.5 3 20.5 3 27 8.5"
          stroke="#0b0b12"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M8 13.5C12 10.5 18 10.5 22 13.5"
          stroke="#0b0b12"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M13.5 18.5C14.5 18 15.5 18 16.5 18.5"
          stroke="#0b0b12"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          width: 36,
          height: 18,
          border: "3px solid #0b0b12",
          borderRadius: 5,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -7,
            top: 4,
            width: 4,
            height: 8,
            backgroundColor: "#0b0b12",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 3,
            top: 3,
            width: 26,
            height: 8,
            backgroundColor: "#0b0b12",
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  </div>
);

const PremiumLogo = () => (
  <Img
    src={staticFile("assets/TVS_Credit_logo.png")}
    style={{
      width: 450,
      height: "auto",
      objectFit: "contain",
      filter: "drop-shadow(0 14px 30px rgba(76, 29, 149, 0.12))",
    }}
  />
);

const Sparkle = ({
  x,
  y,
  size,
  delay = 0,
  color = "#a855f7",
}: {
  x: string;
  y: string;
  size: number;
  delay?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  const appear = clamp(localFrame / 18, 0, 1);
  const pulse = 0.75 + 0.25 * Math.sin(localFrame * 0.35);
  const scale = 0.35 + appear * pulse;
  const opacity = localFrame < 0 ? 0 : appear * pulse;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale}) rotate(${localFrame * 2.5}deg)`,
        filter: `drop-shadow(0 0 ${size * 0.45}px ${color})`,
      }}
    >
      <path
        d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z"
        fill={color}
      />
    </svg>
  );
};

const ConfettiStrip = ({
  x,
  y,
  width,
  color,
  rotate,
  delay = 0,
}: {
  x: string;
  y: string;
  width: number;
  color: string;
  rotate: number;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  const appear = clamp(localFrame / 14, 0, 1);
  const floatY = Math.sin(localFrame * 0.12) * 5;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: 8,
        borderRadius: 999,
        backgroundColor: color,
        opacity: localFrame < 0 ? 0 : appear * 0.85,
        transform: `translate(-50%, calc(-50% + ${floatY}px)) rotate(${rotate}deg)`,
      }}
    />
  );
};

const PartyEmoji = ({
  x,
  y,
  delay = 0,
}: {
  x: string;
  y: string;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - delay;

  const appear = clamp(localFrame / 16, 0, 1);
  const floatY = Math.sin(localFrame * 0.15) * 8;
  const rotate = Math.sin(localFrame * 0.18) * 10;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontSize: 38,
        opacity: localFrame < 0 ? 0 : appear,
        transform: `translate(-50%, calc(-50% + ${floatY}px)) rotate(${rotate}deg) scale(${0.75 + appear * 0.25})`,
      }}
    >
      🎉
    </div>
  );
};

// -- Confetti / Sparkle Decoration --
const Confetti = ({ opacity }: { opacity: number }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      pointerEvents: "none",
      zIndex: 2,
    }}
  >
    <Sparkle x="18%" y="19%" size={18} delay={2} color="#8b5cf6" />
    <Sparkle x="82%" y="20%" size={16} delay={8} color="#22c55e" />
    <Sparkle x="26%" y="33%" size={14} delay={12} color="#60a5fa" />
    <Sparkle x="74%" y="33%" size={14} delay={16} color="#facc15" />
    <Sparkle x="50%" y="41%" size={26} delay={20} color="#a855f7" />

    <ConfettiStrip x="28%" y="21%" width={22} color="#a78bfa" rotate={-35} delay={4} />
    <ConfettiStrip x="72%" y="22%" width={22} color="#6ee7b7" rotate={35} delay={7} />
    <ConfettiStrip x="22%" y="29%" width={18} color="#60a5fa" rotate={15} delay={10} />
    <ConfettiStrip x="78%" y="29%" width={20} color="#8b5cf6" rotate={-20} delay={13} />

    <PartyEmoji x="15%" y="24%" delay={10} />
    <PartyEmoji x="85%" y="24%" delay={14} />
  </div>
);

const FeatureIcon = ({ type }: { type: "bolt" | "shield" | "percent" }) => {
  if (type === "bolt") {
    return (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L4 14h7l-1 8 10-13h-7l0-7z" fill="#5b21b6" />
      </svg>
    );
  }

  if (type === "shield") {
    return (
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
          fill="#5b21b6"
        />
        <path
          d="M8.5 12.2l2.2 2.2 4.8-5"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <div
      style={{
        color: "#5b21b6",
        fontSize: 38,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      %
    </div>
  );
};

const FeatureItem = ({
  type,
  line1,
  line2,
}: {
  type: "bolt" | "shield" | "percent";
  line1: string;
  line2: string;
}) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}
  >
    <div
      style={{
        width: 82,
        height: 82,
        borderRadius: "50%",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(240,230,255,0.95))",
        border: "2px solid rgba(255,255,255,0.95)",
        boxShadow: "0 10px 25px rgba(91, 33, 182, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
      }}
    >
      <FeatureIcon type={type} />
    </div>

    <div
      style={{
        fontSize: 24,
        fontWeight: 500,
        lineHeight: 1.22,
        textAlign: "center",
        color: "#21183c",
      }}
    >
      {line1}
      <br />
      {line2}
    </div>
  </div>
);

// -- Scene 1: Intro --
const Intro = ({
  offer,
  customerName,
}: {
  offer: LoanOfferData;
  customerName?: string;
}) => {
  const frame = useCurrentFrame();

  const entrance = clamp(frame / 24, 0, 1);
  const lift = (1 - entrance) * 34;

  const amountText = formatIndian(
    offer.max_loan_amount || getSelectedRow(offer).amount || "500000",
  ).replace(/^₹/, "₹ ");

  return (
    <Shell>
      <StatusBar />

      <div
        style={{
          position: "absolute",
          top: 142,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: entrance,
          transform: `translateY(${lift}px)`,
        }}
      >
        <PremiumLogo />
      </div>

      <div
        style={{
          position: "absolute",
          top: 282,
          left: 72,
          right: 72,
          height: 1255,
          borderRadius: 52,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88))",
          boxShadow:
            "0 32px 80px rgba(76, 29, 149, 0.13), inset 0 1px 0 rgba(255,255,255,0.9)",
          border: "1px solid rgba(255,255,255,0.85)",
          overflow: "hidden",
          opacity: entrance,
          transform: `translateY(${lift}px)`,
        }}
      >
        <Confetti opacity={entrance} />

        <div
          style={{
            position: "absolute",
            top: 88,
            left: "50%",
            transform: "translateX(-50%)",
            width: 154,
            height: 154,
            borderRadius: "50%",
            background: "rgba(34, 197, 94, 0.12)",
            boxShadow: "0 0 0 22px rgba(34, 197, 94, 0.07)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 108,
            left: "50%",
            transform: "translateX(-50%)",
            width: 114,
            height: 114,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #76e59c 0%, #16a34a 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 18px 38px rgba(22, 163, 74, 0.35), inset 0 2px 8px rgba(255,255,255,0.35)",
          }}
        >
          <svg width="58" height="58" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.3l4.2 4.2L19 6.8"
              stroke="#fff"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div
          style={{
            position: "absolute",
            top: 320,
            left: 40,
            right: 40,
            textAlign: "center",
            fontFamily: SERIF_FONT,
            fontSize: 78,
            fontWeight: 800,
            lineHeight: 1.05,
            color: "#16073d",
            letterSpacing: -1.8,
          }}
        >
          Congratulations!
        </div>

        <div
          style={{
            position: "absolute",
            top: 430,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 34,
            color: "#33334d",
            fontWeight: 500,
          }}
        >
          Your loan has been pre-approved
        </div>

        <div
          style={{
            position: "absolute",
            top: 515,
            left: 140,
            right: 140,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(91, 33, 182, 0.22), transparent)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 496,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 28,
            height: 28,
            backgroundColor: "#a855f7",
            boxShadow: "0 0 30px rgba(168, 85, 247, 0.35)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 570,
            left: 120,
            right: 120,
            textAlign: "center",
            fontSize: 28,
            lineHeight: 1.38,
            color: "#4b4b63",
            fontWeight: 400,
          }}
        >
          We're excited to help you take the next step
          <br />
          towards your financial goals.
        </div>

        <div
          style={{
            position: "absolute",
            top: 710,
            left: 48,
            right: 48,
            height: 355,
            borderRadius: 38,
            background:
              "linear-gradient(135deg, #8b5cf6 0%, #5b21b6 46%, #3b0b8f 100%)",
            boxShadow:
              "0 28px 56px rgba(76, 29, 149, 0.35), inset 0 1px 0 rgba(255,255,255,0.22)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.22,
              background:
                "radial-gradient(circle at 92% 15%, transparent 0 120px, rgba(255,255,255,0.45) 122px, transparent 124px)",
            }}
          />

          <svg
            style={{ position: "absolute", left: 0, bottom: 0, opacity: 0.25 }}
            width="520"
            height="140"
            viewBox="0 0 520 140"
            fill="none"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <path
                key={i}
                d={`M0 ${100 + i * 7} C 130 ${40 + i * 8}, 230 ${
                  170 - i * 7
                }, 520 ${70 + i * 4}`}
                stroke="white"
                strokeWidth="1.2"
              />
            ))}
          </svg>

          <div
            style={{
              position: "absolute",
              top: 42,
              left: "50%",
              transform: "translateX(-50%)",
              padding: "12px 40px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.28)",
              backgroundColor: "rgba(255,255,255,0.10)",
              color: "#f5efff",
              fontSize: 25,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            Pre-approved Limit
          </div>

          <div
            style={{
              position: "absolute",
              top: 128,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: SERIF_FONT,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -1,
              color: "#ffffff",
              lineHeight: 1,
              textShadow: "0 4px 18px rgba(0,0,0,0.18)",
            }}
          >
            {amountText}
          </div>

          <div
            style={{
              position: "absolute",
              bottom: 50,
              left: 0,
              right: 0,
              textAlign: "center",
              color: "#efe8ff",
              fontSize: 30,
              fontWeight: 400,
            }}
          >
            Pre-approved loan amount
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            bottom: 58,
            display: "flex",
            alignItems: "center",
          }}
        >
          <FeatureItem type="bolt" line1="Quick" line2="Disbursal" />

          <div
            style={{
              width: 1,
              height: 112,
              backgroundColor: "rgba(76, 29, 149, 0.16)",
            }}
          />

          <FeatureItem type="shield" line1="Secure &" line2="Trusted" />

          <div
            style={{
              width: 1,
              height: 112,
              backgroundColor: "rgba(76, 29, 149, 0.16)",
            }}
          />

          <FeatureItem
            type="percent"
            line1="Competitive"
            line2="Interest Rates"
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 82,
          right: 82,
          bottom: 110,
          height: 104,
          borderRadius: 32,
          background:
            "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 45%, #4c1d95 100%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          fontWeight: 800,
          letterSpacing: 0.3,
          boxShadow:
            "0 20px 42px rgba(76, 29, 149, 0.32), inset 0 1px 0 rgba(255,255,255,0.25)",
          opacity: entrance,
          transform: `translateY(${lift}px)`,
        }}
      >
        Continue

        <div
          style={{
            position: "absolute",
            right: 46,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 52,
            fontWeight: 300,
          }}
        >
          -&gt;
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 25,
          color: "#5b21b6",
          fontWeight: 400,
          opacity: entrance,
        }}
      >
        Learn more about your offer
      </div>
    </Shell>
  );
};

// -- Scene 2: Selector --
const Selector = ({ offer }: { offer: LoanOfferData }) => {
  const frame = useCurrentFrame();
  const entrance = Math.min(frame / 20, 1);
  const selected = getSelectedRow(offer);

  return (
    <Shell>
      <div style={{ padding: "60px 40px", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, opacity: entrance }}>
          <div>
          </div>
          {/* Mock 3D Wallet Graphic */}
          <div style={{ position: 'relative', width: 220, height: 220, right: -20, top: -20 }}>
            {/* Soft background glow */}
            <div style={{ position: 'absolute', inset: 20, background: '#a855f7', filter: 'blur(30px)', opacity: 0.3 }} />
            {/* Wallet body */}
            <div style={{ position: 'absolute', top: 60, right: 20, width: 160, height: 120, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', borderRadius: 24, transform: 'rotate(-5deg)', boxShadow: '0 20px 40px rgba(124,58,237,0.3)', border: '2px solid #c084fc' }} />
            {/* Wallet flap */}
            <div style={{ position: 'absolute', top: 50, right: 20, width: 160, height: 60, background: 'linear-gradient(135deg, #d8b4fe, #a855f7)', borderRadius: '24px 24px 12px 12px', transform: 'rotate(-5deg)', borderBottom: '2px solid #c084fc' }} />
            {/* Cash */}
            <div style={{ position: 'absolute', top: 10, right: 40, width: 100, height: 120, background: '#fff', borderRadius: 12, transform: 'rotate(5deg)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 50, color: '#d8b4fe', fontWeight: 900 }}>₹</div>
            </div>
            {/* Percentage coin */}
            <div style={{ position: 'absolute', bottom: 30, right: 0, width: 70, height: 70, background: 'linear-gradient(135deg, #c084fc, #9333ea)', borderRadius: '50%', border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 32, fontWeight: 900, transform: 'rotate(10deg)', boxShadow: '0 10px 20px rgba(124,58,237,0.4)' }}>%</div>
          </div>
        </div>






      </div>
    </Shell>
  );
};

// -- Scene 3: Confirmed --
const Confirmed = ({ offer, contactDetails }: { offer: LoanOfferData, contactDetails: string }) => {
  const frame = useCurrentFrame();
  const selected = getSelectedRow(offer);
  const phone = safeText(offer.cta_phone_number, contactDetails);
  const entrance = Math.min(frame / 20, 1);

  return (
    <Shell hideGrid>
      <div style={{ padding: "80px 40px", height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>



      </div>
    </Shell>
  );
};

export const LoanOfferInteractiveTemplate = ({
  customerName = "",
  contactDetails = "1800-555-999",
  loanOffer = {},
  stepBoundaries = [324, 660],
  interactiveBackgroundColor,
  interactiveCtaColor,
}: LoanOfferInteractiveTemplateProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const offer = {
    max_loan_amount: "500000",
    max_tenure: "60",
    max_emi: "2250",
    month_12_loan_amount: "100000",
    month_24_loan_amount: "200000",
    month_36_loan_amount: "300000",
    month_48_loan_amount: "400000",
    month_60_loan_amount: "500000",
    ...loanOffer,
  };

  const { introEnd, selectorEnd } = resolveSceneBoundaries(
    stepBoundaries,
    durationInFrames,
    fps,
  );

  if (frame < introEnd) {
    return <Intro offer={offer} customerName={customerName} />;
  }

  if (frame < selectorEnd) {
    return <Selector offer={offer} />;
  }

  return <Confirmed offer={offer} contactDetails={contactDetails} />;
};
