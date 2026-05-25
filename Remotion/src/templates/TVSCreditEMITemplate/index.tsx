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
import {TVS_CREDIT_EMI_SCENES} from './scenes';
import type {TVSCreditEMITemplateProps, TVSCreditEMIScene} from './types';

const FONT_FAMILY = 'Inter, Noto Sans, Avenir Next, SF Pro Display, Arial, sans-serif';

const safeText = (value: string | undefined, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const personalize = (text: string, values: Record<string, string>) =>
  text
    .replace(/\{\{customerName\}\}/g, values.customerName)
    .replace(/\{\{productType\}\}/g, values.productType)
    .replace(/\{\{clientName\}\}/g, values.clientName)
    .replace(/\{\{tos\}\}/g, values.tos)
    .replace(/\{\{lan\}\}/g, values.lan)
    .replace(/\{\{contactDetails\}\}/g, values.contactDetails);

const Shell = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill
    style={{
      background: 'linear-gradient(180deg, #f7fbff 0%, #eef6fb 46%, #eaf3f7 100%)',
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

const TextOnlyScene = ({
  scene,
  values,
  localFrame,
  duration,
}: {
  scene: TVSCreditEMIScene;
  values: Record<string, string>;
  localFrame: number;
  duration: number;
}) => {
  const contentOpacity = interpolate(localFrame, [8, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lift = interpolate(localFrame, [8, 30], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Shell>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
        }}
      >
        <div
          style={{
            width: '100%',
            opacity: contentOpacity,
            transform: `translateY(${lift}px)`,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)',
            borderRadius: 40,
            padding: 60,
          }}
        >
          {scene.eyebrow && (
            <div
              style={{
                display: 'inline-flex',
                marginBottom: 24,
                borderRadius: 999,
                backgroundColor: '#dbeafe',
                color: '#1d4ed8',
                fontSize: 32,
                fontWeight: 800,
                padding: '12px 28px',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              {personalize(scene.eyebrow, values)}
            </div>
          )}
          {scene.title && (
            <h1
              style={{
                margin: 0,
                color: '#0f172a',
                fontSize: 72,
                fontWeight: 900,
                lineHeight: 1.1,
              }}
            >
              {personalize(scene.title, values)}
            </h1>
          )}
          {scene.subtitle && (
            <p
              style={{
                margin: '24px 0 0',
                color: '#475569',
                fontSize: 42,
                fontWeight: 600,
                lineHeight: 1.4,
              }}
            >
              {personalize(scene.subtitle, values)}
            </p>
          )}
        </div>
      </AbsoluteFill>
    </Shell>
  );
};

const resolveImage = (
  sceneImage: string | undefined,
  props: TVSCreditEMITemplateProps
) => {
  if (!sceneImage) return '';
  
  let key: string | null = null;
  if (sceneImage === 'paynow_whatsapp.png') key = 'whatsappPaynow';
  else if (sceneImage === 'link_sms.png') key = 'smsLink';
  else if (sceneImage === 'upi_app.png') key = 'upiApps';
  else if (sceneImage === 'open_app_search.png') key = 'openappSearch';
  else if (sceneImage === 'enter_lan.png') key = 'enterlan';
  else if (sceneImage === 'payment_success_image.png') key = 'paymentSuccess';
  else if (sceneImage === 'shop_visit.png') key = 'shopVisit';

  if (key) {
    const customPath = props[key as keyof TVSCreditEMITemplateProps] || props.emiImagePaths?.[key];
    if (customPath && typeof customPath === 'string') {
      const cleanPath = customPath.startsWith('/') ? customPath.substring(1) : customPath;
      if (cleanPath.startsWith('assets/')) {
        return cleanPath;
      }
      return `assets/${cleanPath}`;
    }
  }

  return `assets/${sceneImage}`;
};

const FullscreenImageScene = ({
  scene,
  localFrame,
  duration,
  props,
}: {
  scene: TVSCreditEMIScene;
  localFrame: number;
  duration: number;
  props: TVSCreditEMITemplateProps;
}) => {
  const opacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (!scene.image) return null;

  const imageSrc = resolveImage(scene.image, props);

  return (
    <Shell>
      <AbsoluteFill style={{opacity}}>
        <Img
          src={staticFile(imageSrc)}
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
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: 42,
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              boxShadow: '0 34px 80px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)',
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
                width: '100%',
                backgroundColor: '#ffffff',
              }}
            >
              <Img
                src={staticFile(imageSrc)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          </div>
          {scene.caption && (
            <div
              style={{
                marginTop: 40,
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                color: '#ffffff',
                padding: '24px 48px',
                borderRadius: 999,
                fontSize: 36,
                fontWeight: 600,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                textAlign: 'center',
                maxWidth: '90%',
              }}
            >
              {scene.caption}
            </div>
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    </Shell>
  );
};

const SceneWrapper = ({
  scene,
  startFrame,
  duration,
  values,
  props,
}: {
  scene: TVSCreditEMIScene;
  startFrame: number;
  duration: number;
  values: Record<string, string>;
  props: TVSCreditEMITemplateProps;
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > duration) {
    return null;
  }

  return (
    <div style={{display: localFrame < 0 || localFrame > duration ? 'none' : 'block'}}>
      {['intro', 'text-only', 'final'].includes(scene.kind) ? (
        <TextOnlyScene scene={scene} values={values} localFrame={localFrame} duration={duration} />
      ) : (
        <FullscreenImageScene scene={scene} localFrame={localFrame} duration={duration} props={props} />
      )}
    </div>
  );
};

export const TVSCreditEMITemplate = (props: TVSCreditEMITemplateProps) => {
  const {
    enableNarration = false,
    narrationAudioPath,
    customerName = 'Valued Customer',
    productType = 'Two Wheeler Loan',
    clientName = 'TVS Credit',
    tos = '0.00',
    lan = 'TVS000123456',
    contactDetails = '1800 123 4567',
    stepBoundaries = [],
    logoUrl,
    logoPosition = 'top-right',
    logoOpacity = 100,
    language = 'English',
  } = props;
  const {durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();
  const normalizedLogoPosition = logoPosition.toLowerCase().replace(/\s+/g, '-');

  const values = {
    customerName: safeText(customerName, 'Valued Customer'),
    productType: safeText(productType, 'Two Wheeler Loan'),
    clientName: safeText(clientName, 'TVS Credit'),
    tos: safeText(tos, '0.00'),
    lan: safeText(lan, 'TVS000123456'),
    contactDetails: safeText(contactDetails, '1800 123 4567'),
  };

  const sceneCount = TVS_CREDIT_EMI_SCENES.length;

  const getSceneStart = (index: number): number => {
    if (index === 0) return 0;
    // Use VTT-derived step boundary if provided (primary path for precise audio sync)
    const boundary = stepBoundaries[index - 1];
    if (boundary != null && boundary > 0) return Math.min(boundary, durationInFrames - 1);
    
    // Calculate cumulative relative duration up to this index
    let cumulativeDuration = 0;
    const lang = (language?.toLowerCase() === 'hindi' || language?.toLowerCase() === 'hi') ? 'hi' : 'en';
    for (let i = 0; i < index; i++) {
      cumulativeDuration += TVS_CREDIT_EMI_SCENES[i].relativeDuration[lang];
    }
    return Math.round(cumulativeDuration * durationInFrames);
  };

  const getSceneDuration = (index: number): number => {
    const start = getSceneStart(index);
    const end = index === sceneCount - 1
      ? durationInFrames
      : getSceneStart(index + 1);
    return Math.max(1, end - start);
  };

  const activeSceneIndex = TVS_CREDIT_EMI_SCENES.findIndex((_, index) => {
    const start = getSceneStart(index);
    const end = start + getSceneDuration(index);
    return frame >= start && frame < end;
  });
  const activeScene = activeSceneIndex >= 0 ? TVS_CREDIT_EMI_SCENES[activeSceneIndex] : null;
  const isFullscreenImageScene = activeScene?.kind === 'fullscreen-image';
  const isLogoTop = normalizedLogoPosition.includes('top');
  const isLogoBottom = normalizedLogoPosition.includes('bottom');
  const isLogoLeft = normalizedLogoPosition.includes('left');
  const isLogoRight = normalizedLogoPosition.includes('right');
  const logoInset = isFullscreenImageScene ? 24 : 60;
  const logoHeight = isFullscreenImageScene ? 72 : 120;

  return (
    <AbsoluteFill style={{backgroundColor: '#ffffff'}}>
      {enableNarration && narrationAudioPath && (
        <Audio src={staticFile(narrationAudioPath)} />
      )}

      {TVS_CREDIT_EMI_SCENES.map((scene, index) => (
        <SceneWrapper
          key={`scene-${index}`}
          scene={scene}
          startFrame={getSceneStart(index)}
          duration={getSceneDuration(index)}
          values={values}
          props={props}
        />
      ))}

      {logoUrl && (
        <Img
          src={logoUrl.startsWith('http') ? logoUrl : staticFile(logoUrl)}
          style={{
            position: 'absolute',
            top: isLogoTop ? logoInset : undefined,
            bottom: isLogoBottom ? logoInset : undefined,
            left: isLogoLeft ? logoInset : undefined,
            right: isLogoRight ? logoInset : undefined,
            height: logoHeight,
            maxWidth: isFullscreenImageScene ? 180 : 260,
            opacity: logoOpacity / 100,
            zIndex: 100,
            objectFit: 'contain',
            backgroundColor: isFullscreenImageScene ? 'rgba(255, 255, 255, 0.88)' : undefined,
            borderRadius: isFullscreenImageScene ? 12 : undefined,
            padding: isFullscreenImageScene ? 8 : undefined,
            boxShadow: isFullscreenImageScene ? '0 8px 24px rgba(15, 23, 42, 0.16)' : undefined,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
