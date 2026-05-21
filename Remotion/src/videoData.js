import leadsData from '../leads.json';
import metadataData from '../public/metadata.json';

export const FPS = 30;
export const DEFAULT_DURATION_SECONDS = 12;
export const TRANSITION_FRAMES = 12;
export const WIDTH = 1280;
export const HEIGHT = 720;
export const PAYMENT_LINK_GUIDANCE_DURATION = 960;
export const OVERDUE_TEMPLATE_DURATION = 1050;
export const LOAN_OFFER_INTERACTIVE_DURATION = 450;
const MIN_VIDEO_WIDTH = 540;
const MIN_VIDEO_HEIGHT = 540;
const MAX_VIDEO_WIDTH = 2160;
const MAX_VIDEO_HEIGHT = 2160;

export const SCENE_DEFINITIONS = [
  {key: 'opening', label: 'Notice', ratio: 0.15},
  {key: 'account', label: 'Account', ratio: 0.15},
  {key: 'context', label: 'Review', ratio: 0.17},
  {key: 'amounts', label: 'Amounts', ratio: 0.16},
  {key: 'action', label: 'Action', ratio: 0.21},
  {key: 'closing', label: 'Resolve', ratio: 0.16},
];

const fallbackLead = {
  id: 'preview-sample',
  customer_name: 'Preview Customer',
  lan: 'PREVIEW-001',
  client_name: 'CredResolve',
  language: 'Hindi',
  loan_amount: '₹1,20,000',
  tos: '₹38,450',
  contact_details: '1800-555-999',
  product_type: 'loan',
  title_prefix: 'Account Notice',
  script_text:
    'यह एक प्रीव्यू टेम्पलेट है। वास्तविक रेंडर के दौरान ग्राहक-विशिष्ट डेटा और ऑडियो अपने आप लोड हो जाएंगे।',
  branding: {
    subtitles: {
      enabled: true,
      color: 'White',
      position: 'Bottom',
    },
    logo: {
      public_path: null,
      position: 'Top Right',
      opacity: 80,
    },
  },
  video_width: WIDTH,
  video_height: HEIGHT,
};

export const safeString = (value, fallback = 'Not available') => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
};

const metadata = typeof metadataData === 'object' && metadataData ? metadataData : {};

const BRANDING_DEFAULTS = fallbackLead.branding;

const normalizeSubtitleColor = (value) => {
  const cleaned = safeString(value, BRANDING_DEFAULTS.subtitles.color);
  return ['White', 'Blue', 'Green', 'Red', 'Yellow', 'Teal', 'Black'].includes(cleaned)
    ? cleaned
    : BRANDING_DEFAULTS.subtitles.color;
};

const normalizeSubtitlePosition = (value) => {
  const cleaned = safeString(value, BRANDING_DEFAULTS.subtitles.position);
  return ['Top', 'Center', 'Bottom'].includes(cleaned)
    ? cleaned
    : BRANDING_DEFAULTS.subtitles.position;
};

const normalizeLogoPosition = (value) => {
  const cleaned = safeString(value, BRANDING_DEFAULTS.logo.position);
  return ['Top Left', 'Top Right', 'Bottom Left', 'Bottom Right'].includes(cleaned)
    ? cleaned
    : BRANDING_DEFAULTS.logo.position;
};

const normalizeBranding = (branding) => {
  const subtitleBranding =
    branding && typeof branding.subtitles === 'object' && branding.subtitles
      ? branding.subtitles
      : {};
  const logoBranding =
    branding && typeof branding.logo === 'object' && branding.logo
      ? branding.logo
      : {};

  return {
    subtitles: {
      enabled:
        typeof subtitleBranding.enabled === 'boolean'
          ? subtitleBranding.enabled
          : BRANDING_DEFAULTS.subtitles.enabled,
      color: normalizeSubtitleColor(subtitleBranding.color),
      position: normalizeSubtitlePosition(subtitleBranding.position),
    },
    logo: {
      public_path:
        typeof logoBranding.public_path === 'string' && logoBranding.public_path.trim()
          ? logoBranding.public_path.trim()
          : null,
      position: normalizeLogoPosition(logoBranding.position),
      opacity:
        typeof logoBranding.opacity === 'number' && Number.isFinite(logoBranding.opacity)
          ? Math.max(0, Math.min(100, logoBranding.opacity))
          : BRANDING_DEFAULTS.logo.opacity,
    },
  };
};

