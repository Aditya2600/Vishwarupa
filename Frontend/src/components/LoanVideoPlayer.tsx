'use client';

import {useState} from 'react';

type LoanVideoPlayerProps = {
  videoSrc: string;
  paymentUrl: string;
  callbackPhone: string;
  showCtaAt?: number;
};

export function LoanVideoPlayer({
  videoSrc,
  paymentUrl,
  callbackPhone,
  showCtaAt = 46,
}: LoanVideoPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const shouldShowCta = currentTime >= showCtaAt;

  const openPayment = () => {
    if (!paymentUrl) {
      return;
    }

    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  };

  const startCall = () => {
    if (!callbackPhone) {
      return;
    }

    window.location.href = `tel:${callbackPhone}`;
  };

  return (
    <div
      style={{
        aspectRatio: '9 / 16',
        background: '#08263e',
        borderRadius: 12,
        boxShadow: '0 24px 70px rgba(8, 38, 62, 0.22)',
        maxHeight: 'min(86vh, 920px)',
        maxWidth: 430,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <video
        controls
        playsInline
        src={videoSrc}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        style={{
          background: '#08263e',
          display: 'block',
          height: '100%',
          objectFit: 'cover',
          width: '100%',
        }}
      />

      {shouldShowCta ? (
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(8, 38, 62, 0) 0%, rgba(8, 38, 62, 0.72) 28%, rgba(8, 38, 62, 0.94) 100%)',
            bottom: 0,
            left: 0,
            padding: '72px 18px 18px',
            pointerEvents: 'none',
            position: 'absolute',
            right: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: '1fr',
              pointerEvents: 'auto',
            }}
          >
            <button
              type="button"
              onClick={openPayment}
              style={{
                alignItems: 'center',
                background: 'linear-gradient(135deg, #0a9d58 0%, #25c978 100%)',
                border: 0,
                borderRadius: 8,
                boxShadow: '0 16px 34px rgba(10, 157, 88, 0.3)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                fontSize: 18,
                fontWeight: 900,
                justifyContent: 'center',
                lineHeight: 1.1,
                minHeight: 54,
                padding: '14px 18px',
                width: '100%',
              }}
            >
              Pay Now
            </button>

            <button
              type="button"
              onClick={startCall}
              style={{
                alignItems: 'center',
                background: '#ffffff',
                border: '2px solid rgba(6, 63, 95, 0.16)',
                borderRadius: 8,
                boxShadow: '0 12px 28px rgba(6, 63, 95, 0.18)',
                color: '#063f5f',
                cursor: 'pointer',
                display: 'flex',
                fontSize: 18,
                fontWeight: 900,
                justifyContent: 'center',
                lineHeight: 1.1,
                minHeight: 54,
                padding: '14px 18px',
                width: '100%',
              }}
            >
              Call
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LoanVideoPlayer;
