import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const BankCard = ({
  bankName,
  productType,
  accountLast4,
  brandColor,
  accentColor,
}: {
  bankName: string;
  productType: string;
  accountLast4: string;
  brandColor: string;
  accentColor: string;
}) => {
  const frame = useCurrentFrame();
  const rotate = interpolate(frame, [0, 45], [-4, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, 45], [38, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        background: `linear-gradient(145deg, ${brandColor}, #092f83)`,
        borderRadius: 38,
        boxShadow: '0 35px 80px rgba(15, 23, 42, 0.22)',
        color: '#ffffff',
        height: 300,
        padding: 34,
        position: 'relative',
        transform: `translateY(${y}px) rotate(${rotate}deg)`,
        width: 520,
      }}
    >
      <div style={{fontSize: 26, fontWeight: 950}}>{bankName}</div>
      <div style={{color: 'rgba(255,255,255,0.72)', fontSize: 20, fontWeight: 800, marginTop: 12}}>
        {productType}
      </div>
      <div
        style={{
          bottom: 34,
          display: 'flex',
          gap: 16,
          left: 34,
          position: 'absolute',
        }}
      >
        {['••••', '••••', '••••', accountLast4].map((segment, index) => (
          <span key={`${segment}-${index}`} style={{fontSize: 29, fontWeight: 950, letterSpacing: 2}}>
            {segment}
          </span>
        ))}
      </div>
      <div
        style={{
          backgroundColor: `${accentColor}88`,
          borderRadius: 999,
          height: 86,
          position: 'absolute',
          right: 30,
          top: 78,
          width: 86,
        }}
      />
    </div>
  );
};
