import {Composition} from 'remotion';
import {TemplateVideo} from './TemplateVideo';
import {PaymentLinkGuidanceTemplate} from './templates/PaymentLinkGuidanceTemplate';
import {LoanOfferInteractiveTemplate} from './templates/LoanOfferInteractiveTemplate';
import {PAYMENT_LINK_GUIDANCE_DURATION} from './templates/PaymentLinkGuidanceTemplate/scenes';
import {
  COLLECTION_REMINDER_DURATION_IN_FRAMES,
  COLLECTION_REMINDER_FPS,
  CollectionReminderVideo,
} from './CollectionReminderVideo';
import {collectionReminderData} from './data/collectionReminderData';
import {
  FPS,
  LOAN_OFFER_INTERACTIVE_DURATION,
  getDurationInFrames,
  getLeadDimensions,
  leads,
} from './videoData';

export const RemotionRoot = () => {
  const primaryLead = leads[0];
  const defaultDimensions = getLeadDimensions(primaryLead);

  return (
    <>
      <Composition
        id="main"
        component={TemplateVideo}
        durationInFrames={getDurationInFrames(primaryLead.id)}
        fps={FPS}
        width={defaultDimensions.width}
        height={defaultDimensions.height}
        defaultProps={{leadId: primaryLead.id}}
      />
      <Composition
        id="PaymentLinkGuidanceTemplate"
        component={PaymentLinkGuidanceTemplate}
        durationInFrames={PAYMENT_LINK_GUIDANCE_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="LoanOfferInteractiveTemplate"
        component={LoanOfferInteractiveTemplate}
        durationInFrames={LOAN_OFFER_INTERACTIVE_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
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
      {leads.map((lead) => {
        const dimensions = getLeadDimensions(lead);
        return (
          <Composition
            key={lead.id}
            id={String(lead.id).replace(/_/g, '-')}
            component={TemplateVideo}
            durationInFrames={getDurationInFrames(lead.id)}
            fps={FPS}
            width={dimensions.width}
            height={dimensions.height}
            defaultProps={{leadId: lead.id}}
          />
        );
      })}
    </>
  );
};
