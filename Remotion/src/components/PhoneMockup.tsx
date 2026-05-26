import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const PhoneMockup = ({
  children,
  variant = 'frame',
  width = 520,
}: {
  children?: React.ReactNode;
  variant?: 'frame' | 'tilted';
  width?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    frame,
    fps,
    config: {damping: 20, stiffness: 110},
  });
  const y = interpolate(enter, [0, 1], [42, 0]);
  const rotation = variant === 'tilted' ? -5 : 0;

  return (
    <div
      style={{
        height: variant === 'tilted' ? width * 1.05 : width * 1.8,
        position: 'relative',
        transform: `translateY(${y}px) rotate(${rotation}deg)`,
        width,
      }}
    >
      <Img
        src={staticFile(
          variant === 'tilted'
            ? 'assets/phone-tilted.svg'
            : 'assets/phone-frame.svg'
        )}
        style={{
          height: '100%',
          objectFit: 'contain',
          position: 'absolute',
          width: '100%',
        }}
      />
      {variant === 'frame' && children ? (
        <div
          style={{
            background: 'linear-gradient(180deg, #f7fbff 0%, #e7f6f1 100%)',
            borderRadius: 24,
            height: '72%',
            left: '17.7%',
            overflow: 'hidden',
            padding: '34px 28px',
            position: 'absolute',
            top: '12.8%',
            width: '64.6%',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};
