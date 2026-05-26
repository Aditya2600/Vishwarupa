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

export const FinancialBurden = ({
  customer,
}: {
  customer: LoanReminderCustomer;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 95},
  });
  const opacity = interpolate(frame, [20, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
          <AnimatedHeading tone="success">
            Avoid additional financial burden
          </AnimatedHeading>
        </div>

        {/* Centered Piggy-Bank Illustration using SceneImage */}
        <SceneImage
          src={customer.loanReminderAssets.financialBurden}
          width={660}
          height={660}
          top={360}
          left={210} // Centered: (1080 - 660) / 2
          style={{
            transform: `scale(${0.94 + progress * 0.06})`,
          }}
        />

        {/* Clear Overdue Card at top: 1080 */}
        <div
          style={{
            position: 'absolute',
            top: 1080,
            left: 110, // Centered: (1080 - 860) / 2
            width: 860,
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1.5px solid rgba(10, 157, 88, 0.16)',
            borderRadius: 16,
            boxShadow: '0 22px 52px rgba(6, 63, 95, 0.1)',
            color: '#17374c',
            fontSize: 40,
            fontWeight: 850,
            lineHeight: 1.25,
            opacity,
            padding: '34px 38px',
            textAlign: 'center',
          }}
        >
          Clear your overdue amount today
          <div
            style={{
              color: '#0a9d58',
              fontSize: 48,
              fontWeight: 950,
              marginTop: 14,
            }}
          >
            {customer.overdueAmount}
          </div>
        </div>

        {/* Helper footer at top: 1390 */}
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
          A prompt payment helps secure your financial wellness.
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
