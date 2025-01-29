import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import React from 'react';
import styles from './SpeechRecognition.module.scss';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}) => {
  return (
    <IconButton
      title={isListening ? 'Stop listening' : 'Start speech recognition'}
      disabled={disabled}
      className={classNames('transition-all relative', {
        'text-bolt-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? (
        <div className="relative">
          <div className={styles.voiceWaveContainer}>
            <div className={styles.voiceWave}></div>
            <div className={styles.voiceWave}></div>
            <div className={styles.voiceWave}></div>
          </div>
          <div className="i-ph:microphone-slash text-xl relative z-10" />
        </div>
      ) : (
        <div className="i-ph:microphone text-xl" />
      )}
    </IconButton>
  );
};
