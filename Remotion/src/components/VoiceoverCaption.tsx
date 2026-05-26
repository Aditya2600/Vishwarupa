import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const VoiceoverCaption = ({text}: {text: string}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 14, 9999], [0, 1, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, 18], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        bottom: 72,
        display: 'flex',
        justifyContent: 'center',
        left: 64,
        opacity,
        pointerEvents: 'none',
        position: 'absolute',
        right: 64,
        transform: `translateY(${y}px)`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: 'rgba(5, 28, 48, 0.84)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 8,
          boxShadow: '0 18px 46px rgba(5, 28, 48, 0.26)',
          color: '#ffffff',
          fontSize: 32,
          fontWeight: 750,
          lineHeight: 1.28,
          maxWidth: 920,
          padding: '22px 28px',
          textAlign: 'center',
          width: '100%',
        }}
      >
        {text}
      </div>
    </div>
  );
};
