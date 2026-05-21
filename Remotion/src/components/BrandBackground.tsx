import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

const FONT_FAMILY =
  'Inter, Noto Sans, Avenir Next, SF Pro Display, Arial, sans-serif';

export const BrandBackground = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'deep' | 'calm';
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 210], [0, 18], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const base =
    variant === 'deep'
      ? 'linear-gradient(135deg, #f4faff 0%, #edf5fc 45%, #ebfbf4 100%)'
      : variant === 'calm'
        ? 'linear-gradient(135deg, #fcfdfe 0%, #f1f8fc 50%, #f6fdf9 100%)'
        : 'linear-gradient(135deg, #f8fbfd 0%, #f0f7fc 40%, #eefbf4 100%)';

  return (
    <AbsoluteFill
      style={{
        background: base,
        color: '#0b1f35',
        fontFamily: FONT_FAMILY,
        overflow: 'hidden',
        width: 1080,
        height: 1920,
      }}
    >
      {/* Decorative premium background circles */}
      <div
        style={{
          position: 'absolute',
          width: 860,
          height: 860,
          borderRadius: 999,
          border: '1.5px solid rgba(10, 157, 88, 0.05)',
          top: '20%',
          right: -300,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          borderRadius: 999,
          border: '1.5px dashed rgba(0, 107, 179, 0.04)',
          top: '12%',
          right: -420,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 650,
          height: 650,
          borderRadius: 999,
          border: '1px solid rgba(10, 157, 88, 0.06)',
          bottom: '12%',
          left: -200,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 800,
          height: 800,
          borderRadius: 999,
          border: '1.5px dashed rgba(0, 107, 179, 0.03)',
          bottom: '8%',
          left: -280,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <Img
        src={staticFile('assets/background-pattern.svg')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.14,
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 18% 16%, rgba(0, 107, 179, 0.12), transparent 35%), radial-gradient(circle at 86% 80%, rgba(10, 157, 88, 0.14), transparent 38%)',
          zIndex: 1,
        }}
      />
      <Img
        src={staticFile('assets/green-shape.svg')}
        style={{
          position: 'absolute',
          right: -170,
          top: 180 + drift,
          width: 480,
          opacity: 0.45,
          zIndex: 1,
        }}
      />
      <Img
        src={staticFile('assets/accent-lines.svg')}
        style={{
          position: 'absolute',
          left: -60,
          bottom: 150 - drift,
          width: 440,
          opacity: 0.32,
          zIndex: 1,
        }}
      />
      <div style={{position: 'absolute', inset: 0, zIndex: 2}}>
        {children}
      </div>
    </AbsoluteFill>
  );
};
