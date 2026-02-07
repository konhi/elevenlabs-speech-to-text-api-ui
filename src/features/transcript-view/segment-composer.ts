import type { CharacterAlignmentResponseModel } from "@elevenlabs/elevenlabs-js/api/types/CharacterAlignmentResponseModel";
import type {
  ComposeSegmentsOptions,
  ComposeSegmentsResult,
  TranscriptSegment,
  TranscriptWord,
} from "./transcript-types";

export function composeSegments(
  alignment: CharacterAlignmentResponseModel,
  options: ComposeSegmentsOptions = {}
): ComposeSegmentsResult {
  const {
    characters,
    characterStartTimesSeconds: starts,
    characterEndTimesSeconds: ends,
  } = alignment;

  const segments: TranscriptSegment[] = [];
  const words: TranscriptWord[] = [];

  let wordBuffer = "";
  let whitespaceBuffer = "";
  let wordStart = 0;
  let wordEnd = 0;
  let segmentIndex = 0;
  let wordIndex = 0;
  let insideAudioTag = false;

  const hideAudioTags = options.hideAudioTags ?? false;

  function flushWhitespace() {
    if (!whitespaceBuffer) return;
    segments.push({
      kind: "gap",
      segmentIndex: segmentIndex++,
      text: whitespaceBuffer,
    });
    whitespaceBuffer = "";
  }

  function flushWord() {
    if (!wordBuffer) return;
    const word: TranscriptWord = {
      kind: "word",
      segmentIndex: segmentIndex++,
      wordIndex: wordIndex++,
      text: wordBuffer,
      startTime: wordStart,
      endTime: wordEnd,
    };
    segments.push(word);
    words.push(word);
    wordBuffer = "";
  }

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const start = starts[i] ?? 0;
    const end = ends[i] ?? start;

    if (hideAudioTags) {
      if (char === "[") {
        flushWord();
        whitespaceBuffer = "";
        insideAudioTag = true;
        continue;
      }

      if (insideAudioTag) {
        if (char === "]") insideAudioTag = false;
        continue;
      }
    }

    if (/\s/.test(char || "")) {
      flushWord();
      whitespaceBuffer += char || "";
      continue;
    }

    if (whitespaceBuffer) {
      flushWhitespace();
    }

    if (!wordBuffer) {
      wordBuffer = char || "";
      wordStart = start;
      wordEnd = end;
    } else {
      wordBuffer += char || "";
      wordEnd = end;
    }
  }

  flushWord();
  flushWhitespace();

  return { segments, words };
}
