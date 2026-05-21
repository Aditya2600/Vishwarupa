import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {BrandBackground} from '../components/BrandBackground';
import {Logo} from '../components/Logo';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

export const Outro = ({customer}: {customer: LoanReminderCustomer}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [66, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <BrandBackground>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
          padding: 96,
        }}
      >
        <Logo
          lenderName={customer.lenderName}
          size={480}
          src={customer.loanReminderAssets.logo}
        />
        <div
          style={{
            color: '#0b466c',
            fontSize: 62,
            fontWeight: 950,
            lineHeight: 1.08,
            marginTop: 34,
            textAlign: 'center',
          }}
        >
          Thank you
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
