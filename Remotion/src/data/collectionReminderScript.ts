import type {CollectionReminderData} from './collectionReminderData';

export type CollectionReminderSceneKey =
  | 'intro'
  | 'accountDetails'
  | 'npaWarning'
  | 'nonPaymentConsequences'
  | 'takeAction'
  | 'benefits'
  | 'difficultySupport'
  | 'actNow'
  | 'callBanker'
  | 'thankYou'
  | 'contactUs';

export type CollectionReminderScriptScene = {
  key: CollectionReminderSceneKey;
  fromSecond: number;
  durationSeconds: number;
  voiceover: string;
};

export const collectionReminderVoiceoverScript = {
  intro: 'Dear {customerName},',

  accountDetails:
    'Your {productType} ending with {accountLast4Speech} has an overdue amount of {overdueAmountSpeech}.',

  npaWarning:
    'If this continues beyond {npaDaysSpeech} days, your account will be classified as a Non-Performing Asset, NPA.',

  nonPaymentConsequences:
    'Non-payment can lead to legal action to recover dues, restrictions on future loans or credit cards from any financial institution, and a lasting negative impact on your financial health.',

  takeAction:
    'Take action now. Clear your outstanding balance and avoid these consequences.',

  benefits:
    'Timely repayment brings several benefits. Protect your credit score and ensure access to future loans.',

  difficultySupport:
    'We understand that life can be challenging. If full repayment is difficult, here are some options for you. Pay the minimum amount due.',

  actNow: 'Act now to protect your financial future.',

  callBanker:
    'You can call your {bankName} banker at {bankerPhoneSpeech} for assistance.',

  thankYou:
    'Our team is here to guide you. Thank you for choosing {bankName}.',

  contactUs: "Contact us today, and let's work together for a solution.",
} satisfies Record<CollectionReminderSceneKey, string>;

const digitWords: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

export const formatDigitsForSpeech = (value: string): string =>
  value
    .split('')
    .filter((character) => character >= '0' && character <= '9')
    .map((digit) => digitWords[digit])
    .join(' ');

const formatAmountForSpeech = (value: string): string =>
  value.replace(/₹/g, 'rupees ').replace(/,/g, '').trim();

export const collectionReminderScript: CollectionReminderScriptScene[] = [
  {
    key: 'intro',
    fromSecond: 0,
    durationSeconds: 5,
    voiceover: collectionReminderVoiceoverScript.intro,
  },
  {
    key: 'accountDetails',
    fromSecond: 5,
    durationSeconds: 8,
    voiceover: collectionReminderVoiceoverScript.accountDetails,
  },
  {
    key: 'npaWarning',
    fromSecond: 13,
    durationSeconds: 8,
    voiceover: collectionReminderVoiceoverScript.npaWarning,
  },
  {
    key: 'nonPaymentConsequences',
    fromSecond: 21,
    durationSeconds: 9,
    voiceover: collectionReminderVoiceoverScript.nonPaymentConsequences,
  },
  {
    key: 'takeAction',
    fromSecond: 30,
    durationSeconds: 7,
    voiceover: collectionReminderVoiceoverScript.takeAction,
  },
  {
    key: 'benefits',
    fromSecond: 37,
    durationSeconds: 8,
    voiceover: collectionReminderVoiceoverScript.benefits,
  },
  {
    key: 'difficultySupport',
    fromSecond: 45,
    durationSeconds: 9,
    voiceover: collectionReminderVoiceoverScript.difficultySupport,
  },
  {
    key: 'actNow',
    fromSecond: 54,
    durationSeconds: 7,
    voiceover: collectionReminderVoiceoverScript.actNow,
  },
  {
    key: 'callBanker',
    fromSecond: 61,
    durationSeconds: 6,
    voiceover: collectionReminderVoiceoverScript.callBanker,
  },
  {
    key: 'thankYou',
    fromSecond: 67,
    durationSeconds: 4,
    voiceover: collectionReminderVoiceoverScript.thankYou,
  },
  {
    key: 'contactUs',
    fromSecond: 71,
    durationSeconds: 4,
    voiceover: collectionReminderVoiceoverScript.contactUs,
  },
];

export const personalizeCollectionReminderScript = (
  template: string,
  data: CollectionReminderData
) => {
  const values = {
    customerName: data.customerName,
    bankName: data.bankName,
    productType: data.productType,
    accountLast4: data.accountLast4,
    accountLast4Speech: formatDigitsForSpeech(data.accountLast4),
    accountLast4Spoken: formatDigitsForSpeech(data.accountLast4),
    overdueAmount: data.overdueAmount,
    overdueAmountSpeech: formatAmountForSpeech(data.overdueAmount),
    minimumDue: data.minimumDue,
    minimumDueSpeech: formatAmountForSpeech(data.minimumDue),
    totalDue: data.totalDue,
    totalDueSpeech: formatAmountForSpeech(data.totalDue),
    daysOverdue: String(data.daysOverdue),
    npaDays: String(data.npaDays),
    npaDaysSpeech: String(data.npaDays),
    bankerName: data.bankerName,
    bankerPhone: data.bankerPhone,
    bankerPhoneSpeech: formatDigitsForSpeech(data.bankerPhone),
    bankerPhoneSpoken: formatDigitsForSpeech(data.bankerPhone),
    payNowLabel: data.payNowLabel,
    callUsLabel: data.callUsLabel,
  };

  return template.replace(
    /\{(customerName|bankName|productType|accountLast4|accountLast4Speech|accountLast4Spoken|overdueAmount|overdueAmountSpeech|minimumDue|minimumDueSpeech|totalDue|totalDueSpeech|daysOverdue|npaDays|npaDaysSpeech|bankerName|bankerPhone|bankerPhoneSpeech|bankerPhoneSpoken|payNowLabel|callUsLabel)\}/g,
    (_, key: keyof typeof values) => values[key]
  );
};
