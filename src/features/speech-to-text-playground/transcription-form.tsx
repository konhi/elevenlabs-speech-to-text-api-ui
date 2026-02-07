import { useRef, type ChangeEvent, type FormEvent, type SubmitEventHandler } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { UploadIcon } from "lucide-react";
import type { TranscriptOptions } from "./speech-to-text-types";
import {
  isTranscriptModelId,
  isTranscriptTimestampsGranularity,
  parseKeytermsInput,
} from "./transcript-utils";

type CheckboxChecked = boolean | "indeterminate";

type TranscriptionFormProps = {
  apiKey: string;
  file: File | null;
  options: TranscriptOptions;
  isTranscribing: boolean;
  error: string | null;
  onApiKeyChange: (value: string) => void;
  onFileSelected: (file: File | null) => void;
  onOptionsChange: (options: TranscriptOptions) => void;
  onSubmit: SubmitEventHandler<HTMLFormElement>
};

export function TranscriptionForm({
  apiKey,
  file,
  options,
  isTranscribing,
  error,
  onApiKeyChange,
  onFileSelected,
  onOptionsChange,
  onSubmit,
}: TranscriptionFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleApiKeyChange(event: ChangeEvent<HTMLInputElement>) {
    onApiKeyChange(event.target.value);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  }

  function handleClearFileClick() {
    onFileSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleModelChange(value: string) {
    if (!isTranscriptModelId(value)) return;
    onOptionsChange({ ...options, modelId: value });
  }

  function handleLanguageChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || undefined;
    onOptionsChange({ ...options, languageCode: value });
  }

  function handleTimestampsChange(value: string) {
    if (!isTranscriptTimestampsGranularity(value)) return;
    onOptionsChange({ ...options, timestampsGranularity: value });
  }

  function handleNumSpeakersChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const numSpeakers = value ? parseInt(value, 10) : undefined;
    onOptionsChange({ ...options, numSpeakers });
  }

  function handleTemperatureChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const temperature = value ? parseFloat(value) : undefined;
    onOptionsChange({ ...options, temperature });
  }

  function handleSeedChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    const seed = value ? parseInt(value, 10) : undefined;
    onOptionsChange({ ...options, seed });
  }

  function handleDiarizationThresholdChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const value = event.target.value;
    const diarizationThreshold = value ? parseFloat(value) : undefined;
    onOptionsChange({ ...options, diarizationThreshold });
  }

  function handleKeytermsChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const keyterms = parseKeytermsInput(event.target.value);
    onOptionsChange({ ...options, keyterms });
  }

  function handleEntityDetectionChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value || undefined;
    onOptionsChange({ ...options, entityDetection: value });
  }

  function handleTagAudioChange(checked: CheckboxChecked) {
    onOptionsChange({ ...options, tagAudioEvents: checked === true });
  }

  function handleDiarizeChange(checked: CheckboxChecked) {
    onOptionsChange({ ...options, diarize: checked === true });
  }

  function handleMultiChannelChange(checked: CheckboxChecked) {
    onOptionsChange({ ...options, useMultiChannel: checked === true });
  }

  const keytermsValue = options.keyterms?.join(", ") || "";

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-4xl">Speech-to-Text Playground</CardTitle>
        <CardDescription>
          Transcribe audio files using ElevenLabs Scribe API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="apiKey">ElevenLabs API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={handleApiKeyChange}
              required
            />
          </div>

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
                  onClick={handleClearFileClick}
                >
                  Clear
                </Button>
              )}
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select value={options.modelId} onValueChange={handleModelChange}>
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
                  onChange={handleLanguageChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timestamps">Timestamps Granularity</Label>
                <Select
                  value={options.timestampsGranularity}
                  onValueChange={handleTimestampsChange}
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
                <Label htmlFor="speakers">Number of Speakers (optional)</Label>
                <Input
                  id="speakers"
                  type="number"
                  min="1"
                  max="32"
                  placeholder="Auto-detect"
                  value={options.numSpeakers || ""}
                  onChange={handleNumSpeakersChange}
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
                  onChange={handleTemperatureChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seed">Seed (optional)</Label>
                <Input
                  id="seed"
                  type="number"
                  placeholder="Random"
                  value={options.seed || ""}
                  onChange={handleSeedChange}
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
                    onChange={handleDiarizationThresholdChange}
                  />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="keyterms">Keyterms (comma-separated)</Label>
                <Textarea
                  id="keyterms"
                  placeholder="technical term, product name, ..."
                  value={keytermsValue}
                  onChange={handleKeytermsChange}
                  className="resize-none h-20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity">Entity Detection</Label>
                <Input
                  id="entity"
                  placeholder="e.g., pii, phi, all"
                  value={options.entityDetection || ""}
                  onChange={handleEntityDetectionChange}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="tagAudio"
                    checked={options.tagAudioEvents}
                    onCheckedChange={handleTagAudioChange}
                  />
                  <Label htmlFor="tagAudio" className="cursor-pointer">
                    Tag Audio Events
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="diarize"
                    checked={options.diarize}
                    onCheckedChange={handleDiarizeChange}
                  />
                  <Label htmlFor="diarize" className="cursor-pointer">
                    Diarize (Speaker Detection)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multichannel"
                    checked={options.useMultiChannel}
                    onCheckedChange={handleMultiChannelChange}
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
                  <h3 className="font-semibold text-destructive mb-1">Error</h3>
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
  );
}
