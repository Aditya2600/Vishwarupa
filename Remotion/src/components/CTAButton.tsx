import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const CTAButton = ({
  label,
  variant = 'primary',
  delay = 0,
}: {
  label: string;
  variant?: 'primary' | 'secondary';
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: {damping: 16, stiffness: 120},
  });
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isPrimary = variant === 'primary';

  return (
    <div
      style={{
        alignItems: 'center',
        background: isPrimary
          ? 'linear-gradient(135deg, #0a9d58 0%, #25c978 100%)'
          : '#ffffff',
        border: isPrimary ? 'none' : '3px solid rgba(6, 63, 95, 0.2)',
        borderRadius: 8,
        boxShadow: isPrimary
          ? '0 24px 52px rgba(10, 157, 88, 0.28)'
          : '0 18px 42px rgba(6, 63, 95, 0.11)',
        color: isPrimary ? '#ffffff' : '#063f5f',
        display: 'flex',
        fontSize: 42,
        fontWeight: 900,
        justifyContent: 'center',
        letterSpacing: 0,
        lineHeight: 1.1,
        minHeight: 104,
        opacity,
        padding: '22px 34px',
        textAlign: 'center',
        transform: `scale(${0.94 + progress * 0.06})`,
        width: '100%',
      }}
    >
      {label}
    </div>
  );
};
