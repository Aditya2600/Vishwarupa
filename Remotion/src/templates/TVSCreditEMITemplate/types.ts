export type TVSCreditEMIScene = {
  kind: 'intro' | 'text-only' | 'fullscreen-image' | 'final';
  method?: 1 | 2 | 3;
  image?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  relativeDuration: number;
  caption?: string;
};

export type TVSCreditEMITemplateProps = {
  enableNarration?: boolean;
  narrationAudioPath?: string;
  customerName?: string;
  productType?: string;
  clientName?: string;
  tos?: string;
  lan?: string;
  contactDetails?: string;
  stepBoundaries?: number[];
  durationInFrames?: number;
};
