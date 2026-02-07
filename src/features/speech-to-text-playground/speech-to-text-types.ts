import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/types/SpeechToTextChunkResponseModel";
import type { CharacterAlignmentResponseModel } from "@/features/transcript-view/transcript-viewer";

export type TranscriptOptions = {
  modelId: "scribe_v1" | "scribe_v2";
  languageCode?: string;
  tagAudioEvents: boolean;
  numSpeakers?: number;
  timestampsGranularity: "none" | "word" | "character";
  diarize: boolean;
  diarizationThreshold?: number;
  temperature?: number;
  seed?: number;
  useMultiChannel: boolean;
  keyterms?: string[];
  entityDetection?: string;
};

export type TranscriptResult = {
  transcript: SpeechToTextChunkResponseModel;
  audioUrl: string;
  alignment: CharacterAlignmentResponseModel;
};

export type SpeakerNames = Record<string, string>;

export type TranscriptWord = SpeechToTextChunkResponseModel["words"][number];

export type TranscriptModelId = TranscriptOptions["modelId"];
export type TranscriptTimestampsGranularity =
  TranscriptOptions["timestampsGranularity"];

export type AudioType =
  | "audio/mpeg"
  | "audio/wav"
  | "audio/ogg"
  | "audio/mp3"
  | "audio/m4a"
  | "audio/aac"
  | "audio/webm";
