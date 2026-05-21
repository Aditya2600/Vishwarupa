import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { LoanOfferData, LoanOfferInteractiveTemplateProps } from "./types";

const FONT_FAMILY =
  "Inter, Poppins, Avenir Next, SF Pro Display, Arial, sans-serif";
const INTRO_DISPLAY_FONT = "Playfair Display, Georgia, Times New Roman, serif";
const INTRO_BRAND_FONT =
  "Montserrat, Poppins, Avenir Next, SF Pro Display, Arial, sans-serif";
const INTRO_BODY_FONT =
  "Manrope, Inter, Poppins, Avenir Next, SF Pro Display, Arial, sans-serif";

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
  const rawIntro = Number.isFinite(stepBoundaries[0])
    ? stepBoundaries[0]
    : introFallback;
  const rawSelector = Number.isFinite(stepBoundaries[1])
    ? stepBoundaries[1]
    : selectorFallback;
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

const safeText = (value: unknown, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
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
  return `₹ ${numeric.toLocaleString("en-IN")}`;
};

const isAvailable = (value: unknown) => {
  const cleaned = safeText(value, "").toLowerCase();
  return Boolean(cleaned && cleaned !== "na" && cleaned !== "null");
};

const buildRows = (offer: LoanOfferData) => {
  const tenures = ["24", "30", "36", "42", "48", "60"];
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
      amount: offer.max_loan_amount || "105000",
      emi: offer.max_emi || "3398",
    },
  ];
};

const getSelectedRow = (offer: LoanOfferData) => {
  const rows = buildRows(offer);
  const maxAmount = safeText(
    offer.max_loan_amount,
    safeText(rows[rows.length - 1]?.amount, "105000"),
  );
  const maxTenure = safeText(
    offer.max_tenure,
    safeText(rows[rows.length - 1]?.tenure, "60"),
  );
  return (
    rows.find(
      (row) =>
        safeText(row.amount, "") === maxAmount &&
        safeText(row.tenure, "") === maxTenure,
    ) ||
    rows.find((row) => safeText(row.amount, "") === maxAmount) ||
    rows[rows.length - 1]
  );
};

const Shell = ({ children }: { children: React.ReactNode }) => (
  <AbsoluteFill
    style={{
      background:
        "linear-gradient(180deg, #ffffff 0%, #f6eff8 50%, #eddcf2 100%)",
      color: "#1a062f",
      fontFamily: FONT_FAMILY,
      overflow: "hidden",
    }}
  >
    {/* SVG Grid Overlay */}
    <div style={{ position: "absolute", inset: 0, opacity: 0.04 }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#702082"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>

    {/* Soft glowing ambient blobs */}
    <div
      style={{
        position: "absolute",
        top: "-10%",
        left: "-20%",
        width: "80%",
        height: "40%",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(142, 43, 175, 0.22) 0%, transparent 70%)",
        filter: "blur(40px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: "10%",
        right: "-25%",
        width: "90%",
        height: "45%",
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(74, 16, 92, 0.18) 0%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />

    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 10% 8%, rgba(112, 32, 130, 0.12), transparent 34%), radial-gradient(circle at 90% 76%, rgba(74, 16, 92, 0.14), transparent 30%)",
      }}
    />
    {children}
  </AbsoluteFill>
);

