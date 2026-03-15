import {Composition} from 'remotion';
import {TemplateVideo} from './TemplateVideo';
import {FPS, getDurationInFrames, getLeadDimensions, leads} from './videoData';

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
