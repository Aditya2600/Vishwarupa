export type CollectionReminderData = {
  customerName: string;
  bankName: string;
  productType: string;
  accountLast4: string;
  overdueAmount: string;
  minimumDue: string;
  totalDue: string;
  daysOverdue: number;
  npaDays: number;
  bankerName: string;
  bankerPhone: string;
  payNowLabel: string;
  callUsLabel: string;
  brandColor: string;
  accentColor: string;
  logoPath?: string;
  voiceoverAudioPath?: string;
};

export const collectionReminderData: CollectionReminderData = {
  customerName: 'Ramesh Kumar',
  bankName: 'TVS Credit',
  productType: 'Personal Loan',
  accountLast4: '1234',
  overdueAmount: '₹18,750',
  minimumDue: '₹5,000',
  totalDue: '₹23,750',
  daysOverdue: 12,
  npaDays: 90,
  bankerName: 'Neha Sharma',
  bankerPhone: '1800-555-999',
  payNowLabel: 'Pay Now',
  callUsLabel: 'Call Us',
  brandColor: '#1455D9',
  accentColor: '#19B6A3',
  logoPath: 'assets/tvs_credit_logo.png',
  voiceoverAudioPath: undefined,
};
