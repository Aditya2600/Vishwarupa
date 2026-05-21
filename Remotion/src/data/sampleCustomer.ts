export type LoanReminderAssetKey =
  | 'logo'
  | 'npaWarning'
  | 'creditImpact'
  | 'lastChance'
  | 'ctaScene'
  | 'financialBurden';

export type LoanReminderAssets = Record<LoanReminderAssetKey, string>;

export type LoanReminderCustomer = {
  customerName: string;
  loanType: string;
  loanNumber: string;
  overdueAmount: string;
  lenderName: string;
  ctaPrimary: string;
  ctaSecondary: string;
  paymentUrl: string;
  callbackPhone: string;
  voiceoverLanguage: 'loan_reminder';
  voiceoverAudioSrc?: string;
  loanReminderAssets: LoanReminderAssets;
};

export const defaultLoanReminderAssets: LoanReminderAssets = {
  logo: 'assets/tvs_credit_logo.png',
  npaWarning: 'man_phone_transparent.png',
  creditImpact: 'credit_score_transparent.png',
  lastChance: 'last_chance_transparent.png',
  ctaScene: 'phone_paynow_transparent.png',
  financialBurden: 'piggy_bank_arrow_transparent.png',
};

export const sampleCustomer: LoanReminderCustomer = {
  customerName: 'Rahul Verma',
  loanType: 'Personal Loan',
  loanNumber: '123445555555',
  overdueAmount: '₹50,000',
  lenderName: 'TVS Credit',
  ctaPrimary: 'Pay Now',
  ctaSecondary: 'Request a Call Back',
  paymentUrl: 'https://pay.example.com/customer123',
  callbackPhone: '+911234567890',
  voiceoverLanguage: 'loan_reminder',
  loanReminderAssets: defaultLoanReminderAssets,
};
