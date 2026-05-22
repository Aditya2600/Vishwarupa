import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {OptionalVoiceoverAudio} from './components/OptionalVoiceoverAudio';
import {AmountHighlight} from './components/collection-reminder/AmountHighlight';
import {AnimatedIllustration} from './components/collection-reminder/AnimatedIllustration';
import {BankCard} from './components/collection-reminder/BankCard';
import {BrandFrame} from './components/collection-reminder/BrandFrame';
import {CTAFooter} from './components/collection-reminder/CTAFooter';
import {CurvedBackground} from './components/collection-reminder/CurvedBackground';
import {SceneTitle} from './components/collection-reminder/SceneTitle';
import {Subtitles} from './components/collection-reminder/Subtitles';
import {
  collectionReminderData,
  type CollectionReminderData,
} from './data/collectionReminderData';
import {
  collectionReminderScript,
  personalizeCollectionReminderScript,
  type CollectionReminderSceneKey,
} from './data/collectionReminderScript';

export const COLLECTION_REMINDER_FPS = 30;
export const COLLECTION_REMINDER_DURATION_SECONDS = 75;
export const COLLECTION_REMINDER_DURATION_IN_FRAMES =
  COLLECTION_REMINDER_DURATION_SECONDS * COLLECTION_REMINDER_FPS;

type SceneProps = {
  data: CollectionReminderData;
};

const mergeCollectionReminderData = (
  props: Partial<CollectionReminderData>
): CollectionReminderData => ({
  ...collectionReminderData,
  ...props,
});

const CardShell = ({children}: {children: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [0, 18], [34, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.94)',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        borderRadius: 46,
        boxShadow: '0 30px 90px rgba(15, 23, 42, 0.14)',
        opacity,
        padding: 42,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
};

const TwoColumnScene = ({
  children,
  illustration,
  reverse = false,
}: {
  children: React.ReactNode;
  illustration: React.ReactNode;
  reverse?: boolean;
}) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '170px 80px 280px'}}>
    <div
      style={{
        alignItems: 'center',
        display: 'grid',
        gap: 62,
        gridTemplateColumns: reverse ? '0.72fr 1fr' : '1fr 0.72fr',
        width: '100%',
      }}
    >
      {reverse ? illustration : children}
      {reverse ? children : illustration}
    </div>
  </AbsoluteFill>
);

const IntroScene = ({data}: SceneProps) => (
  <TwoColumnScene
    illustration={<AnimatedIllustration variant="greeting" size={500} />}
  >
    <SceneTitle
      dark
      eyebrow={data.bankName}
      lines={['A personalized repayment reminder for your account.']}
      title={`Dear ${data.customerName},`}
    />
  </TwoColumnScene>
);

const AccountDetailsScene = ({data}: SceneProps) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '170px 78px 280px'}}>
    <div style={{display: 'grid', gap: 34, width: '100%'}}>
      <SceneTitle
        eyebrow="Account details"
        lines={[
          `${data.productType} ending with ${data.accountLast4}`,
          `Overdue amount: ${data.overdueAmount}`,
        ]}
        title="Payment overdue"
      />
      <div style={{alignItems: 'center', display: 'grid', gap: 28, gridTemplateColumns: '0.86fr 1fr'}}>
        <BankCard
          accountLast4={data.accountLast4}
          accentColor={data.accentColor}
          bankName={data.bankName}
          brandColor={data.brandColor}
          productType={data.productType}
        />
        <AmountHighlight
          accentColor={data.accentColor}
          amount={data.overdueAmount}
          brandColor={data.brandColor}
          label="Overdue amount"
          width="100%"
        />
      </div>
    </div>
  </AbsoluteFill>
);

const NpaWarningScene = ({data}: SceneProps) => (
  <TwoColumnScene
    reverse
    illustration={<AnimatedIllustration variant="npaWarning" size={500} />}
  >
    <SceneTitle
      eyebrow="NPA warning"
      lines={[
        `If overdue continues beyond ${data.npaDays} days, your account may be classified as NPA.`,
        'Please clear dues before escalation.',
      ]}
      title="Avoid account classification risk"
    />
  </TwoColumnScene>
);

const NonPaymentConsequencesScene = () => (
  <TwoColumnScene
    illustration={<AnimatedIllustration variant="nonPaymentConsequences" size={500} />}
  >
    <SceneTitle
      eyebrow="Important"
      lines={[
        'Non-payment can lead to legal recovery action.',
        'It can also restrict future loans and credit cards.',
      ]}
      title="Consequences of delay"
    />
  </TwoColumnScene>
);

