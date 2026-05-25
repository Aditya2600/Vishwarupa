import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { LoanOfferData, LoanOfferInteractiveTemplateProps } from "./types";

const FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF_FONT = "Playfair Display, Georgia, Times New Roman, serif";

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
const Shell = ({ children, hideGrid = false }: { children: React.ReactNode, hideGrid?: boolean }) => (
  <AbsoluteFill
    style={{
      backgroundColor: "#f5eefc",
      color: "#1a062f",
      fontFamily: FONT_FAMILY,
      overflow: "hidden",
    }}
  >
    {!hideGrid && (
      <div style={{ position: "absolute", inset: 0, opacity: 0.15 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d5bdf2" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
    )}
    <div
      style={{
        position: "absolute",
        top: "-10%", left: "-20%", width: "80%", height: "40%",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(142, 43, 175, 0.1) 0%, transparent 70%)",
        filter: "blur(40px)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: "10%", right: "-25%", width: "90%", height: "45%",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(74, 16, 92, 0.08) 0%, transparent 70%)",
        filter: "blur(50px)",
      }}
    />
    {children}
  </AbsoluteFill>
);

// -- Confetti Decoration --
const Confetti = ({ opacity }: { opacity: number }) => (
  <div style={{ position: 'absolute', inset: 0, opacity, pointerEvents: 'none' }}>
    {/* Just a few mock confetti shapes based on images */}
    <div style={{ position: 'absolute', top: '15%', left: '20%', width: 10, height: 10, backgroundColor: '#a855f7', transform: 'rotate(25deg)' }} />
    <div style={{ position: 'absolute', top: '25%', left: '80%', width: 8, height: 8, backgroundColor: '#22c55e', borderRadius: '50%' }} />
    <div style={{ position: 'absolute', top: '10%', left: '70%', width: 12, height: 6, backgroundColor: '#facc15', transform: 'rotate(-45deg)' }} />
    <div style={{ position: 'absolute', top: '30%', left: '10%', width: 6, height: 6, backgroundColor: '#3b82f6', borderRadius: '50%' }} />
    <div style={{ position: 'absolute', top: '40%', right: '15%', width: 10, height: 10, backgroundColor: '#a855f7', transform: 'rotate(60deg)' }} />
  </div>
);

// -- Scene 1: Intro --
const Intro = ({ offer, customerName }: { offer: LoanOfferData; customerName?: string }) => {
  const frame = useCurrentFrame();
  const introFade = Math.min(frame / 20, 1);
  const cardLift = Math.max(20 - frame * 0.8, 0);

  return (
    <Shell>
      <div style={{ padding: "80px 40px 0", height: "100%", position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Header Logo Area */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, opacity: introFade, transform: `translateY(${Math.max(10 - frame * 0.5, 0)}px)` }}>
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #a855f7, #702082)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 24, marginRight: 16 }}>
            FP
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1a062f' }}>Finance Partner</div>
            <div style={{ fontSize: 16, color: '#702082', fontWeight: 500 }}>Your Dreams, Our Commitment</div>
          </div>
        </div>

        {/* Main Card */}
        <div style={{
          width: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 40,
          padding: '50px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 20px 50px rgba(112, 32, 130, 0.08)',
          border: '1px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(10px)',
          opacity: introFade,
          transform: `translateY(${cardLift}px)`,
          position: 'relative'
        }}>

          <Confetti opacity={introFade} />

          {/* Green Check */}
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(22, 163, 74, 0.2)', marginBottom: 24, zIndex: 1 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>

          <div style={{ fontFamily: SERIF_FONT, fontSize: 56, fontWeight: 700, color: '#1e1b4b', marginBottom: 12, zIndex: 1 }}>
            Congratulations{customerName ? `, ${customerName.split(' ')[0]}` : ''}!
          </div>

          <div style={{ fontSize: 24, color: '#4b5563', fontWeight: 500, marginBottom: 30, zIndex: 1 }}>
            Your loan has been pre-approved
          </div>

          {/* Sparkle Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 30 }}><path d="M12 2l2.4 7.6 7.6 2.4-7.6 2.4-2.4 7.6-2.4-7.6-7.6-2.4 7.6-2.4z" /></svg>

          <div style={{ fontSize: 20, color: '#6b7280', textAlign: 'center', lineHeight: 1.5, marginBottom: 40, maxWidth: '80%', zIndex: 1 }}>
            We're excited to help you take the next step towards your financial goals.
          </div>

          {/* Purple Gradient Limit Card */}
          <div style={{
            width: '100%',
            background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
            borderRadius: 24,
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 40,
            boxShadow: '0 15px 30px rgba(76, 29, 149, 0.3)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, border: '2px solid rgba(255,255,255,0.1)', borderRadius: '50%' }} />

            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '8px 20px', fontSize: 16, color: '#e9d5ff', fontWeight: 600, marginBottom: 16, border: '1px solid rgba(255,255,255,0.2)' }}>
              Pre-approved Limit
            </div>
            <div style={{ fontFamily: SERIF_FONT, fontSize: 72, color: '#ffffff', fontWeight: 700, marginBottom: 8, zIndex: 1 }}>
              {formatIndian(offer.max_loan_amount || '500000')}
            </div>
            <div style={{ fontSize: 18, color: '#ddd6fe', fontWeight: 500, zIndex: 1 }}>
              Pre-approved loan amount
            </div>
          </div>

          {/* Features Row */}
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 600, textAlign: 'center' }}>Quick<br />Disbursal</div>
            </div>
            <div style={{ width: 1, backgroundColor: '#e5e7eb', height: 60, alignSelf: 'center' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
              </div>
              <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 600, textAlign: 'center' }}>Secure &<br />Trusted</div>
            </div>
            <div style={{ width: 1, backgroundColor: '#e5e7eb', height: 60, alignSelf: 'center' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', marginBottom: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"></line><circle cx="6.5" cy="6.5" r="2.5"></circle><circle cx="17.5" cy="17.5" r="2.5"></circle></svg>
              </div>
              <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 600, textAlign: 'center' }}>Competitive<br />Interest Rates</div>
            </div>
          </div>
        </div>



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
