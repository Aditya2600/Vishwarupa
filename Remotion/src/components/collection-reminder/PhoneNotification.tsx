import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const PhoneNotification = ({
  bankName,
  customerName,
  productType,
  brandColor,
  accentColor,
}: {
  bankName: string;
  customerName: string;
  productType: string;
  brandColor: string;
  accentColor: string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({frame: frame - 10, fps, config: {damping: 17}});
  const y = interpolate(entrance, [0, 1], [90, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        backgroundColor: '#101827',
        border: '10px solid #1f2937',
        borderRadius: 64,
        boxShadow: '0 42px 110px rgba(15, 23, 42, 0.35)',
        height: 760,
        opacity,
        overflow: 'hidden',
        padding: 28,
        transform: `translateY(${y}px)`,
        width: 410,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 42,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
            height: 190,
            padding: '34px 28px',
          }}
        >
          <div style={{color: '#ffffff', fontSize: 22, fontWeight: 950}}>
            {bankName}
          </div>
          <div style={{color: 'rgba(255,255,255,0.76)', fontSize: 15, fontWeight: 800, marginTop: 8}}>
            WhatsApp Reminder
          </div>
        </div>
        <div
          style={{
            backgroundColor: '#f8fafc',
            borderRadius: 28,
            boxShadow: '0 18px 38px rgba(15, 23, 42, 0.12)',
            left: 22,
            padding: 22,
            position: 'absolute',
            right: 22,
            top: 140,
          }}
        >
          <div style={{color: '#0f172a', fontSize: 23, fontWeight: 950}}>
            Hi {customerName}
          </div>
          <div style={{color: '#475569', fontSize: 18, fontWeight: 700, lineHeight: 1.35, marginTop: 12}}>
            Your {productType} repayment needs attention.
          </div>
          <div
            style={{
              backgroundColor: `${accentColor}22`,
              borderRadius: 18,
              color: brandColor,
              fontSize: 17,
              fontWeight: 950,
              marginTop: 18,
              padding: '12px 14px',
              textAlign: 'center',
            }}
          >
            Open reminder
          </div>
        </div>
        <div
          style={{
            bottom: 34,
            display: 'grid',
            gap: 12,
            left: 30,
            position: 'absolute',
            right: 30,
          }}
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                backgroundColor: item === 0 ? '#e2e8f0' : '#eef2f7',
                borderRadius: 999,
                height: item === 2 ? 14 : 18,
                opacity: 0.82 - item * 0.18,
                width: `${86 - item * 16}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
