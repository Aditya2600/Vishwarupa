import {Composition, registerRoot} from 'remotion';
import {
  LOAN_REMINDER_DURATION_IN_FRAMES,
  LOAN_REMINDER_FPS,
  LoanReminderVideo,
} from './LoanReminderVideo';
import {sampleCustomer} from './data/sampleCustomer';

const Root = () => {
  return (
    <Composition
      id="LoanReminderVideo"
      component={LoanReminderVideo}
      durationInFrames={LOAN_REMINDER_DURATION_IN_FRAMES}
      fps={LOAN_REMINDER_FPS}
      width={1080}
      height={1920}
      defaultProps={sampleCustomer}
    />
  );
};

registerRoot(Root);
