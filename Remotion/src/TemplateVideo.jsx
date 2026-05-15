import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {PaymentLinkGuidanceTemplate} from './templates/PaymentLinkGuidanceTemplate';
import {
  TRANSITION_FRAMES,
  HEIGHT,
  extractNumericAmount,
  formatAmountDisplay,
  getActiveSubtitle,
  getLeadById,
  getSceneTimeline,
  getSubtitleProgress,
  getTrackMeta,
  safeString,
  WIDTH,
} from './videoData';

const FONT_FAMILY =
  'Noto Sans Devanagari, Noto Sans Bengali, Noto Sans Gujarati, Noto Sans Gurmukhi, Noto Sans Kannada, Noto Sans Malayalam, Noto Sans Tamil, Noto Sans Telugu, Noto Sans, Avenir Next, SF Pro Display, Arial, sans-serif';

const URGENCY_COLORS = {
  critical: '#f97316',
  high: '#f59e0b',
  elevated: '#38bdf8',
};

const SUBTITLE_COLORS = {
  White: '#f8fafc',
  Blue: '#60a5fa',
  Green: '#34d399',
  Red: '#f87171',
  Yellow: '#facc15',
  Teal: '#2dd4bf',
  Black: '#000000',
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const BASE_FRAME_WIDTH = WIDTH;
const BASE_FRAME_HEIGHT = HEIGHT;
const legalGavelImage = staticFile('image.png');
const debtNoticeImage = staticFile('image copy.png');
// Drives the PhonePe walkthrough: which screenshot to show, where (if anywhere)
// to draw the tap indicator, and the relative time each step takes — weights
// align with how long the narration spends on each step (LAN/amount entry is
// longer because the digits are spoken).
const PHONE_STEP_CONFIG = [
  {image: staticFile('step1.png'), tap: {x: 231, y: 362}, weight: 1},   // Tap "Loan Repayment"
  {image: staticFile('step2.png'), tap: {x: 110, y: 111}, weight: 1.2}, // Tap "TVS Credit"
  {image: staticFile('step3.png'), tap: null,             weight: 2.4}, // Type LAN — no tap target
  {image: staticFile('step3.png'), tap: null,             weight: 1.6}, // Type amount — no tap target
];
const SAFE_TEXT_STYLE = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
};

const UI_COPY = {
  English: {
    titlePrefixFallback: 'Account Notice', formalNotice: 'Formal Notice', accountStatus: 'Account Status', financialHighlights: 'Financial Highlights', immediateNextStep: 'Next Step', resolutionStillPossible: 'Solution Possible', sceneLabels: { opening: 'Notice', account: 'Account', context: 'Review', amounts: 'Amounts', action: 'Action', closing: 'Resolve' }, openingIdentity: 'Lead Identity', customerLabel: 'Customer', clientLabel: 'Client', productLabel: 'Product', outstandingLabel: 'Outstanding', reviewMarkers: 'Review Markers', leadLabel: 'Lead', accountLabel: 'Account', currentDueLabel: 'Current Due', amountsPrimaryHelper: 'Primary Amount', urgentAction: 'Urgent Action', actionCardHelper: 'Immediate contact expected.', finalSummary: 'Summary', contactLabel: 'Contact',
  },
  Hindi: {
    titlePrefixFallback: 'खाता सूचना', formalNotice: 'औपचारिक सूचना', accountStatus: 'खाता स्थिति', financialHighlights: 'वित्तीय मुख्य बिंदु', immediateNextStep: 'तत्काल अगला कदम', resolutionStillPossible: 'समाधान अभी भी संभव है', sceneLabels: { opening: 'सूचना', account: 'खाता', context: 'समीक्षा', amounts: 'राशि', action: 'कार्रवाई', closing: 'समाधान' }, openingIdentity: 'पहचान विवरण', customerLabel: 'ग्राहक', clientLabel: 'बैंक', productLabel: 'उत्पाद', outstandingLabel: 'कुल बकाया', reviewMarkers: 'मुख्य संकेत', leadLabel: 'ग्राहक', accountLabel: 'खाता', currentDueLabel: 'वर्तमान बकाया', amountsPrimaryHelper: 'महत्वपूर्ण राशि', urgentAction: 'कार्रवाई आवश्यक', actionCardHelper: 'त्वरित कॉल अपेक्षित है।', finalSummary: 'अंतिम सारांश', contactLabel: 'संपर्क',
  },
  Marathi: {
    titlePrefixFallback: 'खाते सूचना', formalNotice: 'औपचारिक सूचना', accountStatus: 'खाते स्थिती', financialHighlights: 'आर्थिक ठळक मुद्दे', immediateNextStep: 'पुढील पाऊल', resolutionStillPossible: 'निवारण अजूनही शक्य आहे', sceneLabels: { opening: 'सूचना', account: 'खाते', context: 'समीक्षा', amounts: 'रक्कम', action: 'कार्रवाई', closing: 'निवारण' }, openingIdentity: 'ओळख तपशील', customerLabel: 'ग्राहक', clientLabel: 'बँक', productLabel: 'उत्पादन', outstandingLabel: 'एकूण थकबाकी', reviewMarkers: 'मुख्य संकेत', leadLabel: 'ग्राहक', accountLabel: 'खाते', currentDueLabel: 'वर्तमान थकबाकी', amountsPrimaryHelper: 'महत्वाची रक्कम', urgentAction: 'कृती आवश्यक', actionCardHelper: 'त्वरित संपर्क अपेक्षित आहे.', finalSummary: 'अંતિમ સારાંશ', contactLabel: 'संपर्क',
  },
  Tamil: {
    titlePrefixFallback: 'கணக்கு அறிவிப்பு', formalNotice: 'முறைப்படியான அறிவிப்பு', accountStatus: 'கணக்கு நிலை', financialHighlights: 'நிதிச் சிறப்பம்சங்கள்', immediateNextStep: 'அடுத்த படி', resolutionStillPossible: 'தீர்வு இன்னும் சாத்தியமே', sceneLabels: { opening: 'அறிவிப்பு', account: 'கணக்கு', context: 'மதிப்பாய்வு', amounts: 'தொகைகள்', action: 'நடவடிக்கை', closing: 'தீர்வு' }, openingIdentity: 'அடையாள விவரங்கள்', customerLabel: 'வாடிக்கையாளர்', clientLabel: 'வங்கி', productLabel: 'தயாரிப்பு', outstandingLabel: 'மொத்த நிலுவை', reviewMarkers: 'முக்கிய குறிகள்', leadLabel: 'முன்னணி', accountLabel: 'கணக்கு', currentDueLabel: 'தற்போதைய நிலுவை', amountsPrimaryHelper: 'முக்கிய தொகை', urgentAction: 'நடவடிக்கை தேவை', actionCardHelper: 'உடனடி தொடர்பு எதிர்பார்க்கப்படுகிறது.', finalSummary: 'சுருக்கம்', contactLabel: 'தொடர்பு',
  },
  Telugu: {
    titlePrefixFallback: 'ఖాతా నోటీసు', formalNotice: 'అధికారిక నోటీసు', accountStatus: 'ఖాతా స్థితి', financialHighlights: 'ఆర్థిక ముఖ్యాంశాలు', immediateNextStep: 'తదుపరి అడుగు', resolutionStillPossible: 'పరిష్కారం ఇంకా సాధ్యమే', sceneLabels: { opening: 'నోటీసు', account: 'ఖాతా', context: 'సమీక్ష', amounts: 'మొత్తాలు', action: 'చర్య', closing: 'పరిష్కారం' }, openingIdentity: 'గుర్తింపు వివరాలు', customerLabel: 'కస్టమర్', clientLabel: 'బ్యాంక్', productLabel: 'ఉత్పత్తి', outstandingLabel: 'మొత్తం బకాయి', reviewMarkers: 'ముఖ్య గుర్తులు', leadLabel: 'లీడ్', accountLabel: 'ఖాతా', currentDueLabel: 'ప్రస్తుత బకాయి', amountsPrimaryHelper: 'ముఖ్యమైన మొత్తం', urgentAction: 'చర్య అవసరం', actionCardHelper: 'తక్షణ సంప్రదింపు నిరీక్షణ.', finalSummary: 'సారాంశం', contactLabel: 'సంప్రదించండి',
  },
  Kannada: {
    titlePrefixFallback: 'ಖಾತೆ ಸೂಚನೆ', formalNotice: 'ಔಪಚಾರಿಕ ಸೂಚನೆ', accountStatus: 'ಖಾತೆ ಸ್ಥಿತಿ', financialHighlights: 'ಹಣಕಾಸಿನ ಮುಖ್ಯಾಂಶಗಳು', immediateNextStep: 'ಮುಂದಿನ ಹಂತ', resolutionStillPossible: 'ಪರಿಹಾರ ಇನ್ನೂ ಸಾಧ್ಯವಿದೆ', sceneLabels: { opening: 'ಸೂಚನೆ', account: 'ಖಾತೆ', context: 'ಪರಿಶೀಲನೆ', amounts: 'ಮೊತ್ತಗಳು', action: 'ಕ್ರಮ', closing: 'ಪರಿಹಾರ' }, openingIdentity: 'ಗುರುತಿನ ಮಾಹಿತಿ', customerLabel: 'ಗ್ರಾಹಕ', clientLabel: 'ಬ್ಯಾಂಕ್', productLabel: 'ಉತ್ಪನ್ನ', outstandingLabel: 'ಒಟ್ಟು ಬಾಕಿ', reviewMarkers: 'ಮುಖ್ಯ ಗುರುತುಗಳು', leadLabel: 'ಲೀಡ್', accountLabel: 'ಖಾತೆ', currentDueLabel: 'ಪ್ರಸ್ತುತ ಬಾಕಿ', amountsPrimaryHelper: 'ಪ್ರಮುಖ ಮೊತ್ತ', urgentAction: 'ಕ್ರಮ ಅಗತ್ಯ', actionCardHelper: 'ತಕ್ಷಣದ ಸಂಪರ್ಕ ನಿರೀಕ್ಷಿಸಲಾಗಿದೆ.', finalSummary: 'ಸಾರಾಂಶ', contactLabel: 'ಸಂಪರ್ಕ',
  },
  Bengali: {
    titlePrefixFallback: 'অ্যাকাউন্ট নোটিশ', formalNotice: 'আনুষ্ঠানিক নোটিশ', accountStatus: 'অ্যাকাউন্ট স্থিতি', financialHighlights: 'আর্থিক হাইলাইটস', immediateNextStep: 'পরবর্তী পদক্ষেপ', resolutionStillPossible: 'সমাধান এখনও সম্ভব', sceneLabels: { opening: 'নোটিশ', account: 'অ্যাকাউন্ট', context: 'পর্যালোচনা', amounts: 'পরিমাণ', action: 'পদক্ষেপ', closing: 'সমাধান' }, openingIdentity: 'পরিচয় বিবরণ', customerLabel: 'গ্রাহক', clientLabel: 'ব্যাঙ্ক', productLabel: 'পণ্য', outstandingLabel: 'মোট বকেয়া', reviewMarkers: 'মুখ্য সংকেত', leadLabel: 'লিড', accountLabel: 'অ্যাকাউন্ট', currentDueLabel: 'বর্তমান বকেয়া', amountsPrimaryHelper: 'প্রধান পরিমাণ', urgentAction: 'পদক্ষেপ প্রয়োজন', actionCardHelper: 'অবিলম্বে যোগাযোগ প্রত্যাশিত।', finalSummary: 'সারাংশ', contactLabel: 'যোগাযোগ',
  },
  Gujarati: {
    titlePrefixFallback: 'ખાતાની સૂચના', formalNotice: 'ઔપચારિક સૂચના', accountStatus: 'ખાતાની સ્થિતિ', financialHighlights: 'નાણાકીય મુખ્ય મુદ્દાઓ', immediateNextStep: 'આગળનું પગલું', resolutionStillPossible: 'ઉકેલ હજુ પણ શક્ય છે', sceneLabels: { opening: 'સૂચના', account: 'ખાતું', context: 'સમીક્ષા', amounts: 'રકમ', action: 'પગલાં', closing: 'ઉકેલ' }, openingIdentity: 'ઓળખ વિગતો', customerLabel: 'ગ્રાહક', clientLabel: 'બેંક', productLabel: 'ઉત્પાદન', outstandingLabel: 'કુલ બાકી', reviewMarkers: 'મુખ્ય સંકેતો', leadLabel: 'લીഡ്', accountLabel: 'ખાતું', currentDueLabel: 'વર્તમાન બાકી', amountsPrimaryHelper: 'મુખ્ય રકમ', urgentAction: 'પગલાં જરૂરી', actionCardHelper: 'તાત્કાલિક સંપર્ક અપેક્ષিত છે.', finalSummary: 'સારાંશ', contactLabel: 'संपર્ક',
  },
  Malayalam: {
    titlePrefixFallback: 'അക്കൗണ്ട് അറിയിപ്പ്', formalNotice: 'ഔദ്യോഗിക അറിയിപ്പ്', accountStatus: 'അക്കൗണ്ട് നില', financialHighlights: 'സാമ്പത്തിക വിവരങ്ങൾ', immediateNextStep: 'അടുത്ത ഘട്ടം', resolutionStillPossible: 'പരിഹാരം ഇപ്പോഴും സാധ്യമാണ്', sceneLabels: { opening: 'അറിയിപ്പ്', account: 'അക്കൗണ്ട്', context: 'പരിശോധന', amounts: 'തുകകൾ', action: 'നടപടി', closing: 'പരിഹാരം' }, openingIdentity: 'തിരിച്ചറിയൽ വിവരങ്ങൾ', customerLabel: 'ഉപഭോക്താവ്', clientLabel: 'ബാങ്ക്', productLabel: 'ഉൽപ്പന്നം', outstandingLabel: 'ആകെ കുടിശ്ശിക', reviewMarkers: 'പ്രധാന വിവരങ്ങൾ', leadLabel: 'ലീഡ്', accountLabel: 'അക്കൗണ്ട്', currentDueLabel: 'നിലവിലെ കുടിശ്ശിക', amountsPrimaryHelper: 'പ്രധാന തുക', urgentAction: 'നടപടി ആവശ്യമാണ്', actionCardHelper: 'ഉടനടി ബന്ധപ്പെടുക.', finalSummary: 'സംഗ്രഹം', contactLabel: 'ബന്ധപ്പെടുക',
  },
  Punjabi: {
    titlePrefixFallback: 'ਖਾਤਾ ਨੋਟਿਸ', formalNotice: 'ਰਸਮੀ ਨੋਟਿਸ', accountStatus: 'ਖਾਤੇ ਦੀ ਸਥਿਤੀ', financialHighlights: 'ਵਿੱਤੀ ਮੁੱਖ ਨੁਕਤੇ', immediateNextStep: 'ਅਗਲਾ ਕਦਮ', resolutionStillPossible: 'ਹੱਲ ਅਜੇ ਵੀ ਸੰਭਵ ਹੈ', sceneLabels: { opening: 'ਨੋਟਿਸ', account: 'ਖਾਤਾ', context: 'ਸਮੀਖਿਆ', amounts: 'ਰਾਸ਼ੀ', action: 'ਕਾਰਵਾਈ', closing: 'ਹੱਲ' }, openingIdentity: 'ਪਛਾਣ ਵੇਰਵਾ', customerLabel: 'ਗਾਹਕ', clientLabel: 'ਬੈਂਕ', productLabel: 'ਉਤਪਾਦ', outstandingLabel: 'ਕੁੱਲ ਬਕਾਇਆ', reviewMarkers: 'ਮੁੱਖ ਸੰਕੇਤ', leadLabel: 'ਲੀਡ', accountLabel: 'ਖਾਤਾ', currentDueLabel: 'ਮੌਜੂਦਾ ਬਕਾਇਆ', amountsPrimaryHelper: 'ਮੁੱਖ ਰਾਸ਼ੀ', urgentAction: 'ਕਾਰਵਾਈ ਲੋੜੀਂਦੀ', actionCardHelper: 'ਤੁਰੰਤ ਸੰਪਰਕ ਦੀ ਉਮੀਦ ਹੈ।', finalSummary: 'ਸਾਰ', contactLabel: 'ਸੰਪਰਕ',
  },
};

