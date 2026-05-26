import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type AnimatedIllustrationVariant =
  | 'greeting'
  | 'npaWarning'
  | 'nonPaymentConsequences'
  | 'difficultySupport'
  | 'benefits'
  | 'actNow'
  | 'callBanker';

const approvedIllustrations: Record<AnimatedIllustrationVariant, string> = {
  greeting: 'greeting_transparent_color.png',
  npaWarning: 'npaWarning_transparent_color.png',
  nonPaymentConsequences: 'nonPaymentConsequences_transparent_color.png',
  difficultySupport: 'difficultySupport_transparent_color.png',
  benefits: 'benefits_transparent.png',
  actNow: 'actNow_transparent_color.png',
  callBanker: 'callBanker_transparent.png',
};

export const AnimatedIllustration = ({
  variant,
  size = 470,
}: {
  variant: AnimatedIllustrationVariant;
  size?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({frame: frame - 8, fps, config: {damping: 15}});
  const bob = interpolate(frame % 90, [0, 45, 90], [0, -16, 0]);
  const scale = interpolate(entrance, [0, 1], [0.86, 1]);

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        height: size,
        justifyContent: 'center',
        transform: `translateY(${bob}px) scale(${scale})`,
        width: size,
      }}
    >
      <Img
        src={staticFile(approvedIllustrations[variant])}
        style={{
          filter: 'drop-shadow(0 34px 54px rgba(15, 23, 42, 0.18))',
          height: '100%',
          objectFit: 'contain',
          width: '100%',
        }}
      />
    </div>
  );
};
