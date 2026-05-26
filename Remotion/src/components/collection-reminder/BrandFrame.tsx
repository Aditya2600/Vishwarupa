import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const BrandFrame = ({
  bankName,
  brandColor,
  logoPath,
}: {
  bankName: string;
  brandColor: string;
  accentColor: string;
  logoPath?: string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = spring({frame, fps, config: {damping: 18, stiffness: 130}});
  const opacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        left: 74,
        opacity,
        position: 'absolute',
        right: 72,
        top: 58,
        transform: `scale(${scale})`,
        transformOrigin: 'left center',
        zIndex: 20,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          color: '#ffffff',
          display: 'flex',
          minWidth: 0,
        }}
      >
        <div
          style={{
            alignItems: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.42)',
            borderRadius: 30,
            boxShadow: '0 22px 48px rgba(15, 23, 42, 0.18)',
            display: 'flex',
            height: 112,
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 12,
            width: 112,
          }}
        >
          {logoPath ? (
            <Img
              src={staticFile(logoPath)}
              style={{height: '100%', objectFit: 'contain', width: '100%'}}
            />
          ) : (
            <span
              style={{
                color: brandColor,
                fontSize: 30,
                fontWeight: 950,
              }}
            >
              {bankName.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