const getSubtitleColor = (colorName) => SUBTITLE_COLORS[colorName] || SUBTITLE_COLORS.White;
const getUiCopy = (language) => UI_COPY[language] || UI_COPY.English;

const fitTextSize = (text, baseSize, minSize, softLimit, hardLimit) => {
  const content = safeString(text, '');
  if (!content) {
    return baseSize;
  }
  const length = content.length;
  if (length <= softLimit) {
    return baseSize;
  }

  const cappedLength = Math.min(length, hardLimit);
  const progress = (cappedLength - softLimit) / Math.max(1, hardLimit - softLimit);
  return Math.round(baseSize - (baseSize - minSize) * progress);
};

const getAdaptiveTextStyle = (text, baseSize, options = {}) => {
  const {
    minSize = Math.round(baseSize * 0.72),
    softLimit = Math.max(14, Math.round(baseSize * 0.55)),
    hardLimit = Math.max(softLimit + 8, Math.round(baseSize * 1.25)),
  } = options;
  return {
    fontSize: fitTextSize(text, baseSize, minSize, softLimit, hardLimit),
    ...SAFE_TEXT_STYLE,
  };
};

const getStageScale = (width, height) =>
  Math.min(width / BASE_FRAME_WIDTH, height / BASE_FRAME_HEIGHT);

const getSubtitlePanelPlacement = (position) => {
  switch (position) {
    case 'Top':
      return {
        top: 120,
        left: 84,
        right: 84,
      };
    case 'Center':
      return {
        top: '50%',
        left: 84,
        right: 84,
        transform: 'translateY(-50%)',
      };
    default:
      return {
        bottom: 24,
        left: 84,
        right: 84,
      };
  }
};

