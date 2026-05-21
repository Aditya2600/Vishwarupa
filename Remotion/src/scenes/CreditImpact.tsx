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
import {SceneImage} from '../components/SceneImage';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

const impactItems = [
  'Permanent negative impact on credit score',
  'Loan approvals may be denied',
  'Credit card access may be impacted',
];

const ImpactCard = ({
  text,
  delay,
}: {
  text: string;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: {damping: 18, stiffness: 105},
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
        border: '1px solid rgba(10, 157, 88, 0.08)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(10, 157, 88, 0.04)',
        display: 'grid',
        gap: 20,
        gridTemplateColumns: '20px 1fr',
        minHeight: 96,
        opacity,
        padding: '16px 24px',
        transform: `translateX(${(1 - progress) * 34}px)`,
      }}
    >
      <span
        style={{
          background: '#0a9d58',
          borderRadius: 999,
          display: 'block',
          height: 16,
          width: 16,
        }}
      />
      <div
        style={{
          color: '#12334a',
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

export const CreditImpact = ({customer}: {customer: LoanReminderCustomer}) => {
  const frame = useCurrentFrame();
  const illustrationOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <BrandBackground>
      <AbsoluteFill>
        {/* Top Label & Title at y ≈ 140 */}
        <div
          style={{
            position: 'absolute',
            top: 140,
            left: 74,
            right: 74,
          }}
        >
          <AnimatedHeading eyebrow="Credit impact">
            Delayed payment can affect future borrowing
          </AnimatedHeading>
        </div>

        {/* Center/Right Illustration using SceneImage at top: 360, width: 480 */}
        <SceneImage
          src={customer.loanReminderAssets.creditImpact}
          width={480}
          height={400}
          top={360}
          left={300} // Centered: (1080 - 480) / 2
          style={{
            opacity: illustrationOpacity,
          }}
        />

        {/* Lower Half Content Card at top: 840, width: 860 */}
        <div
          style={{
            position: 'absolute',
            top: 840,
            left: 110, // Centered: (1080 - 860) / 2
            width: 860,
            background: 'rgba(235, 250, 242, 0.75)',
            border: '1.5px solid rgba(10, 157, 88, 0.16)',
            borderRadius: 16,
            boxShadow: '0 20px 48px rgba(10, 157, 88, 0.05)',
            padding: '24px',
            display: 'grid',
            gap: 16,
          }}
        >
          {impactItems.map((item, index) => (
            <ImpactCard
              key={item}
              delay={20 + index * 10}
              text={item}
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
          Please review the overdue amount for {customer.loanType}.
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
