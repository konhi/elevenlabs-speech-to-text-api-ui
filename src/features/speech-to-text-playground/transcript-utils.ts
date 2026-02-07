import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/types/SpeechToTextChunkResponseModel";
import type {
  AudioType,
  TranscriptModelId,
  TranscriptTimestampsGranularity,
  TranscriptWord,
} from "./speech-to-text-types";
import type { CharacterAlignmentResponseModel } from "@/features/transcript-view/transcript-viewer";

const audioTypes: AudioType[] = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp3",
  "audio/m4a",
  "audio/aac",
  "audio/webm",
];

const audioTypeByExtension: Record<string, AudioType> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/m4a",
  aac: "audio/aac",
  webm: "audio/webm",
};

const transcriptModelIds: TranscriptModelId[] = ["scribe_v1", "scribe_v2"];
const transcriptTimestampsGranularity: TranscriptTimestampsGranularity[] = [
  "none",
  "word",
  "character",
];

type MarkdownWord = {
  text: string;
  time?: number;
};

function isAudioType(value: string): value is AudioType {
  return audioTypes.some((type) => type === value);
}

export function getAudioTypeForFile(file: File | null): AudioType {
  if (!file) return "audio/mpeg";
  if (file.type && isAudioType(file.type)) {
    return file.type;
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return "audio/mpeg";
  return audioTypeByExtension[ext] || "audio/mpeg";
}

export function isTranscriptModelId(value: string): value is TranscriptModelId {
  return transcriptModelIds.some((modelId) => modelId === value);
}

export function isTranscriptTimestampsGranularity(
  value: string
): value is TranscriptTimestampsGranularity {
  return transcriptTimestampsGranularity.some((granularity) => granularity === value);
}

export function parseKeytermsInput(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export function getElevenLabsErrorMessage(
  error: unknown
): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const body = Reflect.get(error, "body");
  const parsedBody = typeof body === "string" ? safeParseJson(body) : body;
  if (!parsedBody || typeof parsedBody !== "object") return undefined;

  const detail = Reflect.get(parsedBody, "detail");
  if (typeof detail === "string") return detail;

  if (detail && typeof detail === "object") {
    const detailMessage = Reflect.get(detail, "message");
    if (typeof detailMessage === "string") return detailMessage;
    return JSON.stringify(detail);
  }

  return undefined;
}

export function isSpeechToTextChunkResponseModel(
  value: unknown
): value is SpeechToTextChunkResponseModel {
  if (!value || typeof value !== "object") return false;
  const words = Reflect.get(value, "words");
  return Array.isArray(words);
}

function appendWordCharactersFromText(
  word: TranscriptWord,
  characters: string[],
  characterStartTimesSeconds: number[],
  characterEndTimesSeconds: number[]
) {
  const wordCharacters = word.text.split("");
  const wordStart = word.start || 0;
  const wordEnd = word.end || wordStart;
  const wordDurationSeconds = wordEnd - wordStart;
  const charDurationSeconds =
    wordCharacters.length > 0 ? wordDurationSeconds / wordCharacters.length : 0;

  wordCharacters.forEach((char, idx) => {
    characters.push(char);
    const charStart = wordStart + idx * charDurationSeconds;
    characterStartTimesSeconds.push(charStart);
    characterEndTimesSeconds.push(charStart + charDurationSeconds);
  });
}

export function convertToAlignment(
  transcript: SpeechToTextChunkResponseModel
): CharacterAlignmentResponseModel {
  const characters: string[] = [];
  const characterStartTimesSeconds: number[] = [];
  const characterEndTimesSeconds: number[] = [];

  for (const word of transcript.words) {
    if (word.characters && word.characters.length > 0) {
      for (const char of word.characters) {
        characters.push(char.text);
        characterStartTimesSeconds.push(char.start || 0);
        characterEndTimesSeconds.push(char.end || 0);
      }
    } else {
      appendWordCharactersFromText(
        word,
        characters,
        characterStartTimesSeconds,
        characterEndTimesSeconds
      );
    }
  }

  return {
    characters,
    characterStartTimesSeconds,
    characterEndTimesSeconds,
  };
}

export function findTranscriptWordByTextAndStart(
  words: TranscriptWord[],
  text: string,
  startTime: number
): TranscriptWord | undefined {
  return words.find(
    (word) => word.text === text && Math.abs((word.start || 0) - startTime) < 0.01
  );
}

export function getTranscriptWordAtIndex(
  words: TranscriptWord[],
  index: number
): TranscriptWord | undefined {
  if (index < 0 || index >= words.length) return undefined;
  return words[index];
}

export function getUniqueSpeakers(words: TranscriptWord[]): string[] {
  const speakers = new Set<string>();
  words.forEach((word) => {
    if (word.speakerId) {
      speakers.add(word.speakerId);
    }
  });
  return Array.from(speakers).sort();
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function buildTranscriptMarkdown(
  words: TranscriptWord[],
  options: {
    includeTimestamps: boolean;
    includeSpeakers: boolean;
    getSpeakerName: (speakerId: string) => string;
  }
): string {
  let markdown = "# Transcript\n\n";
  let currentSpeaker: string | undefined;
  let currentParagraph: MarkdownWord[] = [];

  function flushParagraph() {
    if (currentParagraph.length === 0) return;

    if (options.includeSpeakers && currentSpeaker) {
      markdown += `**${options.getSpeakerName(currentSpeaker)}:** `;
    }

    markdown += currentParagraph.map((word) => word.text).join("");

    if (
      options.includeTimestamps &&
      currentParagraph[0] &&
      currentParagraph[0].time !== undefined
    ) {
      markdown += ` _(${formatTimestamp(currentParagraph[0].time)})_`;
    }

    markdown += "\n\n";
    currentParagraph = [];
  }

  words.forEach((word) => {
    if (word.type === "word") {
      const hasSpeakerChanged =
        word.speakerId && word.speakerId !== currentSpeaker;
      if (hasSpeakerChanged) {
        flushParagraph();
        currentSpeaker = word.speakerId;
      }

      currentParagraph.push({
        text: word.text,
        time: word.start,
      });
    } else if (word.type === "spacing") {
      if (currentParagraph.length > 0) {
        currentParagraph.push({ text: word.text });
      }
    }
  });

  flushParagraph();
  return markdown;
}
