import React from 'react';
import {Video, staticFile} from 'remotion';

const NAMEPLATE_HEIGHT = 92;

export const AvatarPip = ({
  avatarVideoPath,
  agentName,
  agentRole,
  style,
}) => {
  const src = avatarVideoPath || 'avatar/sample-avatar.mp4';

  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: 32,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.38)',
        boxShadow: '0 36px 80px rgba(65, 18, 18, 0.42), 0 14px 34px rgba(0, 0, 0, 0.24)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
        ...style,
      }}
    >
      <Video
        src={staticFile(src)}
        volume={1}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: NAMEPLATE_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 28px',
          background: 'linear-gradient(180deg, rgba(20, 20, 20, 0), rgba(20, 20, 20, 0.78) 34%, rgba(20, 20, 20, 0.92))',
          color: '#fff',
        }}
      >
        <div style={{fontSize: 28, lineHeight: 1, fontWeight: 800}}>
          {agentName || 'Priya Singh'}
        </div>
        <div style={{marginTop: 9, fontSize: 18, lineHeight: 1, color: 'rgba(255,255,255,0.78)', fontWeight: 600}}>
          {agentRole || 'Collections Agent'}
        </div>
      </div>
    </div>
  );
};