const getLogoPlacement = (position) => {
  switch (position) {
    case 'Top Left':
      return {top: 120, left: 34};
    case 'Bottom Left':
      return {bottom: 214, left: 34};
    case 'Bottom Right':
      return {bottom: 214, right: 34};
    default:
      return {top: 120, right: 34};
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const getSceneVisualState = (frame, scene) => {
  const localFrame = frame - scene.start;
  const duration = Math.max(scene.duration, TRANSITION_FRAMES * 2 + 1);
  const opacity = interpolate(
    localFrame,
    [0, TRANSITION_FRAMES, duration - TRANSITION_FRAMES, duration],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
  );
  const translateY =
    interpolate(localFrame, [0, TRANSITION_FRAMES], [28, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }) +
    interpolate(localFrame, [duration - TRANSITION_FRAMES, duration], [0, -14], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  const scale = interpolate(localFrame, [0, TRANSITION_FRAMES], [0.982, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return {
    opacity,
    translateY,
    scale,
    progress: clamp(localFrame / duration, 0, 1),
    localFrame: Math.max(0, localFrame),
  };
};

const getAnimatedAmount = (rawValue, fallbackValue, localFrame, duration) => {
  const numericValue = extractNumericAmount(rawValue);
  if (numericValue === null) return fallbackValue;
  const animatedValue = Math.round(
    interpolate(localFrame, [0, Math.max(16, duration * 0.68)], [0, numericValue], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  return formatAmountDisplay(animatedValue);
};

// ─── Floating Orbs Background ───────────────────────────────────────────────

const FloatingOrbs = ({frame, accentColor}) => {
  const orbs = [
    {cx: 12, cy: 22, r: 340, sin_a: 0.018, sin_b: 0.011, cos_a: 0.013, cos_b: 0.009, opacity: 0.13},
    {cx: 78, cy: 68, r: 280, sin_a: 0.022, sin_b: 0.007, cos_a: 0.016, cos_b: 0.012, opacity: 0.10},
    {cx: 55, cy: 12, r: 200, sin_a: 0.014, sin_b: 0.019, cos_a: 0.010, cos_b: 0.015, opacity: 0.08},
    {cx: 90, cy: 40, r: 180, sin_a: 0.011, sin_b: 0.024, cos_a: 0.017, cos_b: 0.008, opacity: 0.07},
  ];

  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {orbs.map((orb, i) => {
        const dx = Math.sin(frame * orb.sin_a + i * 1.2) * 28;
        const dy = Math.cos(frame * orb.cos_a + i * 0.9) * 20;
        const pulse = 1 + Math.sin(frame * orb.sin_b + i * 2.1) * 0.06;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${orb.cx}%`,
              top: `${orb.cy}%`,
              width: orb.r,
              height: orb.r,
              borderRadius: '50%',
              transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${pulse})`,
              background: `radial-gradient(circle, ${accentColor}${Math.round(orb.opacity * 255).toString(16).padStart(2, '0')}, transparent 70%)`,
              filter: 'blur(40px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Scene Shell ────────────────────────────────────────────────────────────

const SceneShell = ({scene, frame, children, align = 'center', padding = '92px 74px 188px'}) => {
  const visual = getSceneVisualState(frame, scene);
  if (visual.opacity <= 0.01) return null;

  return (
    <AbsoluteFill
      style={{
        padding,
        opacity: visual.opacity,
        transform: `translateY(${visual.translateY}px) scale(${visual.scale})`,
        justifyContent: align,
      }}
    >
      {children(visual)}
    </AbsoluteFill>
  );
};

// ─── Brand HUD ──────────────────────────────────────────────────────────────

const BrandHud = ({lead, accentColor, activeSceneLabel, frame, uiCopy, logo}) => {
  // Breathing dot: oscillates scale gently
  const dotPulse = 1 + Math.sin(frame * 0.14) * 0.22;
  const dotGlow = 0.55 + Math.sin(frame * 0.14) * 0.45;

  const showTopRightLogo = logo?.public_path && (!logo.position || logo.position === 'Top Right');

  return (
    <div
      style={{
        position: 'absolute',
        top: 32,
        left: 34,
        right: 34,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
      }}
    >
      <div
        style={{
          padding: '4px 0',
          maxWidth: '48%',
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2.4,
            textTransform: 'uppercase',
            color: '#94a3b8',
            textShadow: '0 4px 16px rgba(2, 6, 23, 0.9)',
            ...SAFE_TEXT_STYLE,
          }}
        >
          {safeString(lead.title_prefix, uiCopy.titlePrefixFallback)}
        </div>
        <div
          style={{
            fontWeight: 700,
            marginTop: 4,
            color: '#f8fafc',
            textShadow: '0 6px 20px rgba(2, 6, 23, 0.95)',
            ...getAdaptiveTextStyle(lead.client_name, 18, {minSize: 14, softLimit: 18, hardLimit: 42}),
          }}
        >
          {safeString(lead.client_name)}
        </div>
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 18,
            border: 'none',
            background: 'transparent',
            backdropFilter: 'none',
          }}
        >
          {/* Breathing pulse dot */}
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: accentColor,
              boxShadow: `0 0 ${Math.round(12 + dotGlow * 18)}px ${accentColor}`,
              transform: `scale(${dotPulse})`,
              display: 'inline-block',
            }}
          />
          <div
            style={{
              fontSize: 12,
              letterSpacing: 1.8,
              textTransform: 'uppercase',
              color: '#cbd5e1',
              ...SAFE_TEXT_STYLE,
            }}
          >
            {activeSceneLabel}
          </div>
        </div>

        {showTopRightLogo && (
          <Img
            src={staticFile(logo.public_path)}
            style={{
              display: 'block',
              maxWidth: 300,
              maxHeight: 120,
              objectFit: 'contain',
              opacity: clamp((logo.opacity ?? 80) / 100, 0, 1),
              filter: 'drop-shadow(0 4px 12px rgba(2, 6, 23, 0.4))',
            }}
          />
        )}
      </div>
    </div>
  );
};

// ─── Progress Track ──────────────────────────────────────────────────────────

const ProgressTrack = ({timeline, frame, accentColor, sceneLabels}) => {
  // Pulse glow for active segment
  const glowPulse = 0.7 + Math.sin(frame * 0.18) * 0.30;

  return (
    <div
      style={{
        position: 'absolute',
        left: 74,
        right: 74,
        bottom: 162,
        display: 'grid',
        gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))`,
        gap: 14,
        zIndex: 20,
      }}
    >
      {timeline.map((scene) => {
        const isActive = frame >= scene.start && frame < scene.end;
        const progress = clamp((frame - scene.start) / scene.duration, 0, 1);
        return (
          <div key={scene.key} style={{display: 'grid', gap: 8}}>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.1)',
              }}
            >
              <div
                style={{
                  width: `${isActive ? progress * 100 : frame >= scene.end ? 100 : 0}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: isActive
                    ? `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`
                    : 'rgba(255,255,255,0.38)',
                  boxShadow: isActive
                    ? `0 0 ${Math.round(8 + glowPulse * 16)}px ${accentColor}`
                    : 'none',
                  transition: 'none',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                opacity: isActive ? 1 : 0.72,
                ...SAFE_TEXT_STYLE,
              }}
            >
              {sceneLabels?.[scene.key] || scene.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Subtitle Panel (word-by-word karaoke) ───────────────────────────────────

const SubtitlePanel = ({subtitle, subtitleProgress, branding, fallbackText}) => {
  const words = subtitle ? subtitle.text.split(' ') : [];
  const subtitleColor = getSubtitleColor(branding?.color);
  const placement = getSubtitlePanelPlacement(branding?.position);
  const activeWordIndex = subtitle
    ? Math.min(words.length - 1, Math.floor(subtitleProgress * words.length))
    : -1;
  const isDark = subtitleColor === '#000000';

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 25,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 18px',
        ...placement,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1500,
          textAlign: 'center',
        }}
      >
        {subtitle ? (
          <div
            style={{
              fontSize: 20,
              lineHeight: 1.35,
              fontWeight: 600,
              color: isDark ? 'rgba(30, 30, 30, 0.7)' : '#94a3b8',
              flexWrap: 'wrap',
              display: 'flex',
              justifyContent: 'center',
              gap: '0 6px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.82)' : 'transparent',
              borderRadius: isDark ? 12 : 0,
              padding: isDark ? '6px 14px' : 0,
            }}
          >
            {words.map((word, i) => {
              const isPast = i < activeWordIndex;
              const isCurrent = i === activeWordIndex;
              return (
                <span
                  key={i}
                  style={{
                    color: isDark
                      ? (isCurrent ? '#000000' : isPast ? '#374151' : 'rgba(55, 65, 81, 0.65)')
                      : (isPast ? '#e2e8f0' : isCurrent ? subtitleColor : 'rgba(226, 232, 240, 0.74)'),
                    fontWeight: isCurrent ? 800 : isPast ? 600 : 500,
                    textShadow: isDark
                      ? 'none'
                      : (isCurrent
                        ? `0 0 18px ${subtitleColor}, 0 4px 16px rgba(2, 6, 23, 0.95)`
                        : '0 4px 16px rgba(2, 6, 23, 0.95)'),
                    transition: 'none',
                    display: 'inline-block',
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              fontSize: 20,
              lineHeight: 1.35,
              fontWeight: 500,
              color: isDark ? 'rgba(30, 30, 30, 0.7)' : 'rgba(226, 232, 240, 0.76)',
              textShadow: isDark ? 'none' : '0 4px 16px rgba(2, 6, 23, 0.95)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.82)' : 'transparent',
              borderRadius: isDark ? 12 : 0,
              padding: isDark ? '6px 14px' : 0,
            }}
          >
            {fallbackText}
          </div>
        )}
      </div>
    </div>
  );
};

const LogoOverlay = ({logo}) => {
  if (!logo?.public_path || logo.position === 'Top Right' || !logo.position) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 24,
        ...getLogoPlacement(logo.position),
      }}
    >
      <Img
        src={staticFile(logo.public_path)}
        style={{
          display: 'block',
          maxWidth: 300,
          maxHeight: 120,
          objectFit: 'contain',
          opacity: clamp((logo.opacity ?? 80) / 100, 0, 1),
          filter: 'drop-shadow(0 10px 22px rgba(2, 6, 23, 0.28))',
        }}
      />
    </div>
  );
};

// ─── Opening Scene ───────────────────────────────────────────────────────────

const OpeningScene = ({scene, frame, fps, lead, accentColor, uiCopy}) => (
  <SceneShell scene={scene} frame={frame} align="space-between">
    {({localFrame}) => {
      const headlineReveal = spring({
        fps,
        frame: localFrame,
        config: {damping: 18, stiffness: 88},
      });
      const cardReveal = spring({
        fps,
        frame: localFrame - 10,
        config: {damping: 20, stiffness: 90},
      });
      // Stagger for each identity row
      const row0 = spring({fps, frame: localFrame - 14, config: {damping: 18, stiffness: 92}});
      const row1 = spring({fps, frame: localFrame - 22, config: {damping: 18, stiffness: 92}});
      const row2 = spring({fps, frame: localFrame - 30, config: {damping: 18, stiffness: 92}});

      return (
        <>
          <div style={{maxWidth: 780}}>
            <div
              style={{
                display: 'inline-flex',
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${accentColor}55`,
                background: `${accentColor}12`,
                color: '#f8fafc',
                fontSize: 13,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                transform: `translateY(${(1 - headlineReveal) * 18}px)`,
                opacity: headlineReveal,
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.opening.eyebrow, uiCopy.formalNotice)}
            </div>
            <div
              style={{
                lineHeight: 1.04,
                fontWeight: 800,
                marginTop: 20,
                letterSpacing: -1.8,
                color: '#f8fafc',
                transform: `translateY(${(1 - headlineReveal) * 26}px)`,
                opacity: headlineReveal,
                ...getAdaptiveTextStyle(lead.scene_payload.opening?.headline || lead.headline_text, 70, {
                  minSize: 46,
                  softLimit: 52,
                  hardLimit: 116,
                }),
              }}
            >
              {safeString(lead.scene_payload.opening.headline, lead.headline_text)}
            </div>
            <div
              style={{
                lineHeight: 1.5,
                marginTop: 18,
                maxWidth: 620,
                color: '#cbd5e1',
                transform: `translateY(${(1 - headlineReveal) * 30}px)`,
                opacity: headlineReveal,
                ...getAdaptiveTextStyle(
                  lead.scene_payload.opening?.subheadline || `${safeString(lead.client_name)} | ${safeString(lead.lan)}`,
                  24,
                  {minSize: 18, softLimit: 28, hardLimit: 70}
                ),
              }}
            >
              {safeString(
                lead.scene_payload.opening.subheadline,
                `${safeString(lead.client_name)} | खाता ${safeString(lead.lan)}`
              )}
            </div>
          </div>

          {/* Card with staggered identity rows */}
          <div
            style={{
              width: 460,
              alignSelf: 'flex-end',
              padding: '28px 30px',
              borderRadius: 28,
              background: 'rgba(10, 24, 46, 0.72)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(18px)',
              boxShadow: `0 18px 50px ${accentColor}18`,
              transform: `translateY(${(1 - cardReveal) * 32}px)`,
              opacity: cardReveal,
            }}
          >
            <div
              style={{
                height: 228,
                marginBottom: 20,
                overflow: 'hidden',
                borderRadius: 22,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(15,23,42,0.4), rgba(15,23,42,0.15))',
              }}
            >
              <Img
                src={legalGavelImage}
                style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.06)'}}
              />
            </div>
            <div
              style={{
                fontSize: 14,
                letterSpacing: 1.8,
                textTransform: 'uppercase',
                color: '#94a3b8',
                marginBottom: 18,
                ...SAFE_TEXT_STYLE,
              }}
            >
              {uiCopy.openingIdentity}
            </div>
            <div style={{display: 'grid', gap: 18}}>
              <StaggeredIdentityRow
                label={uiCopy.customerLabel}
                value={safeString(lead.customer_name)}
                reveal={row0}
              />
              <StaggeredIdentityRow
                label={uiCopy.clientLabel}
                value={safeString(lead.client_name)}
                reveal={row1}
              />
              <StaggeredIdentityRow
                label={uiCopy.productLabel}
                value={safeString(lead.product_type, 'loan')}
                reveal={row2}
              />
            </div>
          </div>
        </>
      );
    }}
  </SceneShell>
);

// ─── Account Scene ───────────────────────────────────────────────────────────

const AccountScene = ({scene, frame, fps, lead, accentColor, uiCopy}) => (
  <SceneShell scene={scene} frame={frame} align="space-between">
    {({localFrame, progress}) => {
      const heroReveal = spring({fps, frame: localFrame, config: {damping: 16, stiffness: 92}});
      const sideReveal = spring({fps, frame: localFrame - 10, config: {damping: 18, stiffness: 88}});
      // Kinetic pulse on the white card during count-up
      const countPulse = 1 + Math.sin(progress * Math.PI * 3) * 0.012 * (1 - progress);

      return (
        <>
          <div style={{maxWidth: 760}}>
            <div
              style={{
                fontSize: 14,
                letterSpacing: 2.4,
                textTransform: 'uppercase',
                color: '#94a3b8',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.account.eyebrow, uiCopy.accountStatus)}
            </div>
            <div
              style={{
                fontWeight: 900,
                lineHeight: 0.95,
                marginTop: 16,
                letterSpacing: -2.4,
                color: '#f8fafc',
                transform: `translateX(${(1 - heroReveal) * -28}px)`,
                opacity: heroReveal,
                ...getAdaptiveTextStyle(lead.scene_payload.account?.headline || safeString(lead.lan), 88, {
                  minSize: 56,
                  softLimit: 24,
                  hardLimit: 56,
                }),
              }}
            >
              {safeString(lead.scene_payload.account.headline, `खाता ${safeString(lead.lan)}`)}
            </div>
            <div
              style={{
                display: 'inline-flex',
                padding: '12px 18px',
                borderRadius: 999,
                background: `${accentColor}20`,
                border: `1px solid ${accentColor}50`,
                color: '#f8fafc',
                fontSize: 18,
                fontWeight: 700,
                marginTop: 24,
                transform: `translateY(${(1 - heroReveal) * 18}px)`,
                opacity: heroReveal,
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.account.badge, 'Priority attention required')}
            </div>
            <div
              style={{
                lineHeight: 1.42,
                marginTop: 22,
                color: '#cbd5e1',
                maxWidth: 720,
                transform: `translateY(${(1 - heroReveal) * 22}px)`,
                opacity: heroReveal,
                ...getAdaptiveTextStyle(lead.scene_payload.account?.supporting, 28, {
                  minSize: 21,
                  softLimit: 34,
                  hardLimit: 92,
                }),
              }}
            >
              {safeString(
                lead.scene_payload.account.supporting,
                `वर्तमान कुल बकाया ${safeString(lead.display_amounts.primary.value)}`
              )}
            </div>
          </div>

          <div
            style={{
              width: 340,
              padding: '30px 28px',
              borderRadius: 30,
              background: 'rgba(250, 250, 252, 0.94)',
              color: '#0f172a',
              boxShadow: '0 30px 80px rgba(2, 8, 23, 0.28)',
              transform: `translateY(${(1 - sideReveal) * 34}px) scale(${countPulse})`,
              opacity: sideReveal,
            }}
          >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  ...SAFE_TEXT_STYLE,
                }}
              >
                {uiCopy.outstandingLabel}
              </div>
            <div style={{fontSize: 52, fontWeight: 900, lineHeight: 1.02, marginTop: 18}}>
              {safeString(lead.display_amounts.primary.value)}
            </div>
            <div style={{marginTop: 18, fontSize: 17, lineHeight: 1.5, color: '#475569'}}>
              {safeString(lead.customer_name)} के खाते में त्वरित समाधान अपेक्षित है।
            </div>
          </div>
        </>
      );
    }}
  </SceneShell>
);

// ─── Context Scene ───────────────────────────────────────────────────────────

const ContextScene = ({scene, frame, fps, lead, uiCopy}) => (
  <SceneShell scene={scene} frame={frame} padding="104px 66px 86px">
    {({localFrame}) => {
      const reveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 84}});
      const body = safeString(lead.scene_payload.context.body, lead.script_text);
      const visibleCharacters = Math.max(
        1,
        Math.floor(
          interpolate(localFrame, [0, Math.max(20, scene.duration * 0.72)], [0, body.length], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        )
      );
      const revealedBody = body.slice(0, visibleCharacters);

      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.25fr 0.75fr',
            gap: 30,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              padding: '34px 36px',
              borderRadius: 32,
              background: 'rgba(250, 250, 252, 0.96)',
              color: '#0f172a',
              boxShadow: '0 24px 60px rgba(2, 8, 23, 0.24)',
              transform: `translateY(${(1 - reveal) * 24}px)`,
              opacity: reveal,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: '#64748b',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.context.eyebrow, lead.language === 'English' ? 'Status Summary' : 'स्थिति सारांश')}
            </div>
            <div
              style={{
                fontWeight: 800,
                lineHeight: 1.08,
                marginTop: 16,
                ...getAdaptiveTextStyle(lead.scene_payload.context?.headline, 46, {
                  minSize: 32,
                  softLimit: 34,
                  hardLimit: 90,
                }),
              }}
            >
              {safeString(lead.scene_payload.context.headline)}
            </div>
            <div
              style={{
                lineHeight: 1.58,
                marginTop: 22,
                color: '#334155',
                ...getAdaptiveTextStyle(revealedBody, 27, {minSize: 20, softLimit: 88, hardLimit: 220}),
              }}
            >
              {revealedBody}
            </div>
          </div>

          <div
            style={{
              padding: '28px 28px 32px',
              borderRadius: 30,
              background: 'rgba(8, 20, 40, 0.74)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(16px)',
              transform: `translateY(${(1 - reveal) * 32}px)`,
              opacity: reveal,
            }}
          >
            <div
              style={{
                height: 154,
                overflow: 'hidden',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 18,
              }}
            >
              <Img
                src={debtNoticeImage}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: '#94a3b8',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {uiCopy.reviewMarkers}
            </div>
            <div style={{display: 'grid', gap: 14, marginTop: 18}}>
              <ContextMarker title={uiCopy.leadLabel} text={safeString(lead.customer_name)} />
              <ContextMarker title={uiCopy.accountLabel} text={safeString(lead.lan)} />
              <ContextMarker title={uiCopy.clientLabel} text={safeString(lead.client_name)} />
              <ContextMarker
                title={uiCopy.currentDueLabel}
                text={safeString(lead.display_amounts.primary.value)}
              />
            </div>
          </div>
        </div>
      );
    }}
  </SceneShell>
);

// ─── Amounts Scene ───────────────────────────────────────────────────────────

const AmountsScene = ({scene, frame, fps, lead, accentColor, uiCopy}) => (
  <SceneShell scene={scene} frame={frame}>
    {({localFrame}) => {
      const headerReveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 92}});
      const primaryReveal = spring({fps, frame: localFrame + 4, config: {damping: 17, stiffness: 90}});
      const secondaryReveal = spring({fps, frame: localFrame - 6, config: {damping: 16, stiffness: 88}});
      const primaryAmount = getAnimatedAmount(
        lead.display_amounts.primary.raw,
        lead.display_amounts.primary.value,
        localFrame,
        scene.duration
      );
      const secondaryAmount = lead.display_amounts.secondary.available
        ? getAnimatedAmount(
            lead.display_amounts.secondary.raw,
            lead.display_amounts.secondary.value,
            localFrame - 6,
            scene.duration
          )
        : lead.display_amounts.secondary.value;

      return (
        <div style={{display: 'grid', gap: 24}}>
          <div style={{maxWidth: 780, opacity: headerReveal}}>
            <div
              style={{
                fontSize: 14,
                letterSpacing: 2.4,
                textTransform: 'uppercase',
                color: '#94a3b8',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.amounts.eyebrow, uiCopy.financialHighlights)}
            </div>
            <div
              style={{
                fontWeight: 800,
                lineHeight: 1.08,
                marginTop: 14,
                color: '#f8fafc',
                ...getAdaptiveTextStyle(lead.scene_payload.amounts?.headline, 60, {
                  minSize: 42,
                  softLimit: 22,
                  hardLimit: 64,
                }),
              }}
            >
              {safeString(lead.scene_payload.amounts.headline, 'राशि सारांश')}
            </div>
            <div
              style={{
                lineHeight: 1.45,
                marginTop: 16,
                color: '#cbd5e1',
                ...getAdaptiveTextStyle(lead.scene_payload.amounts?.body, 24, {
                  minSize: 18,
                  softLimit: 44,
                  hardLimit: 120,
                }),
              }}
            >
              {safeString(lead.scene_payload.amounts.body)}
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 22}}>
            <AmountCard
              title={safeString(lead.display_amounts.primary.label)}
              value={primaryAmount}
              helper={uiCopy.amountsPrimaryHelper}
              accentColor={accentColor}
              opacity={primaryReveal}
              background="linear-gradient(160deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.78))"
              shimmerFrame={localFrame}
            />
            <AmountCard
              title={safeString(lead.display_amounts.secondary.label)}
              value={secondaryAmount}
              helper={safeString(lead.scene_payload.amounts.note)}
              accentColor="#94a3b8"
              opacity={secondaryReveal}
              background="linear-gradient(160deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.74))"
              shimmerFrame={null}
            />
          </div>
        </div>
      );
    }}
  </SceneShell>
);

// ─── Action Scene ─────────────────────────────────────────────────────────────

const ActionScene = ({scene, frame, fps, lead, accentColor, uiCopy}) => (
  <SceneShell scene={scene} frame={frame}>
    {({localFrame, progress}) => {
      const reveal = spring({fps, frame: localFrame, config: {damping: 16, stiffness: 92}});
      // Bouncy spring for phone number
      const phoneReveal = spring({
        fps,
        frame: localFrame - 20,
        config: {damping: 10, stiffness: 120},
      });
      const glowOpacity = interpolate(progress, [0, 1], [0.12, 0.28], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      // Pulsing CTA badge
      const badgePulse = 1 + Math.sin(localFrame * 0.18) * 0.04;
      const badgeGlow = 0.4 + Math.sin(localFrame * 0.18) * 0.3;

      return (
        <div
          style={{
            position: 'relative',
            padding: '40px 42px',
            borderRadius: 36,
            background: 'rgba(5, 16, 35, 0.74)',
            border: '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(18px)',
            boxShadow: `0 0 80px ${accentColor}${Math.round(glowOpacity * 255)
              .toString(16)
              .padStart(2, '0')}`,
            transform: `translateY(${(1 - reveal) * 24}px) scale(${0.98 + reveal * 0.02})`,
            opacity: reveal,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 36,
              background: `radial-gradient(circle at top right, ${accentColor}33, transparent 36%)`,
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '1.15fr 0.85fr',
              gap: 28,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase',
                  color: '#94a3b8',
                  ...SAFE_TEXT_STYLE,
                }}
              >
                {safeString(lead.scene_payload.action.eyebrow, uiCopy.immediateNextStep)}
              </div>
              <div
              style={{
                  lineHeight: 1.02,
                  fontWeight: 900,
                  marginTop: 16,
                  color: '#f8fafc',
                  ...getAdaptiveTextStyle(lead.scene_payload.action?.headline, 62, {
                    minSize: 42,
                    softLimit: 24,
                    hardLimit: 70,
                  }),
                }}
              >
                {safeString(lead.scene_payload.action.headline, 'आज ही संपर्क करें')}
              </div>
              <div
                style={{
                  lineHeight: 1.52,
                  marginTop: 18,
                  color: '#dbe4f0',
                  ...getAdaptiveTextStyle(lead.scene_payload.action?.body || lead.cta_text, 26, {
                    minSize: 18,
                    softLimit: 58,
                    hardLimit: 160,
                  }),
                }}
              >
                {safeString(lead.scene_payload.action.body, lead.cta_text)}
              </div>

              {/* Pulsing urgency badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 22,
                  padding: '10px 18px',
                  borderRadius: 999,
                  background: `${accentColor}${Math.round(0.18 * 255).toString(16).padStart(2, '0')}`,
                  border: `1px solid ${accentColor}${Math.round(badgeGlow * 255).toString(16).padStart(2, '0')}`,
                  transform: `scale(${badgePulse})`,
                  boxShadow: `0 0 20px ${accentColor}${Math.round(badgeGlow * 0.5 * 255).toString(16).padStart(2, '0')}`,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: accentColor,
                    display: 'inline-block',
                    boxShadow: `0 0 10px ${accentColor}`,
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: '#f8fafc',
                    ...SAFE_TEXT_STYLE,
                  }}
                >
                  {uiCopy.urgentAction}
                </span>
              </div>
            </div>

            {/* CTA card with bouncy phone number */}
            <div
              style={{
                alignSelf: 'center',
                padding: '28px',
                borderRadius: 28,
                background: 'rgba(248, 250, 252, 0.96)',
                color: '#0f172a',
                boxShadow: '0 24px 60px rgba(2, 8, 23, 0.22)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  color: '#64748b',
                  ...SAFE_TEXT_STYLE,
                }}
              >
                {safeString(lead.scene_payload.action.cta_label, 'संपर्क नंबर')}
              </div>
              <div
                style={{
                  fontWeight: 900,
                  lineHeight: 1.05,
                  marginTop: 18,
                  transform: `scale(${0.88 + phoneReveal * 0.12}) translateY(${(1 - phoneReveal) * 12}px)`,
                  opacity: phoneReveal,
                  ...getAdaptiveTextStyle(lead.scene_payload.action?.cta_value || lead.contact_details, 44, {
                    minSize: 30,
                    softLimit: 16,
                    hardLimit: 34,
                  }),
                }}
              >
                {safeString(
                  lead.scene_payload.action.cta_value,
                  safeString(lead.contact_details)
                )}
              </div>
              <div
                style={{
                  lineHeight: 1.55,
                  marginTop: 18,
                  color: '#475569',
                  ...getAdaptiveTextStyle(uiCopy.actionCardHelper, 17, {
                    minSize: 14,
                    softLimit: 42,
                    hardLimit: 96,
                  }),
                }}
              >
                {uiCopy.actionCardHelper}
              </div>
            </div>
          </div>
        </div>
      );
    }}
  </SceneShell>
);

const PaymentPhoneWalkthroughScene = ({scene, frame, fps, lead, accentColor, uiCopy, currentTime, stepBoundaries}) => (
  <SceneShell scene={scene} frame={frame}>
    {({localFrame}) => {
      const copy = getPaymentCopy(lead.language);
      const reveal = spring({fps, frame: localFrame, config: {damping: 17, stiffness: 92}});
      const phoneReveal = spring({fps, frame: localFrame - 8, config: {damping: 18, stiffness: 86}});
      const amount = safeString(lead.display_amounts.primary.value, safeString(lead.tos, '0'));
      const account = safeString(lead.lan, 'N/A');
      const client = safeString(lead.client_name, 'TVS Credit');
      const contact = safeString(lead.contact_details, lead.scene_payload.action?.cta_value || '');
      const paymentBody = `${copy.checklist[0][1]} ${copy.checklist[1][1]} ${copy.checklist[2][1]}`;
      const steps = copy.phoneSteps.map((step, index) => ({
        ...step,
        title: step.title || amount,
        subtitle: index === 2 ? `${step.subtitle} ${account}` : step.subtitle,
      }));
      const stepCount = Math.min(steps.length, PHONE_STEP_CONFIG.length);

      // Prefer subtitle-anchored step advancement (so step transitions align with
      // narration). Fall back to weighted localFrame when anchors are missing
      // (e.g. preview without subtitles, or the second walkthrough pass after
      // all anchor lines have already been spoken).
      const anchors = Array.isArray(stepBoundaries) ? stepBoundaries : [];
      const haveAnchors = anchors.some((t) => typeof t === 'number');
      const sceneStartTime = scene.start / fps;
      const sceneEndTime = scene.end / fps;
      const anchorsInScene =
        haveAnchors &&
        anchors.some(
          (t) => typeof t === 'number' && t >= sceneStartTime && t <= sceneEndTime,
        );

      let activeIndex;
      if (anchorsInScene && typeof currentTime === 'number') {
        activeIndex = stepCount - 1;
        for (let i = 0; i < stepCount - 1; i += 1) {
          const boundary = anchors[i];
          if (typeof boundary === 'number' && currentTime < boundary) {
            activeIndex = i;
            break;
          }
        }
      } else {
        const totalWeight = PHONE_STEP_CONFIG.slice(0, stepCount).reduce((sum, s) => sum + s.weight, 0);
        const elapsed = interpolate(
          localFrame,
          [12, Math.max(64, scene.duration - 20)],
          [0, totalWeight],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        );
        let cumulative = 0;
        activeIndex = stepCount - 1;
        for (let i = 0; i < stepCount; i += 1) {
          cumulative += PHONE_STEP_CONFIG[i].weight;
          if (elapsed < cumulative) {
            activeIndex = i;
            break;
          }
        }
      }
      const screenStep = steps[activeIndex];
      const activeTap = PHONE_STEP_CONFIG[activeIndex]?.tap || null;
      const tapPulse = 0.35 + Math.abs(Math.sin((localFrame / fps) * Math.PI * 2 * 1.05)) * 0.65;

      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 410px',
            gap: 36,
            alignItems: 'center',
            height: '100%',
            padding: '28px 34px',
            borderRadius: 36,
            background: 'linear-gradient(135deg, rgba(15,23,42,0.98), rgba(49,46,129,0.92))',
            boxShadow: '0 32px 90px rgba(15,23,42,0.22)',
          }}
        >
          <div
            style={{
              transform: `translateY(${(1 - reveal) * 24}px)`,
              opacity: reveal,
            }}
          >
            <div
              style={{
                fontSize: 14,
                letterSpacing: 2.4,
                textTransform: 'uppercase',
                color: '#94a3b8',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {copy.phoneEyebrow}
            </div>
            <div
              style={{
                lineHeight: 1.02,
                fontWeight: 900,
                marginTop: 16,
                color: '#f8fafc',
                ...getAdaptiveTextStyle(lead.scene_payload.action?.headline, 64, {
                  minSize: 38,
                  softLimit: 24,
                  hardLimit: 72,
                }),
              }}
            >
              {copy.phoneHeadline}
            </div>
            <div
              style={{
                lineHeight: 1.52,
                marginTop: 20,
                color: '#dbe4f0',
                maxWidth: 700,
                  ...getAdaptiveTextStyle(lead.scene_payload.action?.body || lead.cta_text, 22, {
                  minSize: 16,
                  softLimit: 70,
                  hardLimit: 180,
                }),
              }}
            >
              {paymentBody}
            </div>

            <div style={{display: 'grid', gap: 8, marginTop: 18, maxWidth: 620}}>
              {steps.map((step, index) => {
                const done = index < activeIndex;
                const current = index === activeIndex;
                return (
                  <div
                    key={step.label}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 1fr',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 16,
                      background: current ? `${accentColor}22` : 'rgba(15, 23, 42, 0.62)',
                      border: `1px solid ${current ? accentColor : 'rgba(255,255,255,0.1)'}`,
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        display: 'grid',
                        placeItems: 'center',
                        background: done || current ? accentColor : 'rgba(148,163,184,0.2)',
                        color: '#020817',
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {done ? '✓' : index + 1}
                    </div>
                    <div>
                      <div style={{fontSize: 15, fontWeight: 800, color: '#f8fafc'}}>{step.title}</div>
                      <div style={{fontSize: 11, color: '#94a3b8', marginTop: 1}}>{step.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              width: 300,
              height: 530,
              justifySelf: 'center',
              borderRadius: 46,
              padding: 14,
              background: 'linear-gradient(160deg, #111827, #020617)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: `0 34px 90px ${accentColor}35`,
              transform: `translateY(${(1 - phoneReveal) * 30}px) rotate(${(1 - phoneReveal) * -3}deg)`,
              opacity: phoneReveal,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: '50%',
                width: 94,
                height: 22,
                transform: 'translateX(-50%)',
                borderRadius: '0 0 18px 18px',
                background: '#020617',
                zIndex: 2,
              }}
            />
            <div
              style={{
                height: '100%',
                borderRadius: 34,
                overflow: 'hidden',
                background: '#f8fafc',
                color: '#111827',
                position: 'relative',
              }}
            >
              <Img
                src={PHONE_STEP_CONFIG[activeIndex]?.image || PHONE_STEP_CONFIG[0].image}
                style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
              />
              {activeTap ? (
                <div
                  style={{
                    position: 'absolute',
                    left: activeTap.x,
                    top: activeTap.y,
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    border: '3px solid rgba(255,255,255,0.95)',
                    background: `rgba(95, 37, 159, ${0.18 + tapPulse * 0.18})`,
                    transform: `translate(-50%, -50%) scale(${0.82 + tapPulse * 0.36})`,
                    boxShadow: '0 0 0 10px rgba(95, 37, 159, 0.12)',
                  }}
                />
              ) : null}
            </div>
          </div>

          {contact ? (
            <div
              style={{
                position: 'absolute',
                right: 92,
                bottom: 98,
                padding: '12px 18px',
                borderRadius: 999,
                background: 'rgba(248,250,252,0.95)',
                color: '#0f172a',
                fontSize: 18,
                fontWeight: 900,
                boxShadow: '0 18px 44px rgba(2, 8, 23, 0.22)',
              }}
            >
              {copy.help}: {contact}
            </div>
          ) : null}
        </div>
      );
    }}
  </SceneShell>
);

const PhoneRow = ({label, value, active}) => (
  <div
    style={{
      padding: '9px 12px',
      borderRadius: 14,
      background: active ? 'rgba(95,37,159,0.1)' : '#eef2f7',
      border: `1px solid ${active ? '#5f259f' : 'rgba(148,163,184,0.32)'}`,
    }}
  >
    <div style={{fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 800}}>{label}</div>
    <div style={{fontSize: 15, fontWeight: 900, marginTop: 3, ...SAFE_TEXT_STYLE}}>{value}</div>
  </div>
);

const PAYMENT_COPY = {
  English: {
    topTitle: 'Payment Guidance',
    topSubtitle: 'Reference walkthrough for customers',
    welcome: 'Welcome',
    welcomeHeadline: (name) => `Hi ${name}, here is your payment guide`,
    welcomeBody: (client) => `Use this video as a quick reference to complete your ${client} loan payment safely.`,
    summary: 'Payment summary',
    loanAccount: 'Loan account',
    provider: 'Provider',
    support: 'Support',
    beforeStart: 'Before you start',
    readyTitle: 'Keep these details ready',
    checklist: [
      ['Payment link or PhonePe app', 'Open the link shared with you or use the PhonePe app.'],
      ['Loan account number', 'Keep your LAN ready to verify the account.'],
      ['Payable amount', 'Enter the amount shown in this video and review it.'],
    ],
    phoneEyebrow: 'PhonePe process',
    phoneHeadline: 'Open PhonePe and pay',
    phoneSecure: 'Secure payment',
    phoneSteps: [
      {label: 'PhonePe', title: 'PhonePe', subtitle: 'Payment link ready'},
      {label: 'Loan Payment', title: 'Loan Payment', subtitle: 'Choose biller category'},
      {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'Account'},
      {label: 'Amount', title: null, subtitle: 'Review and pay'},
    ],
    biller: 'Biller',
    loanAccountUi: 'Loan account',
    payableAmount: 'Payable amount',
    company: 'Company',
    selectBiller: 'Select biller',
    enterAmount: 'Enter amount',
    proceed: 'Proceed to Pay',
    help: 'Help',
    reviewEyebrow: 'Review before paying',
    reviewTitle: 'Confirm every detail',
    reviewBody: 'Match the provider, loan account, and amount before tapping proceed.',
    needHelp: 'Need help?',
    supportAvailable: 'Support is available',
    helpTitle: 'Need help while paying?',
    helpBody: 'Contact this number for payment assistance or any other information.',
    fallbackSubtitle: 'Follow the steps on screen to complete payment.',
  },
  Hindi: {
    topTitle: 'भुगतान मार्गदर्शन',
    topSubtitle: 'ग्राहकों के लिए संदर्भ वीडियो',
    welcome: 'स्वागत है',
    welcomeHeadline: (name) => `${name} जी, यह आपका भुगतान गाइड है`,
    welcomeBody: (client) => `${client} लोन भुगतान सुरक्षित रूप से पूरा करने के लिए इस वीडियो को संदर्भ के रूप में देखें।`,
    summary: 'भुगतान सारांश',
    loanAccount: 'लोन खाता',
    provider: 'प्रदाता',
    support: 'सहायता',
    beforeStart: 'शुरू करने से पहले',
    readyTitle: 'ये जानकारी तैयार रखें',
    checklist: [
      ['पेमेंट लिंक या PhonePe ऐप', 'साझा किया गया लिंक खोलें या PhonePe ऐप इस्तेमाल करें।'],
      ['लोन अकाउंट नंबर', 'खाता सत्यापित करने के लिए LAN तैयार रखें।'],
      ['देय राशि', 'वीडियो में दिखाई गई राशि दर्ज करें और जांचें।'],
    ],
    phoneEyebrow: 'PhonePe प्रक्रिया',
    phoneHeadline: 'PhonePe खोलें और भुगतान करें',
    phoneSecure: 'सुरक्षित भुगतान',
    phoneSteps: [
      {label: 'PhonePe', title: 'PhonePe', subtitle: 'पेमेंट लिंक तैयार'},
      {label: 'लोन भुगतान', title: 'लोन भुगतान', subtitle: 'बिलर श्रेणी चुनें'},
      {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'खाता'},
      {label: 'राशि', title: null, subtitle: 'जांचें और भुगतान करें'},
    ],
    biller: 'बिलर',
    loanAccountUi: 'लोन खाता',
    payableAmount: 'देय राशि',
    company: 'कंपनी',
    selectBiller: 'बिलर चुनें',
    enterAmount: 'राशि दर्ज करें',
    proceed: 'भुगतान करें',
    help: 'सहायता',
    reviewEyebrow: 'भुगतान से पहले जांचें',
    reviewTitle: 'हर जानकारी की पुष्टि करें',
    reviewBody: 'आगे बढ़ने से पहले प्रदाता, लोन खाता और राशि मिलाएं।',
    needHelp: 'सहायता चाहिए?',
    supportAvailable: 'सहायता उपलब्ध है',
    helpTitle: 'भुगतान करते समय सहायता चाहिए?',
    helpBody: 'भुगतान सहायता या अन्य जानकारी के लिए इस नंबर पर संपर्क करें।',
    fallbackSubtitle: 'भुगतान पूरा करने के लिए स्क्रीन पर दिए गए चरणों का पालन करें।',
  },
  Marathi: {
    topTitle: 'पेमेंट मार्गदर्शन',
    topSubtitle: 'ग्राहकांसाठी संदर्भ व्हिडिओ',
    welcome: 'स्वागत आहे',
    welcomeHeadline: (name) => `${name}, हा तुमचा पेमेंट गाईड आहे`,
    welcomeBody: (client) => `${client} कर्जाचे पेमेंट सुरक्षितपणे पूर्ण करण्यासाठी हा व्हिडिओ संदर्भ म्हणून वापरा.`,
    summary: 'पेमेंट सारांश',
    loanAccount: 'कर्ज खाते',
    provider: 'प्रदाता',
    support: 'सहाय्य',
    beforeStart: 'सुरू करण्यापूर्वी',
    readyTitle: 'ही माहिती तयार ठेवा',
    checklist: [
      ['पेमेंट लिंक किंवा PhonePe अॅप', 'शेअर केलेली लिंक उघडा किंवा PhonePe अॅप वापरा.'],
      ['कर्ज खाते क्रमांक', 'खाते तपासण्यासाठी LAN तयार ठेवा.'],
      ['देय रक्कम', 'व्हिडिओमध्ये दाखवलेली रक्कम भरा आणि तपासा.'],
    ],
    phoneEyebrow: 'PhonePe प्रक्रिया',
    phoneHeadline: 'PhonePe उघडा आणि पेमेंट करा',
    phoneSecure: 'सुरक्षित पेमेंट',
    phoneSteps: [
      {label: 'PhonePe', title: 'PhonePe', subtitle: 'पेमेंट लिंक तयार'},
      {label: 'कर्ज पेमेंट', title: 'कर्ज पेमेंट', subtitle: 'बिलर श्रेणी निवडा'},
      {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'खाते'},
      {label: 'रक्कम', title: null, subtitle: 'तपासा आणि पेमेंट करा'},
    ],
    biller: 'बिलर', loanAccountUi: 'कर्ज खाते', payableAmount: 'देय रक्कम', company: 'कंपनी', selectBiller: 'बिलर निवडा', enterAmount: 'रक्कम भरा', proceed: 'पेमेंट करा', help: 'सहाय्य',
    reviewEyebrow: 'पेमेंटपूर्वी तपासा', reviewTitle: 'प्रत्येक तपशील तपासा', reviewBody: 'पुढे जाण्यापूर्वी प्रदाता, कर्ज खाते आणि रक्कम जुळवा.', needHelp: 'सहाय्य हवे आहे?', supportAvailable: 'सहाय्य उपलब्ध आहे', helpTitle: 'पेमेंट करताना मदत हवी आहे?', helpBody: 'पेमेंट सहाय्य किंवा इतर माहितीसाठी या नंबरवर संपर्क करा.', fallbackSubtitle: 'पेमेंट पूर्ण करण्यासाठी स्क्रीनवरील चरणांचे अनुसरण करा.',
  },
  Tamil: {
    topTitle: 'கட்டண வழிகாட்டி', topSubtitle: 'வாடிக்கையாளர்களுக்கான குறிப்பு வீடியோ', welcome: 'வரவேற்கிறோம்',
    welcomeHeadline: (name) => `${name}, இது உங்கள் கட்டண வழிகாட்டி`, welcomeBody: (client) => `${client} கடன் கட்டணத்தை பாதுகாப்பாக முடிக்க இந்த வீடியோவை வழிகாட்டியாக பயன்படுத்தவும்.`,
    summary: 'கட்டண சுருக்கம்', loanAccount: 'கடன் கணக்கு', provider: 'சேவை வழங்குநர்', support: 'உதவி', beforeStart: 'தொடங்குவதற்கு முன்', readyTitle: 'இந்த விவரங்களை தயார் வைத்துக்கொள்ளுங்கள்',
    checklist: [['கட்டண இணைப்பு அல்லது PhonePe ஆப்', 'பகிரப்பட்ட இணைப்பைத் திறக்கவும் அல்லது PhonePe ஆப்பைப் பயன்படுத்தவும்.'], ['கடன் கணக்கு எண்', 'கணக்கை சரிபார்க்க LAN தயாராக வைத்துக்கொள்ளுங்கள்.'], ['செலுத்த வேண்டிய தொகை', 'வீடியோவில் காட்டிய தொகையை உள்ளிட்டு சரிபார்க்கவும்.']],
    phoneEyebrow: 'PhonePe செயல்முறை', phoneHeadline: 'PhonePe திறந்து கட்டணம் செலுத்துங்கள்', phoneSecure: 'பாதுகாப்பான கட்டணம்',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'கட்டண இணைப்பு தயார்'}, {label: 'கடன் கட்டணம்', title: 'கடன் கட்டணம்', subtitle: 'பில்லர் வகையைத் தேர்வு செய்யவும்'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'கணக்கு'}, {label: 'தொகை', title: null, subtitle: 'சரிபார்த்து செலுத்தவும்'}],
    biller: 'பில்லர்', loanAccountUi: 'கடன் கணக்கு', payableAmount: 'செலுத்த வேண்டிய தொகை', company: 'நிறுவனம்', selectBiller: 'பில்லரைத் தேர்வு செய்யவும்', enterAmount: 'தொகை உள்ளிடவும்', proceed: 'கட்டணம் செலுத்தவும்', help: 'உதவி',
    reviewEyebrow: 'செலுத்துவதற்கு முன் சரிபார்க்கவும்', reviewTitle: 'ஒவ்வொரு விவரத்தையும் உறுதிப்படுத்தவும்', reviewBody: 'தொடர்வதற்கு முன் வழங்குநர், கடன் கணக்கு மற்றும் தொகையைப் பொருத்திப் பார்க்கவும்.', needHelp: 'உதவி வேண்டுமா?', supportAvailable: 'உதவி கிடைக்கும்', helpTitle: 'கட்டணம் செலுத்தும்போது உதவி வேண்டுமா?', helpBody: 'கட்டண உதவி அல்லது பிற தகவலுக்கு இந்த எண்ணை தொடர்புகொள்ளுங்கள்.', fallbackSubtitle: 'கட்டணத்தை முடிக்க திரையில் உள்ள படிகளைப் பின்பற்றவும்.',
  },
  Telugu: {
    topTitle: 'చెల్లింపు మార్గదర్శకం', topSubtitle: 'కస్టమర్ల కోసం సూచన వీడియో', welcome: 'స్వాగతం',
    welcomeHeadline: (name) => `${name}, ఇది మీ చెల్లింపు గైడ్`, welcomeBody: (client) => `${client} లోన్ చెల్లింపును సురక్షితంగా పూర్తి చేయడానికి ఈ వీడియోను సూచనగా ఉపయోగించండి.`,
    summary: 'చెల్లింపు సారాంశం', loanAccount: 'లోన్ ఖాతా', provider: 'ప్రొవైడర్', support: 'సహాయం', beforeStart: 'ప్రారంభించే ముందు', readyTitle: 'ఈ వివరాలను సిద్ధంగా ఉంచండి',
    checklist: [['చెల్లింపు లింక్ లేదా PhonePe యాప్', 'పంచుకున్న లింక్ తెరవండి లేదా PhonePe యాప్ ఉపయోగించండి.'], ['లోన్ ఖాతా నంబర్', 'ఖాతాను ధృవీకరించడానికి LAN సిద్ధంగా ఉంచండి.'], ['చెల్లించవలసిన మొత్తం', 'వీడియోలో చూపిన మొత్తాన్ని నమోదు చేసి తనిఖీ చేయండి.']],
    phoneEyebrow: 'PhonePe ప్రక్రియ', phoneHeadline: 'PhonePe తెరిచి చెల్లించండి', phoneSecure: 'సురక్షిత చెల్లింపు',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'చెల్లింపు లింక్ సిద్ధంగా ఉంది'}, {label: 'లోన్ చెల్లింపు', title: 'లోన్ చెల్లింపు', subtitle: 'బిల్లర్ వర్గాన్ని ఎంచుకోండి'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'ఖాతా'}, {label: 'మొత్తం', title: null, subtitle: 'తనిఖీ చేసి చెల్లించండి'}],
    biller: 'బిల్లర్', loanAccountUi: 'లోన్ ఖాతా', payableAmount: 'చెల్లించవలసిన మొత్తం', company: 'కంపెనీ', selectBiller: 'బిల్లర్ ఎంచుకోండి', enterAmount: 'మొత్తం నమోదు చేయండి', proceed: 'చెల్లించండి', help: 'సహాయం',
    reviewEyebrow: 'చెల్లించే ముందు తనిఖీ చేయండి', reviewTitle: 'ప్రతి వివరాన్ని నిర్ధారించండి', reviewBody: 'కొనసాగించే ముందు ప్రొవైడర్, లోన్ ఖాతా మరియు మొత్తాన్ని సరిపోల్చండి.', needHelp: 'సహాయం కావాలా?', supportAvailable: 'సహాయం అందుబాటులో ఉంది', helpTitle: 'చెల్లింపులో సహాయం కావాలా?', helpBody: 'చెల్లింపు సహాయం లేదా ఇతర సమాచారం కోసం ఈ నంబర్‌కు సంప్రదించండి.', fallbackSubtitle: 'చెల్లింపును పూర్తి చేయడానికి స్క్రీన్‌పై చూపిన దశలను అనుసరించండి.',
  },
  Kannada: {
    topTitle: 'ಪಾವತಿ ಮಾರ್ಗದರ್ಶಿ', topSubtitle: 'ಗ್ರಾಹಕರಿಗಾಗಿ ಉಲ್ಲೇಖ ವೀಡಿಯೊ', welcome: 'ಸ್ವಾಗತ',
    welcomeHeadline: (name) => `${name}, ಇದು ನಿಮ್ಮ ಪಾವತಿ ಮಾರ್ಗದರ್ಶಿ`, welcomeBody: (client) => `${client} ಸಾಲದ ಪಾವತಿಯನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಪೂರ್ಣಗೊಳಿಸಲು ಈ ವೀಡಿಯೊವನ್ನು ಉಲ್ಲೇಖವಾಗಿ ಬಳಸಿ.`,
    summary: 'ಪಾವತಿ ಸಾರಾಂಶ', loanAccount: 'ಸಾಲ ಖಾತೆ', provider: 'ಪ್ರದಾತ', support: 'ಸಹಾಯ', beforeStart: 'ಪ್ರಾರಂಭಿಸುವ ಮೊದಲು', readyTitle: 'ಈ ವಿವರಗಳನ್ನು ಸಿದ್ಧವಾಗಿಡಿ',
    checklist: [['ಪಾವತಿ ಲಿಂಕ್ ಅಥವಾ PhonePe ಆಪ್', 'ಹಂಚಿದ ಲಿಂಕ್ ತೆರೆಯಿರಿ ಅಥವಾ PhonePe ಆಪ್ ಬಳಸಿ.'], ['ಸಾಲ ಖಾತೆ ಸಂಖ್ಯೆ', 'ಖಾತೆ ಪರಿಶೀಲಿಸಲು LAN ಸಿದ್ಧವಾಗಿಡಿ.'], ['ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ', 'ವೀಡಿಯೊದಲ್ಲಿರುವ ಮೊತ್ತವನ್ನು ನಮೂದಿಸಿ ಪರಿಶೀಲಿಸಿ.']],
    phoneEyebrow: 'PhonePe ಪ್ರಕ್ರಿಯೆ', phoneHeadline: 'PhonePe ತೆರೆಯಿರಿ ಮತ್ತು ಪಾವತಿಸಿ', phoneSecure: 'ಸುರಕ್ಷಿತ ಪಾವತಿ',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'ಪಾವತಿ ಲಿಂಕ್ ಸಿದ್ಧ'}, {label: 'ಸಾಲ ಪಾವತಿ', title: 'ಸಾಲ ಪಾವತಿ', subtitle: 'ಬಿಲ್ಲರ್ ವರ್ಗ ಆಯ್ಕೆಮಾಡಿ'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'ಖಾತೆ'}, {label: 'ಮೊತ್ತ', title: null, subtitle: 'ಪರಿಶೀಲಿಸಿ ಪಾವತಿಸಿ'}],
    biller: 'ಬಿಲ್ಲರ್', loanAccountUi: 'ಸಾಲ ಖಾತೆ', payableAmount: 'ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ', company: 'ಕಂಪನಿ', selectBiller: 'ಬಿಲ್ಲರ್ ಆಯ್ಕೆಮಾಡಿ', enterAmount: 'ಮೊತ್ತ ನಮೂದಿಸಿ', proceed: 'ಪಾವತಿಸಿ', help: 'ಸಹಾಯ',
    reviewEyebrow: 'ಪಾವತಿಗೆ ಮೊದಲು ಪರಿಶೀಲಿಸಿ', reviewTitle: 'ಪ್ರತಿ ವಿವರವನ್ನು ದೃಢಪಡಿಸಿ', reviewBody: 'ಮುಂದುವರೆಯುವ ಮೊದಲು ಪ್ರದಾತ, ಸಾಲ ಖಾತೆ ಮತ್ತು ಮೊತ್ತವನ್ನು ಹೊಂದಿಸಿ ನೋಡಿ.', needHelp: 'ಸಹಾಯ ಬೇಕೇ?', supportAvailable: 'ಸಹಾಯ ಲಭ್ಯವಿದೆ', helpTitle: 'ಪಾವತಿಸುವಾಗ ಸಹಾಯ ಬೇಕೇ?', helpBody: 'ಪಾವತಿ ಸಹಾಯ ಅಥವಾ ಇತರ ಮಾಹಿತಿಗಾಗಿ ಈ ಸಂಖ್ಯೆಗೆ ಸಂಪರ್ಕಿಸಿ.', fallbackSubtitle: 'ಪಾವತಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ಪರದೆಯಲ್ಲಿರುವ ಹಂತಗಳನ್ನು ಅನುಸರಿಸಿ.',
  },
  Bengali: {
    topTitle: 'পেমেন্ট নির্দেশিকা', topSubtitle: 'গ্রাহকদের জন্য রেফারেন্স ভিডিও', welcome: 'স্বাগতম',
    welcomeHeadline: (name) => `${name}, এটি আপনার পেমেন্ট গাইড`, welcomeBody: (client) => `${client} ঋণের পেমেন্ট নিরাপদে সম্পন্ন করতে এই ভিডিওটি রেফারেন্স হিসেবে ব্যবহার করুন।`,
    summary: 'পেমেন্ট সারাংশ', loanAccount: 'ঋণ অ্যাকাউন্ট', provider: 'প্রদানকারী', support: 'সহায়তা', beforeStart: 'শুরু করার আগে', readyTitle: 'এই তথ্যগুলি প্রস্তুত রাখুন',
    checklist: [['পেমেন্ট লিঙ্ক বা PhonePe অ্যাপ', 'শেয়ার করা লিঙ্ক খুলুন অথবা PhonePe অ্যাপ ব্যবহার করুন।'], ['ঋণ অ্যাকাউন্ট নম্বর', 'অ্যাকাউন্ট যাচাই করতে LAN প্রস্তুত রাখুন।'], ['প্রদেয় পরিমাণ', 'ভিডিওতে দেখানো পরিমাণ লিখে যাচাই করুন।']],
    phoneEyebrow: 'PhonePe প্রক্রিয়া', phoneHeadline: 'PhonePe খুলুন এবং পেমেন্ট করুন', phoneSecure: 'নিরাপদ পেমেন্ট',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'পেমেন্ট লিঙ্ক প্রস্তুত'}, {label: 'ঋণ পেমেন্ট', title: 'ঋণ পেমেন্ট', subtitle: 'বিলার বিভাগ নির্বাচন করুন'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'অ্যাকাউন্ট'}, {label: 'পরিমাণ', title: null, subtitle: 'যাচাই করে পেমেন্ট করুন'}],
    biller: 'বিলার', loanAccountUi: 'ঋণ অ্যাকাউন্ট', payableAmount: 'প্রদেয় পরিমাণ', company: 'কোম্পানি', selectBiller: 'বিলার নির্বাচন করুন', enterAmount: 'পরিমাণ লিখুন', proceed: 'পেমেন্ট করুন', help: 'সহায়তা',
    reviewEyebrow: 'পেমেন্টের আগে যাচাই করুন', reviewTitle: 'প্রতিটি তথ্য নিশ্চিত করুন', reviewBody: 'এগোনোর আগে প্রদানকারী, ঋণ অ্যাকাউন্ট এবং পরিমাণ মিলিয়ে নিন।', needHelp: 'সহায়তা দরকার?', supportAvailable: 'সহায়তা উপলব্ধ', helpTitle: 'পেমেন্টের সময় সহায়তা দরকার?', helpBody: 'পেমেন্ট সহায়তা বা অন্য তথ্যের জন্য এই নম্বরে যোগাযোগ করুন।', fallbackSubtitle: 'পেমেন্ট সম্পন্ন করতে স্ক্রিনের ধাপগুলি অনুসরণ করুন।',
  },
  Gujarati: {
    topTitle: 'ચુકવણી માર્ગદર્શન', topSubtitle: 'ગ્રાહકો માટે સંદર્ભ વિડિયો', welcome: 'સ્વાગત છે',
    welcomeHeadline: (name) => `${name}, આ તમારી ચુકવણી માર્ગદર્શિકા છે`, welcomeBody: (client) => `${client} લોનની ચુકવણી સુરક્ષિત રીતે પૂર્ણ કરવા માટે આ વિડિયોનો સંદર્ભ લો.`,
    summary: 'ચુકવણી સારાંશ', loanAccount: 'લોન ખાતું', provider: 'પ્રદાતા', support: 'સહાય', beforeStart: 'શરૂ કરતા પહેલા', readyTitle: 'આ વિગતો તૈયાર રાખો',
    checklist: [['ચુકવણી લિંક અથવા PhonePe એપ', 'શેર કરેલી લિંક ખોલો અથવા PhonePe એપ વાપરો.'], ['લોન ખાતા નંબર', 'ખાતું ચકાસવા LAN તૈયાર રાખો.'], ['ચુકવવાની રકમ', 'વિડિયોમાં બતાવેલી રકમ દાખલ કરી તપાસો.']],
    phoneEyebrow: 'PhonePe પ્રક્રિયા', phoneHeadline: 'PhonePe ખોલો અને ચુકવણી કરો', phoneSecure: 'સુરક્ષિત ચુકવણી',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'ચુકવણી લિંક તૈયાર'}, {label: 'લોન ચુકવણી', title: 'લોન ચુકવણી', subtitle: 'બિલર કેટેગરી પસંદ કરો'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'ખાતું'}, {label: 'રકમ', title: null, subtitle: 'તપાસો અને ચુકવણી કરો'}],
    biller: 'બિલર', loanAccountUi: 'લોન ખાતું', payableAmount: 'ચુકવવાની રકમ', company: 'કંપની', selectBiller: 'બિલર પસંદ કરો', enterAmount: 'રકમ દાખલ કરો', proceed: 'ચુકવણી કરો', help: 'સહાય',
    reviewEyebrow: 'ચુકવણી પહેલા તપાસો', reviewTitle: 'દરેક વિગત ખાતરી કરો', reviewBody: 'આગળ વધતા પહેલા પ્રદાતા, લોન ખાતું અને રકમ મેળવો.', needHelp: 'સહાય જોઈએ?', supportAvailable: 'સહાય ઉપલબ્ધ છે', helpTitle: 'ચુકવણી કરતી વખતે સહાય જોઈએ?', helpBody: 'ચુકવણી સહાય અથવા અન્ય માહિતી માટે આ નંબર પર સંપર્ક કરો.', fallbackSubtitle: 'ચુકવણી પૂર્ણ કરવા માટે સ્ક્રીન પરના પગલાં અનુસરો.',
  },
  Malayalam: {
    topTitle: 'പേയ്മെന്റ് ഗൈഡ്', topSubtitle: 'ഉപഭോക്താക്കൾക്കുള്ള റഫറൻസ് വീഡിയോ', welcome: 'സ്വാഗതം',
    welcomeHeadline: (name) => `${name}, ഇത് നിങ്ങളുടെ പേയ്മെന്റ് ഗൈഡാണ്`, welcomeBody: (client) => `${client} വായ്പയുടെ പേയ്മെന്റ് സുരക്ഷിതമായി പൂർത്തിയാക്കാൻ ഈ വീഡിയോ റഫറൻസായി ഉപയോഗിക്കുക.`,
    summary: 'പേയ്മെന്റ് സംഗ്രഹം', loanAccount: 'വായ്പ അക്കൗണ്ട്', provider: 'പ്രൊവൈഡർ', support: 'സഹായം', beforeStart: 'ആരംഭിക്കുന്നതിന് മുമ്പ്', readyTitle: 'ഈ വിവരങ്ങൾ തയ്യാറാക്കി വയ്ക്കുക',
    checklist: [['പേയ്മെന്റ് ലിങ്ക് അല്ലെങ്കിൽ PhonePe ആപ്പ്', 'ഷെയർ ചെയ്ത ലിങ്ക് തുറക്കുക അല്ലെങ്കിൽ PhonePe ആപ്പ് ഉപയോഗിക്കുക.'], ['വായ്പ അക്കൗണ്ട് നമ്പർ', 'അക്കൗണ്ട് പരിശോധിക്കാൻ LAN തയ്യാറാക്കി വയ്ക്കുക.'], ['അടയ്ക്കേണ്ട തുക', 'വീഡിയോയിൽ കാണിച്ച തുക നൽകുകയും പരിശോധിക്കുകയും ചെയ്യുക.']],
    phoneEyebrow: 'PhonePe പ്രക്രിയ', phoneHeadline: 'PhonePe തുറന്ന് പണമടയ്ക്കുക', phoneSecure: 'സുരക്ഷിത പേയ്മെന്റ്',
    phoneSteps: [{label: 'PhonePe', title: 'PhonePe', subtitle: 'പേയ്മെന്റ് ലിങ്ക് തയ്യാറാണ്'}, {label: 'വായ്പ പേയ്മെന്റ്', title: 'വായ്പ പേയ്മെന്റ്', subtitle: 'ബില്ലർ വിഭാഗം തിരഞ്ഞെടുക്കുക'}, {label: 'TVS Credit', title: 'TVS Credit', subtitle: 'അക്കൗണ്ട്'}, {label: 'തുക', title: null, subtitle: 'പരിശോധിച്ച് പണമടയ്ക്കുക'}],
    biller: 'ബില്ലർ', loanAccountUi: 'വായ്പ അക്കൗണ്ട്', payableAmount: 'അടയ്ക്കേണ്ട തുക', company: 'കമ്പനി', selectBiller: 'ബില്ലർ തിരഞ്ഞെടുക്കുക', enterAmount: 'തുക നൽകുക', proceed: 'പണമടയ്ക്കുക', help: 'സഹായം',
    reviewEyebrow: 'പേയ്മെന്റിന് മുമ്പ് പരിശോധിക്കുക', reviewTitle: 'ഓരോ വിവരവും സ്ഥിരീകരിക്കുക', reviewBody: 'തുടരുന്നതിന് മുമ്പ് പ്രൊവൈഡർ, വായ്പ അക്കൗണ്ട്, തുക എന്നിവ ഒത്തുനോക്കുക.', needHelp: 'സഹായം വേണോ?', supportAvailable: 'സഹായം ലഭ്യമാണ്', helpTitle: 'പണമടയ്ക്കുമ്പോൾ സഹായം വേണോ?', helpBody: 'പേയ്മെന്റ് സഹായത്തിനോ മറ്റ് വിവരങ്ങൾക്കോ ഈ നമ്പറിൽ ബന്ധപ്പെടുക.', fallbackSubtitle: 'പേയ്മെന്റ് പൂർത്തിയാക്കാൻ സ്ക്രീനിലെ ഘട്ടങ്ങൾ പിന്തുടരുക.',
  },
};

const getPaymentCopy = (language) => PAYMENT_COPY[language] || PAYMENT_COPY.English;

const PaymentSceneShell = ({scene, frame, children, background = '#f8fafc'}) => {
  const state = getSceneVisualState(frame, scene);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: '96px 78px 58px',
        opacity: state.opacity,
        transform: `translateY(${state.translateY}px) scale(${state.scale})`,
        background,
        color: '#111827',
      }}
    >
      {children(state)}
    </div>
  );
};

const PaymentTopBar = ({lead, frame}) => {
  const copy = getPaymentCopy(lead.language);
  return (
    <div
      style={{
        position: 'absolute',
        top: 30,
        left: 56,
        right: 56,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        borderRadius: 20,
        background: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 18px 48px rgba(15,23,42,0.08)',
        transform: `translateY(${Math.sin(frame * 0.018) * 2}px)`,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: '#5f259f',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            fontSize: 18,
          }}
        >
          P
        </div>
        <div>
          <div style={{fontSize: 16, fontWeight: 900}}>{copy.topTitle}</div>
          <div style={{fontSize: 12, color: '#64748b'}}>{copy.topSubtitle}</div>
        </div>
      </div>
      <div style={{fontSize: 15, fontWeight: 800, color: '#334155'}}>
        {safeString(lead.client_name, 'TVS Credit')} | {copy.loanAccount}: {safeString(lead.lan, 'N/A')}
      </div>
    </div>
  );
};

const PaymentWelcomeScene = ({scene, frame, fps, lead}) => (
  <PaymentSceneShell scene={scene} frame={frame} background="linear-gradient(135deg, #f8fafc, #eef2ff)">
    {({localFrame}) => {
      const copy = getPaymentCopy(lead.language);
      const reveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 90}});
      const amount = safeString(lead.display_amounts.primary.value, safeString(lead.tos, '0'));
      const customerName = safeString(lead.customer_name, 'Customer');
      const clientName = safeString(lead.client_name, 'TVS Credit');
      return (
        <div style={{display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 46, alignItems: 'center', height: '100%'}}>
          <div style={{transform: `translateX(${(1 - reveal) * -24}px)`, opacity: reveal}}>
            <div style={{fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: '#5f259f', fontWeight: 900}}>
              {copy.welcome}
            </div>
            <div
              style={{
                marginTop: 18,
                fontWeight: 950,
                lineHeight: 0.98,
                color: '#0f172a',
                ...getAdaptiveTextStyle(copy.welcomeHeadline(customerName), 72, {
                  minSize: 46,
                  softLimit: 44,
                  hardLimit: 92,
                }),
              }}
            >
              {copy.welcomeHeadline(customerName)}
            </div>
            <div style={{fontSize: 24, lineHeight: 1.45, color: '#475569', marginTop: 24, maxWidth: 660}}>
              {copy.welcomeBody(clientName)}
            </div>
          </div>
          <div
            style={{
              borderRadius: 34,
              padding: 30,
              background: '#fff',
              border: '1px solid rgba(15,23,42,0.08)',
              boxShadow: '0 28px 80px rgba(15,23,42,0.12)',
              transform: `translateY(${(1 - reveal) * 28}px)`,
              opacity: reveal,
            }}
          >
            <div style={{fontSize: 13, color: '#64748b', textTransform: 'uppercase', fontWeight: 900}}>{copy.summary}</div>
            <div style={{fontSize: 54, fontWeight: 950, marginTop: 14, color: '#5f259f'}}>{amount}</div>
            <div style={{display: 'grid', gap: 14, marginTop: 24}}>
              <PaymentInfoRow label={copy.loanAccount} value={safeString(lead.lan, 'N/A')} />
              <PaymentInfoRow label={copy.provider} value="TVS Credit" />
              <PaymentInfoRow label={copy.support} value={safeString(lead.contact_details, '1800-555-999')} />
            </div>
          </div>
        </div>
      );
    }}
  </PaymentSceneShell>
);

const PaymentInfoRow = ({label, value}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', gap: 18, padding: '12px 0', borderTop: '1px solid #e2e8f0'}}>
    <div style={{fontSize: 13, color: '#64748b', fontWeight: 800}}>{label}</div>
    <div style={{fontSize: 17, color: '#0f172a', fontWeight: 900, textAlign: 'right', ...SAFE_TEXT_STYLE}}>{value}</div>
  </div>
);

const PaymentChecklistScene = ({scene, frame, fps, lead}) => (
  <PaymentSceneShell scene={scene} frame={frame} background="#ffffff">
    {({localFrame}) => {
      const copy = getPaymentCopy(lead.language);
      const reveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 90}});
      return (
        <div style={{height: '100%', display: 'grid', alignContent: 'center'}}>
          <div style={{fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: '#5f259f', fontWeight: 900}}>
            {copy.beforeStart}
          </div>
          <div style={{fontSize: 58, lineHeight: 1.05, fontWeight: 950, color: '#0f172a', marginTop: 14}}>
            {copy.readyTitle}
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22, marginTop: 38}}>
            {copy.checklist.map(([title, body], index) => (
              <div
                key={title}
                style={{
                  minHeight: 250,
                  padding: 28,
                  borderRadius: 28,
                  background: index === 0 ? '#f5f3ff' : '#f8fafc',
                  border: `1px solid ${index === 0 ? '#c4b5fd' : '#e2e8f0'}`,
                  transform: `translateY(${(1 - reveal) * (28 + index * 10)}px)`,
                  opacity: reveal,
                }}
              >
                <div style={{width: 46, height: 46, borderRadius: 16, background: '#5f259f', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 950}}>
                  {index + 1}
                </div>
                <div style={{fontSize: 27, lineHeight: 1.12, fontWeight: 950, color: '#0f172a', marginTop: 28}}>{title}</div>
                <div style={{fontSize: 17, lineHeight: 1.5, color: '#64748b', marginTop: 14}}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }}
  </PaymentSceneShell>
);

const PaymentPhoneScene = ({scene, frame, fps, lead, currentTime, stepBoundaries}) => (
  <PaymentPhoneWalkthroughScene scene={scene} frame={frame} fps={fps} lead={lead} accentColor="#5f259f" uiCopy={getUiCopy(lead.language)} currentTime={currentTime} stepBoundaries={stepBoundaries} />
);

const PaymentSafetyScene = ({scene, frame, fps, lead}) => (
  <PaymentSceneShell scene={scene} frame={frame} background="#ffffff">
    {({localFrame}) => {
      const copy = getPaymentCopy(lead.language);
      const reveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 88}});
      return (
        <div style={{display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 42, alignItems: 'center', height: '100%'}}>
          <div style={{opacity: reveal}}>
            <div style={{fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: '#5f259f', fontWeight: 900}}>
              {copy.reviewEyebrow}
            </div>
            <div style={{fontSize: 58, lineHeight: 1.05, fontWeight: 950, color: '#0f172a', marginTop: 14}}>
              {copy.reviewTitle}
            </div>
            <div style={{fontSize: 22, lineHeight: 1.45, color: '#64748b', marginTop: 22}}>
              {copy.reviewBody}
            </div>
          </div>
          <div style={{display: 'grid', gap: 16}}>
            {[
              [copy.provider, 'TVS Credit'],
              [copy.loanAccount, safeString(lead.lan, 'N/A')],
              [copy.payableAmount, safeString(lead.display_amounts.primary.value, safeString(lead.tos, '0'))],
              [copy.needHelp, safeString(lead.contact_details, '1800-555-999')],
            ].map(([label, value], index) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 24,
                  padding: '22px 24px',
                  borderRadius: 22,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  transform: `translateX(${(1 - reveal) * (28 + index * 8)}px)`,
                  opacity: reveal,
                }}
              >
                <div style={{fontSize: 16, color: '#64748b', fontWeight: 800}}>{label}</div>
                <div style={{fontSize: 22, color: '#0f172a', fontWeight: 950, textAlign: 'right', ...SAFE_TEXT_STYLE}}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }}
  </PaymentSceneShell>
);

const PaymentSupportScene = ({scene, frame, fps, lead}) => (
  <PaymentSceneShell scene={scene} frame={frame} background="linear-gradient(135deg, #5f259f, #312e81)">
    {({localFrame}) => {
      const copy = getPaymentCopy(lead.language);
      const reveal = spring({fps, frame: localFrame, config: {damping: 17, stiffness: 88}});
      return (
        <div style={{height: '100%', display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center'}}>
          <div style={{maxWidth: 860, transform: `translateY(${(1 - reveal) * 26}px)`, opacity: reveal}}>
            <div style={{fontSize: 15, letterSpacing: 2.8, textTransform: 'uppercase', opacity: 0.78, fontWeight: 900}}>
              {copy.supportAvailable}
            </div>
            <div style={{fontSize: 72, lineHeight: 1.02, fontWeight: 950, marginTop: 18}}>
              {copy.helpTitle}
            </div>
            <div style={{fontSize: 26, lineHeight: 1.45, marginTop: 24, opacity: 0.86}}>
              {copy.helpBody}
            </div>
            <div
              style={{
                display: 'inline-flex',
                marginTop: 38,
                padding: '20px 34px',
                borderRadius: 999,
                background: '#fff',
                color: '#312e81',
                fontSize: 34,
                fontWeight: 950,
                boxShadow: '0 28px 70px rgba(15,23,42,0.28)',
              }}
            >
              {safeString(lead.contact_details, '1800-555-999')}
            </div>
          </div>
        </div>
      );
    }}
  </PaymentSceneShell>
);

// Match a subtitle line by phrase (case-insensitive substring) and return its end-time in seconds.
const findSubtitleEnd = (subtitles, phrase) => {
  if (!Array.isArray(subtitles) || !phrase) return null;
  const needle = phrase.toLowerCase();
  const hit = subtitles.find((s) => typeof s?.text === 'string' && s.text.toLowerCase().includes(needle));
  return hit && typeof hit.end === 'number' ? hit.end : null;
};

const findSubtitleStart = (subtitles, phrase) => {
  if (!Array.isArray(subtitles) || !phrase) return null;
  const needle = phrase.toLowerCase();
  const hit = subtitles.find((s) => typeof s?.text === 'string' && s.text.toLowerCase().includes(needle));
  return hit && typeof hit.start === 'number' ? hit.start : null;
};

const PaymentGuidanceVideo = ({lead, frame, fps, durationInFrames}) => {
  const timeline = getSceneTimeline(durationInFrames, lead);
  const track = getTrackMeta(lead.id);
  const currentTime = frame / fps;
  // Anchors: phrases that mark the END of each step's narration. Step N stays on
  // screen until its anchor passes. These English terms appear verbatim across
  // all localized payment_guidance scripts (see PAYMENT_GUIDANCE_TEMPLATES).
  const stepBoundaries = [
    findSubtitleEnd(track.subtitles, 'Loan Repayment'),
    findSubtitleEnd(track.subtitles, 'TVS Credit'),
    findSubtitleEnd(track.subtitles, 'Agreement number'),
  ];
  return (
    <AbsoluteFill style={{background: '#f8fafc', fontFamily: FONT_FAMILY, overflow: 'hidden'}}>
      <PaymentTopBar lead={lead} frame={frame} />
      <PaymentWelcomeScene scene={timeline[0]} frame={frame} fps={fps} lead={lead} />
      <PaymentChecklistScene scene={timeline[1]} frame={frame} fps={fps} lead={lead} />
      <PaymentPhoneScene scene={timeline[2]} frame={frame} fps={fps} lead={lead} currentTime={currentTime} stepBoundaries={stepBoundaries} />
      <PaymentSafetyScene scene={timeline[3]} frame={frame} fps={fps} lead={lead} />
      <PaymentPhoneScene scene={timeline[4]} frame={frame} fps={fps} lead={lead} currentTime={currentTime} stepBoundaries={stepBoundaries} />
      <PaymentSupportScene scene={timeline[5]} frame={frame} fps={fps} lead={lead} />
    </AbsoluteFill>
  );
};

// ─── Closing Scene ────────────────────────────────────────────────────────────

const ClosingScene = ({scene, frame, fps, lead, accentColor, uiCopy}) => (
  <SceneShell scene={scene} frame={frame}>
    {({localFrame}) => {
      const reveal = spring({fps, frame: localFrame, config: {damping: 18, stiffness: 84}});
      // Staggered summary rows
      const row0 = spring({fps, frame: localFrame - 8, config: {damping: 18, stiffness: 88}});
      const row1 = spring({fps, frame: localFrame - 18, config: {damping: 18, stiffness: 88}});
      const row2 = spring({fps, frame: localFrame - 28, config: {damping: 18, stiffness: 88}});
      const row3 = spring({fps, frame: localFrame - 38, config: {damping: 18, stiffness: 88}});

      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 0.88fr',
            gap: 28,
            alignItems: 'end',
          }}
        >
          <div
            style={{
              padding: '32px 34px',
              borderRadius: 32,
              background: 'rgba(248, 250, 252, 0.95)',
              color: '#0f172a',
              boxShadow: '0 24px 60px rgba(2, 8, 23, 0.24)',
              transform: `translateY(${(1 - reveal) * 22}px)`,
              opacity: reveal,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: '#64748b',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {safeString(lead.scene_payload.closing.eyebrow, uiCopy.resolutionStillPossible)}
            </div>
            <div
              style={{
                lineHeight: 1.08,
                fontWeight: 900,
                marginTop: 16,
                ...getAdaptiveTextStyle(lead.scene_payload.closing?.headline, 52, {
                  minSize: 36,
                  softLimit: 34,
                  hardLimit: 90,
                }),
              }}
            >
              {safeString(lead.scene_payload.closing.headline)}
            </div>
            <div
              style={{
                lineHeight: 1.52,
                marginTop: 18,
                color: '#334155',
                ...getAdaptiveTextStyle(lead.scene_payload.closing?.body, 24, {
                  minSize: 18,
                  softLimit: 44,
                  hardLimit: 120,
                }),
              }}
            >
              {safeString(lead.scene_payload.closing.body)}
            </div>
          </div>

          <div
            style={{
              padding: '28px 30px',
              borderRadius: 28,
              background: 'rgba(5, 16, 35, 0.72)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(16px)',
              transform: `translateY(${(1 - reveal) * 28}px)`,
              opacity: reveal,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: '#94a3b8',
                ...SAFE_TEXT_STYLE,
              }}
            >
              {uiCopy.finalSummary}
            </div>
            <div style={{display: 'grid', gap: 18, marginTop: 20}}>
              <StaggeredSummaryRow
                label={uiCopy.customerLabel}
                value={safeString(lead.customer_name)}
                reveal={row0}
              />
              <StaggeredSummaryRow
                label={uiCopy.accountLabel}
                value={safeString(lead.lan)}
                reveal={row1}
              />
              <StaggeredSummaryRow
                label={uiCopy.outstandingLabel}
                value={safeString(lead.display_amounts.primary.value)}
                reveal={row2}
              />
              <StaggeredSummaryRow
                label={uiCopy.contactLabel}
                value={safeString(lead.contact_details)}
                accentColor={accentColor}
                reveal={row3}
              />
            </div>
          </div>
        </div>
      );
    }}
  </SceneShell>
);

// ─── Primitive Components ─────────────────────────────────────────────────────

const StaggeredIdentityRow = ({label, value, reveal}) => (
  <div
    style={{
      display: 'grid',
      gap: 4,
      paddingBottom: 12,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      transform: `translateX(${(1 - reveal) * -16}px)`,
      opacity: reveal,
    }}
  >
    <div
      style={{
        fontSize: 12,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
        color: '#94a3b8',
        ...SAFE_TEXT_STYLE,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontWeight: 700,
        lineHeight: 1.12,
        color: '#f8fafc',
        ...getAdaptiveTextStyle(value, 28, {minSize: 20, softLimit: 18, hardLimit: 42}),
      }}
    >
      {value}
    </div>
  </div>
);

const ContextMarker = ({title, text}) => (
  <div
    style={{
      padding: '16px 18px',
      borderRadius: 18,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}
  >
    <div
      style={{
        fontSize: 11,
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        color: '#94a3b8',
        ...SAFE_TEXT_STYLE,
      }}
    >
      {title}
    </div>
    <div
      style={{
        lineHeight: 1.2,
        fontWeight: 700,
        color: '#f8fafc',
        marginTop: 8,
        ...getAdaptiveTextStyle(text, 24, {minSize: 18, softLimit: 16, hardLimit: 40}),
      }}
    >
      {text}
    </div>
  </div>
);

const AmountCard = ({title, value, helper, accentColor, opacity, background, shimmerFrame}) => {
  // Shimmer: a sliding gradient overlay on the progress bar
  const shimmerPos =
    shimmerFrame !== null
      ? `${((shimmerFrame * 3.2) % 200) - 60}%`
      : '-60%';

  return (
    <div
      style={{
        padding: '30px 30px 32px',
        borderRadius: 30,
        background,
        color: '#f8fafc',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: `0 18px 50px ${accentColor}18`,
        transform: `translateY(${(1 - opacity) * 24}px) scale(${0.98 + opacity * 0.02})`,
        opacity,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#94a3b8',
          ...SAFE_TEXT_STYLE,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontWeight: 900,
          lineHeight: 1.02,
          marginTop: 20,
          ...getAdaptiveTextStyle(value, 54, {minSize: 40, softLimit: 10, hardLimit: 24}),
        }}
      >
        {value}
      </div>
      {/* Shimmer progress bar */}
      <div
        style={{
          marginTop: 20,
          height: 4,
          borderRadius: 999,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            width: `${55 + opacity * 45}%`,
            height: '100%',
            borderRadius: 999,
            background: accentColor,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {shimmerFrame !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: shimmerPos,
                width: '60%',
                height: '100%',
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          lineHeight: 1.5,
          marginTop: 18,
          color: '#dbe4f0',
          ...getAdaptiveTextStyle(helper, 18, {minSize: 15, softLimit: 28, hardLimit: 72}),
        }}
      >
        {helper}
      </div>
    </div>
  );
};

const StaggeredSummaryRow = ({label, value, accentColor, reveal}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      paddingBottom: 12,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      transform: `translateX(${(1 - reveal) * 16}px)`,
      opacity: reveal,
    }}
  >
    <div
      style={{
        fontSize: 13,
        color: '#94a3b8',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        ...SAFE_TEXT_STYLE,
      }}
    >
      {label}
    </div>
    <div
      style={{
        lineHeight: 1.18,
        fontWeight: 700,
        color: accentColor || '#f8fafc',
        textAlign: 'right',
        ...getAdaptiveTextStyle(value, 24, {minSize: 18, softLimit: 16, hardLimit: 40}),
      }}
    >
      {value}
    </div>
  </div>
);

// ─── Main Composition ─────────────────────────────────────────────────────────

export const TemplateVideo = ({leadId}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const lead = getLeadById(leadId);
  const uiCopy = getUiCopy(lead.language);
  const subtitleBranding = lead.branding?.subtitles || {
    enabled: true,
    color: 'White',
    position: 'Bottom',
  };
  const logoBranding = lead.branding?.logo || {
    public_path: null,
    position: 'Top Right',
    opacity: 80,
  };
  const track = getTrackMeta(lead.id);
  const timeline = getSceneTimeline(durationInFrames, lead);
  const activeScene =
    timeline.find((scene) => frame >= scene.start && frame < scene.end) ||
    timeline[timeline.length - 1];
  const activeSceneLabel = uiCopy.sceneLabels[activeScene?.key] || uiCopy.sceneLabels.opening;
  const currentTime = frame / fps;
  const currentSubtitle = getActiveSubtitle(track.subtitles, currentTime);
  const subtitleProgress = getSubtitleProgress(currentSubtitle, currentTime);
  const audioSrc =
    lead.id && lead.id !== 'preview-sample' ? staticFile(`audio/${lead.id}.mp3`) : null;
  const accentColor = URGENCY_COLORS[lead.urgency_level] || URGENCY_COLORS.elevated;
  const stageScale = getStageScale(width, height);
  const backgroundShift = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const actionScene = timeline.find((scene) => scene.key === 'action');
  const actionGlow =
    actionScene && frame >= actionScene.start
      ? interpolate(frame, [actionScene.start, actionScene.end], [0.1, 0.28], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0.08;

  if (lead.template_key === 'payment_guidance') {
    const paymentCopy = getPaymentCopy(lead.language);
    return (
      <AbsoluteFill style={{backgroundColor: '#f8fafc', fontFamily: FONT_FAMILY, overflow: 'hidden'}}>
        {audioSrc ? <Audio src={audioSrc} /> : null}
        <PaymentGuidanceVideo lead={lead} frame={frame} fps={fps} durationInFrames={durationInFrames} />
        {subtitleBranding.enabled ? (
          <SubtitlePanel
            subtitle={currentSubtitle}
            subtitleProgress={subtitleProgress}
            branding={subtitleBranding}
            fallbackText={safeString(lead.cta_text, paymentCopy.fallbackSubtitle)}
          />
        ) : null}
      </AbsoluteFill>
    );
  }

  if (lead.template_key === 'payment_link_guidance') {
    const paymentCopy = getPaymentCopy(lead.language);
    // Aligning step boundaries with the Payment Link Guidance narration phrases
    // findSubtitleEnd returns seconds → convert to frames
    const toFrames = (secs) => secs != null ? Math.round(secs * fps) : null;
    const stepBoundaries = [
      toFrames(findSubtitleStart(track.subtitles, 'payment link') || 60),                                                  // Step 0 (Link Click) ends
      toFrames(findSubtitleStart(track.subtitles, 'agreement number') || findSubtitleEnd(track.subtitles, 'payment link')), // Step 1 (Intro) ends
      toFrames(findSubtitleStart(track.subtitles, 'captcha') || findSubtitleEnd(track.subtitles, 'agreement number')),      // Step 2 ends
      toFrames(findSubtitleStart(track.subtitles, 'terms') || findSubtitleEnd(track.subtitles, 'captcha') || findSubtitleStart(track.subtitles, 'shartein')), // Step 3 ends
      toFrames(findSubtitleStart(track.subtitles, 'payable amount') || findSubtitleEnd(track.subtitles, 'terms') || findSubtitleStart(track.subtitles, 'rashi')), // Step 4 ends
      toFrames(findSubtitleStart(track.subtitles, 'proceed to pay') || findSubtitleEnd(track.subtitles, 'payable amount') || findSubtitleStart(track.subtitles, 'aage')), // Step 5 ends
      toFrames(findSubtitleStart(track.subtitles, 'payment method') || findSubtitleStart(track.subtitles, 'bhugtan') || findSubtitleEnd(track.subtitles, 'proceed to pay')), // Step 6 ends
      toFrames(findSubtitleStart(track.subtitles, 'contact') || findSubtitleStart(track.subtitles, 'support') || findSubtitleStart(track.subtitles, 'sampark') || findSubtitleEnd(track.subtitles, 'transaction')), // Step 7 ends
    ];

    return (
      <AbsoluteFill style={{backgroundColor: '#f7fbff', fontFamily: FONT_FAMILY, overflow: 'hidden'}}>
        {audioSrc ? <Audio src={audioSrc} /> : null}
        <PaymentLinkGuidanceTemplate
          enableNarration={false}
          customerName={lead.customer_name}
          lan={lead.lan}
          clientName={lead.client_name}
          contactDetails={lead.contact_details}
          payableAmount={lead.tos}
          stepBoundaries={stepBoundaries}
        />
        <LogoOverlay logo={logoBranding} />
        {subtitleBranding.enabled ? (
          <SubtitlePanel
            subtitle={currentSubtitle}
            subtitleProgress={subtitleProgress}
            branding={{...subtitleBranding, color: 'Black'}}
            fallbackText={safeString(lead.cta_text, paymentCopy.fallbackSubtitle)}
          />
        ) : null}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020817',
        color: '#f8fafc',
        fontFamily: FONT_FAMILY,
        overflow: 'hidden',
      }}
    >
      {audioSrc ? <Audio src={audioSrc} /> : null}

      {/* Base dark gradient */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(135deg, rgba(2, 6, 23, 1), rgba(10, 18, 35, 1) 42%, rgba(15, 23, 42, 1))',
        }}
      />

      {/* Static radial accent */}
      <AbsoluteFill
        style={{
          transform: `scale(${1.04 - backgroundShift * 0.04}) rotate(${backgroundShift * -2}deg)`,
          background: `radial-gradient(circle at 18% 18%, ${accentColor}30, transparent 28%), radial-gradient(circle at 82% 22%, rgba(59,130,246,0.18), transparent 24%), radial-gradient(circle at 58% 78%, rgba(255,255,255,0.08), transparent 22%)`,
        }}
      />

      {/* Animated floating orbs */}
      <FloatingOrbs frame={frame} accentColor={accentColor} />

      {/* Subtle grid texture */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
          opacity: 0.12,
          transform: `translate(${backgroundShift * -50}px, ${backgroundShift * 24}px)`,
        }}
      />

      {/* Action scene glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at bottom right, ${accentColor}${Math.round(actionGlow * 255)
            .toString(16)
            .padStart(2, '0')}, transparent 32%)`,
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: BASE_FRAME_WIDTH,
          height: BASE_FRAME_HEIGHT,
          transform: `translate(-50%, -50%) scale(${stageScale})`,
          transformOrigin: 'center center',
          overflow: 'hidden',
        }}
      >
        <BrandHud
          lead={lead}
          accentColor={accentColor}
          activeSceneLabel={activeSceneLabel}
          frame={frame}
          uiCopy={uiCopy}
          logo={logoBranding}
        />
        <LogoOverlay logo={logoBranding} />

        <OpeningScene
          scene={timeline[0]}
          frame={frame}
          fps={fps}
          lead={lead}
          accentColor={accentColor}
          uiCopy={uiCopy}
        />
        <AccountScene
          scene={timeline[1]}
          frame={frame}
          fps={fps}
          lead={lead}
          accentColor={accentColor}
          uiCopy={uiCopy}
        />
        <ContextScene scene={timeline[2]} frame={frame} fps={fps} lead={lead} uiCopy={uiCopy} />
        <AmountsScene
          scene={timeline[3]}
          frame={frame}
          fps={fps}
          lead={lead}
          accentColor={accentColor}
          uiCopy={uiCopy}
        />
        {lead.template_key === 'payment_guidance' ? (
          <PaymentPhoneWalkthroughScene
            scene={timeline[4]}
            frame={frame}
            fps={fps}
            lead={lead}
            accentColor={accentColor}
            uiCopy={uiCopy}
          />
        ) : (
          <ActionScene
            scene={timeline[4]}
            frame={frame}
            fps={fps}
            lead={lead}
            accentColor={accentColor}
            uiCopy={uiCopy}
          />
        )}
        <ClosingScene
          scene={timeline[5]}
          frame={frame}
          fps={fps}
          lead={lead}
          accentColor={accentColor}
          uiCopy={uiCopy}
        />

        <ProgressTrack
          timeline={timeline}
          frame={frame}
          accentColor={accentColor}
          sceneLabels={uiCopy.sceneLabels}
        />

        {subtitleBranding.enabled ? (
          <SubtitlePanel
            subtitle={currentSubtitle}
            subtitleProgress={subtitleProgress}
            branding={subtitleBranding}
            fallbackText={safeString(
              lead.cta_text,
              lead.language === 'English'
                ? 'The active spoken line will appear here with the audio.'
                : 'ऑडियो के साथ सक्रिय पंक्ति यहां दिखाई देगी।'
            )}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
