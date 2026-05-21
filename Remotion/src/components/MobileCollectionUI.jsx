import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const red = '#c91428';
const darkRed = '#650914';
const ink = '#1f2937';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const Field = ({label, value}) => (
  <div>
    <div style={{fontSize: 24, color: '#6b7280', fontWeight: 700}}>{label}</div>
    <div style={{marginTop: 8, fontSize: 38, color: ink, fontWeight: 900, letterSpacing: 0}}>{value}</div>
  </div>
);

export const MobileCollectionUI = ({
  customerName,
  accountNumber,
  daysOverdue,
  collectionStatus,
  amountDue,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const status = clamp(Number(collectionStatus ?? 75), 0, 100);
  const cardEnter = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  const pulse = interpolate(Math.sin(frame / 18), [-1, 1], [0.82, 1]);
  const progressWidth = interpolate(frame, [20, 90], [0, status], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: `radial-gradient(circle at 78% 8%, rgba(255,255,255,0.34), transparent 22%),
          linear-gradient(150deg, #ff4258 0%, ${red} 38%, ${darkRed} 100%)`,
        fontFamily: 'Inter, Avenir Next, Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '76px 76px',
          opacity: 0.22,
          transform: `translateY(${frame * -0.35}px)`,
        }}
      />

      <div style={{position: 'absolute', left: 54, top: 74, color: '#fff'}}>
        <div style={{fontSize: 27, fontWeight: 800, opacity: 0.78}}>Mobile - Shorts / Reels / WhatsApp</div>
        <div style={{marginTop: 38, width: 780, fontSize: 88, lineHeight: 0.95, fontWeight: 950, letterSpacing: 0}}>
          Payment attention required
        </div>
        <div style={{marginTop: 28, fontSize: 34, lineHeight: 1.25, width: 700, opacity: 0.86, fontWeight: 650}}>
          Please review your account details and choose the next action.
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 430,
          width: 806,
          borderRadius: 36,
          padding: 40,
          background: '#fff',
          transform: `translateY(${(1 - cardEnter) * 42}px)`,
          opacity: cardEnter,
          boxShadow: '0 26px 80px rgba(70, 8, 18, 0.34)',
        }}
      >
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 38}}>
          <Field label="Account number" value={accountNumber || 'DC-2024-089456'} />
          <Field label="Customer name" value={customerName || 'Rajesh Kumar Singh'} />
          <Field label="Days overdue" value={`${daysOverdue ?? 35} days`} />
          <Field label="Amount due" value={amountDue || '₹45,200'} />
        </div>

        <div style={{marginTop: 42}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <div style={{fontSize: 26, fontWeight: 850, color: ink}}>Collection status</div>
            <div style={{fontSize: 30, fontWeight: 950, color: red}}>{status}%</div>
          </div>
          <div style={{marginTop: 18, height: 24, borderRadius: 999, background: '#fee2e2', overflow: 'hidden'}}>
            <div
              style={{
                width: `${progressWidth}%`,
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #ef4444, #b91c1c)',
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 54,
          top: 940,
          width: 570,
          boxSizing: 'border-box',
          borderRadius: 32,
          padding: 34,
          background: 'rgba(255,255,255,0.94)',
          boxShadow: '0 18px 50px rgba(85, 9, 24, 0.28)',
        }}
      >
        <div style={{fontSize: 25, color: red, fontWeight: 950}}>Important notice</div>
        <div style={{marginTop: 14, fontSize: 35, lineHeight: 1.12, color: ink, fontWeight: 900}}>
          Timely payment can help avoid further collection escalation.
        </div>
      </div>

      <div style={{position: 'absolute', left: 54, bottom: 72, display: 'flex', gap: 20}}>
        {['Pay now', 'Talk to agent'].map((label, index) => (
          <div
            key={label}
            style={{
              minWidth: index === 0 ? 240 : 300,
              height: 84,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: index === 0 ? red : '#fff',
              background: index === 0 ? '#fff' : 'rgba(255,255,255,0.18)',
              border: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.32)',
              fontSize: 30,
              fontWeight: 950,
              transform: `scale(${index === 0 ? pulse : 1})`,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};
