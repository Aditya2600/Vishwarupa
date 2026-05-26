import {Composition, registerRoot} from 'remotion';
import {
  COLLECTION_REMINDER_DURATION_IN_FRAMES,
  COLLECTION_REMINDER_FPS,
  CollectionReminderVideo,
} from './CollectionReminderVideo';
import {
  LOAN_REMINDER_DURATION_IN_FRAMES,
  LOAN_REMINDER_FPS,
  LoanReminderVideo,
} from './LoanReminderVideo';
import {collectionReminderData} from './data/collectionReminderData';
import {sampleCustomer} from './data/sampleCustomer';
import {LoanOfferInteractiveTemplate} from './templates/LoanOfferInteractiveTemplate';

const Root = () => {
  return (
    <>
      <Composition
        id="LoanReminderVideo"
        component={LoanReminderVideo}
        durationInFrames={LOAN_REMINDER_DURATION_IN_FRAMES}
        fps={LOAN_REMINDER_FPS}
        width={1080}
        height={1920}
        defaultProps={sampleCustomer}
      />
      <Composition
        id="CollectionReminderVideo"
        component={CollectionReminderVideo}
        durationInFrames={COLLECTION_REMINDER_DURATION_IN_FRAMES}
        fps={COLLECTION_REMINDER_FPS}
        width={1080}
        height={1920}
        defaultProps={collectionReminderData}
      />
      <Composition
        id="LoanOfferInteractiveTemplate"
        component={LoanOfferInteractiveTemplate}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

registerRoot(Root);
