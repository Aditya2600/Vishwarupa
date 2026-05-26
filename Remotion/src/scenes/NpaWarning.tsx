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

export const NpaWarning = ({customer}: {customer: LoanReminderCustomer}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 95},
  });
  const imageY = interpolate(enter, [0, 1], [46, 0]);

  return (
    <BrandBackground variant="deep">
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
          <AnimatedHeading tone="warning">
            Your loan account is critically overdue
          </AnimatedHeading>
        </div>

        {/* Large centered scene illustration using SceneImage */}
        <SceneImage
          src={customer.loanReminderAssets.npaWarning}
          width={660}
          height={660}
          top={380}
          left={210} // Centered: (1080 - 660) / 2
          style={{
            transform: `translateY(${imageY}px)`,
          }}
        />

        {/* Warning Card at top: 1080 */}
        <div
          style={{
            position: 'absolute',
            top: 1080,
            left: 74,
            right: 74,
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1px solid rgba(180, 83, 9, 0.18)',
            borderLeft: '12px solid #0a9d58',
            borderRadius: 12,
            boxShadow: '0 22px 52px rgba(6, 63, 95, 0.1)',
            color: '#1e3a4f',
            fontSize: 40,
            fontWeight: 850,
            lineHeight: 1.25,
            padding: '30px 38px',
            textAlign: 'center',
          }}
        >
          It may be reported as NPA if dues remain unpaid
          <div
            style={{
              color: '#607589',
              fontSize: 26,
              fontWeight: 750,
              marginTop: 14,
            }}
          >
            Account: {customer.loanNumber}
          </div>
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
