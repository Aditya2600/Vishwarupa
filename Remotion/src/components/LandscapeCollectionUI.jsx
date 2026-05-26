import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const red = '#d7192f';
const deep = '#41070e';
const ink = '#101827';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DetailRow = ({label, value, highlight}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 28,
      padding: '23px 0',
      borderBottom: '1px solid rgba(17, 24, 39, 0.08)',
    }}
  >
    <div style={{fontSize: 25, color: '#6b7280', fontWeight: 750}}>{label}</div>
    <div style={{fontSize: highlight ? 44 : 31, color: highlight ? red : ink, fontWeight: 950, textAlign: 'right'}}>
      {value}
    </div>
  </div>
);

export const LandscapeCollectionUI = ({
  customerName,
  accountNumber,
  daysOverdue,
  collectionStatus,
  amountDue,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const status = clamp(Number(collectionStatus ?? 75), 0, 100);
  const enter = spring({frame, fps, config: {damping: 20, stiffness: 92}});
  const progressWidth = interpolate(frame, [18, 88], [0, status], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: `linear-gradient(125deg, #fff 0%, #fff 52%, ${deep} 52%, #940f20 100%)`,
        fontFamily: 'Inter, Avenir Next, Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 760,
          background:
            'radial-gradient(circle at 70% 16%, rgba(255,255,255,0.32), transparent 26%), radial-gradient(circle at 46% 72%, rgba(255,255,255,0.2), transparent 28%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '88px 88px',
          opacity: 0.18,
          transform: `translateX(${frame * -0.24}px)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 92,
          top: 70,
          width: 890,
          color: ink,
          transform: `translateX(${(1 - enter) * -50}px)`,
          opacity: enter,
        }}
      >
        <div style={{fontSize: 27, color: red, fontWeight: 900}}>Big screen - YouTube / Webinars / Desktop</div>
        <div style={{marginTop: 34, fontSize: 82, lineHeight: 0.94, fontWeight: 950, letterSpacing: 0}}>
          Account payment notice
        </div>
        <div style={{marginTop: 26, width: 720, fontSize: 31, lineHeight: 1.26, color: '#4b5563', fontWeight: 650}}>
          Review the current collection status and complete the recommended action.
        </div>

        <div
          style={{
            marginTop: 46,
            width: 840,
            borderRadius: 30,
            padding: '30px 38px',
            background: '#fff',
            boxShadow: '0 26px 70px rgba(80, 14, 24, 0.16)',
            border: '1px solid rgba(185, 28, 28, 0.11)',
          }}
        >
          <DetailRow label="Customer" value={customerName || 'Rajesh Kumar Singh'} />
          <DetailRow label="Account number" value={accountNumber || 'DC-2024-089456'} />
          <DetailRow label="Days overdue" value={`${daysOverdue ?? 35} days`} />
          <DetailRow label="Amount due" value={amountDue || '₹45,200'} highlight />

          <div style={{marginTop: 30}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
              <div style={{fontSize: 26, color: ink, fontWeight: 900}}>Collection status progress</div>
              <div style={{fontSize: 32, color: red, fontWeight: 950}}>{status}%</div>
            </div>
            <div style={{marginTop: 17, height: 22, borderRadius: 999, background: '#fee2e2', overflow: 'hidden'}}>
              <div
                style={{
                  width: `${progressWidth}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #fb7185, #b91c1c)',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 32,
            width: 840,
            borderRadius: 30,
            padding: '28px 34px',
            background: '#fff7f7',
            border: '1px solid rgba(220, 38, 38, 0.22)',
          }}
        >
          <div style={{fontSize: 24, color: red, fontWeight: 950}}>Important notice</div>
          <div style={{marginTop: 12, fontSize: 32, lineHeight: 1.16, color: ink, fontWeight: 850}}>
            Payment today may help prevent additional recovery steps and preserve repayment options.
          </div>
        </div>
      </div>
    </div>
  );
};
