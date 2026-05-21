import React, {useEffect, useMemo, useState} from 'react';
import {
  Audio,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from 'remotion';

export const OptionalVoiceoverAudio = ({
  src,
}: {
  src: string | undefined;
}) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const {id} = useVideoConfig();
  const handle = useMemo(
    () => delayRender(`Checking optional voiceover audio for ${id}`),
    [id]
  );

  useEffect(() => {
    if (!src) {
      continueRender(handle);
      return;
    }

    fetch(staticFile(src), {method: 'HEAD'})
      .then((response) => {
        setIsAvailable(response.ok);
      })
      .catch(() => {
        setIsAvailable(false);
      })
      .finally(() => {
        continueRender(handle);
      });
  }, [handle, src]);

  if (!src || !isAvailable) {
    return null;
  }

  return <Audio src={staticFile(src)} />;
};
