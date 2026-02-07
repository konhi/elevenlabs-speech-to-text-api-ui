import { useMemo, type ChangeEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TranscriptViewerAudio,
  TranscriptViewerContainer,
  TranscriptViewerPlayPauseButton,
  TranscriptViewerScrubBar,
  TranscriptViewerWords,
} from "@/features/transcript-view/transcript-viewer";
import { CopyIcon, PauseIcon, PlayIcon } from "lucide-react";
import type { TranscriptWord as ViewerWord } from "@/features/transcript-view/transcript-types";
import type {
  AudioType,
  SpeakerNames,
  TranscriptResult,
} from "./speech-to-text-types";
import {
  buildTranscriptMarkdown,
  findTranscriptWordByTextAndStart,
  getTranscriptWordAtIndex,
  getUniqueSpeakers,
} from "./transcript-utils";

type TranscriptViewerWordStatus = "spoken" | "unspoken" | "current";

type RenderWordPayload = {
  word: ViewerWord;
  status: TranscriptViewerWordStatus;
};

type TranscriptionResultProps = {
  result: TranscriptResult;
  audioType: AudioType;
  speakerNames: SpeakerNames;
  onSpeakerNameChange: (speakerId: string, value: string) => void;
};

type SpeakerNameInputProps = {
  speakerId: string;
  value: string;
  onChange: (speakerId: string, value: string) => void;
};

function SpeakerNameInput({
  speakerId,
  value,
  onChange,
}: SpeakerNameInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(speakerId, event.target.value);
  }

  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs text-muted-foreground min-w-[80px]">
        {speakerId}:
      </Label>
      <Input
        placeholder={speakerId}
        value={value}
        onChange={handleChange}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function TranscriptionResult({
  result,
  audioType,
  speakerNames,
  onSpeakerNameChange,
}: TranscriptionResultProps) {
  const uniqueSpeakers = useMemo(
    () => getUniqueSpeakers(result.transcript.words),
    [result.transcript.words]
  );

  function getSpeakerName(speakerId: string) {
    return speakerNames[speakerId] || speakerId;
  }

  function handleCopyOptionChange(value: string) {
    if (value === "plain") {
      handlePlainTextCopy();
      return;
    }

    const markdownOption = getMarkdownOption(value);
    if (!markdownOption) return;
    handleMarkdownCopy(markdownOption);
  }

  function handlePlainTextCopy() {
    if (result.transcript.text) {
      navigator.clipboard.writeText(result.transcript.text);
    }
  }

  function handleMarkdownCopy(option: {
    includeTimestamps: boolean;
    includeSpeakers: boolean;
  }) {
    const markdown = buildTranscriptMarkdown(result.transcript.words, {
      includeTimestamps: option.includeTimestamps,
      includeSpeakers: option.includeSpeakers,
      getSpeakerName,
    });
    navigator.clipboard.writeText(markdown);
  }

  function getMarkdownOption(value: string) {
    if (value === "md-full") {
      return { includeTimestamps: true, includeSpeakers: true };
    }
    if (value === "md-no-time") {
      return { includeTimestamps: false, includeSpeakers: true };
    }
    if (value === "md-no-speaker") {
      return { includeTimestamps: true, includeSpeakers: false };
    }
    if (value === "md-clean") {
      return { includeTimestamps: false, includeSpeakers: false };
    }
    return null;
  }

  function renderSpeakerNameInput(speakerId: string) {
    return (
      <SpeakerNameInput
        key={speakerId}
        speakerId={speakerId}
        value={speakerNames[speakerId] || ""}
        onChange={onSpeakerNameChange}
      />
    );
  }

  function renderTranscriptWord({ word, status }: RenderWordPayload) {
    const transcriptWords = result.transcript.words;
    const originalWord = findTranscriptWordByTextAndStart(
      transcriptWords,
      word.text,
      word.startTime
    );
    const speakerId = originalWord?.speakerId;
    const previousWordSource = getTranscriptWordAtIndex(
      transcriptWords,
      word.wordIndex - 1
    );
    const previousWord = previousWordSource
      ? findTranscriptWordByTextAndStart(
          transcriptWords,
          previousWordSource.text,
          previousWordSource.start || 0
        )
      : undefined;
    const prevSpeakerId = previousWord?.speakerId;
    const speakerChanged = speakerId && speakerId !== prevSpeakerId;

    return (
      <>
        {speakerChanged && (
          <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded mr-1 align-middle">
            {getSpeakerName(speakerId)}
          </span>
        )}
        <span
          className={
            status === "spoken"
              ? "text-muted-foreground"
              : status === "current"
              ? "text-primary font-semibold"
              : "text-foreground"
          }
        >
          {word.text}
        </span>
      </>
    );
  }

  function renderPlayPause({ isPlaying }: { isPlaying: boolean }) {
    return isPlaying ? (
      <>
        <PauseIcon className="size-4 mr-2" /> Pause
      </>
    ) : (
      <>
        <PlayIcon className="size-4 mr-2" /> Play
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Transcription Result</CardTitle>
              <CardDescription>
                Language: {result.transcript.languageCode} (
                {(result.transcript.languageProbability * 100).toFixed(1)}%
                confidence)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select onValueChange={handleCopyOptionChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Copy options" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">
                    <CopyIcon className="h-3 w-3 inline mr-2" />
                    Plain Text
                  </SelectItem>
                  <SelectItem value="md-full">
                    <CopyIcon className="h-3 w-3 inline mr-2" />
                    Markdown (Full)
                  </SelectItem>
                  <SelectItem value="md-no-time">
                    <CopyIcon className="h-3 w-3 inline mr-2" />
                    Markdown (No Time)
                  </SelectItem>
                  <SelectItem value="md-no-speaker">
                    <CopyIcon className="h-3 w-3 inline mr-2" />
                    Markdown (No Speaker)
                  </SelectItem>
                  <SelectItem value="md-clean">
                    <CopyIcon className="h-3 w-3 inline mr-2" />
                    Markdown (Clean)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {uniqueSpeakers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Speaker Names</Label>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {uniqueSpeakers.map(renderSpeakerNameInput)}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <TranscriptViewerContainer
          audioSrc={result.audioUrl}
          audioType={audioType}
          alignment={result.alignment}
          className="space-y-4"
        >
          <TranscriptViewerAudio className="sr-only" />

          {result.alignment ? (
            <>
              <div className="p-4 bg-muted/50 rounded-lg min-h-[100px]">
                <TranscriptViewerWords renderWord={renderTranscriptWord} />
              </div>

              <TranscriptViewerScrubBar />

              <TranscriptViewerPlayPauseButton size="lg" className="w-full">
                {renderPlayPause}
              </TranscriptViewerPlayPauseButton>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-2 w-full mt-4" />
            </div>
          )}
        </TranscriptViewerContainer>
      </CardContent>
    </Card>
  );
}