const normalizeVideoDimension = (value, fallback, min, max) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
  return fallback;
};

const normalizeVideoWidth = (value) =>
  normalizeVideoDimension(value, WIDTH, MIN_VIDEO_WIDTH, MAX_VIDEO_WIDTH);

const normalizeVideoHeight = (value) =>
  normalizeVideoDimension(value, HEIGHT, MIN_VIDEO_HEIGHT, MAX_VIDEO_HEIGHT);

export const extractNumericAmount = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (!cleaned) {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const formatIndianNumber = (value) => {
  const digits = String(Math.abs(value));
  if (digits.length <= 3) {
    return digits;
  }

  const lastThree = digits.slice(-3);
  const remaining = digits.slice(0, -3);
  const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return value < 0 ? `-${grouped},${lastThree}` : `${grouped},${lastThree}`;
};

export const formatAmountDisplay = (value, fallback = 'राशि उपलब्ध नहीं') => {
  const numericValue = extractNumericAmount(value);
  if (numericValue === null) {
    const cleaned = value === null || value === undefined ? '' : String(value).trim();
    return cleaned || fallback;
  }
  return `₹${formatIndianNumber(numericValue)}`;
};

const determineUrgencyLevel = (tos) => {
  const numericTos = extractNumericAmount(tos);
  if (numericTos === null) {
    return 'elevated';
  }
  if (numericTos >= 100000) {
    return 'critical';
  }
  if (numericTos >= 50000) {
    return 'high';
  }
  return 'elevated';
};

const getProductContent = (productType) => {
  const normalized = safeString(productType, 'loan').toLowerCase().replace(/_/g, ' ');
  const mapping = {
    loan: {
      label: 'लोन खाता',
      formal: 'ऋण खाते',
      summary: 'लोन भुगतान स्थिति',
    },
    insurance: {
      label: 'बीमा खाता',
      formal: 'बीमा खाते',
      summary: 'बीमा भुगतान स्थिति',
    },
    'credit card': {
      label: 'क्रेडिट कार्ड खाता',
      formal: 'क्रेडिट कार्ड खाते',
      summary: 'क्रेडिट कार्ड स्थिति',
    },
  };

  return (
    mapping[normalized] || {
      label: `${normalized || 'खाता'} खाता`,
      formal: `${normalized || 'खाते'} खाते`,
      summary: 'भुगतान स्थिति',
    }
  );
};

const buildDisplayAmounts = (lead) => ({
  primary: {
    label: 'कुल बकाया राशि',
    value: formatAmountDisplay(lead.tos),
    raw: safeString(lead.tos, '0'),
    available: true,
  },
  secondary: {
    label: 'मूल ऋण राशि',
    value: formatAmountDisplay(lead.loan_amount),
    raw: safeString(lead.loan_amount, ''),
    available: lead.loan_amount !== null && lead.loan_amount !== undefined && String(lead.loan_amount).trim() !== '',
  },
});

const buildScenePayload = (lead, displayAmounts, urgencyLevel) => {
  const customerName = safeString(lead.customer_name, 'Customer');
  const clientName = safeString(lead.client_name, 'Bank');
  const lan = safeString(lead.lan, 'N/A');
  const contactDetails = safeString(lead.contact_details, '1800-555-999');

  if (lead.template_key === 'overdue_template') {
    return {
      headline_text: `Dear ${customerName}`,
      cta_text: `For any help, contact ${contactDetails}.`,
      opening: {
        eyebrow: 'Overdue Notice',
        headline: `Dear ${customerName}`,
        subheadline: `${clientName} | Card ${lan}`,
      },
    };
  }

  const productContent = getProductContent(lead.product_type);
  const outstandingValue = displayAmounts.primary.value;
  const loanValue = displayAmounts.secondary.value;
  const urgencyCopy = {
    critical: 'तत्काल हस्तक्षेप आवश्यक',
    high: 'शीघ्र समाधान आवश्यक',
    elevated: 'समय-संवेदी औपचारिक सूचना',
  }[urgencyLevel];

  const secondaryNote = displayAmounts.secondary.available
    ? `मूल राशि ${loanValue}`
    : 'उपलब्ध अभिलेखों के अनुसार भुगतान विलंब जारी है';

  const headlineText = `${customerName} जी, आपके ${productContent.formal} पर तत्काल ध्यान आवश्यक है`;
  const ctaText = `${customerName}, समाधान और पुनर्भुगतान विकल्पों पर बात करने के लिए अभी ${contactDetails} पर संपर्क करें।`;

  return {
    opening: {
      eyebrow: 'औपचारिक सूचना',
      headline: headlineText,
      subheadline: `${clientName} | खाता ${lan}`,
    },
    account: {
      eyebrow: productContent.summary,
      headline: `खाता ${lan}`,
      supporting: `वर्तमान कुल बकाया ${outstandingValue}`,
      badge: urgencyCopy,
    },
    context: {
      eyebrow: 'स्थिति सारांश',
      headline: `${productContent.label} में निरंतर विलंब दर्ज है`,
      body: `${clientName} के रिकॉर्ड के अनुसार भुगतान समय पर नहीं हुआ है। कुल बकाया राशि ${outstandingValue} तक पहुंच चुकी है और स्थिति पर अब औपचारिक ध्यान अपेक्षित है।`,
    },
    amounts: {
      eyebrow: 'वित्तीय मुख्य बिंदु',
      headline: 'राशि सारांश',
      body: secondaryNote,
      note: 'कृपया भुगतान या पुनर्भुगतान विकल्प पर तुरंत चर्चा करें।',
    },
    action: {
      eyebrow: 'तत्काल अगला कदम',
      headline: 'आज ही संपर्क करें',
      body: ctaText,
      cta_label: 'संपर्क नंबर',
      cta_value: contactDetails,
    },
    closing: {
      eyebrow: 'समाधान अभी भी संभव है',
      headline: 'समय पर प्रतिक्रिया से आगे की एस्केलेशन टल सकती है',
      body: `${clientName} आपकी त्वरित प्रतिक्रिया की प्रतीक्षा कर रहा है।`,
    },
    headline_text: headlineText,
    cta_text: ctaText,
  };
};

const normalizeLead = (lead) => {
  const mergedLead = {...fallbackLead, ...lead};
  const displayAmounts = lead?.display_amounts || buildDisplayAmounts(mergedLead);
  const urgencyLevel = safeString(lead?.urgency_level, determineUrgencyLevel(mergedLead.tos));
  const scenePayload = lead?.scene_payload || buildScenePayload(mergedLead, displayAmounts, urgencyLevel);
  const branding = normalizeBranding(lead?.branding);

  return {
    ...mergedLead,
    display_amounts: displayAmounts,
    scene_payload: scenePayload,
    headline_text: safeString(lead?.headline_text, scenePayload.headline_text),
    cta_text: safeString(lead?.cta_text, scenePayload.cta_text),
    urgency_level: urgencyLevel,
    branding,
    video_width: normalizeVideoWidth(lead?.video_width),
    video_height: normalizeVideoHeight(lead?.video_height),
  };
};

export const leads =
  Array.isArray(leadsData) && leadsData.length > 0
    ? leadsData.map((lead) => normalizeLead(lead))
    : [normalizeLead(fallbackLead)];

export const getLeadById = (leadId) =>
  leads.find((lead) => lead.id === leadId) || leads[0] || normalizeLead(fallbackLead);

export const getLeadDimensions = (lead) => ({
  width: normalizeVideoWidth(lead?.video_width),
  height: normalizeVideoHeight(lead?.video_height),
});

export const getTrackMeta = (leadId) => {
  const lead = getLeadById(leadId);
  const track = metadata[leadId] || {};
  
  const rawSubtitles = Array.isArray(lead?.subtitles) && lead.subtitles.length > 0 
    ? lead.subtitles 
    : (Array.isArray(track.subtitles) ? track.subtitles : []);

  const subtitles = rawSubtitles.map((sub) => {
    if (!sub || typeof sub !== 'object') return sub;
    return {
      ...sub,
      text: typeof sub.text === 'string' ? sub.text.replace(/\s+\d+\s*$/, '') : '',
    };
  });

  const duration = typeof track.duration === 'number' && Number.isFinite(track.duration)
    ? track.duration
    : (subtitles.length > 0 ? Math.max(DEFAULT_DURATION_SECONDS, subtitles[subtitles.length - 1].end) : DEFAULT_DURATION_SECONDS);

  return {
    duration,
    subtitles,
  };
};

export const getDurationInFrames = (leadId) => {
  const lead = getLeadById(leadId);
  const track = getTrackMeta(leadId);
  const lastSubtitleEnd = track.subtitles.reduce((max, item) => {
    if (item && typeof item.end === 'number' && Number.isFinite(item.end)) {
      return Math.max(max, item.end);
    }
    return max;
  }, 0);
  const templateMinSeconds =
    lead?.template_key === 'payment_link_guidance'
      ? PAYMENT_LINK_GUIDANCE_DURATION / FPS
      : lead?.template_key === 'overdue_template'
      ? OVERDUE_TEMPLATE_DURATION / FPS
      : lead?.template_key === 'loan_offer_interactive'
      ? LOAN_OFFER_INTERACTIVE_DURATION / FPS
      : DEFAULT_DURATION_SECONDS;
  const totalSeconds = Math.max(track.duration, lastSubtitleEnd, templateMinSeconds);
  return Math.ceil(totalSeconds * FPS) + Math.round(FPS * 1.5);
};

export const getActiveSubtitle = (subtitles, currentTime) =>
  subtitles.find((subtitle) => {
    if (!subtitle || typeof subtitle !== 'object') {
      return false;
    }
    return currentTime >= subtitle.start && currentTime <= subtitle.end;
  }) || null;

export const getSubtitleProgress = (subtitle, currentTime) => {
  if (!subtitle) {
    return 0;
  }
  const duration = Math.max(0.01, subtitle.end - subtitle.start);
  return Math.min(1, Math.max(0, (currentTime - subtitle.start) / duration));
};

const getWordCount = (value) => {
  if (typeof value !== 'string') {
    return 0;
  }
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length;
};

const getDynamicSceneRatios = (lead) => {
  const scenePayload = lead?.scene_payload || {};
  const textByScene = {
    opening: `${safeString(scenePayload.opening?.headline, '')} ${safeString(scenePayload.opening?.subheadline, '')}`,
    account: `${safeString(scenePayload.account?.headline, '')} ${safeString(scenePayload.account?.supporting, '')} ${safeString(scenePayload.account?.badge, '')}`,
    context: `${safeString(scenePayload.context?.headline, '')} ${safeString(scenePayload.context?.body, '')}`,
    amounts: `${safeString(scenePayload.amounts?.headline, '')} ${safeString(scenePayload.amounts?.body, '')} ${safeString(scenePayload.amounts?.note, '')}`,
    action: `${safeString(scenePayload.action?.headline, '')} ${safeString(scenePayload.action?.body, '')} ${safeString(scenePayload.action?.cta_value, '')}`,
    closing: `${safeString(scenePayload.closing?.headline, '')} ${safeString(scenePayload.closing?.body, '')}`,
  };
  const thresholds = {
    opening: 12,
    account: 10,
    context: 18,
    amounts: 14,
    action: 18,
    closing: 12,
  };
  const gains = {
    opening: 0.0028,
    account: 0.0024,
    context: 0.0044,
    amounts: 0.0034,
    action: 0.0048,
    closing: 0.003,
  };

  const rawRatios = SCENE_DEFINITIONS.map((scene) => {
    const wordCount = getWordCount(textByScene[scene.key]);
    const overflow = Math.max(0, wordCount - thresholds[scene.key]);
    return scene.ratio + overflow * gains[scene.key];
  });
  const total = rawRatios.reduce((sum, ratio) => sum + ratio, 0) || 1;

  return rawRatios.map((ratio) => ratio / total);
};

export const getSceneTimeline = (durationInFrames, lead = null) => {
  const totalFrames = Math.max(durationInFrames, SCENE_DEFINITIONS.length * 40);
  const minFrames = 36;
  const normalizedLead = lead && typeof lead === 'object' ? normalizeLead(lead) : leads[0];
  const ratios = getDynamicSceneRatios(normalizedLead);
  const durations = ratios.map((ratio) => Math.max(minFrames, Math.round(totalFrames * ratio)));

  let allocated = durations.reduce((sum, value) => sum + value, 0);

  while (allocated > totalFrames) {
    const index = durations.findIndex((value) => value > minFrames);
    if (index === -1) {
      break;
    }
    durations[index] -= 1;
    allocated -= 1;
  }

  while (allocated < totalFrames) {
    const index = allocated % SCENE_DEFINITIONS.length;
    durations[index] += 1;
    allocated += 1;
  }

  let cursor = 0;
  return SCENE_DEFINITIONS.map((scene, index) => {
    const duration = durations[index];
    const start = cursor;
    cursor += duration;
    return {
      ...scene,
      start,
      duration,
      end: start + duration,
    };
  });
};
