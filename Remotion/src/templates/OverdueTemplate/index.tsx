import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {OverdueTemplateProps} from './types';

const FONT_FAMILY =
  'Inter, Noto Sans, Avenir Next, SF Pro Display, Arial, sans-serif';

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const safeText = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const getStepIndex = (frame: number, boundaries: number[]) => {
  for (let i = 0; i < boundaries.length; i++) {
    const boundary = boundaries[i];
    if (Number.isFinite(boundary) && frame < boundary) {
      return i;
    }
  }
  return boundaries.length;
};

const STEP_COPY = [
  {
    eyebrow: 'Overdue alert',
    title: 'Your account has an overdue balance',
    subtitle: 'Please review the details below.',
  },
  {
    eyebrow: 'Important',
    title: 'Avoid account escalation',
    subtitle: 'Delays may impact your credit history and future eligibility.',
  },
  {
    eyebrow: 'Action required',
    title: 'Resolve the overdue amount promptly',
    subtitle: 'Clearing dues reduces additional charges and follow-ups.',
  },
  {
    eyebrow: 'Support',
    title: 'We can help with repayment options',
    subtitle: 'Contact our team to discuss a suitable plan.',
  },
  {
    eyebrow: 'Due summary',
    title: 'Minimum due and total payable',
    subtitle: 'Pay at least the minimum due to regularize your account.',
  },
  {
    eyebrow: 'Contact',
    title: 'Call us for assistance',
    subtitle: 'Our support team is available to help.',
  },
  {
    eyebrow: 'Thank you',
    title: 'Please take action today',
    subtitle: 'A timely response helps avoid further escalation.',
  },
];

export const OverdueTemplate: React.FC<OverdueTemplateProps> = ({
  enableNarration = false,
  narrationAudioPath,
  customerName,
  lan,
  clientName,
  contactDetails,
  payableAmount,
  minimumAmountDue,
  stepBoundaries,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const boundaries = Array.isArray(stepBoundaries) ? stepBoundaries : [];
  const stepIndex = getStepIndex(frame, boundaries);
  const step = STEP_COPY[clamp(stepIndex, 0, STEP_COPY.length - 1)];

  const fadeIn = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames],
    [1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  const opacity = fadeIn * fadeOut;

  const cardLift = interpolate(frame, [0, 26], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const values = {
    customerName: safeText(customerName, 'Customer'),
    lan: safeText(lan, 'N/A'),
    clientName: safeText(clientName, 'CredResolve'),
    contactDetails: safeText(contactDetails, '1800-555-999'),
    payableAmount: safeText(payableAmount, '₹0'),
    minimumAmountDue: safeText(minimumAmountDue, '₹0'),
  };

  const progress =
    boundaries.length > 0
      ? clamp(stepIndex / Math.max(1, boundaries.length), 0, 1)
      : clamp(frame / Math.max(1, durationInFrames), 0, 1);

  return (
    <AbsoluteFill
      style={{
        opacity,
        background:
          'radial-gradient(circle at 12% 10%, rgba(239, 68, 68, 0.18), transparent 35%), radial-gradient(circle at 86% 78%, rgba(59, 130, 246, 0.12), transparent 38%), linear-gradient(180deg, #070b14 0%, #090d16 65%, #0b1020 100%)',
        fontFamily: FONT_FAMILY,
        color: '#e2e8f0',
        overflow: 'hidden',
      }}
    >
      {enableNarration && narrationAudioPath ? (
        <Audio src={staticFile(narrationAudioPath)} />
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: 84,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 34,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          <div
            style={{
              height: 14,
              width: 14,
              borderRadius: 999,
              background: '#ef4444',
              boxShadow: '0 0 0 6px rgba(239, 68, 68, 0.18)',
            }}
          />
          <div style={{fontSize: 26, fontWeight: 900, letterSpacing: 0.2}}>
            {step.eyebrow}
          </div>
          <div style={{marginLeft: 'auto', fontSize: 22, color: '#94a3b8'}}>
            {values.clientName}
          </div>
        </div>

        <div style={{maxWidth: 980}}>
          <div style={{fontSize: 84, fontWeight: 950, lineHeight: 0.98}}>
            {step.title}
          </div>
          <div
            style={{
              marginTop: 22,
              fontSize: 34,
              color: '#cbd5e1',
              lineHeight: 1.25,
              fontWeight: 650,
            }}
          >
            {step.subtitle}
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            width: '100%',
            height: 14,
            borderRadius: 999,
            background: 'rgba(148, 163, 184, 0.18)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${Math.round(progress * 100)}%`,
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 55%, #38bdf8 100%)',
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 22,
            marginTop: 22,
            transform: `translateY(${cardLift}px)`,
          }}
        >
          {[
            ['Customer', values.customerName],
            ['Account', values.lan],
            ['Total payable', values.payableAmount],
            ['Minimum due', values.minimumAmountDue],
            ['Contact', values.contactDetails],
            ['Status', 'Overdue'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: 26,
                padding: '22px 24px',
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(148, 163, 184, 0.16)',
                boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
              }}
            >
              <div style={{fontSize: 20, fontWeight: 900, color: '#94a3b8'}}>
                {label}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 34,
                  fontWeight: 950,
                  lineHeight: 1.05,
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        <div style={{marginTop: 'auto', display: 'flex', gap: 18}}>
          {[
            {label: 'Pay now', primary: true},
            {label: 'Talk to agent', primary: false},
          ].map((cta) => (
            <div
              key={cta.label}
              style={{
                height: 86,
                minWidth: cta.primary ? 260 : 320,
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 950,
                background: cta.primary
                  ? 'linear-gradient(90deg, #ef4444, #f97316)'
                  : 'rgba(148, 163, 184, 0.14)',
                color: cta.primary ? '#0b1020' : '#e2e8f0',
                border: cta.primary ? 'none' : '1px solid rgba(148, 163, 184, 0.22)',
              }}
            >
              {cta.label}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

