import { useState, useRef, type FormEvent, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TranscriptViewerContainer,
  TranscriptViewerAudio,
  TranscriptViewerWords,
  TranscriptViewerScrubBar,
  TranscriptViewerPlayPauseButton,
  type CharacterAlignmentResponseModel,
} from "@/components/ui/transcript-viewer";
import { PlayIcon, PauseIcon, UploadIcon, CopyIcon } from "lucide-react";
import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/types/SpeechToTextChunkResponseModel";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

type TranscriptOptions = {
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

type TranscriptResult = {
  transcript: SpeechToTextChunkResponseModel;
  audioUrl: string;
  alignment: CharacterAlignmentResponseModel;
};

type SpeakerNames = Record<string, string>;

function convertToAlignment(
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
      // AI: Fallback if no character-level data - split word into characters
      const wordChars = word.text.split("");
      const wordDuration = (word.end || 0) - (word.start || 0);
      const charDuration = wordDuration / wordChars.length;

      wordChars.forEach((char, idx) => {
        characters.push(char);
        const charStart = (word.start || 0) + idx * charDuration;
        characterStartTimesSeconds.push(charStart);
        characterEndTimesSeconds.push(charStart + charDuration);
      });
    }
  }

  return {
    characters,
    characterStartTimesSeconds,
    characterEndTimesSeconds,
  };
}

