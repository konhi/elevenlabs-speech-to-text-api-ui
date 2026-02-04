"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useTranscriptViewer,
  type SegmentComposer,
  type TranscriptSegment,
  type TranscriptWord as TranscriptWordType,
  type UseTranscriptViewerResult,
} from "@/registry/elevenlabs-ui/hooks/use-transcript-viewer";
import { Button } from "@/components/ui/button";
import {
  ScrubBarContainer,
  ScrubBarProgress,
  ScrubBarThumb,
  ScrubBarTimeLabel,
  ScrubBarTrack,
} from "@/components/ui/scrub-bar";

type TranscriptGap = Extract<TranscriptSegment, { kind: "gap" }>;

type TranscriptViewerContextValue = UseTranscriptViewerResult & {
  audioProps: Omit<ComponentPropsWithRef<"audio">, "children" | "src">;
};

const TranscriptViewerContext =
  createContext<TranscriptViewerContextValue | null>(null);

function useTranscriptViewerContext() {
  const context = useContext(TranscriptViewerContext);
  if (!context) {
    throw new Error(
      "useTranscriptViewerContext must be used within a TranscriptViewer"
    );
  }
  return context;
}

type TranscriptViewerProviderProps = {
  value: TranscriptViewerContextValue;
  children: ReactNode;
};

function TranscriptViewerProvider({
  value,
  children,
}: TranscriptViewerProviderProps) {
  return (
    <TranscriptViewerContext.Provider value={value}>
      {children}
    </TranscriptViewerContext.Provider>
  );
}

type AudioType =
  | "audio/mpeg"
  | "audio/wav"
  | "audio/ogg"
  | "audio/mp3"
  | "audio/m4a"
  | "audio/aac"
  | "audio/webm";

type TranscriptViewerContainerProps = {
  audioSrc: string;
  audioType: AudioType;
  alignment: CharacterAlignmentResponseModel;
  segmentComposer?: SegmentComposer;
  hideAudioTags?: boolean;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children"> &
  Pick<
    Parameters<typeof useTranscriptViewer>[0],
    "onPlay" | "onPause" | "onTimeUpdate" | "onEnded" | "onDurationChange"
  >;

function TranscriptViewerContainer({
  audioSrc,
  audioType = "audio/mpeg",
  alignment,
  segmentComposer,
  hideAudioTags = true,
  children,
  className,
  onPlay,
  onPause,
  onTimeUpdate,
  onEnded,
  onDurationChange,
  ...props
}: TranscriptViewerContainerProps) {
  const viewerState = useTranscriptViewer({
    alignment,
    hideAudioTags,
    segmentComposer,
    onPlay,
    onPause,
    onTimeUpdate,
    onEnded,
    onDurationChange,
  });

  const { audioRef } = viewerState;

  const audioProps = useMemo(
    () => ({
      ref: audioRef,
      controls: false,
      preload: "metadata" as const,
      src: audioSrc,
      children: <source src={audioSrc} type={audioType} />,
    }),
    [audioRef, audioSrc]
  );

  const contextValue = useMemo(
    () => ({
      ...viewerState,
      audioProps,
    }),
    [viewerState, audioProps]
  );

  return (
    <TranscriptViewerProvider value={contextValue}>
      <div className={cn("flex flex-col gap-4", className)} {...props}>
        {children}
      </div>
    </TranscriptViewerProvider>
  );
}

type TranscriptViewerWordStatus = "spoken" | "unspoken" | "current";
interface TranscriptViewerWordProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  word: TranscriptWordType;
  status: TranscriptViewerWordStatus;
  children?: ReactNode;
}

function TranscriptViewerWord({
  word,
  status,
  className,
  children,
  ...props
}: TranscriptViewerWordProps) {
  return (
    <span
      className={cn(
        "transition-colors",
        status === "spoken" && "text-muted-foreground",
        status === "current" && "text-primary font-semibold",
        status === "unspoken" && "text-foreground",
        className
      )}
      {...props}
    >
      {children ?? word.text}
    </span>
  );
}

interface TranscriptViewerWordsProps extends HTMLAttributes<HTMLDivElement> {
  renderWord?: (props: {
    word: TranscriptWordType;
    status: TranscriptViewerWordStatus;
  }) => ReactNode;
  renderGap?: (props: {
    segment: TranscriptGap;
    status: TranscriptViewerWordStatus;
  }) => ReactNode;
  wordClassNames?: string;
  gapClassNames?: string;
}