const Intro = ({
  clientName,
}: {
  customerName: string;
  clientName: string;
  offer: LoanOfferData;
}) => {
  const frame = useCurrentFrame();
  const introFade = Math.min(frame / 28, 1);
  const cardLift = Math.max(18 - frame * 0.7, 0);
  const loanLift = Math.max(28 - frame * 0.85, 0);

  return (
    <Shell>
      <div
        style={{
          padding: "110px 80px 0",
          height: "100%",
          position: "relative",
          fontFamily: INTRO_BODY_FONT,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 70,
            width: 150,
            height: 150,
            borderRadius: "50%",
            border: "2px solid rgba(112, 32, 130, 0.16)",
            opacity: 0.75,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 102,
            left: 105,
            width: 82,
            height: 82,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, rgba(112, 32, 130, 0.12), rgba(168, 85, 247, 0.03))",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 88,
            right: 96,
            width: 118,
            height: 118,
            borderRadius: 28,
            transform: `rotate(${12 + frame * 0.05}deg)`,
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(112, 32, 130, 0.08))",
            border: "1px solid rgba(112, 32, 130, 0.12)",
            boxShadow: "0 18px 38px rgba(74, 16, 92, 0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 92,
            bottom: 290,
            width: 190,
            height: 190,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(112, 32, 130, 0.05) 46%, transparent 70%)",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 92,
            bottom: 360,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#a855f7",
            boxShadow:
              "120px -42px 0 rgba(112, 32, 130, 0.28), 250px 12px 0 rgba(168, 85, 247, 0.32), 420px -54px 0 rgba(112, 32, 130, 0.24), 625px 34px 0 rgba(168, 85, 247, 0.26)",
          }}
        />

        {/* Brand Header */}
        <div
          style={{
            fontFamily: INTRO_BRAND_FONT,
            fontSize: 44,
            fontWeight: 900,
            color: "#702082",
            textAlign: "center",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            textShadow: "0 4px 12px rgba(112, 32, 130, 0.05)",
            opacity: introFade,
            transform: `translateY(${Math.max(12 - frame * 0.55, 0)}px)`,
          }}
        >
          {clientName}
        </div>
        <div
          style={{
            margin: "18px auto 0",
            width: 160,
            height: 4,
            borderRadius: 99,
            background:
              "linear-gradient(90deg, transparent, rgba(112, 32, 130, 0.55), transparent)",
            opacity: introFade,
          }}
        />

        {/* Congratulations Card Frame (Blank area for Applicant Name overlay) */}
        <div
          style={{
            position: "absolute",
            top: "15.2%",
            left: "5%",
            width: "90%",
            height: "28%",
            borderRadius: 44,
            background:
              "linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 255, 255, 0.78) 56%, rgba(246, 239, 248, 0.82) 100%)",
            border: "1px solid rgba(112, 32, 130, 0.12)",
            boxShadow:
              "0 28px 58px -14px rgba(74, 16, 92, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(20px)",
            padding: "40px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            opacity: introFade,
            transform: `translateY(${cardLift}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(115deg, transparent 0%, rgba(255, 255, 255, 0.68) 38%, transparent 62%)",
              transform: `translateX(${-62 + frame * 1.1}%)`,
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 30,
              width: 70,
              height: 70,
              borderRadius: "50%",
              border: "1px solid rgba(112, 32, 130, 0.12)",
            }}
          />
          {/* Decorative Success SVG Badge */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #a855f7 0%, #702082 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
              boxShadow: "0 10px 20px rgba(112, 32, 130, 0.25)",
              zIndex: 1,
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div
            style={{
              fontFamily: INTRO_DISPLAY_FONT,
              fontSize: 48,
              fontWeight: 900,
              background: "linear-gradient(135deg, #702082 0%, #4a105c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.01em",
              zIndex: 1,
              textShadow: "0 16px 36px rgba(112, 32, 130, 0.12)",
            }}
          >
            Congratulations
          </div>
        </div>

        {/* Pre-approved Loan Card Frame (Blank area for amount overlay) */}
        <div
          style={{
            position: "absolute",
            top: "48%",
            left: "10%",
            width: "80%",
            height: "24%",
            borderRadius: 44,
            background:
              "linear-gradient(135deg, #3d0a4e 0%, #702082 60%, #8c25aa 100%)",
            padding: "40px 40px",
            textAlign: "center",
            boxShadow:
              "0 30px 60px rgba(74, 16, 92, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            opacity: introFade,
            transform: `translateY(${loanLift}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -58,
              top: -70,
              width: 210,
              height: 210,
              borderRadius: "50%",
              border: "22px solid rgba(255, 255, 255, 0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -34,
              bottom: -52,
              fontSize: 190,
              fontWeight: 900,
              lineHeight: 1,
              color: "rgba(255, 255, 255, 0.05)",
              fontFamily: INTRO_BRAND_FONT,
            }}
          >
            ₹
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(120deg, rgba(255, 255, 255, 0.18), transparent 28%, transparent 72%, rgba(255, 255, 255, 0.12))",
            }}
          />
          {/* Limit Pill Header */}
          <div
            style={{
              fontFamily: INTRO_BRAND_FONT,
              display: "inline-flex",
              padding: "8px 18px",
              borderRadius: 99,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              fontSize: 16,
              fontWeight: 800,
              color: "#ebdcf0",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: 16,
              zIndex: 1,
            }}
          >
            Pre-approved Limit
          </div>

          <div
            style={{
              fontFamily: INTRO_BODY_FONT,
              fontSize: 28,
              fontWeight: 800,
              color: "#ffffff",
              opacity: 0.92,
              letterSpacing: "0.01em",
              zIndex: 1,
            }}
          >
            Pre-approved loan up to
          </div>
        </div>
      </div>
    </Shell>
  );
};

