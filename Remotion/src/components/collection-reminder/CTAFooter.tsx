import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const CTAFooter = ({
  payNowLabel,
  callUsLabel,
  bankerPhone,
  brandColor,
  accentColor,
  showFromFrame,
}: {
  payNowLabel: string;
  callUsLabel: string;
  bankerPhone: string;
  brandColor: string;
  accentColor: string;
  showFromFrame: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [showFromFrame, showFromFrame + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [showFromFrame, showFromFrame + 18], [120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: 34,
        bottom: 46,
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.22)',
        left: 56,
        opacity,
        padding: 18,
        position: 'absolute',
        right: 56,
        transform: `translateY(${y}px)`,
        zIndex: 50,
      }}
    >
      <div style={{display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr'}}>
        <div
          style={{
            alignItems: 'center',
            background: `linear-gradient(135deg, ${brandColor}, #0b45b7)`,
            borderRadius: 26,
            color: '#ffffff',
            display: 'flex',
            fontSize: 34,
            fontWeight: 950,
            justifyContent: 'center',
            minHeight: 96,
          }}
        >
          {payNowLabel}
        </div>
        <div
          style={{
            alignItems: 'center',
            backgroundColor: `${accentColor}20`,
            border: `2px solid ${accentColor}`,
            borderRadius: 26,
            color: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            fontSize: 32,
            fontWeight: 950,
            justifyContent: 'center',
            minHeight: 96,
          }}
        >
          <span>{callUsLabel}</span>
          <span style={{color: '#64748b', fontSize: 18, fontWeight: 850, marginTop: 5}}>
            {bankerPhone}
          </span>
        </div>
      </div>
    </div>
  );
};
