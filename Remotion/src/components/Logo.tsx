import React from 'react';
import {
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const Logo = ({
  lenderName,
  src = 'assets/logo-placeholder.svg',
  size = 420,
  showName = true,
}: {
  lenderName: string;
  src?: string;
  size?: number;
  showName?: boolean;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 90, mass: 0.8},
  });
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        opacity,
        transform: `scale(${0.9 + scale * 0.1})`,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          height: 'auto',
          width: size,
        }}
      />
      {showName ? (
        <div
          style={{
            color: '#0b466c',
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.1,
            maxWidth: 760,
            overflowWrap: 'anywhere',
            textAlign: 'center',
          }}
        >
          {lenderName}
        </div>
      ) : null}
    </div>
  );
};
