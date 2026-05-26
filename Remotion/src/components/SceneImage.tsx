import React from 'react';
import {Img, staticFile} from 'remotion';

type SceneImageProps = {
  src: string;
  width?: number | string;
  height?: number | string;
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  rotate?: number; // In degrees
  zIndex?: number;
  style?: React.CSSProperties;
};

export const SceneImage = ({
  src,
  width,
  height,
  top,
  left,
  right,
  bottom,
  rotate,
  zIndex,
  style,
}: SceneImageProps) => {
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        objectFit: 'contain',
        pointerEvents: 'none',
        userSelect: 'none',
        width,
        height,
        top,
        left,
        right,
        bottom,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        zIndex,
        background: 'transparent',
        ...style,
      }}
    />
  );
};