const Selector = ({
  customerName,
  offer,
}: {
  customerName: string;
  offer: LoanOfferData;
}) => {
  const frame = useCurrentFrame();
  const entrance = Math.min(frame / 24, 1);

  return (
    <Shell>
      <div
        style={{
          padding: "120px 80px 0",
          height: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 68,
            right: 72,
            width: 210,
            height: 210,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.2), rgba(112, 32, 130, 0.05) 54%, transparent 72%)",
            transform: `scale(${0.9 + entrance * 0.1})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 340,
            width: 118,
            height: 118,
            borderRadius: 30,
            transform: `rotate(${-14 + frame * 0.04}deg)`,
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(112, 32, 130, 0.08))",
            border: "1px solid rgba(112, 32, 130, 0.13)",
            boxShadow: "0 20px 42px rgba(74, 16, 92, 0.08)",
          }}
        />
        {/* Title & Subtitle */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 950,
            background: "linear-gradient(135deg, #702082 0%, #4a105c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
            opacity: entrance,
            transform: `translateY(${Math.max(16 - frame * 0.7, 0)}px)`,
          }}
        >
          Choose your loan offer
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            fontWeight: 800,
            color: "#7b6c86",
            overflowWrap: "anywhere",
            lineHeight: 1.2,
            opacity: entrance,
          }}
        >
          {customerName}, select amount and tenure
        </div>

        {/* Amount Pill Frame (Blank white pill) */}
        <div
          style={{
            position: "absolute",
            top: "23%",
            left: "25.7%",
            fontSize: 24,
            fontWeight: 800,
            color: "#7b6c86",
            letterSpacing: "-0.01em",
          }}
        >
          Select Amount
        </div>
        <div
          style={{
            position: "absolute",
            top: "28.62%",
            left: "25.7%",
            width: "58.6%",
            height: "5.2%",
            background: "#ffffff",
            borderRadius: 999,
            border: "1px solid rgba(112, 32, 130, 0.15)",
            boxShadow:
              "0 14px 30px rgba(74, 16, 92, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
          }}
        />

        {/* Tenure Pill Frame (Blank white pill) */}
        <div
          style={{
            position: "absolute",
            top: "43.8%",
            left: "25.7%",
            fontSize: 24,
            fontWeight: 800,
            color: "#7b6c86",
            letterSpacing: "-0.01em",
          }}
        >
          Select Tenure
        </div>
        <div
          style={{
            position: "absolute",
            top: "49.4%",
            left: "25.7%",
            width: "58.6%",
            height: "5.2%",
            background: "#ffffff",
            borderRadius: 999,
            border: "1px solid rgba(112, 32, 130, 0.15)",
            boxShadow:
              "0 14px 30px rgba(74, 16, 92, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95)",
          }}
        />

        {/* Summary Card background and static labels */}
        <div
          style={{
            position: "absolute",
            top: "61%",
            left: "10%",
            width: "80%",
            height: "24%",
            background: "rgba(255, 255, 255, 0.8)",
            borderRadius: 44,
            border: "1px solid rgba(112, 32, 130, 0.12)",
            boxShadow:
              "0 24px 54px rgba(74, 16, 92, 0.11), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
            overflow: "hidden",
            backdropFilter: "blur(18px)",
          }}
        >
          {/* Left accent bar */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 12,
              background: "linear-gradient(180deg, #702082 0%, #4a105c 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -46,
              bottom: -72,
              width: 190,
              height: 190,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(112, 32, 130, 0.1), transparent 66%)",
            }}
          />
        </div>

        {/* Row dividers */}
        <div
          style={{
            position: "absolute",
            top: "70.5%",
            left: "15%",
            right: "15%",
            height: 1,
            background: "rgba(112, 32, 130, 0.1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "76.3%",
            left: "15%",
            right: "15%",
            height: 1,
            background: "rgba(112, 32, 130, 0.1)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: "65.908%",
            left: "17%",
            height: "5.5%",
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#7b6c86",
          }}
        >
          Amount
        </div>
        <div
          style={{
            position: "absolute",
            top: "71.647%",
            left: "17%",
            height: "5.5%",
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#7b6c86",
          }}
        >
          Tenure
        </div>
        <div
          style={{
            position: "absolute",
            top: "78.082%",
            left: "17%",
            height: "5.5%",
            display: "flex",
            alignItems: "center",
            fontSize: 24,
            fontWeight: 800,
            color: "#7b6c86",
          }}
        >
          EMI
        </div>
      </div>
    </Shell>
  );
};

const Confirmed = ({
  offer,
  contactDetails,
}: {
  offer: LoanOfferData;
  contactDetails: string;
}) => {
  const frame = useCurrentFrame();
  const selected = getSelectedRow(offer);
  const phone = safeText(offer.cta_phone_number, contactDetails);
  const entrance = Math.min(frame / 24, 1);

  return (
    <Shell>
      <div
        style={{
          height: "100%",
          padding: "120px 80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 126,
            left: 84,
            width: 180,
            height: 180,
            borderRadius: "50%",
            border: "2px solid rgba(21, 128, 61, 0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 74,
            bottom: 178,
            width: 150,
            height: 150,
            borderRadius: 34,
            transform: `rotate(${10 + frame * 0.03}deg)`,
            background:
              "linear-gradient(135deg, rgba(22, 163, 74, 0.13), rgba(255, 255, 255, 0.55))",
            border: "1px solid rgba(21, 128, 61, 0.12)",
          }}
        />
        <div
          style={{
            borderRadius: 50,
            background:
              "linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.78))",
            border: "1px solid rgba(112, 32, 130, 0.12)",
            boxShadow:
              "0 34px 90px rgba(74, 16, 92, 0.17), inset 0 1px 0 rgba(255, 255, 255, 0.92)",
            backdropFilter: "blur(20px)",
            padding: "60px 50px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            opacity: entrance,
            transform: `translateY(${Math.max(22 - frame * 0.8, 0)}px)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(120deg, rgba(34, 197, 94, 0.08), transparent 38%, rgba(112, 32, 130, 0.07))",
            }}
          />
          {/* Animated Green Checkmark Badge */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
              boxShadow: "0 12px 25px rgba(21, 128, 61, 0.3)",
              zIndex: 1,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div
            style={{
              fontSize: 44,
              fontWeight: 950,
              background: "linear-gradient(135deg, #702082 0%, #4a105c 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
              zIndex: 1,
            }}
          >
            Offer confirmed
          </div>

          <div
            style={{
              marginTop: 20,
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.2,
              color: "#4a3f54",
              zIndex: 1,
            }}
          >
            Our team will help you complete the next step
          </div>

          <div
            style={{
              marginTop: 40,
              width: "100%",
              borderRadius: 28,
              backgroundColor: "rgba(112, 32, 130, 0.05)",
              border: "1px solid rgba(112, 32, 130, 0.1)",
              padding: "24px 24px",
              fontSize: 32,
              fontWeight: 900,
              color: "#702082",
              zIndex: 1,
            }}
          >
            {formatIndian(selected.amount)} · {safeText(selected.tenure, "60")}{" "}
            Months
          </div>

          {/* CTA Phone number */}
          <div
            style={{
              marginTop: 30,
              width: "100%",
              borderRadius: 999,
              background: "linear-gradient(135deg, #15803d 0%, #166534 100%)",
              color: "#ffffff",
              padding: "24px 28px",
              fontSize: 32,
              fontWeight: 950,
              overflowWrap: "anywhere",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 20px rgba(22, 101, 52, 0.2)",
              zIndex: 1,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ marginRight: 12 }}
            >
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.57a1 1 0 0 0-1.01.24l-2.2 2.2a15.045 15.045 0 0 1-6.59-6.59l2.2-2.2a1 1 0 0 0 .24-1.01 11.36 11.36 0 0 1-.57-3.53c0-.55-.45-1-1-1H4.01c-.55 0-1 .45-1 1C3.01 14.75 11.25 23 21.01 23c.55 0 1-.45 1-1v-5.62c0-.55-.45-1-1-1z" />
            </svg>
            {phone}
          </div>
        </div>
      </div>
    </Shell>
  );
};

