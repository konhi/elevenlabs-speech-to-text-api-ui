import type { TranscriptWord } from "./transcript-types";

export function findWordIndex(words: TranscriptWord[], time: number): number {
  if (!words.length) return -1;
  let lo = 0;
  let hi = words.length - 1;
  let answer = -1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const word = words[mid];
    if (!word) break;
    if (time >= word.startTime && time < word.endTime) {
      answer = mid;
      break;
    }
    if (time < word.startTime) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return answer;
}
