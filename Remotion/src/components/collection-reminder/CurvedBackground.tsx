import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

const FONT_FAMILY =
  'Inter, Poppins, Avenir Next, SF Pro Display, Arial, sans-serif';

export const CurvedBackground = ({
  brandColor,
  accentColor,
  children,
}: {
  brandColor: string;
  accentColor: string;
  children: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 2250], [0, 48], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#f8fbff',
        color: '#0f172a',
        fontFamily: FONT_FAMILY,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${brandColor} 0%, #1d6be3 44%, #ffffff 44%, #ffffff 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -180,
          right: -180,
          top: 610,
          height: 540,
          backgroundColor: '#ffffff',
          borderRadius: '0 0 50% 50%',
          transform: 'rotate(-5deg)',
          transformOrigin: 'center top',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -220,
          top: 130 + drift,
          width: 680,
          height: 680,
          borderRadius: 999,
          background: `radial-gradient(circle, ${accentColor}44 0%, ${accentColor}12 44%, transparent 68%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -260,
          top: 1080 - drift,
          width: 620,
          height: 620,
          borderRadius: 999,
          background: `radial-gradient(circle, ${brandColor}1f 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 38%, rgba(248,251,255,0.92) 100%)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
