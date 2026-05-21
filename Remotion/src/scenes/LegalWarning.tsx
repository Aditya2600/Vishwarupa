import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {AnimatedHeading} from '../components/AnimatedHeading';
import {BrandBackground} from '../components/BrandBackground';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

const warnings = [
  'Recovery action may be initiated',
  'Legal notice may be issued',
  'Additional charges may apply',
];

const WarningCard = ({text, delay}: {text: string; delay: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: {damping: 18, stiffness: 100},
  });
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(140, 58, 0, 0.12)',
        borderRadius: 10,
        boxShadow: '0 10px 28px rgba(140, 58, 0, 0.04)',
        color: '#16354c',
        display: 'grid',
        gap: 20,
        gridTemplateColumns: '20px 1fr',
        minHeight: 96,
        opacity,
        padding: '16px 24px',
        transform: `translateY(${(1 - progress) * 28}px)`,
      }}
    >
      <span
        style={{
          background: '#fff',
          border: '3px solid #b45309',
          borderRadius: 999,
          display: 'block',
          height: 16,
          width: 16,
        }}
      />
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.25,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const LegalWarning = ({customer}: {customer: LoanReminderCustomer}) => {
  return (
    <BrandBackground variant="calm">
      <AbsoluteFill>
        {/* Title at top: 140 */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 74,
            right: 74,
          }}
        >
          <AnimatedHeading eyebrow="Possible escalation" tone="warning">
            Continued non-payment may lead to action
          </AnimatedHeading>
        </div>

        {/* Warning Cards Container */}
        <div
          style={{
            position: 'absolute',
            top: 520,
            left: 110, // Centered: (1080 - 860) / 2
            width: 860,
            background: 'rgba(252, 243, 235, 0.75)',
            border: '1.5px solid rgba(180, 83, 9, 0.16)',
            borderRadius: 16,
            boxShadow: '0 20px 48px rgba(180, 83, 9, 0.04)',
            padding: '24px',
            display: 'grid',
            gap: 16,
          }}
        >
          {warnings.map((warning, index) => (
            <WarningCard
              key={warning}
              delay={18 + index * 10}
              text={warning}
            />
          ))}
        </div>

        {/* Helper text at top: 1390 */}
        <div
          style={{
            position: 'absolute',
            top: 1390,
            left: 74,
            right: 74,
            color: '#607589',
            fontSize: 26,
            fontWeight: 750,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Please clear {customer.overdueAmount} to regularize your account.
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
