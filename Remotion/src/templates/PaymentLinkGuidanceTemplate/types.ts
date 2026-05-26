export type PaymentLinkGuidanceScene = {
  kind: 'intro' | 'screenshot' | 'outro' | 'link-click';
  image: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  duration: number;
  blurs?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

export type PaymentLinkGuidanceTemplateProps = {
  enableNarration?: boolean;
  narrationAudioPath?: string;
  customerName?: string;
  lan?: string;
  clientName?: string;
  contactDetails?: string;
  payableAmount?: string;
  stepBoundaries?: number[];
};
