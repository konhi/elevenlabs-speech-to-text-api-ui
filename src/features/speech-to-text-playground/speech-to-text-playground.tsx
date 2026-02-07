import { useMemo, useState, type SubmitEventHandler } from "react";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { TranscriptionForm } from "./transcription-form";
import { TranscriptionResult } from "./transcription-result";
import type {
  SpeakerNames,
  TranscriptOptions,
  TranscriptResult,
} from "./speech-to-text-types";
import {
  convertToAlignment,
  getAudioTypeForFile,
  getElevenLabsErrorMessage,
  isSpeechToTextChunkResponseModel,
} from "./transcript-utils";

const defaultTranscriptOptions: TranscriptOptions = {
  modelId: "scribe_v2",
  tagAudioEvents: false,
  timestampsGranularity: "character",
  diarize: false,
  useMultiChannel: false,
};

export function SpeechToTextPlayground() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>({});
  const [options, setOptions] = useState<TranscriptOptions>(
    defaultTranscriptOptions
  );

  const audioType = useMemo(() => getAudioTypeForFile(file), [file]);

  async function handleTranscribe(event: Parameters<SubmitEventHandler<HTMLFormElement>>[0]) {
    event.preventDefault();
    if (!file || !apiKey) return;

    setIsTranscribing(true);
    setError(null);
    setResult(null);

    try {
      const browserClient = new ElevenLabsClient({ apiKey });
      const transcriptResponse = await browserClient.speechToText.convert({
        file,
        modelId: options.modelId || "scribe_v2",
        languageCode: options.languageCode || undefined,
        tagAudioEvents: options.tagAudioEvents || false,
        numSpeakers: options.numSpeakers || undefined,
        timestampsGranularity: options.timestampsGranularity || "character",
        diarize: options.diarize || false,
        diarizationThreshold: options.diarizationThreshold || undefined,
        temperature: options.temperature || undefined,
        seed: options.seed || undefined,
        useMultiChannel: options.useMultiChannel || false,
        keyterms: options.keyterms || undefined,
        entityDetection: options.entityDetection || undefined,
      });

      if (!isSpeechToTextChunkResponseModel(transcriptResponse)) {
        throw new Error("Invalid transcript response");
      }

      const audioUrl = URL.createObjectURL(file);
      const alignment = convertToAlignment(transcriptResponse);

      setResult({
        transcript: transcriptResponse,
        audioUrl,
        alignment,
      });
    } catch (err: unknown) {
      console.error("Transcription error:", err);

      const apiErrorMessage = getElevenLabsErrorMessage(err);
      const fallbackMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(apiErrorMessage ?? fallbackMessage);
    } finally {
      setIsTranscribing(false);
    }
  }

  function handleFileSelected(selectedFile: File | null) {
    setFile(selectedFile);
    setResult(null);
  }

  function handleSpeakerNameChange(speakerId: string, newName: string) {
    setSpeakerNames((prev) => ({
      ...prev,
      [speakerId]: newName,
    }));
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <TranscriptionForm
        apiKey={apiKey}
        file={file}
        options={options}
        isTranscribing={isTranscribing}
        error={error}
        onApiKeyChange={setApiKey}
        onFileSelected={handleFileSelected}
        onOptionsChange={setOptions}
        onSubmit={handleTranscribe}
      />

      {result && (
        <TranscriptionResult
          result={result}
          audioType={audioType}
          speakerNames={speakerNames}
          onSpeakerNameChange={handleSpeakerNameChange}
        />
      )}
    </div>
  );
}
