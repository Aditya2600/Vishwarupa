import type {LoanReminderCustomer} from './sampleCustomer';

export type LoanReminderSceneKey =
  | 'intro'
  | 'loanDetails'
  | 'npaWarning'
  | 'creditImpact'
  | 'legalWarning'
  | 'lastChance'
  | 'ctaScene'
  | 'financialBurden'
  | 'outro';

export type SceneVoiceoverScript = Record<
  LoanReminderSceneKey,
  {
    duration: string;
    voiceover: string;
  }
>;

export const sceneVoiceoverScript: SceneVoiceoverScript = {
  intro: {
    duration: '0-4s',
    voiceover: 'Yeh ek important reminder hai {lenderName} ki taraf se.',
  },
  loanDetails: {
    duration: '4-13s',
    voiceover:
      'Dear {customerName}, aapke {loanType} account number {loanNumberSpoken} par {overdueAmount} ka overdue amount pending hai.',
  },
  npaWarning: {
    duration: '13-22s',
    voiceover:
      'Kripya dhyaan dein, agar payment aur delay hoti hai, toh aapka account critically overdue category mein ja sakta hai, ya applicable policy ke according NPA report ho sakta hai.',
  },
  creditImpact: {
    duration: '22-30s',
    voiceover:
      'Iska negative impact aapke credit score par pad sakta hai, aur future loan approval, credit card eligibility, aur financial services access affect ho sakte hain.',
  },
  legalWarning: {
    duration: '30-39s',
    voiceover:
      'Lender policy ke according recovery action initiate ho sakta hai, legal notice issue ho sakta hai, aur additional charges bhi badh sakte hain.',
  },
  lastChance: {
    duration: '39-46s',
    voiceover:
      'Further financial burden avoid karne ke liye, kripya apna overdue amount jald se jald clear karein.',
  },
  ctaScene: {
    duration: '46-55s',
    voiceover:
      'Aap apne overdue amount ko secure repayment channel ke through clear kar sakte hain. Zarurat ho toh assistance ke liye support team se sampark karein.',
  },
  financialBurden: {
    duration: '55-61s',
    voiceover:
      'Additional charges avoid karein, aur apni financial profile protect karne ke liye aaj hi dues clear karein.',
  },
  outro: {
    duration: '61-64s',
    voiceover: 'Dhanyavaad.',
  },
};

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

export const speakDigits = (value: string | number) => {
  return String(value)
    .split('')
    .filter((character) => character >= '0' && character <= '9')
    .map((digit) => digitWords[digit])
    .join(' ');
};

export const replaceScriptPlaceholders = (
  script: string,
  customerData: Pick<
    LoanReminderCustomer,
    | 'customerName'
    | 'loanType'
    | 'loanNumber'
    | 'overdueAmount'
    | 'lenderName'
  >
) => {
  const values = {
    customerName: customerData.customerName,
    loanType: customerData.loanType,
    loanNumber: customerData.loanNumber,
    loanNumberSpoken: speakDigits(customerData.loanNumber),
    overdueAmount: customerData.overdueAmount,
    lenderName: customerData.lenderName,
  };

  return script.replace(
    /\{(customerName|loanType|loanNumber|loanNumberSpoken|overdueAmount|lenderName)\}/g,
    (_, key: keyof typeof values) => values[key]
  );
};
