import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel";
import type { RefObject } from "react";

export type BaseSegment = {
  segmentIndex: number;
  text: string;
};

export type TranscriptWord = BaseSegment & {
  kind: "word";
  wordIndex: number;
  startTime: number;
  endTime: number;
};

export type GapSegment = BaseSegment & {
  kind: "gap";
};

export type TranscriptSegment = TranscriptWord | GapSegment;

export type ComposeSegmentsOptions = {
  hideAudioTags?: boolean;
};

export type ComposeSegmentsResult = {
  segments: TranscriptSegment[];
  words: TranscriptWord[];
};

export type SegmentComposer = (
  alignment: CharacterAlignmentResponseModel
) => ComposeSegmentsResult;

export type UseTranscriptViewerProps = {
  alignment: CharacterAlignmentResponseModel;
  segmentComposer?: SegmentComposer;
  hideAudioTags?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  onDurationChange?: (duration: number) => void;
};

export type UseTranscriptViewerResult = {
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  spokenSegments: TranscriptSegment[];
  unspokenSegments: TranscriptSegment[];
  currentWord: TranscriptWord | null;
  currentSegmentIndex: number;
  currentWordIndex: number;
  seekToTime: (time: number) => void;
  seekToWord: (word: number | TranscriptWord) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  isScrubbing: boolean;
  duration: number;
  currentTime: number;
  play: () => void;
  pause: () => void;
  startScrubbing: () => void;
  endScrubbing: () => void;
};
