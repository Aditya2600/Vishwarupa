import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {PAYMENT_LINK_GUIDANCE_SCENES} from './scenes';
import type {
  PaymentLinkGuidanceScene,
  PaymentLinkGuidanceTemplateProps,
} from './types';

const TRANSITION_FRAMES = 18;
const DEFAULT_NARRATION_AUDIO = 'audio/payment-guide.mp3';
const FONT_FAMILY =
  'Inter, Noto Sans, Avenir Next, SF Pro Display, Arial, sans-serif';

const safeText = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const personalize = (
  text: string,
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  }
) =>
  text
    .replace(/\{\{customerName\}\}/g, values.customerName)
    .replace(/\{\{lan\}\}/g, values.lan)
    .replace(/\{\{clientName\}\}/g, values.clientName)
    .replace(/\{\{contactDetails\}\}/g, values.contactDetails)
    .replace(/\{\{payableAmount\}\}/g, values.payableAmount);

const Shell = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill
    style={{
      background:
        'linear-gradient(180deg, #f7fbff 0%, #eef6fb 46%, #eaf3f7 100%)',
      color: '#0f172a',
      fontFamily: FONT_FAMILY,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(circle at 18% 12%, rgba(37, 99, 235, 0.15), transparent 34%), radial-gradient(circle at 88% 78%, rgba(20, 184, 166, 0.16), transparent 32%)',
      }}
    />
    {children}
  </AbsoluteFill>
);

const IntroScene = ({
  scene,
  opacity,
  localFrame,
  values,
}: {
  scene: PaymentLinkGuidanceScene;
  opacity: number;
  localFrame: number;
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  };
}) => {
  const contentOpacity = interpolate(localFrame, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lift = interpolate(localFrame, [8, 30], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Shell>
      <AbsoluteFill
        style={{
          opacity,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 72,
        }}
      >
        <div
          style={{
            width: '100%',
            opacity: contentOpacity,
            transform: `translateY(${lift}px)`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              marginBottom: 36,
              borderRadius: 999,
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0,
              padding: '14px 24px',
            }}
          >
            {personalize(scene.eyebrow, values)}
          </div>
          <h1
            style={{
              margin: 0,
              maxWidth: 920,
              color: '#0f172a',
              fontSize: 82,
              fontWeight: 900,
              lineHeight: 1.04, 
              letterSpacing: 0,
            }}
          >
            {personalize(scene.title, values)}
          </h1>
          <p
            style={{
              margin: '32px 0 0',
              maxWidth: 820,
              color: '#475569',
              fontSize: 38,
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {personalize(scene.subtitle, values)}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              marginTop: 44,
              maxWidth: 780,
            }}
          >
            {[
              ['Customer', values.customerName],
              ['LAN', values.lan],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  borderRadius: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.78)',
                  boxShadow: '0 14px 40px rgba(15, 23, 42, 0.08)',
                  padding: '22px 24px',
                }}
              >
                <div
                  style={{
                    color: '#64748b',
                    fontSize: 20,
                    fontWeight: 800,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    color: '#0f172a',
                    fontSize: 28,
                    fontWeight: 900,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

const ScreenshotScene = ({
  scene,
  opacity,
  localFrame,
  values,
}: {
  scene: PaymentLinkGuidanceScene;
  opacity: number;
  localFrame: number;
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  };
}) => {
  const contentOpacity = interpolate(localFrame, [5, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const contentY = interpolate(localFrame, [5, 24], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Shell>
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile(scene.image)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            filter: 'blur(24px)',
            opacity: 0.18,
            transform: 'scale(1.08)',
          }}
        />
        <AbsoluteFill
          style={{
            padding: '58px 54px 62px',
            gap: 34,
          }}
        >
          <div
            style={{
              opacity: contentOpacity,
              transform: `translateY(${contentY}px)`,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                marginBottom: 18,
                borderRadius: 999,
                backgroundColor: '#0f766e',
                color: '#ffffff',
                fontSize: 24,
                fontWeight: 900,
                padding: '10px 18px',
              }}
            >
              {personalize(scene.eyebrow, values)}
            </div>
            <h2
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: 54,
                fontWeight: 900,
                lineHeight: 1.08,
              }}
            >
              {personalize(scene.title, values)}
            </h2>
            <p
              style={{
                margin: '14px 0 0',
                color: '#475569',
                fontSize: 28,
                fontWeight: 650,
                lineHeight: 1.28,
              }}
            >
              {personalize(scene.subtitle, values)}
            </p>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              width: '100%',
              opacity: contentOpacity,
              transform: `translateY(${contentY}px)`,
              borderRadius: 42,
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow:
                '0 34px 80px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            }}
          >
            <div
              style={{
                height: 46,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0f172a',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  width: 116,
                  height: 9,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                }}
              />
            </div>
            <div
              style={{
                position: 'relative',
                height: 'calc(100% - 46px)',
                aspectRatio: '943 / 1600',
                maxWidth: '100%',
                margin: '0 auto',
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              <Img
                src={staticFile(scene.image)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'fill',
                }}
              />
              {(scene.blurs || []).map((blur, index) => (
                <div
                  key={`${scene.title}-blur-${index}`}
                  style={{
                    position: 'absolute',
                    left: `${blur.x}%`,
                    top: `${blur.y}%`,
                    width: `${blur.width}%`,
                    height: `${blur.height}%`,
                    borderRadius: 12,
                    backgroundColor: 'rgba(248, 250, 252, 0.95)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: '0 0 0 1px rgba(226, 232, 240, 0.82)',
                  }}
                />
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </Shell>
  );
};

const OutroScene = ({
  scene,
  opacity,
  localFrame,
  values,
}: {
  scene: PaymentLinkGuidanceScene;
  opacity: number;
  localFrame: number;
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  };
}) => {
  const contentOpacity = interpolate(localFrame, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Shell>
      <AbsoluteFill
        style={{
          opacity,
          padding: 64,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            opacity: contentOpacity,
            borderRadius: 34,
            backgroundColor: '#ffffff',
            boxShadow: '0 34px 90px rgba(15, 23, 42, 0.16)',
            padding: '54px 50px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              marginBottom: 26,
              borderRadius: 999,
              backgroundColor: '#dcfce7',
              color: '#15803d',
              fontSize: 26,
              fontWeight: 900,
              padding: '12px 20px',
            }}
          >
            {personalize(scene.eyebrow, values)}
          </div>
          <h2
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: 68,
              fontWeight: 950,
              lineHeight: 1.04,
            }}
          >
            {personalize(scene.title, values)}
          </h2>
          <p
            style={{
              margin: '24px 0 0',
              color: '#475569',
              fontSize: 34,
              fontWeight: 650,
              lineHeight: 1.28,
            }}
          >
            {personalize(scene.subtitle, values)}
          </p>
          <div
            style={{
              marginTop: 42,
              borderRadius: 24,
              background: 'linear-gradient(135deg, #0f766e, #2563eb)',
              color: '#ffffff',
              padding: '34px 32px',
            }}
          >
            <div style={{fontSize: 22, fontWeight: 800, opacity: 0.86}}>
              Support number
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 52,
                fontWeight: 950,
                lineHeight: 1.08,
                overflowWrap: 'anywhere',
              }}
            >
              {values.contactDetails}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginTop: 20,
            }}
          >
            {[
              ['Customer', values.customerName],
              ['LAN', values.lan],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  borderRadius: 18,
                  backgroundColor: '#f8fafc',
                  padding: '20px 22px',
                }}
              >
                <div style={{color: '#64748b', fontSize: 18, fontWeight: 800}}>
                  {label}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: '#0f172a',
                    fontSize: 25,
                    fontWeight: 900,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

