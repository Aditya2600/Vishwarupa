import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const SceneTitle = ({
  eyebrow,
  title,
  lines,
  dark = false,
}: {
  eyebrow?: string;
  title: string;
  lines?: string[];
  dark?: boolean;
}) => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [8, 24], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{maxWidth: 880}}>
      {eyebrow ? (
        <div
          style={{
            color: dark ? 'rgba(255,255,255,0.78)' : '#2563eb',
            fontSize: 25,
            fontWeight: 950,
            letterSpacing: 2.2,
            marginBottom: 18,
            textTransform: 'uppercase',
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <h1
        style={{
          color: dark ? '#ffffff' : '#0f172a',
          fontSize: 76,
          fontWeight: 950,
          letterSpacing: -2.8,
          lineHeight: 1.02,
          margin: 0,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </h1>
      {lines?.map((line, index) => {
        const opacity = interpolate(frame, [26 + index * 10, 42 + index * 10], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const y = interpolate(frame, [26 + index * 10, 42 + index * 10], [18, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <p
            key={line}
            style={{
              color: dark ? 'rgba(255,255,255,0.82)' : '#475569',
              fontSize: 36,
              fontWeight: 750,
              lineHeight: 1.26,
              margin: index === 0 ? '30px 0 0' : '16px 0 0',
              opacity,
              transform: `translateY(${y}px)`,
            }}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
};