export const LoanOfferInteractiveTemplate = ({
  customerName = "Customer",
  clientName = "Finance Partner",
  contactDetails = "1800-555-999",
  loanOffer = {},
  stepBoundaries = [324, 660],
}: LoanOfferInteractiveTemplateProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const offer = {
    max_loan_amount: "105000",
    max_tenure: "60",
    max_emi: "3398",
    month_24_loan_amount: "75000",
    month_30_loan_amount: "90000",
    month_36_loan_amount: "105000",
    month_42_loan_amount: "NA",
    month_48_loan_amount: "NA",
    month_60_loan_amount: "105000",
    ...loanOffer,
  };

  const { introEnd, selectorEnd } = resolveSceneBoundaries(
    stepBoundaries,
    durationInFrames,
    fps,
  );

  if (frame < introEnd) {
    return (
      <Intro
        customerName={safeText(customerName, "Customer")}
        clientName={safeText(clientName, "Finance Partner")}
        offer={offer}
      />
    );
  }

  if (frame < selectorEnd) {
    return (
      <Selector
        customerName={safeText(customerName, "Customer")}
        offer={offer}
      />
    );
  }

  return (
    <Confirmed
      offer={offer}
      contactDetails={safeText(contactDetails, "1800-555-999")}
    />
  );
};
