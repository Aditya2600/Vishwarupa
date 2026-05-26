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

export const LastChance = ({customer}: {customer: LoanReminderCustomer}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 100},
  });
  const cardOpacity = interpolate(frame, [24, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

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
            Last chance to avoid further action
          </AnimatedHeading>
        </div>

        {/* Centered SceneImage */}
        <SceneImage
          src={customer.loanReminderAssets.lastChance}
          width={660}
          height={660}
          top={360}
          left={210} // Centered: (1080 - 660) / 2
          style={{
            transform: `translateY(${(1 - progress) * 38}px)`,
          }}
        />

        {/* Warning Box at top: 1080 */}
        <div
          style={{
            position: 'absolute',
            top: 1080,
            left: 110, // Centered: (1080 - 860) / 2
            width: 860,
            background: 'rgba(255, 255, 255, 0.94)',
            border: '1.5px solid rgba(180, 83, 9, 0.18)',
            borderLeft: '12px solid #b45309',
            borderRadius: 12,
            boxShadow: '0 24px 52px rgba(6, 63, 95, 0.1)',
            color: '#17374c',
            fontSize: 40,
            fontWeight: 850,
            lineHeight: 1.3,
            opacity: cardOpacity,
            padding: '34px 38px',
            textAlign: 'center',
          }}
        >
          A prompt payment of{' '}
          <span style={{color: '#b45309'}}>{customer.overdueAmount}</span> can
          help prevent account escalation.
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