function TranscriptViewerWords({
  className,
  renderWord,
  renderGap,
  wordClassNames,
  gapClassNames,
  ...props
}: TranscriptViewerWordsProps) {
  const {
    spokenSegments,
    unspokenSegments,
    currentWord,
    segments,
    duration,
    currentTime,
  } = useTranscriptViewerContext();

  const nearEnd = useMemo(() => {
    if (!duration) return false;
    return currentTime >= duration - 0.01;
  }, [currentTime, duration]);

  const segmentsWithStatus = useMemo(() => {
    if (nearEnd) {
      return segments.map((segment) => ({
        segment,
        status: "spoken" as const,
      }));
    }

    const entries: Array<{
      segment: TranscriptSegment;
      status: TranscriptViewerWordStatus;
    }> = [];

    for (const segment of spokenSegments) {
      entries.push({ segment, status: "spoken" });
    }

    if (currentWord) {
      entries.push({ segment: currentWord, status: "current" });
    }

    for (const segment of unspokenSegments) {
      entries.push({ segment, status: "unspoken" });
    }

    return entries;
  }, [spokenSegments, unspokenSegments, currentWord, nearEnd, segments]);

  return (
    <div className={cn("text-base leading-relaxed", className)} {...props}>
      {segmentsWithStatus.map(({ segment, status }) => {
        if (segment.kind === "gap") {
          const content = renderGap
            ? renderGap({ segment, status })
            : segment.text;
          return (
            <span key={segment.segmentIndex} className={gapClassNames}>
              {content}
            </span>
          );
        }

        if (renderWord) {
          return (
            <span key={segment.segmentIndex} className={wordClassNames}>
              {renderWord({ word: segment, status })}
            </span>
          );
        }

        return (
          <TranscriptViewerWord
            key={segment.segmentIndex}
            word={segment}
            status={status}
            className={wordClassNames}
          />
        );
      })}
    </div>
  );
}

function TranscriptViewerAudio({
  ...props
}: ComponentPropsWithoutRef<"audio">) {
  const { audioProps } = useTranscriptViewerContext();
  return <audio {...audioProps} {...props} />;
}

type RenderChildren = (state: { isPlaying: boolean }) => ReactNode;

type TranscriptViewerPlayPauseButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "children"
> & {
  children?: ReactNode | RenderChildren;
};

function TranscriptViewerPlayPauseButton({
  className,
  children,
  onClick,
  ...props
}: TranscriptViewerPlayPauseButtonProps) {
  const { isPlaying, play, pause } = useTranscriptViewerContext();
  const Icon = isPlaying ? Pause : Play;

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (isPlaying) pause();
    else play();
    onClick?.(event);
  }

  const content =
    typeof children === "function"
      ? (children as RenderChildren)({ isPlaying })
      : children;

  return (
    <Button onClick={handleClick} className={className} {...props}>
      {content ?? <Icon />}
    </Button>
  );
}

type TranscriptViewerScrubBarProps = Omit<
  ComponentPropsWithoutRef<typeof ScrubBarContainer>,
  "duration" | "value" | "onScrub" | "onScrubStart" | "onScrubEnd"
> & {
  showTimeLabels?: boolean;
  labelsClassName?: string;
  trackClassName?: string;
  progressClassName?: string;
  thumbClassName?: string;
};

function TranscriptViewerScrubBar({
  className,
  showTimeLabels = true,
  labelsClassName,
  trackClassName,
  progressClassName,
  thumbClassName,
  ...props
}: TranscriptViewerScrubBarProps) {
  const { duration, currentTime, seekToTime, startScrubbing, endScrubbing } =
    useTranscriptViewerContext();
  return (
    <ScrubBarContainer
      duration={duration}
      value={currentTime}
      onScrub={seekToTime}
      onScrubStart={startScrubbing}
      onScrubEnd={endScrubbing}
      className={className}
      {...props}
    >
      <ScrubBarTrack className={trackClassName}>
        <ScrubBarProgress className={progressClassName} />
        <ScrubBarThumb className={thumbClassName} />
      </ScrubBarTrack>
      {showTimeLabels && (
        <div className={cn("flex justify-between", labelsClassName)}>
          <ScrubBarTimeLabel time={currentTime} />
          <ScrubBarTimeLabel time={duration} />
        </div>
      )}
    </ScrubBarContainer>
  );
}

export {
  TranscriptViewerContainer,
  TranscriptViewerWords,
  TranscriptViewerWord,
  TranscriptViewerAudio,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
  TranscriptViewerProvider,
  useTranscriptViewerContext,
};
export type { CharacterAlignmentResponseModel };
