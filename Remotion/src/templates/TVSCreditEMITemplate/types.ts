export type TVSCreditEMIScene = {
  kind: 'intro' | 'text-only' | 'fullscreen-image' | 'final';
  method?: 1 | 2 | 3;
  image?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  relativeDuration: {
    en: number;
    hi: number;
  };
  caption?: string;
};

export type TVSCreditEMITemplateProps = {
  enableNarration?: boolean;
  narrationAudioPath?: string;
  language?: string;
  customerName?: string;
  productType?: string;
  clientName?: string;
  tos?: string;
  lan?: string;
  contactDetails?: string;
  stepBoundaries?: number[];
  durationInFrames?: number;
  logoUrl?: string;
  logoPosition?: string;
  logoOpacity?: number;
  emiImagePaths?: Record<string, string>;
  whatsappPaynow?: string;
  smsLink?: string;
  upiApps?: string;
  openappSearch?: string;
  enterlan?: string;
  paymentSuccess?: string;
  shopVisit?: string;
};
