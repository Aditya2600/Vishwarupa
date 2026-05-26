import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {BrandBackground} from '../components/BrandBackground';
import {Logo} from '../components/Logo';
import type {LoanReminderCustomer} from '../data/sampleCustomer';

export const Intro = ({customer}: {customer: LoanReminderCustomer}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [96, 120], [1, 0], {
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
          size={520}
          src={customer.loanReminderAssets.logo}
        />
        <div
          style={{
            color: '#466579',
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.25,
            marginTop: 28,
            textAlign: 'center',
          }}
        >
          Loan account reminder
        </div>
      </AbsoluteFill>
    </BrandBackground>
  );
};
