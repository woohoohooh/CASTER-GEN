/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  displayIndex: number;
  sku?: string;
}

export interface VoiceState {
  status: 'idle' | 'generating' | 'done' | 'error';
  blob?: Blob;
  error?: string;
  downloaded: boolean;
  text?: string;
}

export type MatrixState = Record<string, VoiceState>;

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export const VOICES = [
  'Puck',
  'Charon',
  'Fenrir',
  'Zephyr',
  'Kore'
];

export const AVAILABLE_FONTS = [
  "Bebas Neue",
  "Impact",
  "Inter",
  "Roboto",
  "Open Sans",
  "Badaboom BB"
];

export const FONT_MAPPING: Record<string, string> = {
  "Bebas Neue": "'Bebas Neue', sans-serif",
  "Impact": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  "Inter": "'Inter', sans-serif",
  "Roboto": "'Roboto', sans-serif",
  "Open Sans": "'Open Sans', sans-serif",
  "Badaboom BB": "'Bangers', 'Badaboom BB', Impact, sans-serif"
};

export const PROJECT_COOLDOWN_SEC = 2;

export const PODCAST_INSTRUCTIONS = "Speak as a professional educational podcast host. Use clear and natural neutral American English. Read the text at a calm and comfortable conversational pace suitable for English learners. Use natural sentence rhythm, smooth phrasing, and realistic intonation. Sound warm, confident, and engaging, but not theatrical or overly emotional. Keep every word clearly articulated and easy to understand. The narration should feel like a high-quality educational podcast, pleasant to listen to for several minutes and easy to follow.";
