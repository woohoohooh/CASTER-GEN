/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { get, set } from "idb-keyval";
import { WordTimestamp } from "./types";
import { base64ToUint8Array, createWavHeader } from "./utils";

// Simple in-memory cache to avoid duplicate calls for the same text/voice/instruction
const ttsCache = new Map<string, Blob>();

export async function generateTTS(text: string, voice: string, instruction: string): Promise<{ blob: Blob, timestamps?: WordTimestamp[] }> {
  const cacheKey = `tts:${voice}:${instruction}:${text}`;
  
  // 1. Check in-memory cache
  if (ttsCache.has(cacheKey)) {
    console.log("Using in-memory cached TTS for:", text);
    return { blob: ttsCache.get(cacheKey)! };
  }

  // 2. Check IndexedDB cache
  try {
    const cachedBlob = await get(cacheKey);
    if (cachedBlob instanceof Blob) {
      console.log("Using IndexedDB cached TTS for:", text);
      ttsCache.set(cacheKey, cachedBlob); // Update in-memory cache
      return { blob: cachedBlob };
    }
  } catch (err) {
    console.warn("IndexedDB cache read error:", err);
  }

  try {
    // Call the server-side proxy instead of the Gemini SDK directly
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice, instruction }),
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to generate TTS');
    }

    const { data: base64Audio } = await res.json();
    
    // Convert base64 to Uint8Array (PCM data)
    const pcmData = base64ToUint8Array(base64Audio);
    
    // Create WAV header for 24000Hz mono 16-bit PCM (Standard for Gemini TTS)
    const header = createWavHeader(pcmData.length, 24000);
    
    // Combine header and PCM data
    const wavData = new Uint8Array(header.length + pcmData.length);
    wavData.set(header);
    wavData.set(pcmData, header.length);

    const blob = new Blob([wavData], { type: 'audio/wav' });
    
    // Update caches
    ttsCache.set(cacheKey, blob);
    try {
      await set(cacheKey, blob);
    } catch (err) {
      console.warn("IndexedDB cache write error:", err);
    }
    
    return { blob };
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
}
