import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const AnimatedHeading = ({
  children,
  eyebrow,
  align = 'center',
  tone = 'default',
  delay = 0,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  align?: 'left' | 'center';
  tone?: 'default' | 'warning' | 'success';
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: {damping: 18, stiffness: 92},
  });
  const opacity = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const color =
    tone === 'warning' ? '#8c3a00' : tone === 'success' ? '#0a6f42' : '#08263e';

  return (
    <div
      style={{
        opacity,
        textAlign: align,
        transform: `translateY(${(1 - progress) * 30}px)`,
        width: '100%',
      }}
    >
      {eyebrow ? (
        <div
          style={{
            color: tone === 'warning' ? '#b45309' : '#0a9d58',
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 0,
            lineHeight: 1.2,
            marginBottom: 14,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <h1
        style={{
          color,
          fontSize: 72,
          fontWeight: 950,
          letterSpacing: 0,
          lineHeight: 1.05,
          margin: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {children}
      </h1>
    </div>
  );
};