const TakeActionScene = ({data}: SceneProps) => (
  <TwoColumnScene
    reverse
    illustration={<AnimatedIllustration variant="actNow" size={490} />}
  >
    <SceneTitle
      eyebrow="Take action now"
      lines={[
        `Clear your outstanding balance of ${data.overdueAmount}.`,
        'Avoid further consequences and follow-ups.',
      ]}
      title="Repay today"
    />
  </TwoColumnScene>
);

const BenefitsScene = () => (
  <TwoColumnScene
    illustration={<AnimatedIllustration variant="benefits" size={500} />}
  >
    <SceneTitle
      eyebrow="Benefits"
      lines={[
        'Protect your credit score.',
        'Ensure smoother access to future loans.',
      ]}
      title="Timely repayment helps you"
    />
  </TwoColumnScene>
);

const DifficultySupportScene = ({data}: SceneProps) => (
  <TwoColumnScene
    reverse
    illustration={<AnimatedIllustration variant="difficultySupport" size={510} />}
  >
    <SceneTitle
      eyebrow="Support options"
      lines={[
        'If full repayment is difficult, start with the minimum due.',
        `Minimum amount due: ${data.minimumDue}`,
      ]}
      title="We understand challenges"
    />
  </TwoColumnScene>
);

const ActNowScene = ({data}: SceneProps) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '150px 80px 300px'}}>
    <div style={{display: 'grid', gap: 34, justifyItems: 'center', textAlign: 'center'}}>
      <AnimatedIllustration variant="actNow" size={430} />
      <SceneTitle
        eyebrow="Act now"
        lines={[
          `${data.payNowLabel} and ${data.callUsLabel} are visual buttons inside this MP4.`,
          'Use the shared interactive page for real clickable actions.',
        ]}
        title="Protect your financial future"
      />
    </div>
  </AbsoluteFill>
);

const CallBankerScene = ({data}: SceneProps) => (
  <TwoColumnScene
    illustration={<AnimatedIllustration variant="callBanker" size={500} />}
  >
    <SceneTitle
      eyebrow="Need help?"
      lines={[
        `${data.bankerName} can guide you with repayment assistance.`,
        `Call: ${data.bankerPhone}`,
      ]}
      title={`Call your ${data.bankName} banker`}
    />
  </TwoColumnScene>
);

const ThankYouScene = ({data}: SceneProps) => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '220px 80px 300px'}}>
    <CardShell>
      <SceneTitle
        eyebrow={data.bankName}
        lines={['Our team is here to guide you.']}
        title="Thank you"
      />
    </CardShell>
  </AbsoluteFill>
);

const ContactUsScene = () => (
  <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: '220px 80px 300px'}}>
    <CardShell>
      <SceneTitle
        eyebrow="Contact us today"
        lines={["Let's work together for a solution."]}
        title="We are ready to help"
      />
    </CardShell>
  </AbsoluteFill>
);

const sceneComponents: Record<
  CollectionReminderSceneKey,
  React.ComponentType<SceneProps>
> = {
  intro: IntroScene,
  accountDetails: AccountDetailsScene,
  npaWarning: NpaWarningScene,
  nonPaymentConsequences: NonPaymentConsequencesScene,
  takeAction: TakeActionScene,
  benefits: BenefitsScene,
  difficultySupport: DifficultySupportScene,
  actNow: ActNowScene,
  callBanker: CallBankerScene,
  thankYou: ThankYouScene,
  contactUs: ContactUsScene,
};

export const CollectionReminderVideo = (
  props: Partial<CollectionReminderData>
) => {
  const data = mergeCollectionReminderData(props);

  return (
    <CurvedBackground brandColor={data.brandColor} accentColor={data.accentColor}>
      <OptionalVoiceoverAudio src={data.voiceoverAudioPath} />
      <BrandFrame
        accentColor={data.accentColor}
        bankName={data.bankName}
        brandColor={data.brandColor}
        logoPath={data.logoPath}
      />
      {collectionReminderScript.map((scene) => {
        const Scene = sceneComponents[scene.key];
        const subtitle = personalizeCollectionReminderScript(
          scene.voiceover,
          data
        );

        return (
          <Sequence
            key={scene.key}
            from={scene.fromSecond * COLLECTION_REMINDER_FPS}
            durationInFrames={scene.durationSeconds * COLLECTION_REMINDER_FPS}
          >
            <Scene data={data} />
            <Subtitles text={subtitle} />
          </Sequence>
        );
      })}
      <CTAFooter
        accentColor={data.accentColor}
        bankerPhone={data.bankerPhone}
        brandColor={data.brandColor}
        callUsLabel={data.callUsLabel}
        payNowLabel={data.payNowLabel}
        showFromFrame={54 * COLLECTION_REMINDER_FPS}
      />
    </CurvedBackground>
  );
};
