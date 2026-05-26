import type {PaymentLinkGuidanceScene} from './types';

const loginFieldBlurs = [
  {x: 8, y: 40, width: 84, height: 7}, // Agreement Number field
];

const amountPageBlurs = [
  {x: 45, y: 27, width: 50, height: 5},  // Agreement Number value
  {x: 45, y: 31, width: 50, height: 5},  // Customer Name value
  {x: 45, y: 35, width: 50, height: 5},  // EMI value
  {x: 45, y: 41, width: 50, height: 5},  // Total Payable Amount value
  {x: 8,  y: 55, width: 84, height: 7},  // Enter Amount to Pay field
];

export const PAYMENT_LINK_GUIDANCE_SCENES: PaymentLinkGuidanceScene[] = [
  {
    kind: 'link-click',
    image: '', // No image needed, uses CSS bubble
    eyebrow: 'First Step',
    title: 'Click the Link',
    subtitle: 'Tap on the payment link received in your SMS.',
    duration: 90,
  },
  {
    kind: 'intro',
    image: 'click1.png',
    eyebrow: 'Welcome {{customerName}}',
    title: 'Payment guide for account {{lan}}',
    subtitle: 'This video will guide you through completing payment from the payment link.',
    duration: 120,
  },
  {
    kind: 'screenshot',
    image: 'click1.png',
    eyebrow: 'First',
    title: 'Enter agreement number',
    subtitle: 'Type the agreement number for LAN {{lan}} exactly as shown.',
    duration: 120,
    blurs: loginFieldBlurs,
  },
  {
    kind: 'screenshot',
    image: 'click2.png',
    eyebrow: 'Next',
    title: 'Fill the captcha',
    subtitle: 'Enter the captcha carefully before moving ahead.',
    duration: 120,
    blurs: loginFieldBlurs,
  },
  {
    kind: 'screenshot',
    image: 'click2.png',
    eyebrow: 'Next',
    title: 'Accept the terms',
    subtitle: 'Select the checkbox to accept the terms and conditions.',
    duration: 120,
    blurs: loginFieldBlurs,
  },
  {
    kind: 'screenshot',
    image: 'click4.png',
    eyebrow: 'Next',
    title: 'Review payable amount',
    subtitle: 'Check the payable amount {{payableAmount}} for account {{lan}}.',
    duration: 120,
    blurs: amountPageBlurs,
  },
  {
    kind: 'screenshot',
    image: 'click4.png',
    eyebrow: 'Then',
    title: 'Proceed to pay',
    subtitle: 'Tap Proceed to Pay after verifying the details.',
    duration: 120,
    blurs: amountPageBlurs,
  },
  {
    kind: 'screenshot',
    image: 'click6.png',
    eyebrow: 'Then',
    title: 'Choose payment method',
    subtitle: 'Select your preferred payment option to complete the transaction.',
    duration: 120,
    blurs: [{x: 52, y: 22, width: 20, height: 4}], // Covers the ₹4,227 amount on the payment options screen
  },
  {
    kind: 'outro',
    image: 'click6.png',
    eyebrow: 'Need help?',
    title: 'Contact support',
    subtitle: 'For support, please contact {{contactDetails}}.',
    duration: 120,
  },
];

export const PAYMENT_LINK_GUIDANCE_DURATION = PAYMENT_LINK_GUIDANCE_SCENES.reduce(
  (total, scene) => total + scene.duration,
  0
);
