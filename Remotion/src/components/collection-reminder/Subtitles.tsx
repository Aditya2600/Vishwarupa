import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const Subtitles = ({text}: {text: string}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [8, 22], [22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        bottom: 188,
        display: 'flex',
        justifyContent: 'center',
        left: 56,
        opacity,
        pointerEvents: 'none',
        position: 'absolute',
        right: 56,
        transform: `translateY(${y}px)`,
        zIndex: 40,
      }}
    >
      <div
        style={{
          background: 'rgba(8, 22, 46, 0.86)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 22,
          boxShadow: '0 18px 44px rgba(15, 23, 42, 0.22)',
          color: '#ffffff',
          fontSize: 28,
          fontWeight: 800,
          lineHeight: 1.25,
          padding: '18px 24px',
          textAlign: 'center',
          width: '100%',
        }}
      >
        {text}
      </div>
    </div>
  );
};
