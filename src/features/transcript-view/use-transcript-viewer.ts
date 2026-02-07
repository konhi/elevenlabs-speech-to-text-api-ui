"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel";
import { composeSegments } from "./segment-composer";
import { findWordIndex } from "./word-index";
import type {
  UseTranscriptViewerProps,
  UseTranscriptViewerResult,
  TranscriptWord,
} from "./transcript-types";

function getAlignmentFallbackDuration(
  alignment: CharacterAlignmentResponseModel | null | undefined,
  words: TranscriptWord[]
): number {
  const ends = alignment?.characterEndTimesSeconds;
  if (Array.isArray(ends) && ends.length) {
    const last = ends[ends.length - 1];
    return typeof last === "number" && Number.isFinite(last) ? last : 0;
  }
  if (words.length) {
    const lastWord = words[words.length - 1];
    const lastWordEnd = lastWord?.endTime;
    return typeof lastWordEnd === "number" && Number.isFinite(lastWordEnd)
      ? lastWordEnd
      : 0;
  }
  return 0;
}

function getNextWordIndexByStartTime(
  words: TranscriptWord[],
  currentTime: number,
  startIndex: number
): number {
  let nextIndex = startIndex;
  while (
    nextIndex + 1 < words.length &&
    words[nextIndex + 1] &&
    currentTime >= (words[nextIndex + 1]?.startTime || 0)
  ) {
    nextIndex++;
  }
  return nextIndex;
}

