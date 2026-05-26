import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const AmountHighlight = ({
  label,
  amount,
  brandColor,
  accentColor,
  width = 760,
}: {
  label: string;
  amount: string;
  brandColor: string;
  accentColor: string;
  width?: number | string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 10, fps, config: {damping: 11, stiffness: 115}});
  const glow = interpolate(frame % 60, [0, 30, 60], [0.14, 0.34, 0.14]);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: `3px solid ${accentColor}55`,
        borderRadius: 44,
        boxShadow: `0 28px 90px rgba(15, 23, 42, 0.15), 0 0 80px ${accentColor}${Math.round(glow * 255).toString(16).padStart(2, '0')}`,
        padding: '48px 56px',
        transform: `scale(${interpolate(pop, [0, 1], [0.9, 1])})`,
        width,
      }}
    >
      <div style={{color: '#64748b', fontSize: 28, fontWeight: 900, letterSpacing: 1.8, textTransform: 'uppercase'}}>
        {label}
      </div>
      <div style={{color: brandColor, fontSize: 92, fontWeight: 950, letterSpacing: -3, lineHeight: 1.04, marginTop: 14}}>
        {amount}
      </div>
    </div>
  );
};
