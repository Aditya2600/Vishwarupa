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
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const BASE_FRAME_WIDTH = WIDTH;
const BASE_FRAME_HEIGHT = HEIGHT;
const legalGavelImage = staticFile('image.png');
const debtNoticeImage = staticFile('image copy.png');
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
const getUiCopy = (language) => UI_COPY[language] || UI_COPY.English;�शि है',
    urgentAction: 'तुरंत कार्रवाई आवश्यक',
    actionCardHelper: 'भुगतान समाधान या पुनर्भुगतान विकल्प के लिए त्वरित कॉल अपेक्षित है।',
    finalSummary: 'अंतिम सारांश',
    contactLabel: 'संपर्क',
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

const SceneShell = ({scene, frame, children, align = 'center'}) => {
  const visual = getSceneVisualState(frame, scene);
  if (visual.opacity <= 0.01) return null;

  return (
    <AbsoluteFill
      style={{
        padding: '92px 74px 188px',
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
              color: '#94a3b8',
              flexWrap: 'wrap',
              display: 'flex',
              justifyContent: 'center',
              gap: '0 6px',
            }}
          >
            {words.map((word, i) => {
              const isPast = i < activeWordIndex;
              const isCurrent = i === activeWordIndex;
              return (
                <span
                  key={i}
                  style={{
                    color: isPast ? '#e2e8f0' : isCurrent ? subtitleColor : 'rgba(226, 232, 240, 0.74)',
                    fontWeight: isCurrent ? 800 : isPast ? 600 : 500,
                    textShadow: isCurrent
                      ? `0 0 18px ${subtitleColor}, 0 4px 16px rgba(2, 6, 23, 0.95)`
                      : '0 4px 16px rgba(2, 6, 23, 0.95)',
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
              color: 'rgba(226, 232, 240, 0.76)',
              textShadow: '0 4px 16px rgba(2, 6, 23, 0.95)',
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
  <SceneShell scene={scene} frame={frame}>
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
        <ActionScene
          scene={timeline[4]}
          frame={frame}
          fps={fps}
          lead={lead}
          accentColor={accentColor}
          uiCopy={uiCopy}
        />
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
