import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const CalendarWarning = ({
  daysOverdue,
  brandColor,
  accentColor,
}: {
  daysOverdue: number;
  brandColor: string;
  accentColor: string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pulse = spring({frame: frame - 16, fps, config: {damping: 9, stiffness: 90}});
  const scale = interpolate(pulse, [0, 1], [0.88, 1]);

  return (
    <div
      style={{
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 42,
        boxShadow: '0 28px 80px rgba(15, 23, 42, 0.16)',
        display: 'flex',
        flexDirection: 'column',
        height: 420,
        justifyContent: 'center',
        position: 'relative',
        transform: `scale(${scale})`,
        width: 420,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
          borderRadius: '42px 42px 0 0',
          height: 96,
          left: 0,
          position: 'absolute',
          right: 0,
          top: 0,
        }}
      />
      <div style={{color: brandColor, fontSize: 104, fontWeight: 950, marginTop: 44}}>
        {daysOverdue}
      </div>
      <div style={{color: '#0f172a', fontSize: 33, fontWeight: 950}}>
        Days Overdue
      </div>
      <div style={{color: '#64748b', fontSize: 24, fontWeight: 800, marginTop: 12}}>
        Please act today
      </div>
    </div>
  );
};