export function SpeechToTextPlayground() {
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<TranscriptOptions>({
    modelId: "scribe_v2",
    tagAudioEvents: false,
    timestampsGranularity: "character",
    diarize: false,
    useMultiChannel: false,
  });

  async function handleTranscribe(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !apiKey) return;

    setIsTranscribing(true);
    setError(null);
    setResult(null);

    try {
      // AI: Call ElevenLabs API directly from browser
      const client = new ElevenLabsClient({ apiKey });

      const transcript = await client.speechToText.convert({
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

      // AI: Check if transcript has the expected structure
      if (!transcript || typeof transcript !== "object") {
        throw new Error("Invalid transcript response");
      }

      const audioUrl = URL.createObjectURL(file);
      const alignment = convertToAlignment(
        transcript as SpeechToTextChunkResponseModel
      );

      setResult({
        transcript: transcript as SpeechToTextChunkResponseModel,
        audioUrl,
        alignment,
      });
    } catch (err: any) {
      console.error("Transcription error:", err);

      // AI: Extract error message from ElevenLabs API error
      let errorMessage = "An error occurred";

      if (err?.body) {
        try {
          const errorBody =
            typeof err.body === "string" ? JSON.parse(err.body) : err.body;
          if (errorBody?.detail?.message) {
            errorMessage = errorBody.detail.message;
          } else if (errorBody?.detail) {
            errorMessage =
              typeof errorBody.detail === "string"
                ? errorBody.detail
                : JSON.stringify(errorBody.detail);
          }
        } catch (e) {
          // AI: Fallback to error message
        }
      }

      if (err instanceof Error && errorMessage === "An error occurred") {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setIsTranscribing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  }

  function getUniqueSpeakers() {
    if (!result?.transcript.words) return [];
    const speakers = new Set<string>();
    result.transcript.words.forEach((word) => {
      if (word.speakerId) {
        speakers.add(word.speakerId);
      }
    });
    return Array.from(speakers).sort();
  }

  function getSpeakerName(speakerId: string) {
    return speakerNames[speakerId] || speakerId;
  }

  function updateSpeakerName(speakerId: string, newName: string) {
    setSpeakerNames((prev) => ({
      ...prev,
      [speakerId]: newName,
    }));
  }

  function copyAsPlainText() {
    if (result?.transcript.text) {
      navigator.clipboard.writeText(result.transcript.text);
    }
  }

  function copyAsMarkdown(
    includeTimestamps: boolean,
    includeSpeakers: boolean
  ) {
    if (!result?.transcript.words) return;

    let markdown = "# Transcript\n\n";
    let currentSpeaker: string | undefined = undefined;
    let currentParagraph: Array<{ text: string; time?: number }> = [];

    function flushParagraph() {
      if (currentParagraph.length === 0) return;

      if (includeSpeakers && currentSpeaker) {
        markdown += `**${getSpeakerName(currentSpeaker)}:** `;
      }

      markdown += currentParagraph.map((w) => w.text).join("");

      if (
        includeTimestamps &&
        currentParagraph[0] &&
        currentParagraph[0].time !== undefined
      ) {
        const startTime = currentParagraph[0].time;
        const mins = Math.floor(startTime / 60);
        const secs = Math.floor(startTime % 60);
        markdown += ` _(${mins}:${secs.toString().padStart(2, "0")})_`;
      }

      markdown += "\n\n";
      currentParagraph = [];
    }

    result.transcript.words.forEach((word) => {
      if (word.type === "word") {
        // AI: New speaker detected, flush previous paragraph
        if (word.speakerId && word.speakerId !== currentSpeaker) {
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

    navigator.clipboard.writeText(markdown);
  }

  const audioType = useMemo(() => {
    if (!file) return "audio/mpeg";
    const type = file.type;
    if (type) return type as any;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      ogg: "audio/ogg",
      m4a: "audio/m4a",
      aac: "audio/aac",
      webm: "audio/webm",
    };
    return (typeMap[ext || ""] || "audio/mpeg") as any;
  }, [file]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-4xl">Speech-to-Text Playground</CardTitle>
          <CardDescription>
            Transcribe audio files using ElevenLabs Scribe API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleTranscribe} className="space-y-6">
            {/* AI: API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">ElevenLabs API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Enter your API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
              />
            </div>

            {/* AI: File Upload */}
            <div className="space-y-2">
              <Label htmlFor="file">Audio/Video File</Label>
              <div className="flex gap-2">
                <Input
                  id="file"
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*,video/*"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {file && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)}{" "}
                  MB)
                </p>
              )}
            </div>

            {/* AI: Configuration Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={options.modelId}
                    onValueChange={(value) =>
                      setOptions({ ...options, modelId: value as any })
                    }
                  >
                    <SelectTrigger id="model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scribe_v1">Scribe V1</SelectItem>
                      <SelectItem value="scribe_v2">Scribe V2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language Code (optional)</Label>
                  <Input
                    id="language"
                    placeholder="e.g., en, es, fr"
                    value={options.languageCode || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        languageCode: e.target.value || undefined,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timestamps">Timestamps Granularity</Label>
                  <Select
                    value={options.timestampsGranularity}
                    onValueChange={(value) =>
                      setOptions({
                        ...options,
                        timestampsGranularity: value as any,
                      })
                    }
                  >
                    <SelectTrigger id="timestamps">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="word">Word</SelectItem>
                      <SelectItem value="character">Character</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="speakers">
                    Number of Speakers (optional)
                  </Label>
                  <Input
                    id="speakers"
                    type="number"
                    min="1"
                    max="32"
                    placeholder="Auto-detect"
                    value={options.numSpeakers || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        numSpeakers: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature (0.0-2.0)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    placeholder="Default"
                    value={options.temperature || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        temperature: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seed">Seed (optional)</Label>
                  <Input
                    id="seed"
                    type="number"
                    placeholder="Random"
                    value={options.seed || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        seed: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>

                {options.diarize && !options.numSpeakers && (
                  <div className="space-y-2">
                    <Label htmlFor="diarization-threshold">
                      Diarization Threshold (0.0-1.0)
                    </Label>
                    <Input
                      id="diarization-threshold"
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      placeholder="Auto"
                      value={options.diarizationThreshold || ""}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          diarizationThreshold: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="keyterms">Keyterms (comma-separated)</Label>
                  <Textarea
                    id="keyterms"
                    placeholder="technical term, product name, ..."
                    value={options.keyterms?.join(", ") || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        keyterms: e.target.value
                          ? e.target.value.split(",").map((k) => k.trim())
                          : undefined,
                      })
                    }
                    className="resize-none h-20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entity">Entity Detection</Label>
                  <Input
                    id="entity"
                    placeholder="e.g., pii, phi, all"
                    value={options.entityDetection || ""}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        entityDetection: e.target.value || undefined,
                      })
                    }
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="tagAudio"
                      checked={options.tagAudioEvents}
                      onCheckedChange={(checked) =>
                        setOptions({
                          ...options,
                          tagAudioEvents: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="tagAudio" className="cursor-pointer">
                      Tag Audio Events
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="diarize"
                      checked={options.diarize}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, diarize: checked === true })
                      }
                    />
                    <Label htmlFor="diarize" className="cursor-pointer">
                      Diarize (Speaker Detection)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multichannel"
                      checked={options.useMultiChannel}
                      onCheckedChange={(checked) =>
                        setOptions({
                          ...options,
                          useMultiChannel: checked === true,
                        })
                      }
                    />
                    <Label htmlFor="multichannel" className="cursor-pointer">
                      Multi-channel Audio
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                <div className="flex items-start gap-3">
                  <div className="text-destructive mt-0.5">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-destructive mb-1">
                      Error
                    </h3>
                    <p className="text-sm text-destructive/90">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!file || !apiKey || isTranscribing}
            >
              {isTranscribing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Transcribing...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Transcribe Audio
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* AI: Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    Transcription Result
                  </CardTitle>
                  <CardDescription>
                    Language: {result.transcript.languageCode} (
                    {(result.transcript.languageProbability * 100).toFixed(1)}%
                    confidence)
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(value) => {
                      if (value === "plain") copyAsPlainText();
                      else if (value === "md-full") copyAsMarkdown(true, true);
                      else if (value === "md-no-time")
                        copyAsMarkdown(false, true);
                      else if (value === "md-no-speaker")
                        copyAsMarkdown(true, false);
                      else if (value === "md-clean")
                        copyAsMarkdown(false, false);
                    }}
                  >
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

              {/* AI: Speaker Names Editor */}
              {getUniqueSpeakers().length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Speaker Names</Label>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {getUniqueSpeakers().map((speakerId) => (
                      <div key={speakerId} className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground min-w-[80px]">
                          {speakerId}:
                        </Label>
                        <Input
                          placeholder={speakerId}
                          value={speakerNames[speakerId] || ""}
                          onChange={(e) =>
                            updateSpeakerName(speakerId, e.target.value)
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    ))}
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
                    <TranscriptViewerWords
                      renderWord={({ word, status }) => {
                        // AI: Find the original word data to get speaker ID
                        const originalWord = result.transcript.words.find(
                          (w) =>
                            w.text === word.text &&
                            Math.abs((w.start || 0) - word.startTime) < 0.01
                        );
                        const speakerId = originalWord?.speakerId;
                        const prevWord = result.transcript.words.find(
                          (w) =>
                            w.text ===
                              result.transcript.words[word.wordIndex - 1]
                                ?.text &&
                            Math.abs(
                              (w.start || 0) -
                                (result.transcript.words[word.wordIndex - 1]
                                  ?.start || 0)
                            ) < 0.01
                        );
                        const prevSpeakerId = prevWord?.speakerId;
                        const speakerChanged =
                          speakerId && speakerId !== prevSpeakerId;

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
                      }}
                    />
                  </div>

                  <TranscriptViewerScrubBar />

                  <TranscriptViewerPlayPauseButton size="lg" className="w-full">
                    {({ isPlaying }) => (
                      <>
                        {isPlaying ? (
                          <>
                            <PauseIcon className="size-4 mr-2" /> Pause
                          </>
                        ) : (
                          <>
                            <PlayIcon className="size-4 mr-2" /> Play
                          </>
                        )}
                      </>
                    )}
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
      )}
    </div>
  );
}
