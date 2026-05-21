import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const InfoBox = ({
  label,
  value,
  highlight = false,
  delay = 0,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  delay?: number;
}) => {
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
        background: highlight
          ? 'linear-gradient(135deg, #0a9d58 0%, #23c879 100%)'
          : 'rgba(255, 255, 255, 0.92)',
        border: highlight ? 'none' : '1px solid rgba(6, 63, 95, 0.13)',
        borderRadius: 8,
        boxShadow: highlight
          ? '0 22px 46px rgba(10, 157, 88, 0.24)'
          : '0 16px 38px rgba(6, 63, 95, 0.09)',
        opacity,
        padding: '20px 22px',
        transform: `translateY(${(1 - progress) * 24}px)`,
      }}
    >
      <div
        style={{
          color: highlight ? 'rgba(255, 255, 255, 0.82)' : '#5c7284',
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 0,
          lineHeight: 1.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: highlight ? '#ffffff' : '#0b1f35',
          fontSize: highlight ? 42 : 32,
          fontWeight: 900,
          lineHeight: 1.12,
          marginTop: 10,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </div>
    </div>
  );
};
