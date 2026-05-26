import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AvatarPip} from './components/AvatarPip';
import {LandscapeCollectionUI} from './components/LandscapeCollectionUI';
import {MobileCollectionUI} from './components/MobileCollectionUI';

export const hybridCollectionNoticeDefaults = {
  customerName: 'Rajesh Kumar Singh',
  accountNumber: 'DC-2024-089456',
  daysOverdue: 35,
  collectionStatus: 75,
  amountDue: '₹45,200',
  agentName: 'Priya Singh',
  agentRole: 'Collections Agent',
  avatarVideoPath: 'avatar/sample-avatar.mp4',
  durationInFrames: 900,
  aspectMode: 'portrait_9_16',
  resolvedAspectMode: 'portrait_9_16',
};

const portraitPipStyle = {
  width: 360,
  height: 560,
  right: 54,
  bottom: 220,
};

const landscapePipStyle = {
  width: 480,
  height: 680,
  right: 100,
  bottom: 120,
};

export const HybridCollectionNotice = ({layout = 'portrait', ...props}) => {
  const mergedProps = {...hybridCollectionNoticeDefaults, ...props};
  const isLandscape = layout === 'landscape';

  return (
    <AbsoluteFill style={{backgroundColor: isLandscape ? '#fff' : '#c91428'}}>
      {isLandscape ? (
        <LandscapeCollectionUI {...mergedProps} />
      ) : (
        <MobileCollectionUI {...mergedProps} />
      )}
      <AvatarPip
        avatarVideoPath={mergedProps.avatarVideoPath}
        agentName={mergedProps.agentName}
        agentRole={mergedProps.agentRole}
        style={isLandscape ? landscapePipStyle : portraitPipStyle}
      />
    </AbsoluteFill>
  );
};
