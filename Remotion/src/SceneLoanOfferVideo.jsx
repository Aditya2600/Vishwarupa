import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const SCENE_LOAN_OFFER_DURATION = 30 * 30;

const scenes = [
  {src: 'scene1.png', start: 0, end: 3, tone: 'dark'},
  {src: 'scene2.png', start: 3, end: 6, tone: 'bright'},
  {src: 'scene3.png', start: 6, end: 10, tone: 'dark'},
  {src: 'scene4.png', start: 10, end: 23, tone: 'bright'},
  {src: 'scene5.png', start: 23, end: 30, tone: 'neon'},
];

const fallbackCaptions = [
  {start: 0, end: 3, text: 'पैसों की परेशानी से जूझ रहे हैं? अब चिंता छोड़िए।'},
  {start: 3, end: 6, text: 'बधाई हो! आपके लिए एक खास प्री-अप्रूव्ड लोन ऑफर तैयार है।'},
  {start: 6, end: 10, text: 'नया बाइक हो, ज़रूरी खर्च हो या आपके सपने — अब सब होगा आसान।'},
  {start: 10, end: 14, text: 'अपनी जरूरत के हिसाब से आसान लोन विकल्प चुनना अब और भी सरल है।'},
  {start: 14, end: 18, text: 'तेज़ प्रोसेस, कम दस्तावेज़ और भरोसेमंद सहायता।'},
  {start: 18, end: 22, text: 'हर कदम पर हमारी टीम आपके साथ है।'},
  {start: 22, end: 26, text: 'अपने सपनों को आगे बढ़ाइए और बेहतर कल की शुरुआत कीजिए।'},
  {start: 26, end: 30, text: 'आपका प्री-अप्रूव्ड ऑफर आपका इंतज़ार कर रहा है।'},
];

const formatSeconds = (frame, fps) => frame / fps;
const sanitizeCaptionText = (value = '') =>
  String(value)
    .replace(/^\s*[\d०-९]+[\).:-]?\s*/gm, '')
    .replace(/[\d०-९]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getActiveCaption = (time, captionTrack) =>
  captionTrack.find((caption) => time >= caption.start && time < caption.end) ||
  [...captionTrack].reverse().find((caption) => time >= caption.start) ||
  captionTrack[0];

const getActiveScene = (time) =>
  scenes.find((scene) => time >= scene.start && time < scene.end) ||
  scenes[scenes.length - 1];

const chipStyle = {
  alignItems: 'center',
  borderRadius: 999,
  display: 'flex',
  fontSize: 25,
  fontWeight: 900,
  height: 54,
  justifyContent: 'center',
  padding: '0 26px',
};

export const SceneLoanOfferVideo = ({voiceoverAudioSrc = null, subtitles = null, audioPlaybackRate = 1}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const time = formatSeconds(frame, fps);
  const captionTrack = Array.isArray(subtitles) && subtitles.length > 0 ? subtitles : fallbackCaptions;
  const totalDuration = durationInFrames / fps;
  const scene = getActiveScene(time);
  const caption = getActiveCaption(time, captionTrack);
  const sceneFrame = frame - scene.start * fps;
  const sceneEnd = scene === scenes[scenes.length - 1] ? Math.max(totalDuration, scene.end) : scene.end;
  const sceneDuration = (sceneEnd - scene.start) * fps;
  const fade = interpolate(sceneFrame, [0, 14, sceneDuration - 14, sceneDuration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lift = interpolate(sceneFrame, [0, 24], [28, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const captionPulse = 1 + Math.sin(frame / 9) * 0.01;
  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const captionText = sanitizeCaptionText(caption?.text || '');

  return (
    <AbsoluteFill
      style={{
        background: '#05070b',
        color: '#ffffff',
        fontFamily:
          'Noto Sans Devanagari, Mukta, Hind, Avenir Next, SF Pro Display, Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      {voiceoverAudioSrc ? <Audio src={staticFile(voiceoverAudioSrc)} playbackRate={audioPlaybackRate} /> : null}

      {scenes.map((item) => {
        const isLastScene = item === scenes[scenes.length - 1];
        const itemEnd = isLastScene ? Math.max(totalDuration, item.end) : item.end;
        const localTime = time - item.start;
        if (localTime < -0.6 || localTime > itemEnd - item.start + 0.6) {
          return null;
        }
        const itemFrame = frame - item.start * fps;
        const itemDuration = (itemEnd - item.start) * fps;
        const itemOpacity = interpolate(itemFrame, [0, 14, itemDuration - 14, itemDuration], [0, 1, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <AbsoluteFill key={`${item.src}-${item.start}`} style={{opacity: itemOpacity}}>
            <Img
              src={staticFile(item.src)}
              style={{
                height: '100%',
                objectFit: 'contain',
                width: '100%',
              }}
            />
          </AbsoluteFill>
        );
      })}

      <AbsoluteFill
        style={{
          background:
            scene.tone === 'neon'
              ? 'linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.02) 42%, rgba(0,0,0,0.68) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.04) 42%, rgba(0,0,0,0.74) 100%)',
          opacity: fade,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          top: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: time >= 23 ? 0 : fade,
        }}
      >
        <div
          style={{
            ...chipStyle,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.24)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
            color: '#ffffff',
            letterSpacing: 0,
          }}
        >
          Sales Offer
        </div>
        <div
          style={{
            ...chipStyle,
            background: 'rgba(15,191,93,0.92)',
            boxShadow: '0 12px 34px rgba(15,191,93,0.28)',
            color: '#ffffff',
            minWidth: 150,
          }}
        >
          Personalized
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          bottom: 170,
          borderRadius: 34,
          padding: '32px 34px',
          background:
            'linear-gradient(135deg, rgba(5, 7, 11, 0.82) 0%, rgba(9, 18, 32, 0.72) 100%)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.46)',
          opacity: fade,
          transform: `translateY(${lift}px) scale(${captionPulse})`,
        }}
      >
        <div
          style={{
            color: '#9df6bd',
            fontSize: 23,
            fontWeight: 950,
            letterSpacing: '0.08em',
            marginBottom: 14,
            textTransform: 'uppercase',
          }}
        >
          Sales Highlight
        </div>
        <div
          style={{
            fontSize: captionText.length > 58 ? 41 : 47,
            fontWeight: 950,
            letterSpacing: 0,
            lineHeight: 1.17,
            textShadow: '0 4px 18px rgba(0,0,0,0.48)',
          }}
        >
          {captionText}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          background: 'rgba(255,255,255,0.16)',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0fbf5d 0%, #ffe241 55%, #ffffff 100%)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
