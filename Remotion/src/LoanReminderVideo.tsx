import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {OptionalVoiceoverAudio} from './components/OptionalVoiceoverAudio';
import {VoiceoverCaption} from './components/VoiceoverCaption';
import {
  replaceScriptPlaceholders,
  sceneVoiceoverScript,
  type LoanReminderSceneKey,
} from './data/loanReminderVoiceoverScript';
import {
  defaultLoanReminderAssets,
  sampleCustomer,
  type LoanReminderCustomer,
} from './data/sampleCustomer';
import {CreditImpact} from './scenes/CreditImpact';
import {CtaScene} from './scenes/CtaScene';
import {FinancialBurden} from './scenes/FinancialBurden';
import {Intro} from './scenes/Intro';
import {LastChance} from './scenes/LastChance';
import {LegalWarning} from './scenes/LegalWarning';
import {LoanDetails} from './scenes/LoanDetails';
import {NpaWarning} from './scenes/NpaWarning';
import {Outro} from './scenes/Outro';

export const LOAN_REMINDER_FPS = 30;
export const LOAN_REMINDER_DURATION_IN_FRAMES = 64 * LOAN_REMINDER_FPS;
const DEFAULT_LOAN_REMINDER_AUDIO_SRC = 'audio/loan-reminder-voiceover.mp3';

const timeline: Array<{
  key: LoanReminderSceneKey;
  from: number;
  durationInFrames: number;
  Scene: React.ComponentType<{customer: LoanReminderCustomer}>;
}> = [
  {
    key: 'intro',
    from: 0 * LOAN_REMINDER_FPS,
    durationInFrames: 4 * LOAN_REMINDER_FPS,
    Scene: Intro,
  },
  {
    key: 'loanDetails',
    from: 4 * LOAN_REMINDER_FPS,
    durationInFrames: 9 * LOAN_REMINDER_FPS,
    Scene: LoanDetails,
  },
  {
    key: 'npaWarning',
    from: 13 * LOAN_REMINDER_FPS,
    durationInFrames: 9 * LOAN_REMINDER_FPS,
    Scene: NpaWarning,
  },
  {
    key: 'creditImpact',
    from: 22 * LOAN_REMINDER_FPS,
    durationInFrames: 8 * LOAN_REMINDER_FPS,
    Scene: CreditImpact,
  },
  {
    key: 'legalWarning',
    from: 30 * LOAN_REMINDER_FPS,
    durationInFrames: 9 * LOAN_REMINDER_FPS,
    Scene: LegalWarning,
  },
  {
    key: 'lastChance',
    from: 39 * LOAN_REMINDER_FPS,
    durationInFrames: 7 * LOAN_REMINDER_FPS,
    Scene: LastChance,
  },
  {
    key: 'ctaScene',
    from: 46 * LOAN_REMINDER_FPS,
    durationInFrames: 9 * LOAN_REMINDER_FPS,
    Scene: CtaScene,
  },
  {
    key: 'financialBurden',
    from: 55 * LOAN_REMINDER_FPS,
    durationInFrames: 6 * LOAN_REMINDER_FPS,
    Scene: FinancialBurden,
  },
  {
    key: 'outro',
    from: 61 * LOAN_REMINDER_FPS,
    durationInFrames: 3 * LOAN_REMINDER_FPS,
    Scene: Outro,
  },
];

export const LoanReminderVideo = (props: LoanReminderCustomer) => {
  const customer = {
    ...sampleCustomer,
    ...props,
    loanReminderAssets: {
      ...defaultLoanReminderAssets,
      ...sampleCustomer.loanReminderAssets,
      ...props.loanReminderAssets,
    },
  };
  const voiceoverAudioSrc =
    customer.voiceoverAudioSrc ?? DEFAULT_LOAN_REMINDER_AUDIO_SRC;

  return (
    <AbsoluteFill style={{backgroundColor: '#f8fcff'}}>
      <OptionalVoiceoverAudio src={voiceoverAudioSrc} />

      {timeline.map(({key, from, durationInFrames, Scene}) => {
        const caption = replaceScriptPlaceholders(
          sceneVoiceoverScript[key].voiceover,
          customer
        );

        return (
          <Sequence key={key} from={from} durationInFrames={durationInFrames}>
            <Scene customer={customer} />
            <VoiceoverCaption text={caption} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