export function useTranscriptViewer({
  alignment,
  hideAudioTags = true,
  segmentComposer,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
}: UseTranscriptViewerProps): UseTranscriptViewerResult {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const handleTimeUpdateRef = useRef<(time: number) => void>(() => {});
  const onDurationChangeRef = useRef<(duration: number) => void>(() => {});

  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const { segments, words } = useMemo(() => {
    if (segmentComposer) {
      return segmentComposer(alignment);
    }
    return composeSegments(alignment, { hideAudioTags });
  }, [segmentComposer, alignment, hideAudioTags]);

  const alignmentFallbackDuration = useMemo(
    function buildAlignmentFallbackDuration() {
      return getAlignmentFallbackDuration(alignment, words);
    },
    [alignment, words]
  );

  const [currentWordIndex, setCurrentWordIndex] = useState<number>(() =>
    words.length ? 0 : -1
  );

  useEffect(
    function resetStateOnAlignmentChange() {
      setCurrentTime(0);
      setDuration(alignmentFallbackDuration || 0);
      setIsPlaying(false);
      setCurrentWordIndex(words.length ? 0 : -1);
    },
    [words.length, alignment, alignmentFallbackDuration]
  );

  const handleTimeUpdate = useCallback(
    function handleTimeUpdate(currentTime: number) {
      if (!words.length) return;

      const currentWord =
        currentWordIndex >= 0 && currentWordIndex < words.length
          ? words[currentWordIndex]
          : undefined;

      if (!currentWord) {
        const found = findWordIndex(words, currentTime);
        if (found !== -1) setCurrentWordIndex(found);
        return;
      }

      let next = currentWordIndex;
      if (
        currentTime >= currentWord.endTime &&
        currentWordIndex + 1 < words.length
      ) {
        next = getNextWordIndexByStartTime(words, currentTime, currentWordIndex);
        setCurrentWordIndex(next);
        return;
      }

      if (currentTime < currentWord.startTime) {
        const found = findWordIndex(words, currentTime);
        if (found !== -1) setCurrentWordIndex(found);
        return;
      }

      const found = findWordIndex(words, currentTime);
      if (found !== -1 && found !== currentWordIndex) {
        setCurrentWordIndex(found);
      }
    },
    [currentWordIndex, words]
  );

  useEffect(
    function syncHandleTimeUpdateRef() {
      handleTimeUpdateRef.current = handleTimeUpdate;
    },
    [handleTimeUpdate]
  );

  useEffect(
    function syncOnDurationChangeRef() {
      onDurationChangeRef.current = onDurationChange ?? (() => {});
    },
    [onDurationChange]
  );

  const stopRaf = useCallback(function stopRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const syncDurationFromMetadataIfMissing = useCallback(
    function syncDurationFromMetadataIfMissing(node: HTMLAudioElement) {
      if (!Number.isFinite(node.duration) || node.duration <= 0) return;
      setDuration((prev) => {
        if (!prev) {
          onDurationChangeRef.current(node.duration);
          return node.duration;
        }
        return prev;
      });
    },
    []
  );

  const startRaf = useCallback(
    function startRaf() {
      if (rafRef.current != null) return;
      function tick() {
        const node = audioRef.current;
        if (!node) {
          rafRef.current = null;
          return;
        }
        const time = node.currentTime;
        setCurrentTime(time);
        handleTimeUpdateRef.current(time);
        syncDurationFromMetadataIfMissing(node);
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [audioRef, syncDurationFromMetadataIfMissing]
  );

  useEffect(
    function setupAudioEventListeners() {
      const audio = audioRef.current;
      if (!audio) return;

      function syncPlayback() {
        setIsPlaying(!audio!.paused);
      }
      function syncTime() {
        setCurrentTime(audio!.currentTime);
      }
      function syncDuration() {
        setDuration(Number.isFinite(audio!.duration) ? audio!.duration : 0);
      }

      function handlePlay() {
        syncPlayback();
        startRaf();
        onPlay?.();
      }
      function handlePause() {
        syncPlayback();
        syncTime();
        stopRaf();
        onPause?.();
      }
      function handleEnded() {
        syncPlayback();
        syncTime();
        stopRaf();
        onEnded?.();
      }
      function handleTimeUpdateEvent() {
        syncTime();
        onTimeUpdate?.(audio!.currentTime);
      }
      function handleSeeked() {
        syncTime();
        handleTimeUpdateRef.current(audio!.currentTime);
      }
      function handleDuration() {
        syncDuration();
        onDurationChange?.(audio!.duration);
      }

      syncPlayback();
      syncTime();
      syncDuration();
      if (!audio.paused) {
        startRaf();
      } else {
        stopRaf();
      }

      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("timeupdate", handleTimeUpdateEvent);
      audio.addEventListener("seeked", handleSeeked);
      audio.addEventListener("durationchange", handleDuration);
      audio.addEventListener("loadedmetadata", handleDuration);

      return function cleanupAudioEventListeners() {
        stopRaf();
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("timeupdate", handleTimeUpdateEvent);
        audio.removeEventListener("seeked", handleSeeked);
        audio.removeEventListener("durationchange", handleDuration);
        audio.removeEventListener("loadedmetadata", handleDuration);
      };
    },
    [
      audioRef,
      startRaf,
      stopRaf,
      onPlay,
      onPause,
      onEnded,
      onTimeUpdate,
      onDurationChange,
    ]
  );

  const syncSeekTimeState = useCallback(
    function syncSeekTimeState(time: number) {
      setCurrentTime(time);
      handleTimeUpdateRef.current(time);
    },
    []
  );

  const seekToTime = useCallback(
    function seekToTime(time: number) {
      const node = audioRef.current;
      if (!node) return;
      syncSeekTimeState(time);
      node.currentTime = time;
    },
    [audioRef, syncSeekTimeState]
  );

  const seekToWord = useCallback(
    function seekToWord(word: number | TranscriptWord) {
      const target = typeof word === "number" ? words[word] : word;
      if (!target) return;
      seekToTime(target.startTime);
    },
    [seekToTime, words]
  );

  const play = useCallback(
    function play() {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        void audio.play();
      }
    },
    [audioRef]
  );

  const pause = useCallback(
    function pause() {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
    },
    [audioRef]
  );

  const startScrubbing = useCallback(
    function startScrubbing() {
      setIsScrubbing(true);
      stopRaf();
    },
    [stopRaf]
  );

  const endScrubbing = useCallback(
    function endScrubbing() {
      setIsScrubbing(false);
      const node = audioRef.current;
      if (node && !node.paused) {
        startRaf();
      }
    },
    [audioRef, startRaf]
  );

  const currentWord =
    currentWordIndex >= 0 && currentWordIndex < words.length
      ? words[currentWordIndex] || null
      : null;
  const currentSegmentIndex = currentWord?.segmentIndex ?? -1;

  const spokenSegments = useMemo(
    function computeSpokenSegments() {
      if (!segments.length || currentSegmentIndex <= 0) return [];
      return segments.slice(0, currentSegmentIndex);
    },
    [segments, currentSegmentIndex]
  );

  const unspokenSegments = useMemo(
    function computeUnspokenSegments() {
      if (!segments.length) return [];
      if (currentSegmentIndex === -1) return segments;
      if (currentSegmentIndex + 1 >= segments.length) return [];
      return segments.slice(currentSegmentIndex + 1);
    },
    [segments, currentSegmentIndex]
  );

  return {
    segments,
    words,
    spokenSegments,
    unspokenSegments,
    currentWord,
    currentSegmentIndex,
    currentWordIndex,
    seekToTime,
    seekToWord,
    audioRef,
    isPlaying,
    isScrubbing,
    duration,
    currentTime,
    play,
    pause,
    startScrubbing,
    endScrubbing,
  };
}
