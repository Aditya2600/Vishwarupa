import type {TVSCreditEMIScene} from './types';

export const TVS_CREDIT_EMI_SCENES: TVSCreditEMIScene[] = [
  {
    kind: 'intro',
    eyebrow: 'Important Update',
    title: 'Hello {{customerName}}',
    subtitle: 'Regarding your {{productType}} account from {{clientName}}. An outstanding amount of ₹{{tos}} is pending on account {{lan}}.',
    relativeDuration: 0.23, // 23% of total time
  },
  {
    kind: 'text-only',
    method: 1,
    eyebrow: 'Method 1',
    title: 'Payment Link',
    subtitle: 'A secure link has been sent to you on WhatsApp and SMS.',
    relativeDuration: 0.05, // 5%
  },
  {
    kind: 'fullscreen-image',
    method: 1,
    image: 'whatsapp_paynow.png',
    caption: 'Click the "Pay Now" button on WhatsApp',
    relativeDuration: 0.06, // 6%
  },
  {
    kind: 'fullscreen-image',
    method: 1,
    image: 'sms link.png',
    caption: 'Or click the link shared via SMS',
    relativeDuration: 0.08, // 8%
  },
  {
    kind: 'text-only',
    method: 2,
    eyebrow: 'Method 2',
    title: 'UPI / Payment Apps',
    subtitle: 'Pay conveniently using PhonePe, Google Pay, or any UPI app.',
    relativeDuration: 0.06, // 6%
  },
  {
    kind: 'fullscreen-image',
    method: 2,
    image: 'upi apps.png',
    caption: 'Open PhonePe or Google Pay',
    relativeDuration: 0.09, // 9%
  },
  {
    kind: 'fullscreen-image',
    method: 2,
    image: 'openapp_and serach tvs credit.png',
    caption: 'Go to Repayment and search for TVS Credit',
    relativeDuration: 0.09, // 9%
  },
  {
    kind: 'fullscreen-image',
    method: 2,
    image: 'enterlan.png',
    caption: 'Enter LAN and complete payment using UPI PIN',
    relativeDuration: 0.06, // 6%
  },
  {
    kind: 'fullscreen-image',
    method: 2,
    image: 'payment sucess.png',
    caption: 'Wait for successful payment confirmation',
    relativeDuration: 0.05, // 5%
  },
  {
    kind: 'text-only',
    method: 3,
    eyebrow: 'Method 3',
    title: 'EMI Collection Shop',
    subtitle: 'Visit your nearest EMI Collection Shop to deposit your EMI amount.',
    relativeDuration: 0.12, // 12%
  },
  {
    kind: 'final',
    eyebrow: 'Final Reminder',
    title: 'Pay Today',
    subtitle: 'Contact {{contactDetails}} immediately to discuss options and avoid charges.',
    relativeDuration: 0.11, // 11%
  },
];