const LinkClickScene = ({
  scene,
  opacity,
  localFrame,
  duration,
  values,
}: {
  scene: PaymentLinkGuidanceScene;
  opacity: number;
  localFrame: number;
  duration: number;
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  };
}) => {
  // Triple-safety: don't render if outside duration
  if (localFrame < 0 || localFrame > duration) return null;

  // Pulse animation for the click
  const clickStart = 35;
  const clickDuration = 20;
  
  const clickProgress = interpolate(localFrame, [clickStart, clickStart + clickDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  const pulseScale = interpolate(clickProgress, [0, 0.4, 1], [1, 1.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fingerY = interpolate(localFrame, [10, 35], [200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Shell>
      <AbsoluteFill style={{opacity, alignItems: 'center', justifyContent: 'center'}}>
        {/* Mobile Screen Mockup */}
        <div style={{
          width: 420,
          height: 800,
          backgroundColor: '#f1f5f9',
          borderRadius: 50,
          border: '14px solid #1e293b',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 50px 100px rgba(0,0,0,0.2)'
        }}>
          {/* Status Bar */}
          <div style={{height: 44, padding: '0 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 700}}>
            <span>9:41</span>
            <div style={{display: 'flex', gap: 6}}>
              <span>📶</span>
              <span>🔋</span>
            </div>
          </div>

          {/* SMS Header */}
          <div style={{backgroundColor: '#ffffff', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12}}>
            <div style={{width: 40, height: 40, borderRadius: '50%', backgroundColor: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569'}}>
              TVS
            </div>
            <div>
              <div style={{fontSize: 16, fontWeight: 800}}>{values.clientName}</div>
              <div style={{fontSize: 12, color: '#64748b'}}>Text Message</div>
            </div>
          </div>

          {/* SMS Bubble */}
          <div style={{flex: 1, padding: 20}}>
            <div style={{
              backgroundColor: '#e2e8f0',
              padding: '16px 20px',
              borderRadius: '24px 24px 24px 4px',
              maxWidth: '85%',
              fontSize: 18,
              lineHeight: 1.4,
              color: '#1e293b',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              Dear {values.customerName}, your payment for LAN {values.lan} is due. Pay now: 
              <span style={{color: '#2563eb', textDecoration: 'underline', fontWeight: 800, marginLeft: 6, display: 'inline-block'}}>
                tvs.credit/pay
              </span>
            </div>
          </div>

          {/* Animated Finger */}
          <div style={{
            position: 'absolute',
            top: '28%',
            left: '65%',
            fontSize: 100,
            transform: `translate(-50%, -50%) translateY(${fingerY}px) scale(${pulseScale})`,
            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))',
            zIndex: 10,
            pointerEvents: 'none',
            opacity: interpolate(localFrame, [45, 55], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            display: localFrame > 60 ? 'none' : 'block'
          }}>
            ☝️
          </div>
        </div>

        {/* Floating Text Card */}
        <div style={{
          position: 'absolute',
          top: 100,
          left: 60,
          right: 60,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: 32,
          padding: '30px 40px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.1)',
          border: '1px solid rgba(255,255,255,0.4)'
        }}>
           <div style={{
            display: 'inline-flex',
            marginBottom: 12,
            borderRadius: 999,
            backgroundColor: '#0f766e',
            color: '#ffffff',
            fontSize: 20,
            fontWeight: 900,
            padding: '8px 16px',
          }}>
            {personalize(scene.eyebrow, values)}
          </div>
          <h2 style={{margin: 0, fontSize: 42, fontWeight: 900}}>{personalize(scene.title, values)}</h2>
          <p style={{margin: '10px 0 0', fontSize: 26, fontWeight: 600, color: '#475569'}}>{personalize(scene.subtitle, values)}</p>
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

const Scene = ({
  scene,
  startFrame,
  duration,
  values,
}: {
  scene: PaymentLinkGuidanceScene;
  startFrame: number;
  duration: number;
  values: {
    customerName: string;
    lan: string;
    clientName: string;
    contactDetails: string;
    payableAmount: string;
  };
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  const opacity = 1;

  if (localFrame < 0 || localFrame > duration) {
    return null;
  }
  
  if (scene.kind === 'link-click') {
    return (
      <div style={{display: localFrame < 0 || localFrame > duration ? 'none' : 'block'}}>
        <LinkClickScene
          scene={scene}
          opacity={opacity}
          localFrame={localFrame}
          duration={duration}
          values={values}
        />
      </div>
    );
  }

  if (scene.kind === 'intro') {
    return (
      <div style={{display: localFrame < 0 || localFrame > duration ? 'none' : 'block'}}>
        <IntroScene
          scene={scene}
          opacity={opacity}
          localFrame={localFrame}
          values={values}
        />
      </div>
    );
  }

  if (scene.kind === 'outro') {
    return (
      <div style={{display: localFrame < 0 || localFrame > duration ? 'none' : 'block'}}>
        <OutroScene
          scene={scene}
          opacity={opacity}
          localFrame={localFrame}
          values={values}
        />
      </div>
    );
  }

  return (
    <div style={{display: localFrame < 0 || localFrame > duration ? 'none' : 'block'}}>
      <ScreenshotScene
        scene={scene}
        opacity={opacity}
        localFrame={localFrame}
        values={values}
      />
    </div>
  );
};

export const PaymentLinkGuidanceTemplate = ({
  enableNarration = false,
  narrationAudioPath = DEFAULT_NARRATION_AUDIO,
  customerName = 'Customer',
  lan = 'LAN12345',
  clientName = 'TVS Credit',
  contactDetails = '1800-555-999',
  payableAmount = '0',
  stepBoundaries = [],
}: PaymentLinkGuidanceTemplateProps) => {
  const {durationInFrames} = useVideoConfig();

  const values = {
    customerName: safeText(customerName, 'Customer'),
    lan: safeText(lan, 'N/A'),
    clientName: safeText(clientName, 'Payment partner'),
    contactDetails: safeText(contactDetails, '1800-555-999'),
    payableAmount: safeText(payableAmount, 'the displayed amount'),
  };

  const sceneCount = PAYMENT_LINK_GUIDANCE_SCENES.length;

  const getSceneStart = (index: number): number => {
    if (index === 0) return 0;
    const boundary = stepBoundaries[index - 1];
    if (boundary != null && boundary > 0) return Math.min(boundary, durationInFrames - 1);
    return Math.round((index / sceneCount) * durationInFrames);
  };

  const getSceneDuration = (index: number): number => {
    const start = getSceneStart(index);
    const end = index === sceneCount - 1
      ? durationInFrames
      : getSceneStart(index + 1);
    return Math.max(1, end - start);
  };

  return (
    <AbsoluteFill style={{backgroundColor: '#f7fbff'}}>
      {enableNarration ? <Audio src={staticFile(narrationAudioPath)} /> : null}
      {PAYMENT_LINK_GUIDANCE_SCENES.map((scene, index) => (
        <Scene
          key={`scene-${index}`}
          scene={scene}
          startFrame={getSceneStart(index)}
          duration={getSceneDuration(index)}
          values={values}
        />
      ))}
    </AbsoluteFill>
  );
};
