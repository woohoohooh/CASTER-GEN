/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  PlusCircle,
  Sparkles,
  Eraser,
  Trash2,
  Timer,
  Loader2,
  Play,
  Pause,
  Download,
  ArrowLeft,
  RotateCcw,
  Mic2,
  Settings,
  ListMusic,
  Headphones,
  EyeOff,
  Palette,
  Type,
  Check,
  SlidersHorizontal,
  X,
  LayoutTemplate,
  Pipette,
  User,
  Monitor,
  Smartphone,
  Maximize,
  Minimize,
  ThumbsUp,
  Heart,
  Bell,
  Bookmark,
  Eye,
  Globe,
  FolderUp,
  Copy,
  CheckSquare,
} from "lucide-react";
import {
  DialogueLine,
  MatrixState,
  VOICES,
  PROJECT_COOLDOWN_SEC,
  PODCAST_INSTRUCTIONS,
  AVAILABLE_FONTS,
  FONT_MAPPING,
} from "./types";
import { generateTTS } from "./geminiService";
import { formatCountdown } from "./utils";

import { get, set, clear } from "idb-keyval";

interface ParsedScriptResult {
  parsedDialogue: DialogueLine[];
  parsedSku?: string;
  parsedLevel?: string;
  parsedTopic?: string;
  parsedTheme?: string;
}

const parseScriptAndMetadata = (
  raw: string,
  defaultSku: string = ""
): ParsedScriptResult => {
  if (!raw || !raw.trim()) {
    return { parsedDialogue: [], parsedSku: defaultSku };
  }

  const lines = raw.split("\n");
  let parsedSku: string | undefined = undefined;
  let parsedLevel: string | undefined = undefined;
  let parsedTopic: string | undefined = undefined;
  let parsedTheme: string | undefined = undefined;

  const dialogueLinesRaw: string[] = [];

  // Pass 1: Extract header metadata and filter out metadata rows
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for metadata headers
    const skuMatch = line.match(/^(?:артикул|sku|article)\s*[:=：]\s*([a-zA-Z0-9_-]+)/i);
    if (skuMatch) {
      parsedSku = skuMatch[1].trim();
      continue;
    }

    const levelMatch = line.match(/^(?:уровень|level)\s*[:=：]\s*(.+)/i);
    if (levelMatch) {
      parsedLevel = levelMatch[1].trim();
      continue;
    }

    const topicMatch = line.match(/^(?:топик|topic)\s*[:=：]\s*(.+)/i);
    if (topicMatch) {
      parsedTopic = topicMatch[1].trim();
      continue;
    }

    const themeMatch = line.match(/^(?:тема|theme|title)\s*[:=]\s*(.+)/i);
    if (themeMatch) {
      parsedTheme = themeMatch[1].trim();
      continue;
    }

    // Ignore other Russian/English metadata keys if any
    if (/^(?:описание|дата|notes|description)\s*[:=：]/i.test(line)) {
      continue;
    }

    dialogueLinesRaw.push(line);
  }

  const effectiveSku = parsedSku || defaultSku;

  // Pass 2: Parse dialogue lines
  const parsedDialogue: DialogueLine[] = [];
  let itemIndex = 0;

  for (const lineText of dialogueLinesRaw) {
    // Pattern 1: Numbered format, e.g. "306864-1. Emma: text" or "1. Emma: text" or "1: Emma: text" or "306864-1 Emma: text"
    const numMatch = lineText.match(/^(?:([a-zA-Z0-9_-]+)-)?(\d+)[.:\s]+(.*)$/);

    if (numMatch) {
      const lineSku = numMatch[1] || effectiveSku;
      const lineNum = parseInt(numMatch[2]);
      const rest = numMatch[3].trim();
      const colonIdx = rest.indexOf(":");

      let speaker = "";
      let text = "";

      if (colonIdx !== -1) {
        speaker = rest.substring(0, colonIdx).trim();
        text = rest.substring(colonIdx + 1).trim();
      } else {
        const spaceIdx = rest.indexOf(" ");
        if (spaceIdx !== -1) {
          speaker = rest.substring(0, spaceIdx).trim();
          text = rest.substring(spaceIdx + 1).trim();
        } else {
          speaker = "Unknown";
          text = rest;
        }
      }

      if (text.trim()) {
        parsedDialogue.push({
          id: `line-${itemIndex}-${lineNum}`,
          speaker: speaker || "Unknown",
          text: text.trim(),
          displayIndex: lineNum,
          sku: lineSku || undefined,
        });
        itemIndex++;
      }
    } else {
      // Pattern 2: Non-numbered format, e.g. "Emma: Welcome back!"
      const colonIdx = lineText.indexOf(":");
      if (colonIdx !== -1) {
        const speaker = lineText.substring(0, colonIdx).trim();
        const text = lineText.substring(colonIdx + 1).trim();
        if (
          speaker &&
          text &&
          !/^(?:артикул|уровень|топик|тема|level|topic|theme|sku)$/i.test(speaker)
        ) {
          const lineNum = itemIndex + 1;
          parsedDialogue.push({
            id: `line-${itemIndex}-${lineNum}`,
            speaker,
            text,
            displayIndex: lineNum,
            sku: effectiveSku || undefined,
          });
          itemIndex++;
        }
      }
    }
  }

  return {
    parsedDialogue,
    parsedSku: effectiveSku,
    parsedLevel,
    parsedTopic,
    parsedTheme,
  };
};

const formatLineForCopy = (line: DialogueLine, currentSku: string = "") => {
  const finalSku = line.sku || currentSku;
  const numPart = finalSku ? `${finalSku}-${line.displayIndex}` : `${line.displayIndex}`;
  return `${numPart}. ${line.speaker}: ${line.text}`;
};

const CustomQRCode = () => (
  <svg
    width="44"
    height="44"
    viewBox="0 0 29 29"
    fill="none"
    className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
  >
    <rect
      x="1"
      y="1"
      width="7"
      height="7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect x="3" y="3" width="3" height="3" fill="currentColor" />
    <rect
      x="21"
      y="1"
      width="7"
      height="7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect x="23" y="3" width="3" height="3" fill="currentColor" />
    <rect
      x="1"
      y="21"
      width="7"
      height="7"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect x="3" y="23" width="3" height="3" fill="currentColor" />
    <rect x="11" y="4" width="2" height="2" fill="currentColor" />
    <rect x="15" y="2" width="2" height="2" fill="currentColor" />
    <rect x="15" y="6" width="2" height="2" fill="currentColor" />
    <rect x="11" y="10" width="2" height="2" fill="currentColor" />
    <rect x="4" y="11" width="2" height="2" fill="currentColor" />
    <rect x="1" y="15" width="2" height="2" fill="currentColor" />
    <rect x="23" y="11" width="2" height="2" fill="currentColor" />
    <rect x="21" y="15" width="2" height="2" fill="currentColor" />
    <rect x="25" y="15" width="2" height="2" fill="currentColor" />
    <rect
      x="10"
      y="14"
      width="5"
      height="5"
      stroke="currentColor"
      strokeWidth="1"
    />
    <rect x="12" y="16" width="1" height="1" fill="currentColor" />
    <rect x="11" y="23" width="2" height="2" fill="currentColor" />
    <rect x="15" y="21" width="2" height="2" fill="currentColor" />
    <rect x="15" y="25" width="2" height="2" fill="currentColor" />
    <rect x="23" y="21" width="2" height="2" fill="currentColor" />
    <rect x="21" y="23" width="2" height="2" fill="currentColor" />
    <rect x="25" y="25" width="2" height="2" fill="currentColor" />
  </svg>
);

const SketchedArrow = ({
  delay = 0,
  side = "straight",
  length = 35,
  strokeWidth = 2,
  topOffset = 6,
}: {
  delay?: number;
  side?: "left" | "right" | "straight";
  length?: number;
  strokeWidth?: number;
  topOffset?: number;
}) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isReady) return null;

  let path = `M 0,0 Q 12,${length * 0.4} 10,${length}`;
  let head = `M 3,${length - 7} L 10,${length} L 17,${length - 7}`;

  if (side === "left") {
    path = `M 0,0 Q -12,${length * 0.4} -10,${length}`;
    head = `M -17,${length - 7} L -10,${length} L -3,${length - 7}`;
  } else if (side === "straight") {
    path = `M 0,0 L 0,${length}`;
    head = `M -7,${length - 7} L 0,${length} L 7,${length - 7}`;
  }

  // Double head width/scaling dynamically for thicker arrows to maintain perfect outline proportions
  const headSize = Math.max(7, strokeWidth * 3.5);
  if (side === "left") {
    head = `M ${-10 - headSize},${length - headSize} L -10,${length} L ${-10 + headSize},${length - headSize}`;
  } else if (side === "straight") {
    head = `M ${-headSize},${length - headSize} L 0,${length} L ${headSize},${length - headSize}`;
  } else {
    head = `M ${10 - headSize},${length - headSize} L 10,${length} L ${10 + headSize},${length - headSize}`;
  }

  return (
    <svg
      width="120"
      height={length + 30}
      viewBox={`-60 0 120 ${length + 30}`}
      fill="none"
      className="absolute left-1/2 -translate-x-1/2 pointer-events-none overflow-visible z-20"
      style={{ top: `calc(100% + ${topOffset}px)` }}
    >
      <motion.path
        d={path}
        stroke="white"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.7, ease: "easeOut" },
          opacity: { duration: 0.15 }
        }}
      />
      <motion.path
        d={head}
        stroke="white"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { delay: 0.5, duration: 0.3, ease: "easeOut" },
          opacity: { delay: 0.5, duration: 0.08 }
        }}
      />
    </svg>
  );
};

const LineControl = ({
  line,
  sku,
  state,
  onGenerate,
  onDownload,
  onPlay,
  isQueueRunning,
  isSelected,
  onToggleSelect,
  isFocused,
  onFocus,
  isPlayingChecklistAudio,
}: any) => {
  return (
    <div
      id={`line-item-${line.id}`}
      onClick={onFocus}
      className={`flex flex-col gap-2 p-4 border rounded-2xl transition-all group backdrop-blur-sm shadow-xl cursor-pointer ${
        isFocused
          ? "ring-2 ring-white/60 border-white/40 bg-white/10 shadow-2xl"
          : isSelected
            ? "bg-white/10 border-white/20"
            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Circle badge with large, bold, white line number or big checkmark when selected.
              Visually inactive (dimmed/disabled) when audio is currently playing, and active when audio completes */}
          <button
            type="button"
            disabled={isPlayingChecklistAudio}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            title={
              isPlayingChecklistAudio
                ? "Аудио воспроизводится..."
                : isSelected
                  ? "Снять выделение"
                  : "Отметить строку для копирования (горячая клавиша 2)"
            }
            className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all select-none relative group/circle ${
              isPlayingChecklistAudio
                ? "opacity-30 grayscale cursor-not-allowed scale-95 pointer-events-none"
                : "opacity-100 scale-100 cursor-pointer"
            } ${
              isSelected
                ? "bg-white text-black border-2 border-white shadow-lg shadow-white/20 scale-105"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40"
            }`}
          >
            {isSelected ? (
              <Check size={22} className="stroke-[3.5] text-black" />
            ) : (
              <span className="text-lg font-black text-white leading-none tracking-tight">
                {line.displayIndex}
              </span>
            )}
          </button>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider">
                {line.speaker}
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed mt-0.5">{line.text}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {state.status === "error" && (
            <span className="text-[10px] text-red-500 font-bold uppercase">
              {state.error || "Error"}
            </span>
          )}

          {state.status === "done" ? (
            <button
              onClick={onGenerate}
              disabled={isQueueRunning}
              title="Regenerate"
              className="p-2 text-neutral-500 hover:text-orange-400 hover:bg-orange-400/10 rounded-xl transition-all"
            >
              <RotateCcw size={18} />
            </button>
          ) : (
            <button
              onClick={onGenerate}
              disabled={state.status === "generating" || isQueueRunning}
              className={`p-2 rounded-xl transition-all ${
                state.status === "done"
                  ? "text-neutral-300 bg-white/10"
                  : state.status === "error"
                    ? "text-red-500 hover:bg-red-500/10"
                    : "text-neutral-500 hover:text-white hover:bg-neutral-800"
              }`}
            >
              {state.status === "generating" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : state.status === "error" ? (
                <RotateCcw size={18} />
              ) : (
                <Play size={18} />
              )}
            </button>
          )}

          <button
            onClick={onPlay}
            disabled={state.status !== "done"}
            className={`p-2 rounded-xl transition-all ${
              state.status === "done"
                ? "text-neutral-300 hover:text-white hover:bg-neutral-800"
                : "text-neutral-700 cursor-not-allowed"
            }`}
          >
            <Play size={18} />
          </button>

          <button
            onClick={onDownload}
            disabled={state.status !== "done"}
            className={`p-2 rounded-xl transition-all ${
              state.status === "done"
                ? "text-neutral-300 hover:text-white hover:bg-neutral-800"
                : "text-neutral-700 cursor-not-allowed"
            }`}
          >
            <Download size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const getDialogueCachedKey = (skuVal: string, lineId: string) => {
  return `podcast_state_${skuVal || "global"}_${lineId}`;
};

const getSkuForLine = (line?: DialogueLine | null, globalSku?: string) => {
  return (line && line.sku) ? line.sku : (globalSku || "global");
};

const getCustomAudioKey = (skuVal: string, filename: string) => {
  return `podcast_custom_audio_${skuVal || "global"}_${filename}`;
};

export default function App() {
  const [view, setView] = useState<"input" | "setup" | "generating" | "video">(
    "input",
  );
  const [rawText, setRawText] = useState(() => {
    return (
      localStorage.getItem("podcast_raw_text") ||
      "уровень: Beginner\nтопик: Частые слова (база)\nтема: Introducing Yourself and Your Family\n\n1. Emma: Hello everyone! Welcome to our English Podcast.\n2. Ethan: Yes, welcome! Today we are talking about introducing yourself and your family.\n3. Emma: This is a classic topic for beginners. Let's get started!"
    );
  });
  const [sku, setSku] = useState("global");

  useEffect(() => {
    const matchSku = rawText.match(/^(?:артикул|sku|article)\s*[:：]\s*(.+)$/im);
    if (matchSku) {
      const parsedSku = matchSku[1].trim().replace(/[\r\n\s.]+$/, "");
      if (parsedSku && parsedSku !== sku) {
        setSku(parsedSku);
        localStorage.setItem("podcast_sku", parsedSku);
      }
    }
  }, [rawText, sku]);
  const [voiceInstructions, setVoiceInstructions] = useState(() => {
    return (
      localStorage.getItem("tts_podcast_instructions") || PODCAST_INSTRUCTIONS
    );
  });
  const [dialogue, setDialogue] = useState<DialogueLine[]>([]);
  const dialogueRef = useRef<DialogueLine[]>([]);
  const [speakerVoices, setSpeakerVoices] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("podcast_voices");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Object.keys(parsed).length > 0) return parsed;
      }
    } catch (e) {}
    return {
      Ethan: "Charon",
      Emma: "Zephyr",
    };
  });
  const speakerVoicesRef = useRef<Record<string, string>>({
    Ethan: "Charon",
    Emma: "Zephyr",
  });

  useEffect(() => {
    speakerVoicesRef.current = speakerVoices;
  }, [speakerVoices]);
  const [states, setStates] = useState<MatrixState>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });

  const updateDialogue = (d: DialogueLine[]) => {
    dialogueRef.current = d;
    setDialogue(d);
  };

  const updateSpeakerVoices = (v: Record<string, string>) => {
    speakerVoicesRef.current = v;
    setSpeakerVoices(v);
  };

  const [introFont, setIntroFont] = useState(() => {
    return localStorage.getItem("intro_font") || "Open Sans";
  });
  const [dialogueFont, setDialogueFont] = useState(() => {
    return localStorage.getItem("dialogue_font") || "Open Sans";
  });
  const [outroFont, setOutroFont] = useState(() => {
    return localStorage.getItem("outro_font") || "Open Sans";
  });

  const updateIntroFont = (font: string) => {
    setIntroFont(font);
    localStorage.setItem("intro_font", font);
  };
  const [introTitleFontSize, setIntroTitleFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("intro_title_font_size");
    return saved ? parseInt(saved, 10) : 180;
  });
  const updateIntroTitleFontSize = (size: number) => {
    setIntroTitleFontSize(size);
    localStorage.setItem("intro_title_font_size", size.toString());
  };
  const updateDialogueFont = (font: string) => {
    setDialogueFont(font);
    localStorage.setItem("dialogue_font", font);
  };
  const updateOutroFont = (font: string) => {
    setOutroFont(font);
    localStorage.setItem("outro_font", font);
  };

  // Video Player States
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [timingOffset, setTimingOffset] = useState(0); // ms offset for highlighting
  const [videoFormat, setVideoFormat] = useState<"landscape" | "portrait">(
    "landscape",
  );
  const [fontSize, setFontSize] = useState(5); // 1-10 scale
  const [hideUI, setHideUI] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [englishPodcastHuge, setEnglishPodcastHuge] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);

  const stopAndCleanupAudio = useCallback(() => {
    if (firstLineAudioDelayTimeoutRef.current) {
      clearTimeout(firstLineAudioDelayTimeoutRef.current);
      firstLineAudioDelayTimeoutRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {
        console.warn("Failed to pause audio:", e);
      }
      audioRef.current.onended = null;
      audioRef.current.oncanplaythrough = null;
      audioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(activeAudioUrlRef.current);
      } catch (e) {
        console.warn("Failed to revoke object URL:", e);
      }
      activeAudioUrlRef.current = null;
    }
  }, []);

  const playUploadedAudio = async (
    filename: "save" | "subscribe" | "like" | "next" | "intro",
  ): Promise<boolean> => {
    try {
      stopAndCleanupAudio();
      const data = await get(getCustomAudioKey(sku, filename));
      if (data && data.blob) {
        const url = URL.createObjectURL(data.blob);
        activeAudioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        return new Promise<boolean>((resolve) => {
          let resolved = false;
          const doResolve = (val: boolean) => {
            if (!resolved) {
              resolved = true;
              stopAndCleanupAudio();
              resolve(val);
            }
          };
          audio.onended = () => {
            doResolve(true);
          };
          audio.onerror = () => {
            doResolve(false);
          };
          audio
            .play()
            .then(() => {})
            .catch((e) => {
              console.error("Audio play blocked/failed:", e);
              doResolve(false);
            });
        });
      } else {
        console.log(`No custom audio uploaded for ${filename}`);
        return false;
      }
    } catch (err) {
      console.error(`Error playing custom audio ${filename}:`, err);
      return false;
    }
  };
  const playbackTimerRef = useRef<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  const [isPlaybackFinished, setIsPlaybackFinished] = useState(false);
  const [userLiked, setUserLiked] = useState(true);
  const [userSubscribed, setUserSubscribed] = useState(false);
  const [userSaved, setUserSaved] = useState(true);

  // Drawing States & Refs
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [drawings, setDrawings] = useState<any[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<any>(null);

  const isInteractiveElementAt = (clientX: number, clientY: number): HTMLElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const originalPointerEvents = canvas.style.pointerEvents;
    canvas.style.pointerEvents = "none";

    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null;

    canvas.style.pointerEvents = originalPointerEvents;

    if (!element) return null;

    let current: HTMLElement | null = element;
    while (current && current !== canvas.parentElement) {
      if (!current) break;
      const tagName = current.tagName.toLowerCase();
      const style = window.getComputedStyle(current);
      const isPointerAuto = style.pointerEvents !== "none";
      const hasPointerCursor = style.cursor === "pointer";
      const isButton = tagName === "button" || tagName === "a";
      const hasRoleButton = current.getAttribute("role") === "button";

      if (isPointerAuto && (isButton || hasRoleButton || hasPointerCursor)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  };

  const startDrawing = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    isDrawingRef.current = true;
    currentStrokeRef.current = {
      points: [{ x, y }],
      isDot: true,
    };
    redrawCanvas();
  };

  const continueDrawing = (clientX: number, clientY: number) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    const points = currentStrokeRef.current.points;
    const firstPoint = points[0];
    const dx = (x - firstPoint.x) * rect.width;
    const dy = (y - firstPoint.y) * rect.height;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let isDot = currentStrokeRef.current.isDot;
    if (distance > 3) {
      isDot = false;
    }

    currentStrokeRef.current = {
      points: [...points, { x, y }],
      isDot,
    };
    redrawCanvas();
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current) {
      const strokeSnap = currentStrokeRef.current;
      setDrawings((prev) => [...prev, strokeSnap]);
      currentStrokeRef.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const interactive = isInteractiveElementAt(e.clientX, e.clientY);
    if (interactive && typeof (interactive as any).click === "function") {
      (interactive as any).click();
      return;
    }
    startDrawing(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    continueDrawing(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    endDrawing();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (touch) {
      const interactive = isInteractiveElementAt(touch.clientX, touch.clientY);
      if (interactive && typeof (interactive as any).click === "function") {
        (interactive as any).click();
        return;
      }
      startDrawing(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = e.touches[0];
    if (touch) {
      continueDrawing(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    endDrawing();
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.lineWidth = 10; // bold white brush!
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const allStrokes = [...drawings];
    if (currentStrokeRef.current) {
      allStrokes.push(currentStrokeRef.current);
    }

    for (const stroke of allStrokes) {
      if (!stroke || !stroke.points || stroke.points.length === 0) continue;

      if (stroke.isDot || stroke.points.length === 1) {
        const p = stroke.points[0];
        if (p) {
          ctx.beginPath();
          // Drawing a bold dot for "нажал - точка"
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        const first = stroke.points[0];
        if (first) {
          ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
          for (let i = 1; i < stroke.points.length; i++) {
            const p = stroke.points[i];
            if (p) {
              ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
            }
          }
          ctx.stroke();
        }
      }
    }
  }, [drawings]);

  // Redraw when drawings list switches or scales
  useEffect(() => {
    redrawCanvas();
  }, [drawings, redrawCanvas]);

  // ResizeObserver for canvas container sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (canvas) {
          canvas.width = entry.contentRect.width;
          canvas.height = entry.contentRect.height;
          redrawCanvas();
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [redrawCanvas, view]);

  // Tooltip visibility states
  const [showSubscribeTooltip, setShowSubscribeTooltip] = useState(false);
  const [showLikeTooltip, setShowLikeTooltip] = useState(false);
  const [showSaveTooltip, setShowSaveTooltip] = useState(false);
  const [hoverSubscribe, setHoverSubscribe] = useState(false);
  const [hoverLike, setHoverLike] = useState(false);
  const [hoverSave, setHoverSave] = useState(false);
  const [introCountdown, setIntroCountdown] = useState<number | string | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const introDelayTimeoutRef = useRef<number | null>(null);
  const firstLineAudioDelayTimeoutRef = useRef<number | null>(null);
  const [videoIntroPhase, setVideoIntroPhase] = useState<0 | 1 | 2 | 3>(0);
  const [introResetCounter, setIntroResetCounter] = useState(0);
  const [isIntroPreviewOnly, setIsIntroPreviewOnly] = useState(false);
  const [introStarted, setIntroStarted] = useState(false);

  const [bgStyle, setBgStyle] = useState<"neon" | "pure">("neon");
  const [hideName, setHideName] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [disableZoomAnimation, setDisableZoomAnimation] = useState(() => {
    return localStorage.getItem("disable_zoom_animation") === "true";
  });

  const updateDisableZoomAnimation = (val: boolean) => {
    setDisableZoomAnimation(val);
    localStorage.setItem("disable_zoom_animation", String(val));
  };

  // Automatically clear cache on app startup as requested
  useEffect(() => {
    const autoClearCacheOnStartup = async () => {
      try {
        await clear();
        updateStates(() => ({}));
        console.log("Audio cache cleared automatically on startup.");
      } catch (e) {
        console.error("Auto clear startup failed", e);
      }
    };
    autoClearCacheOnStartup();
  }, []);

  const [outroStep, setOutroStep] = useState(0);

  useEffect(() => {
    let timer1: number | undefined;
    let timer2: number | undefined;
    let timer3: number | undefined;
    let timer4: number | undefined;
    let timer5: number | undefined;
    let timer6: number | undefined;
    if (view === "video" && isPlaybackFinished) {
      setOutroStep(0);
      timer1 = window.setTimeout(() => {
        setOutroStep(1);
      }, 250);

      timer2 = window.setTimeout(() => {
        setOutroStep(2);
      }, 1000);

      timer3 = window.setTimeout(() => {
        setOutroStep(3);
      }, 3000);

      timer4 = window.setTimeout(() => {
        setOutroStep(4);
      }, 4500);

      timer5 = window.setTimeout(() => {
        setOutroStep(5);
      }, 6000);

      timer6 = window.setTimeout(() => {
        setOutroStep(6);
      }, 7500);
    }
    return () => {
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      if (timer3) clearTimeout(timer3);
      if (timer4) clearTimeout(timer4);
      if (timer5) clearTimeout(timer5);
      if (timer6) clearTimeout(timer6);
    };
  }, [view, isPlaybackFinished]);

  useEffect(() => {
    let timer1: number | undefined;
    let timer2: number | undefined;
    let isCancelled = false;

    if (view === "video" && currentLineIndex === -1 && !isPlaybackFinished && introStarted) {
      setVideoIntroPhase(0);
      setIntroCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (introDelayTimeoutRef.current) {
        clearTimeout(introDelayTimeoutRef.current);
        introDelayTimeoutRef.current = null;
      }

      // Timeline:
      // 0s: Only "ENGLISH PODCAST" shown (Phase 0)
      // 2.0s: Topic Title appears (Phase 2) & intro.wav plays
      timer1 = window.setTimeout(async () => {
        if (isCancelled) return;
        setVideoIntroPhase(2);

        // Play intro.wav (voice speaking topic title)
        const played = await playUploadedAudio("intro");
        if (isCancelled) return;

        // Wait 2 seconds AFTER audio finishes playing (or fallback 1.5s reading time + 2s delay if missing)
        const postAudioDelay = played ? 2000 : 3500;

        timer2 = window.setTimeout(() => {
          if (isCancelled) return;
          if (!isIntroPreviewOnly) {
            startPlayback(0);
          }
        }, postAudioDelay);
      }, 2000);
    } else {
      setVideoIntroPhase(0);
      setIntroCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (introDelayTimeoutRef.current) {
        clearTimeout(introDelayTimeoutRef.current);
        introDelayTimeoutRef.current = null;
      }
    }

    return () => {
      isCancelled = true;
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (introDelayTimeoutRef.current) {
        clearTimeout(introDelayTimeoutRef.current);
        introDelayTimeoutRef.current = null;
      }
    };
  }, [view, currentLineIndex, isPlaybackFinished, introResetCounter, isIntroPreviewOnly, introStarted]);

  useEffect(() => {
    if (view === "video" && isPlaybackFinished) {
      if (outroStep === 3) {
        playUploadedAudio("subscribe");
      } else if (outroStep === 4) {
        playUploadedAudio("like");
      } else if (outroStep === 5) {
        playUploadedAudio("save");
      } else if (outroStep === 6) {
        playUploadedAudio("next");
      }
    }
  }, [outroStep, view, isPlaybackFinished]);

  const previewEndScreen = () => {
    if (audioRef.current) audioRef.current.pause();
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (introDelayTimeoutRef.current) {
      clearTimeout(introDelayTimeoutRef.current);
      introDelayTimeoutRef.current = null;
    }
    if (firstLineAudioDelayTimeoutRef.current) {
      clearTimeout(firstLineAudioDelayTimeoutRef.current);
      firstLineAudioDelayTimeoutRef.current = null;
    }
    setIntroCountdown(null);
    setCurrentLineIndex(-1);
    setCurrentWordIndex(-1);
    setIsPaused(false);
    isPausedRef.current = false;
    setIsPlaybackFinished(true);
    setOutroStep(0);
    setView("video");
  };

  // Extract custom metadata from rawText dynamically
  const matchLevel = rawText.match(/(?:уровень|level)\s*[:：]\s*(.+)/i);
  const matchTopic = rawText.match(/(?:топик|topic)\s*[:：]\s*(.+)/i);
  const matchTheme = rawText.match(/(?:тема|theme)\s*[:：]\s*(.+)/i);

  const formatLevel = (val: string): string => {
    if (!val) return "";
    return val
      .toLowerCase()
      .replace(/(?:^|[\s\-\/])([a-zA-Zа-яА-ЯёЁ])/g, (match) => match.toUpperCase());
  };

  const levelValueRaw = matchLevel
    ? matchLevel[1].trim().replace(/[.\s]+$/, "")
    : "";
  const levelValue = formatLevel(levelValueRaw);
  const topicValue = matchTopic
    ? matchTopic[1].trim().replace(/[.\s]+$/, "")
    : "";
  const themeValue = matchTheme
    ? matchTheme[1].trim().replace(/[.\s]+$/, "")
    : "";
  const [nameStyle, setNameStyle] = useState({
    name: "Subtle White",
    class: "text-white/10 uppercase tracking-[0.5em] text-9xl font-black",
  });

  // Background Styles configuration
  const BG_STYLES_CONFIG = {
    neon: {
      name: "Violet Neon",
      base: "bg-black",
      glows: ["bg-purple-600/15", "bg-purple-900/5"],
    },
    pure: { name: "Pure Black", base: "bg-black", glows: [] },
  };

  // Map font scale to classes
  const getFontSizeClass = () => {
    const fs = isFullScreen && videoFormat === "landscape";
    const scales: Record<number, string> = {
      1: fs ? "text-3xl md:text-4xl" : "text-xl",
      2: fs ? "text-4xl md:text-5xl" : "text-2xl",
      3: fs ? "text-5xl md:text-6xl" : "text-3xl",
      4: fs ? "text-6xl md:text-7xl" : "text-4xl md:text-5xl",
      5: fs ? "text-7xl md:text-8xl" : "text-5xl md:text-6xl",
      6: fs ? "text-8xl md:text-9xl" : "text-6xl md:text-7xl",
      7: fs ? "text-9xl md:text-[11rem]" : "text-7xl md:text-8xl",
      8: fs ? "text-[11rem] md:text-[13rem]" : "text-8xl md:text-9xl",
      9: fs ? "text-[14rem] md:text-[16rem]" : "text-[10rem] md:text-[12rem]",
      10: fs ? "text-[18rem] md:text-[22rem]" : "text-[12rem] md:text-[15rem]",
    };
    return (
      scales[fontSize] || (fs ? "text-7xl md:text-8xl" : "text-5xl md:text-6xl")
    );
  };

  const statesRef = useRef<MatrixState>({});
  const updateStates = useCallback(
    (updater: (prev: MatrixState) => MatrixState) => {
      const next = updater(statesRef.current);
      statesRef.current = next;
      setStates(next);
    },
    [],
  );

  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef<{ id: string; retryCount: number }[]>([]);
  const isProcessingRef = useRef(false);

  const uploadFilesRef = useRef<HTMLInputElement>(null);
  const scriptUploadRef = useRef<HTMLInputElement>(null);
  const uploadFolderRef = useRef<HTMLInputElement>(null);

  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [focusedLineIndex, setFocusedLineIndex] = useState(0);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isPlayingChecklistAudio, setIsPlayingChecklistAudio] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(false);
  const isAutoPlayActiveRef = useRef(false);
  const autoPlayTimeoutRef = useRef<number | null>(null);

  const stopAutoPlay = useCallback(() => {
    isAutoPlayActiveRef.current = false;
    setIsAutoPlayActive(false);
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
  }, []);

  const toggleSelectLine = (id: string) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      const selectedLines = dialogue.filter((d) => next.has(d.id));
      if (selectedLines.length > 0) {
        const formattedText = selectedLines
          .map((line) => formatLineForCopy(line, sku))
          .join("\n");
        navigator.clipboard.writeText(formattedText).catch((err) => console.error("Clipboard write error:", err));
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLineIds.size === dialogue.length && dialogue.length > 0) {
      setSelectedLineIds(new Set());
    } else {
      const allIds = new Set(dialogue.map((d) => d.id));
      setSelectedLineIds(allIds);
      if (dialogue.length > 0) {
        const formattedText = dialogue
          .map((line) => formatLineForCopy(line, sku))
          .join("\n");
        navigator.clipboard.writeText(formattedText).catch((err) => console.error("Clipboard write error:", err));
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }
    }
  };

  const handleCopySelectedToClipboard = () => {
    const selectedLines = dialogue.filter((d) => selectedLineIds.has(d.id));
    if (selectedLines.length === 0) {
      alert("Нажмите на круглики с номерами строк, чтобы отметить их для копирования");
      return;
    }

    const formattedText = selectedLines
      .map((line) => formatLineForCopy(line, sku))
      .join("\n");

    navigator.clipboard.writeText(formattedText).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const filesArray = Array.from(files) as File[];
    const totalFiles = filesArray.length;
    setUploadProgress({ current: 0, total: totalFiles });

    try {
      // 1. Find .txt or .md file in uploaded folder (any filename)
      const textFiles = filesArray.filter((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith(".txt") ||
          name.endsWith(".md") ||
          name.endsWith(".text") ||
          name.endsWith(".srt")
        );
      });

      let currentRawText = rawText;
      if (textFiles.length > 0) {
        let chosenFile = textFiles[0];
        for (const tf of textFiles) {
          const content = await tf.text();
          if (
            content.includes(":") &&
            (content.includes("Emma") ||
              content.includes("Ethan") ||
              /\d+[.:\s]+/.test(content) ||
              /артикул/i.test(content))
          ) {
            chosenFile = tf;
            currentRawText = content;
            break;
          }
        }
        if (currentRawText === rawText && textFiles.length > 0) {
          currentRawText = await chosenFile.text();
        }

        setRawText(currentRawText);
        localStorage.setItem("podcast_raw_text", currentRawText);
      }

      // 2. Parse dialogue and metadata with robust parser
      const { parsedDialogue, parsedSku } = parseScriptAndMetadata(currentRawText, sku);
      let currentSkuVal = sku;
      if (parsedSku) {
        currentSkuVal = parsedSku;
        setSku(parsedSku);
        localStorage.setItem("podcast_sku", parsedSku);
      }

      if (parsedDialogue.length > 0) {
        updateDialogue(parsedDialogue);

        // Auto-assign voices
        const uniqueSpeakers = Array.from(new Set(parsedDialogue.map((p) => p.speaker)));
        const mapping = { ...speakerVoicesRef.current };
        const STATIC_VOICES: Record<string, string> = {
          Emma: "Zephyr",
          Ethan: "Charon",
        };
        uniqueSpeakers.forEach((s, i) => {
          if (!mapping[s])
            mapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
        });
        updateSpeakerVoices(mapping);
      }

      // 3. Process wav / audio files in folder (including wav/ subfolder)
      const newStates = { ...statesRef.current };
      let matchCount = 0;

      const audioFiles = filesArray.filter((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith(".wav") ||
          name.endsWith(".mp3") ||
          name.endsWith(".ogg") ||
          name.endsWith(".m4a") ||
          name.endsWith(".aac") ||
          name.endsWith(".flac")
        );
      });

      for (let i = 0; i < audioFiles.length; i++) {
        const file = audioFiles[i];
        setUploadProgress({ current: i + 1, total: audioFiles.length });

        const nameLower = file.name.toLowerCase();
        const baseName = nameLower.split("/").pop() || nameLower;

        if (
          baseName === "save.wav" ||
          baseName === "subscribe.wav" ||
          baseName === "like.wav" ||
          baseName === "next.wav" ||
          baseName === "intro.wav" ||
          baseName === "intro.mp3"
        ) {
          const type = baseName.slice(0, baseName.indexOf("."));
          const fileType = file.type || "audio/wav";
          const blob = new Blob([file as BlobPart], { type: fileType });
          await set(getCustomAudioKey(currentSkuVal, type), { blob });
          continue;
        }

        const numMatches = baseName.match(/\d+/g);
        if (numMatches) {
          const lineNum = parseInt(numMatches[numMatches.length - 1]);
          const line = parsedDialogue.find((d) => d.displayIndex === lineNum);

          if (line) {
            const fileType = file.type || "audio/wav";
            const blob = new Blob([file as BlobPart], { type: fileType });
            const newState = {
              status: "done" as const,
              blob: blob,
              downloaded: true,
              text: line.text,
            };

            await set(getDialogueCachedKey(getSkuForLine(line, currentSkuVal), line.id), newState);
            newStates[line.id] = newState;
            matchCount++;
          }
        }
      }

      updateStates(() => newStates);

      // Save session data
      localStorage.setItem("podcast_raw_text", currentRawText);
      localStorage.setItem("podcast_sku", currentSkuVal);
      if (parsedDialogue.length > 0) {
        localStorage.setItem("podcast_dialogue", JSON.stringify(parsedDialogue));
        localStorage.setItem("podcast_voices", JSON.stringify(speakerVoicesRef.current));
      }

      // 4. AUTOMATIC TRANSITION to checklist mode (where user ticks checkboxes)
      if (parsedDialogue.length > 0) {
        setFocusedLineIndex(0);
        setSelectedLineIds(new Set());
        setView("generating");
      }
    } catch (err) {
      console.error("Folder upload error:", err);
      alert("Error processing folder upload. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (uploadFolderRef.current) uploadFolderRef.current.value = "";
    }
  };

  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      if (typeof re.target?.result === "string") {
        setRawText(re.target.result);
      }
    };
    reader.readAsText(file);
    if (scriptUploadRef.current) scriptUploadRef.current.value = "";
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    const filesArray = Array.from(files) as File[];
    const totalFiles = filesArray.length;
    setUploadProgress({ current: 0, total: totalFiles });

    try {
      // Parse the latest dialogue from rawText first so we have the updated line mapping
      let latestDialogue = dialogueRef.current;
      if (rawText.trim()) {
        const lines = rawText.split("\n").filter((l) => l.trim().includes(":"));
        const parsed: DialogueLine[] = lines
          .map((l, i) => {
            const lineText = l.trim();
            const numMatch = lineText.match(/^(?:(\d+)-)?(\d+)[.\s]+/);

            if (!numMatch) return null;

            let speaker = "";
            let text = "";
            let lineNum = i + 1;
            let lineSku: string | undefined = undefined;

            if (numMatch) {
              lineSku = numMatch[1];
              lineNum = parseInt(numMatch[2]);
              const cleanedLine = lineText.substring(numMatch[0].length);
              const colonIdx = cleanedLine.indexOf(":");
              if (colonIdx !== -1) {
                speaker = cleanedLine.substring(0, colonIdx).trim();
                text = cleanedLine.substring(colonIdx + 1).trim();
              }
            }

            return {
              id: `line-${i}-${lineNum}`, // Unique ID using index to avoid collisions
              speaker: speaker || "Unknown",
              text: text,
              displayIndex: lineNum,
              sku: lineSku,
            };
          })
          .filter((d): d is DialogueLine => d !== null && d.text.trim() !== "");

        if (parsed.length > 0) {
          latestDialogue = parsed;
          updateDialogue(parsed);

          // Auto-assign voices to keep them synchronized
          const uniqueSpeakers = Array.from(
            new Set(parsed.map((p) => p.speaker)),
          );
          const mapping = { ...speakerVoicesRef.current };
          const STATIC_VOICES: Record<string, string> = {
            Emma: "Zephyr",
            Ethan: "Charon",
          };
          uniqueSpeakers.forEach((s, i) => {
            if (!mapping[s])
              mapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
          });
          updateSpeakerVoices(mapping);
        }
      }

      const newStates = { ...statesRef.current };
      let matchCount = 0;
      let customCount = 0;

      const getMimeType = (f: File) => {
        const name = f.name.toLowerCase();
        if (name.endsWith(".wav")) return "audio/wav";
        if (name.endsWith(".mp3")) return "audio/mpeg";
        if (name.endsWith(".ogg")) return "audio/ogg";
        if (name.endsWith(".m4a")) return "audio/m4a";
        return f.type || "audio/wav";
      };

      for (let i = 0; i < totalFiles; i++) {
        const file = filesArray[i];
        setUploadProgress({ current: i + 1, total: totalFiles });

        const nameLower = file.name.toLowerCase();
        if (
          nameLower === "save.wav" ||
          nameLower === "subscribe.wav" ||
          nameLower === "like.wav" ||
          nameLower === "next.wav" ||
          nameLower === "intro.wav" ||
          nameLower === "intro.mp3"
        ) {
          const type = nameLower.slice(0, nameLower.indexOf("."));
          const fileType = getMimeType(file);
          const blob = new Blob([file as BlobPart], {
            type: fileType,
          });
          await set(getCustomAudioKey(sku, type), { blob });
          customCount++;
          continue;
        }

        const numMatches = file.name.match(/\d+/g);
        if (numMatches) {
          // Assume the last number in filename is the line index (e.g. 100-4.wav or 4.wav)
          const lineNum = parseInt(numMatches[numMatches.length - 1]);

          // Find the line in current dialogue that has this displayIndex
          const line = latestDialogue.find((d) => d.displayIndex === lineNum);

          if (line) {
            const fileType = getMimeType(file);
            const blob = new Blob([file as BlobPart], {
              type: fileType,
            });
            const newState = {
              status: "done" as const,
              blob: blob,
              downloaded: true,
              text: line.text,
            };

            await set(getDialogueCachedKey(getSkuForLine(line, sku), line.id), newState);
            newStates[line.id] = newState;
            matchCount++;
          }
        }
      }

      if (matchCount > 0 || customCount > 0) {
        updateStates(() => newStates);
        let msg = "";
        if (matchCount > 0)
          msg += `Successfully matched ${matchCount} audio clips to your dialogue lines. `;
        if (customCount > 0)
          msg += `Uploaded ${customCount} custom button audio files.`;
        alert(msg);
      } else {
        alert(
          "No matching line numbers found in filenames. Please ensure filenames contain the line number (e.g., '13.wav').",
        );
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error during audio files upload parsing. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      // Clear input
      if (uploadFilesRef.current) uploadFilesRef.current.value = "";
    }
  };

  const handleNewPodcast = () => {
    setRawText("");
    setDialogue([]);
    updateDialogue([]);
    updateStates(() => ({}));
    localStorage.removeItem("podcast_raw_text");
    localStorage.removeItem("podcast_dialogue");
    localStorage.removeItem("podcast_voices");
    setUserLiked(true);
    setUserSubscribed(false);
    setUserSaved(true);
    setView("input");
  };

  const previewIntroOnly = () => {
    localStorage.setItem("tts_podcast_instructions", voiceInstructions);
    const lines = rawText.split("\n").filter((l) => l.trim().includes(":"));
    const parsed: DialogueLine[] = lines
      .map((l, i) => {
        const lineText = l.trim();
        const numMatch = lineText.match(/^(?:(\d+)-)?(\d+)[.\s]+/);

        if (!numMatch) return null;

        let speaker = "";
        let text = "";
        let lineNum = i + 1;
        let lineSku: string | undefined = undefined;

        if (numMatch) {
          lineSku = numMatch[1];
          lineNum = parseInt(numMatch[2]);
          const cleanedLine = lineText.substring(numMatch[0].length);
          const colonIdx = cleanedLine.indexOf(":");
          if (colonIdx !== -1) {
            speaker = cleanedLine.substring(0, colonIdx).trim();
            text = cleanedLine.substring(colonIdx + 1).trim();
          }
        }

        return {
          id: `line-${i}-${lineNum}`,
          speaker: speaker || "Unknown",
          text: text,
          displayIndex: lineNum,
          sku: lineSku,
        };
      })
      .filter((d): d is DialogueLine => d !== null && d.text.trim() !== "");

    updateDialogue(parsed);
    const uniqueSpeakers = Array.from(new Set(parsed.map((p) => p.speaker)));
    const initialMapping: Record<string, string> = { ...speakerVoicesRef.current };
    const STATIC_VOICES: Record<string, string> = {
      Emma: "Zephyr",
      Ethan: "Charon",
    };
    uniqueSpeakers.forEach((s, i) => {
      if (!initialMapping[s]) {
        initialMapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
      }
    });
    updateSpeakerVoices(initialMapping);

    setIntroResetCounter((prev) => prev + 1);
    setIsIntroPreviewOnly(true);
    setCurrentLineIndex(-1);
    setCurrentWordIndex(-1);
    setIsPaused(false);
    isPausedRef.current = false;
    setIsPlaybackFinished(false);
    setVideoIntroPhase(0);
    setIntroStarted(true);

    setView("video");
  };

  const parseDialogue = () => {
    localStorage.setItem("tts_podcast_instructions", voiceInstructions);
    const lines = rawText.split("\n").filter((l) => l.trim().includes(":"));
    const parsed: DialogueLine[] = lines
      .map((l, i) => {
        const lineText = l.trim();
        const numMatch = lineText.match(/^(?:(\d+)-)?(\d+)[.\s]+/);

        if (!numMatch) return null;

        let speaker = "";
        let text = "";
        let lineNum = i + 1;
        let lineSku: string | undefined = undefined;

        if (numMatch) {
          lineSku = numMatch[1];
          lineNum = parseInt(numMatch[2]);
          const cleanedLine = lineText.substring(numMatch[0].length);
          const colonIdx = cleanedLine.indexOf(":");
          if (colonIdx !== -1) {
            speaker = cleanedLine.substring(0, colonIdx).trim();
            text = cleanedLine.substring(colonIdx + 1).trim();
          }
        }

        return {
          id: `line-${i}-${lineNum}`, // Unique ID using index to avoid collisions
          speaker: speaker || "Unknown",
          text: text,
          displayIndex: lineNum,
          sku: lineSku,
        };
      })
      .filter((d): d is DialogueLine => d !== null && d.text.trim() !== "");

    if (parsed.length === 0) return;

    updateDialogue(parsed);
    const uniqueSpeakers = Array.from(new Set(parsed.map((p) => p.speaker)));
    const initialMapping: Record<string, string> = { ...speakerVoicesRef.current };

    // Static mapping as requested
    const STATIC_VOICES: Record<string, string> = {
      Emma: "Zephyr",
      Ethan: "Charon",
    };

    uniqueSpeakers.forEach((s, i) => {
      if (!initialMapping[s]) {
        initialMapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
      }
    });

    updateSpeakerVoices(initialMapping);
    setView("setup");
  };

  const startBatch = async () => {
    // Save project metadata
    localStorage.setItem("podcast_raw_text", rawText);
    localStorage.setItem("podcast_dialogue", JSON.stringify(dialogue));
    localStorage.setItem("podcast_voices", JSON.stringify(speakerVoices));

    const newStates: MatrixState = {};
    for (const line of dialogue) {
      const cached = await get(getDialogueCachedKey(getSkuForLine(line, sku), line.id));
      if (
        cached &&
        cached.status === "done" &&
        (cached.text === line.text || !cached.hasOwnProperty("text"))
      ) {
        newStates[line.id] = cached;
      } else {
        newStates[line.id] = { status: "idle", downloaded: false };
      }
    }
    statesRef.current = newStates;
    setStates(newStates);

    queueRef.current = dialogue
      .filter((d, i) => newStates[d.id].status !== "done")
      .map((d) => ({ id: d.id, retryCount: 0 }));

    setIsQueueRunning(queueRef.current.length > 0);
    setView("generating");
    if (queueRef.current.length > 0) processNextInQueue();
  };

  const processNextInQueue = async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      if (queueRef.current.length === 0) setIsQueueRunning(false);
      return;
    }

    isProcessingRef.current = true;
    const task = queueRef.current[0];
    const line = dialogueRef.current.find((d) => d.id === task.id);
    if (!line) {
      isProcessingRef.current = false;
      queueRef.current.shift();
      processNextInQueue();
      return;
    }
    const voice = speakerVoicesRef.current[line.speaker];

    updateStates((prev) => ({
      ...prev,
      [task.id]: { ...prev[task.id], status: "generating", error: undefined },
    }));

    try {
      if (!line.text.trim()) {
        throw new Error("Text is empty for this line");
      }
      if (!voice) {
        throw new Error(`No voice assigned for speaker: "${line.speaker}"`);
      }

      const result = await generateTTS(line.text, voice, voiceInstructions);
      const newState = {
        status: "done" as const,
        blob: result.blob,
        downloaded: true,
        text: line.text,
      };
      updateStates((prev) => ({
        ...prev,
        [task.id]: newState,
      }));

      // Save to IndexedDB for persistence
      set(getDialogueCachedKey(getSkuForLine(line, sku), task.id), newState);

      // Auto-download as requested
      downloadLine(
        task.id,
        dialogueRef.current.findIndex((d) => d.id === task.id),
        result.blob,
      );

      queueRef.current.shift();

      if (queueRef.current.length > 0) {
        startCooldown();
      } else {
        setIsQueueRunning(false);
      }
    } catch (err: any) {
      console.error("Batch error for line:", task.id, err);
      const errMessage = err.message || String(err);
      const isRateLimit =
        errMessage.includes("429") ||
        errMessage.toLowerCase().includes("quota") ||
        errMessage.toLowerCase().includes("rate limit") ||
        errMessage.toLowerCase().includes("resource_exhausted");

      updateStates((prev) => ({
        ...prev,
        [task.id]: {
          ...prev[task.id],
          status: "error",
          error: isRateLimit ? "API Limit Reached" : errMessage,
        },
      }));

      if (isRateLimit) {
        // Stop the queue entirely on rate limit
        setIsQueueRunning(false);
        queueRef.current = [];
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
      } else {
        // For other errors, continue to next
        queueRef.current.shift();
        if (queueRef.current.length > 0) startCooldown();
        else setIsQueueRunning(false);
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  const startCooldown = () => {
    setCountdown(PROJECT_COOLDOWN_SEC);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev !== null && prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          processNextInQueue();
          return null;
        }
        return prev !== null ? prev - 1 : null;
      });
    }, 1000);
  };

  const startIntroCountdown = () => {
    if (countdownIntervalRef.current) return;
    setIntroCountdown(3);
    countdownIntervalRef.current = window.setInterval(() => {
      setIntroCountdown((prev) => {
        if (prev === null) {
          if (countdownIntervalRef.current)
            clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          return null;
        }
        if (prev === 3) return 2;
        if (prev === 2) return 1;
        if (prev === 1) {
          if (countdownIntervalRef.current)
            clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          
          if (introDelayTimeoutRef.current) {
            clearTimeout(introDelayTimeoutRef.current);
          }
          introDelayTimeoutRef.current = window.setTimeout(() => {
            introDelayTimeoutRef.current = null;
            startPlayback(0);
          }, 1000);
          
          return "START";
        }
        return null;
      });
    }, 1000);
  };

  const playPodcast = async () => {
    setIsIntroPreviewOnly(false);
    setCurrentLineIndex(-1);
    setCurrentWordIndex(-1);
    setIsPaused(false);
    isPausedRef.current = false;
    setIsPlaybackFinished(false);
    setVideoIntroPhase(0);
    setOutroStep(0);
    setUserLiked(true);
    setUserSubscribed(false);
    setUserSaved(true);
    setShowSubscribeTooltip(false);
    setShowLikeTooltip(false);
    setShowSaveTooltip(false);
    setIntroCountdown(null);
    setIntroStarted(false);
    setEnglishPodcastHuge(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (introDelayTimeoutRef.current) {
      clearTimeout(introDelayTimeoutRef.current);
      introDelayTimeoutRef.current = null;
    }
    setView("video");
  };

  const startPlayback = (index: number) => {
    setIsPaused(false);
    isPausedRef.current = false;
    setIntroStarted(true);
    if (index === 0) {
      setIsPlaybackFinished(false);
      setOutroStep(0);
      setIntroCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (introDelayTimeoutRef.current) {
        clearTimeout(introDelayTimeoutRef.current);
        introDelayTimeoutRef.current = null;
      }
    }

    stopAndCleanupAudio();

    if (index >= dialogue.length) {
      setCurrentLineIndex(-1);
      setCurrentWordIndex(-1);
      return;
    }

    const line = dialogue[index];
    const state = states[line.id];
    if (!state?.blob) {
      // Direct layout play simulator for lines with no matched audio file
      setCurrentLineIndex(index);
      setCurrentWordIndex(-1);

      const words = line.text.split(/\s+/);
      const wordCount = words.length;
      const durationMs = Math.max(1500, Math.min(4000, wordCount * 330));

      const startSimulatedPlayback = () => {
        if (isPausedRef.current) return;
        const startTime = Date.now();

        const updateTiming = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(1, elapsed / durationMs);
          const totalChars = line.text.length;
          const processedChars = progress * totalChars;

          let charSum = 0;
          let wordIdx = 0;
          for (let i = 0; i < words.length; i++) {
            charSum += words[i].length + 1;
            if (charSum > processedChars) {
              wordIdx = i;
              break;
            }
            wordIdx = i;
          }
          setCurrentWordIndex(wordIdx);
        };

        updateTiming();
        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = window.setInterval(() => {
          updateTiming();
          if (Date.now() - startTime >= durationMs) {
            if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
            if (index + 1 < dialogue.length) {
              setTimeout(() => startPlayback(index + 1), 200);
            } else {
              setCurrentLineIndex(-1);
              setCurrentWordIndex(-1);
              setIsPaused(false);
              isPausedRef.current = false;
              setIsPlaybackFinished(true);
              setOutroStep(0);
            }
          }
        }, 40);
      };

      if (index === 0) {
        if (firstLineAudioDelayTimeoutRef.current) {
          clearTimeout(firstLineAudioDelayTimeoutRef.current);
        }
        firstLineAudioDelayTimeoutRef.current = window.setTimeout(() => {
          firstLineAudioDelayTimeoutRef.current = null;
          startSimulatedPlayback();
        }, 500);
      } else {
        startSimulatedPlayback();
      }
      return;
    }

    setCurrentLineIndex(index);
    setCurrentWordIndex(-1);

    const url = URL.createObjectURL(state.blob);
    activeAudioUrlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;

    let hasStartedThisLine = false;
    const startActualPlayback = () => {
      if (hasStartedThisLine) return;
      hasStartedThisLine = true;

      if (isPausedRef.current) return;
      audio.play().catch((e) => console.error("Audio playback failed:", e));

      const updateTiming = () => {
        if (!audioRef.current) return;

        const duration = audioRef.current.duration;
        const currentTime = audioRef.current.currentTime;
        if (!duration || duration === 0) return;

        // 1. Progress by characters (linearly interpolated by char count)
        const effectiveProgress = Math.max(
          0,
          Math.min(1, (currentTime + timingOffset / 1000) / duration),
        );

        // 2. Search for word index based on processed characters
        const text = line.text;
        const totalChars = text.length;
        const processedChars = effectiveProgress * totalChars;

        const words = text.split(/\s+/);
        let charSum = 0;
        let wordIdx = 0;

        for (let i = 0; i < words.length; i++) {
          // Each word length + 1 for the space between words
          charSum += words[i].length + 1;
          if (charSum > processedChars) {
            wordIdx = i;
            break;
          }
          wordIdx = i; // Fallback to last word if we exhaust the list
        }

        setCurrentWordIndex(wordIdx);
      };

      updateTiming(); // Run once immediately
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = window.setInterval(updateTiming, 40); // Slightly more frequent updates
    };

    const triggerLinePlayback = () => {
      if (isPausedRef.current) {
        audio.pause();
        return;
      }
      if (index === 0) {
        if (firstLineAudioDelayTimeoutRef.current) {
          clearTimeout(firstLineAudioDelayTimeoutRef.current);
        }
        firstLineAudioDelayTimeoutRef.current = window.setTimeout(() => {
          firstLineAudioDelayTimeoutRef.current = null;
          startActualPlayback();
        }, 500);
      } else {
        startActualPlayback();
      }
    };

    audio.oncanplaythrough = triggerLinePlayback;
    audio.oncanplay = triggerLinePlayback;
    audio.onloadeddata = triggerLinePlayback;

    if (audio.readyState >= 2) {
      triggerLinePlayback();
    } else {
      // Fallback timer if events don't fire for Blob object URLs
      setTimeout(() => {
        if (!hasStartedThisLine) {
          triggerLinePlayback();
        }
      }, 100);
    }

    audio.onended = () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      stopAndCleanupAudio();
      if (index + 1 < dialogue.length) {
        setTimeout(() => startPlayback(index + 1), 200);
      } else {
        setCurrentLineIndex(-1);
        setCurrentWordIndex(-1);
        setIsPaused(false);
        isPausedRef.current = false;
        setIsPlaybackFinished(true);
        setOutroStep(0);
      }
    };
  };

  const togglePlayPause = () => {
    if (view !== "video") return;

    if (introCountdown !== null || introDelayTimeoutRef.current !== null) {
      setIntroCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (introDelayTimeoutRef.current) {
        clearTimeout(introDelayTimeoutRef.current);
        introDelayTimeoutRef.current = null;
      }
      setIsIntroPreviewOnly(true);
      return;
    }

    if (currentLineIndex === -1) {
      if (!introStarted) {
        setIntroStarted(true);
        return;
      }
      setIsIntroPreviewOnly(false);
      startIntroCountdown();
      return;
    }

    if (isPausedRef.current) {
      // Resume
      isPausedRef.current = false;
      setIsPaused(false);

      if (audioRef.current) {
        audioRef.current.play();

        // Recreate the updates interval
        const line = dialogue[currentLineIndex];
        const updateTiming = () => {
          if (!audioRef.current) return;
          const duration = audioRef.current.duration;
          const currentTime = audioRef.current.currentTime;
          if (!duration || duration === 0) return;
          const effectiveProgress = Math.max(
            0,
            Math.min(1, (currentTime + timingOffset / 1000) / duration),
          );
          const text = line.text;
          const totalChars = text.length;
          const processedChars = effectiveProgress * totalChars;
          const words = text.split(/\s+/);
          let charSum = 0;
          let wordIdx = 0;
          for (let i = 0; i < words.length; i++) {
            charSum += words[i].length + 1;
            if (charSum > processedChars) {
              wordIdx = i;
              break;
            }
            wordIdx = i;
          }
          setCurrentWordIndex(wordIdx);
        };
        if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = window.setInterval(updateTiming, 40);
      } else {
        // Simulated playback resume - restart current simulated line from top
        startPlayback(currentLineIndex);
      }
    } else {
      // Pause
      isPausedRef.current = true;
      setIsPaused(true);
      if (firstLineAudioDelayTimeoutRef.current) {
        clearTimeout(firstLineAudioDelayTimeoutRef.current);
        firstLineAudioDelayTimeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(
          `Error attempting to enable full-screen mode: ${err.message}`,
        );
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error(
          `Error attempting to exit full-screen mode: ${err.message}`,
        );
      });
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => {
      const isNowFull = !!document.fullscreenElement;
      setIsFullScreen(isNowFull);
      if (view === "video") {
        setHideUI(isNowFull);
      }
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, [view]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive =
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLInputElement;

      if (e.key === "Escape") setHideUI(false);
      if (e.key === "F2") {
        e.preventDefault();
        toggleFullScreen();
      }
      if (e.key === "c" || e.key === "C" || e.key === "Backspace") {
        if (view === "video" && !isInputActive) {
          setDrawings([]);
        }
      }
      if (e.key === " " || e.code === "Space") {
        if (view === "video" && !isInputActive) {
          e.preventDefault();
          togglePlayPause();
        } else if (view === "generating" && !isInputActive) {
          e.preventDefault();
          toggleAutoPlay();
        }
      }

      // Hotkeys on Main Input Screen:
      // 1 = switch to checklist mode
      // 2 = switch to YT presentation mode
      if (view === "input" && !isInputActive) {
        if (e.key === "1") {
          e.preventDefault();
          handleSwitchToChecklist();
        } else if (e.key === "2") {
          e.preventDefault();
          handleBypassToVideo();
        }
      }

      // Hotkeys in Checklist Selection Mode:
      // 2 = toggle checkbox for current dialogue line
      // 3 = next dialogue line and play audio
      // 4 / Space = toggle AUTO sequence play
      if (view === "generating" && !isInputActive) {
        if (e.key === "2") {
          e.preventDefault();
          if (dialogue.length > 0) {
            const currentLine = dialogue[focusedLineIndex] || dialogue[0];
            if (currentLine) {
              toggleSelectLine(currentLine.id);
            }
          }
        } else if (e.key === "3") {
          e.preventDefault();
          stopAutoPlay();
          handleNextInChecklist();
        } else if (e.key === "4") {
          e.preventDefault();
          toggleAutoPlay();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    view,
    dialogue,
    states,
    currentLineIndex,
    isPaused,
    introCountdown,
    introStarted,
    focusedLineIndex,
    rawText,
    sku,
    speakerVoices,
    voiceInstructions,
  ]);

  useEffect(() => {
    // Try to load session on mount
    loadPreviousSession();

    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const loadPreviousSession = async () => {
    const savedText = localStorage.getItem("podcast_raw_text");
    const savedSku = localStorage.getItem("podcast_sku");
    const savedDialogue = localStorage.getItem("podcast_dialogue");
    const savedVoices = localStorage.getItem("podcast_voices");

    if (savedText) setRawText(savedText);
    if (savedSku) setSku(savedSku);

    if (savedDialogue) {
      const parsedDialogue: DialogueLine[] = JSON.parse(savedDialogue);
      updateDialogue(parsedDialogue);

      if (savedVoices) updateSpeakerVoices(JSON.parse(savedVoices));

      // Load states from IndexedDB
      const newStates: MatrixState = {};
      const currentSkuVal = savedSku || sku || "global";
      for (const line of parsedDialogue) {
        const cached = await get(getDialogueCachedKey(getSkuForLine(line, currentSkuVal), line.id));
        if (
          cached &&
          (cached.text === line.text || !cached.hasOwnProperty("text"))
        ) {
          newStates[line.id] = cached;
        }
      }
      statesRef.current = newStates;
      setStates(newStates);
    }
  };

  const downloadLine = (id: string, index: number, providedBlob?: Blob) => {
    const state = statesRef.current[id];
    const line = dialogueRef.current[index];
    const blob = providedBlob || state?.blob;

    if (blob && line) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Use the actual number from the dialogue (displayIndex)
      const fileNum = line.displayIndex;
      const finalSku = getSkuForLine(line, sku);
      a.download = `${finalSku}-${fileNum}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const hasPlayedFirstInChecklistRef = useRef(false);

  const playLine = async (id: string, onEndCallback?: () => void) => {
    const line = dialogue.find((d) => d.id === id);
    let state = statesRef.current[id] || states[id];
    let blob = state?.blob;

    if (!blob && line) {
      const effectiveSku = getSkuForLine(line, sku);
      const cached = await get(getDialogueCachedKey(effectiveSku, line.id));
      if (cached?.blob) {
        blob = cached.blob;
        updateStates((prev) => ({ ...prev, [id]: cached }));
      }
    }

    if (blob) {
      stopAndCleanupAudio();
      setIsPlayingChecklistAudio(true);
      const url = URL.createObjectURL(blob);
      activeAudioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsPlayingChecklistAudio(false);
        stopAndCleanupAudio();
        if (onEndCallback) onEndCallback();
      };
      audio.onerror = () => {
        setIsPlayingChecklistAudio(false);
        stopAndCleanupAudio();
        if (onEndCallback) onEndCallback();
      };
      audio.play().catch((e) => {
        console.error("Play line failed:", e);
        setIsPlayingChecklistAudio(false);
        if (onEndCallback) onEndCallback();
      });
    } else {
      setIsPlayingChecklistAudio(false);
      if (onEndCallback) onEndCallback();
    }
  };

  const playLineAutoSequence = (index: number) => {
    if (!isAutoPlayActiveRef.current) return;
    if (index >= dialogue.length) {
      stopAutoPlay();
      return;
    }

    setFocusedLineIndex(index);
    const targetLine = dialogue[index];
    if (!targetLine) {
      stopAutoPlay();
      return;
    }

    const el = document.getElementById(`line-item-${targetLine.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    playLine(targetLine.id, () => {
      if (isAutoPlayActiveRef.current) {
        autoPlayTimeoutRef.current = window.setTimeout(() => {
          if (isAutoPlayActiveRef.current) {
            const nextIndex = index + 1;
            if (nextIndex < dialogue.length) {
              playLineAutoSequence(nextIndex);
            } else {
              stopAutoPlay();
            }
          }
        }, 1000); // 1 sec interval between lines
      }
    });
  };

  const toggleAutoPlay = () => {
    if (isAutoPlayActiveRef.current) {
      stopAutoPlay();
      stopAndCleanupAudio();
      setIsPlayingChecklistAudio(false);
    } else {
      isAutoPlayActiveRef.current = true;
      setIsAutoPlayActive(true);
      hasPlayedFirstInChecklistRef.current = true;
      const startIdx = focusedLineIndex >= 0 && focusedLineIndex < dialogue.length ? focusedLineIndex : 0;
      playLineAutoSequence(startIdx);
    }
  };

  const handleNextInChecklist = () => {
    if (dialogue.length === 0) return;

    let targetIndex = 0;
    if (!hasPlayedFirstInChecklistRef.current) {
      targetIndex = focusedLineIndex >= 0 && focusedLineIndex < dialogue.length ? focusedLineIndex : 0;
      hasPlayedFirstInChecklistRef.current = true;
    } else {
      targetIndex = (focusedLineIndex + 1) % dialogue.length;
    }

    setFocusedLineIndex(targetIndex);
    const targetLine = dialogue[targetIndex];
    if (targetLine) {
      const el = document.getElementById(`line-item-${targetLine.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      playLine(targetLine.id);
    }
  };

  const handleBypassToVideo = async () => {
    // 1. Ensure dialogue is parsed if we are in 'input' view
    let currentDialogue = dialogue;
    if (view === "input") {
      if (!rawText.trim()) return;

      const { parsedDialogue, parsedSku } = parseScriptAndMetadata(rawText, sku);
      if (parsedSku) {
        setSku(parsedSku);
        localStorage.setItem("podcast_sku", parsedSku);
      }

      if (parsedDialogue.length === 0) return;

      currentDialogue = parsedDialogue;
      updateDialogue(parsedDialogue);

      // Auto-assign voices if empty
      const uniqueSpeakers = Array.from(new Set(parsedDialogue.map((p) => p.speaker)));
      const mapping = { ...speakerVoicesRef.current };
      const STATIC_VOICES: Record<string, string> = {
        Emma: "Zephyr",
        Ethan: "Charon",
      };
      uniqueSpeakers.forEach((s, i) => {
        if (!mapping[s])
          mapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
      });
      updateSpeakerVoices(mapping);
    }

    if (currentDialogue.length === 0) return;

    // 2. Refresh states from IndexedDB if needed
    const newStates: Record<string, any> = { ...statesRef.current };
    for (const line of currentDialogue) {
      if (
        !newStates[line.id] ||
        newStates[line.id].status !== "done" ||
        newStates[line.id].text !== line.text
      ) {
        const cached = await get(getDialogueCachedKey(getSkuForLine(line, sku), line.id));
        if (
          cached &&
          cached.status === "done" &&
          (cached.text === line.text || !cached.hasOwnProperty("text"))
        ) {
          newStates[line.id] = cached;
        } else {
          newStates[line.id] = { status: "idle", downloaded: false };
        }
      }
    }
    updateStates(() => newStates);

    // Save session data
    localStorage.setItem("podcast_raw_text", rawText);
    localStorage.setItem("podcast_sku", sku);
    localStorage.setItem("podcast_dialogue", JSON.stringify(currentDialogue));
    localStorage.setItem("podcast_voices", JSON.stringify(speakerVoices));

    // Switch to video directly bypassing startBatch generations
    setCurrentLineIndex(-1);
    setCurrentWordIndex(-1);
    setIsPaused(false);
    isPausedRef.current = false;
    updateDialogueFont("Inter");
    setEnglishPodcastHuge(false);
    setIntroStarted(false);
    setIsIntroPreviewOnly(false);
    setView("video");
  };

  const handleSwitchToChecklist = async () => {
    let currentDialogue = dialogue;
    if (view === "input") {
      if (!rawText.trim()) return;

      const { parsedDialogue, parsedSku } = parseScriptAndMetadata(rawText, sku);
      if (parsedSku) {
        setSku(parsedSku);
        localStorage.setItem("podcast_sku", parsedSku);
      }

      if (parsedDialogue.length === 0) return;

      currentDialogue = parsedDialogue;
      updateDialogue(parsedDialogue);

      // Auto-assign voices if empty
      const uniqueSpeakers = Array.from(new Set(parsedDialogue.map((p) => p.speaker)));
      const mapping = { ...speakerVoicesRef.current };
      const STATIC_VOICES: Record<string, string> = {
        Emma: "Zephyr",
        Ethan: "Charon",
      };
      uniqueSpeakers.forEach((s, i) => {
        if (!mapping[s])
          mapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
      });
      updateSpeakerVoices(mapping);
    }

    if (currentDialogue.length === 0) return;

    // Refresh states from IndexedDB
    const newStates: Record<string, any> = { ...statesRef.current };
    for (const line of currentDialogue) {
      if (
        !newStates[line.id] ||
        newStates[line.id].status !== "done" ||
        newStates[line.id].text !== line.text
      ) {
        const cached = await get(getDialogueCachedKey(getSkuForLine(line, sku), line.id));
        if (
          cached &&
          cached.status === "done" &&
          (cached.text === line.text || !cached.hasOwnProperty("text"))
        ) {
          newStates[line.id] = cached;
        } else {
          newStates[line.id] = { status: "idle", downloaded: false };
        }
      }
    }
    updateStates(() => newStates);

    localStorage.setItem("podcast_raw_text", rawText);
    localStorage.setItem("podcast_sku", sku);
    localStorage.setItem("podcast_dialogue", JSON.stringify(currentDialogue));
    localStorage.setItem("podcast_voices", JSON.stringify(speakerVoices));

    hasPlayedFirstInChecklistRef.current = false;
    setFocusedLineIndex(0);
    setView("generating");
  };

  const handleNextFromChecklist = () => {
    if (dialogue.length === 0) return;
    stopAndCleanupAudio();
    setIsIntroPreviewOnly(false);
    setCurrentLineIndex(0);
    setCurrentWordIndex(-1);
    setIsPaused(false);
    isPausedRef.current = false;
    setIsPlaybackFinished(false);
    setVideoIntroPhase(0);
    setOutroStep(0);
    setUserLiked(true);
    setUserSubscribed(false);
    setUserSaved(true);
    setIntroCountdown(null);
    setIntroStarted(true);
    setEnglishPodcastHuge(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (introDelayTimeoutRef.current) {
      clearTimeout(introDelayTimeoutRef.current);
      introDelayTimeoutRef.current = null;
    }
    setView("video");
    startPlayback(0);
  };

  const handleQuickStart = async () => {
    // Automatically clear audio cache for safety when Start is clicked
    try {
      await clear();
      updateStates(() => ({}));
      console.log("Audio cache cleared upon Start click.");
    } catch (e) {
      console.error(e);
    }

    // 1. Ensure dialogue is parsed if we are in 'input' view
    let currentDialogue = dialogue;
    if (view === "input") {
      if (!rawText.trim()) return;

      const { parsedDialogue, parsedSku } = parseScriptAndMetadata(rawText, sku);
      if (parsedSku) {
        setSku(parsedSku);
        localStorage.setItem("podcast_sku", parsedSku);
      }

      if (parsedDialogue.length === 0) return;

      currentDialogue = parsedDialogue;
      updateDialogue(parsedDialogue);

      // Auto-assign voices if empty
      const uniqueSpeakers = Array.from(new Set(parsedDialogue.map((p) => p.speaker)));
      const mapping = { ...speakerVoicesRef.current };
      const STATIC_VOICES: Record<string, string> = {
        Emma: "Zephyr",
        Ethan: "Charon",
      };
      uniqueSpeakers.forEach((s, i) => {
        if (!mapping[s])
          mapping[s] = STATIC_VOICES[s] || VOICES[i % VOICES.length];
      });
      updateSpeakerVoices(mapping);
    }

    if (currentDialogue.length === 0) return;

    // 2. Refresh states from IndexedDB if needed
    const newStates: MatrixState = { ...statesRef.current };
    for (const line of currentDialogue) {
      if (
        !newStates[line.id] ||
        newStates[line.id].status !== "done" ||
        newStates[line.id].text !== line.text
      ) {
        const cached = await get(getDialogueCachedKey(getSkuForLine(line, sku), line.id));
        if (
          cached &&
          cached.status === "done" &&
          (cached.text === line.text || !cached.hasOwnProperty("text"))
        ) {
          newStates[line.id] = cached;
        } else {
          newStates[line.id] = { status: "idle", downloaded: false };
        }
      }
    }
    updateStates(() => newStates);

    // 3. Determine next view
    const allDone = currentDialogue.every(
      (d) => newStates[d.id]?.status === "done",
    );

    if (allDone) {
      // Save session data
      localStorage.setItem("podcast_raw_text", rawText);
      localStorage.setItem("podcast_sku", sku);
      localStorage.setItem("podcast_dialogue", JSON.stringify(currentDialogue));
      localStorage.setItem("podcast_voices", JSON.stringify(speakerVoices));

      playPodcast();
    } else {
      // Go to generating and start queue
      localStorage.setItem("podcast_raw_text", rawText);
      localStorage.setItem("podcast_sku", sku);
      localStorage.setItem("podcast_dialogue", JSON.stringify(currentDialogue));
      localStorage.setItem("podcast_voices", JSON.stringify(speakerVoices));

      queueRef.current = currentDialogue
        .filter((d, i) => newStates[d.id].status !== "done")
        .map((d) => ({ id: d.id, retryCount: 0 }));

      setIsQueueRunning(queueRef.current.length > 0);
      hasPlayedFirstInChecklistRef.current = false;
      setFocusedLineIndex(0);
      setView("generating");
      if (queueRef.current.length > 0) processNextInQueue();
    }
  };

  return (
    <div className="min-h-screen bg-[#05060b] text-slate-200 font-sans selection:bg-purple-500/30 selection:text-white relative overflow-x-hidden">
      {/* Mesh Gradient Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[100px] pointer-events-none"></div>
      <div className="fixed top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none"></div>

      {/* Global Background Dot Grid */}
      <div className="fixed inset-0 dot-grid opacity-[0.03] pointer-events-none" />

      {/* Hidden File Inputs */}
      <input
        type="file"
        multiple
        accept="audio/*"
        className="hidden"
        ref={uploadFilesRef}
        onChange={handleBulkUpload}
      />
      <input
        type="file"
        className="hidden"
        ref={uploadFolderRef}
        onChange={handleFolderUpload}
        {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
      />
      <input
        type="file"
        accept=".txt,.md"
        className="hidden"
        ref={scriptUploadRef}
        onChange={handleScriptUpload}
      />

      <div className="max-w-4xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        {view !== "input" && (
          <header className="mb-12 flex items-center justify-end px-8 py-6 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl">
            <div className="flex gap-4">
              <button
                onClick={handleBypassToVideo}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-xl text-sm font-medium hover:bg-purple-500/20 hover:text-white transition-all backdrop-blur-sm shadow-xl cursor-pointer"
                title="Watch Video Directly"
              >
                <Monitor size={16} /> YT Presentation
              </button>
              <button
                onClick={handleNewPodcast}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm cursor-pointer"
              >
                <ArrowLeft size={16} /> New Podcast
              </button>
            </div>
          </header>
        )}

        {view === "input" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-xl shadow-2xl">
              <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {/* START BUTTON with text */}
                  <button
                    onClick={handleQuickStart}
                    disabled={!rawText.trim() || isUploading}
                    className="group relative px-5 py-2.5 bg-white text-black rounded-xl font-bold text-xs transition-all shadow-lg hover:shadow-purple-500/20 active:scale-95 flex items-center gap-2 overflow-hidden whitespace-nowrap disabled:opacity-50 cursor-pointer"
                  >
                    <span className="relative z-10 font-extrabold tracking-wider uppercase">
                      START
                    </span>
                    <Sparkles
                      className="relative z-10 text-purple-600 animate-pulse"
                      size={14}
                    />
                  </button>

                  <div className="h-6 w-[1px] bg-white/10 mx-1 hidden sm:block" />

                  {/* UPLOAD (Folder & files) */}
                  <button
                    onClick={() => !isUploading && (uploadFolderRef.current?.click() || uploadFilesRef.current?.click())}
                    disabled={isUploading}
                    className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Загрузить папку (txt диалог + wav аудио)"
                  >
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin text-orange-400" />
                    ) : (
                      <FolderUp size={16} />
                    )}
                  </button>

                  {/* WATCH YT (icon only) */}
                  <button
                    onClick={handleBypassToVideo}
                    disabled={!rawText.trim() || isUploading}
                    className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Watch video directly, bypassing all generations (горячая клавиша 2)"
                  >
                    <Monitor size={16} />
                  </button>

                  {/* CHECKLIST MODE BUTTON */}
                  <button
                    onClick={handleSwitchToChecklist}
                    disabled={!rawText.trim() || isUploading}
                    className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Открыть список строк с галками (горячая клавиша 1)"
                  >
                    <CheckSquare size={16} />
                  </button>

                  {/* TEST OUTRO (icon only) */}
                  <button
                    onClick={previewEndScreen}
                    className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                    title="Test outro screen (Иконка Test Outro)"
                  >
                    <EyeOff size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  {/* PREVIEW INTRO (icon only, indigo) */}
                  <button
                    onClick={() => {
                      setEnglishPodcastHuge(false);
                      previewIntroOnly();
                    }}
                    disabled={isUploading}
                    className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all text-indigo-400 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Preview Intro Screen (Первый глазик)"
                  >
                    <Eye size={16} />
                  </button>

                  {/* PREVIEW INTRO HUGE (icon only, amber) */}
                  <button
                    onClick={() => {
                      setEnglishPodcastHuge(true);
                      previewIntroOnly();
                    }}
                    disabled={isUploading}
                    className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all text-amber-400 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Preview with HUGE Title (Второй глазик - растянутый ENGLISH PODCAST)"
                  >
                    <Eye size={16} className="stroke-[2.5]" />
                  </button>

                  {/* CLEAR TEXT (icon only, slate) */}
                  <button
                    onClick={() => !isUploading && setRawText("")}
                    disabled={isUploading}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-slate-400 hover:text-red-400 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    title="Clear text"
                  >
                    <Eraser size={16} />
                  </button>
                </div>
              </div>

              {/* RELOCATED SPEAKER VOICE SELECTION & INTRO TITLE SETTINGS */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl bg-black/25 border border-white/5 rounded-2xl p-4">
                {/* Ethan Voice Selection */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 select-none">
                    <User size={13} className="text-purple-400" />
                    <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Ethan (Speaker 1)</span>
                  </div>
                  <select
                    value={speakerVoices["Ethan"] || "Charon"}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      const updated = {
                        ...speakerVoices,
                        Ethan: newVal,
                      };
                      updateSpeakerVoices(updated);
                      localStorage.setItem("podcast_voices", JSON.stringify(updated));
                    }}
                    className="bg-white/5 text-xs border border-white/10 rounded-xl px-3 py-2 focus:ring-1 ring-purple-500 outline-none cursor-pointer hover:bg-white/10 transition-colors text-white"
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v} className="bg-neutral-900">
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Emma Voice Selection */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 select-none">
                    <User size={13} className="text-pink-400" />
                    <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Emma (Speaker 2)</span>
                  </div>
                  <select
                    value={speakerVoices["Emma"] || "Zephyr"}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      const updated = {
                        ...speakerVoices,
                        Emma: newVal,
                      };
                      updateSpeakerVoices(updated);
                      localStorage.setItem("podcast_voices", JSON.stringify(updated));
                    }}
                    className="bg-white/5 text-xs border border-white/10 rounded-xl px-3 py-2 focus:ring-1 ring-pink-500 outline-none cursor-pointer hover:bg-white/10 transition-colors text-white"
                  >
                    {VOICES.map((v) => (
                      <option key={v} value={v} className="bg-neutral-900">
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Intro Title Font Size */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <Type size={13} className="text-purple-400" />
                      <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Размер темы Интро</span>
                    </div>
                    <span className="text-xs font-mono text-purple-400 font-bold">{introTitleFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="240"
                    step="5"
                    value={introTitleFontSize}
                    onChange={(e) => updateIntroTitleFontSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-full appearance-none accent-purple-500 cursor-pointer my-1"
                  />
                </div>

                {/* Intro Title Font Family */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 select-none">
                    <Type size={13} className="text-amber-400" />
                    <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-widest">Шрифт темы Интро</span>
                  </div>
                  <select
                    value={introFont}
                    onChange={(e) => updateIntroFont(e.target.value)}
                    className="bg-white/5 text-xs border border-white/10 rounded-xl px-3 py-2 focus:ring-1 ring-amber-500 outline-none cursor-pointer hover:bg-white/10 transition-colors text-white font-medium"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f} value={f} className="bg-neutral-900">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="2. Emma: Welcome back!&#10;4. Ethan: Glad to be here."
                className="w-full h-80 bg-black/20 border border-white/5 rounded-2xl p-6 text-slate-200 font-mono text-sm focus:outline-none focus:border-purple-500/50 transition-all resize-none shadow-inner mb-6"
              />

              <div className="mt-8">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Settings size={18} className="text-purple-400" /> Voice
                    Instruction
                  </h3>
                </div>
                <textarea
                  value={voiceInstructions}
                  onChange={(e) => setVoiceInstructions(e.target.value)}
                  placeholder="e.g. Speak excitedly..."
                  className="w-full h-40 bg-black/20 border border-white/5 rounded-2xl p-6 text-slate-200 text-sm focus:outline-none focus:border-purple-500/50 transition-all resize-none shadow-inner"
                />
              </div>

            </div>
          </div>
        )}

        {view === "setup" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-6 tracking-tight">
                Step 2: Assign Voices
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {Object.keys(speakerVoices).map((speaker) => (
                  <div
                    key={speaker}
                    className="p-4 bg-black/20 border border-white/5 rounded-2xl flex items-center justify-between backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center font-bold">
                        {speaker[0]}
                      </div>
                      <span className="font-bold text-white">{speaker}</span>
                    </div>
                    <select
                      value={speakerVoices[speaker]}
                      onChange={(e) =>
                        setSpeakerVoices((prev) => ({
                          ...prev,
                          [speaker]: e.target.value,
                        }))
                      }
                      className="bg-white/5 text-sm border border-white/10 rounded-xl px-3 py-1.5 focus:ring-2 ring-blue-500 outline-none cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      {VOICES.map((v) => (
                        <option key={v} value={v} className="bg-neutral-900">
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button
                onClick={startBatch}
                className="w-full py-4 bg-white text-black hover:bg-blue-50 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5 active:scale-95"
              >
                Generate Podcast Clips <ListMusic size={20} />
              </button>
            </div>
          </div>
        )}

        {view === "generating" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
            {/* Fixed Top-Right Counter Circle Badge */}
            <div className="fixed top-6 right-6 z-40 animate-in fade-in zoom-in duration-300">
              <button
                type="button"
                onClick={handleSelectAll}
                title={selectedLineIds.size > 0 ? "Снять выделение со всех" : "Выбрать все строки"}
                className="w-14 h-14 rounded-full bg-neutral-900/95 border-2 border-white/30 shadow-2xl backdrop-blur-md flex items-center justify-center text-white transition-all transform hover:scale-105 active:scale-95 cursor-pointer select-none"
              >
                <span className="text-2xl font-black text-white leading-none">
                  {selectedLineIds.size}
                </span>
              </button>
            </div>

            {/* Fixed Bottom-Right Floating Controls (NEXT & AUTO stacked / overlapping) */}
            <div className="fixed bottom-8 right-8 z-40 flex flex-col items-center -space-y-3 select-none animate-in fade-in zoom-in duration-300">
              {/* NEXT BUTTON */}
              <button
                type="button"
                onClick={() => {
                  stopAutoPlay();
                  handleNextInChecklist();
                }}
                className="w-16 h-16 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs tracking-wider uppercase shadow-2xl border-2 border-white/40 hover:border-white flex flex-col items-center justify-center gap-0.5 transition-all transform hover:scale-110 active:scale-95 cursor-pointer group z-20"
                title="Следующий диалог: подсветить и воспроизвести аудио (горячая клавиша 3)"
              >
                <Play size={18} className="fill-white translate-x-0.5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black tracking-widest leading-none">NEXT</span>
              </button>

              {/* AUTO BUTTON */}
              <button
                type="button"
                onClick={toggleAutoPlay}
                className={`w-14 h-14 rounded-full flex flex-col items-center justify-center border-2 transition-all transform hover:scale-110 active:scale-95 cursor-pointer shadow-2xl z-10 ${
                  isAutoPlayActive
                    ? "bg-emerald-600 border-emerald-300 text-white shadow-emerald-600/50 ring-2 ring-emerald-400/40 animate-pulse"
                    : "bg-neutral-950/95 hover:bg-neutral-900 border-white/20 text-slate-300 hover:text-white hover:border-white/50"
                }`}
                title={isAutoPlayActive ? "Остановить AUTO режим (Клавиша 4 или Пробел)" : "AUTO режим: воспроизведение подряд с паузой 1 сек (Клавиша 4 или Пробел)"}
              >
                {isAutoPlayActive ? (
                  <Pause size={14} className="fill-white" />
                ) : (
                  <Sparkles size={14} className="text-emerald-400" />
                )}
                <span className="text-[9px] font-black tracking-widest leading-none mt-0.5">AUTO</span>
              </button>
            </div>

            {/* Top Banner with SKU and Preview Video */}
            <div className="bg-neutral-900/90 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                  {isQueueRunning ? (
                    <Loader2 className="text-white animate-spin" size={24} />
                  ) : (
                    <Check className="text-white" size={24} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg tracking-tight">
                    {sku || dialogue[0]?.sku || "Podcast"}
                  </h3>
                </div>
              </div>
              {!isQueueRunning && (
                <div className="flex gap-2">
                  <button
                    onClick={playPodcast}
                    className="px-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-neutral-200 transition-all flex items-center gap-2 shadow-xl cursor-pointer"
                  >
                    <Play size={16} fill="currentColor" /> Preview Video
                  </button>
                </div>
              )}
            </div>

            {/* Selection & Copy Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md shadow-xl">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-white/10"
                >
                  <Check size={14} className="text-white" />
                  <span>
                    {selectedLineIds.size === dialogue.length && dialogue.length > 0
                      ? "Снять выделение со всех"
                      : "Выбрать все"}
                  </span>
                </button>
                <span className="text-xs text-slate-300 font-medium">
                  Отмечено: <strong className="text-white font-bold">{selectedLineIds.size}</strong> из {dialogue.length}
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden md:inline-block ml-2">
                  [Клавиши: <strong>2</strong> — отметить, <strong>3</strong> — след, <strong>4</strong> / <strong>Пробел</strong> — авто]
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopySelectedToClipboard}
                disabled={selectedLineIds.size === 0}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-white text-black font-bold text-xs transition-all flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
              >
                <Copy size={14} />
                <span>Скопировать отмеченные ({selectedLineIds.size})</span>
              </button>
            </div>

            <div className="space-y-4">
              {dialogue.map((line, index) => (
                <LineControl
                  key={line.id}
                  line={line}
                  sku={sku}
                  state={
                    states[line.id] || { status: "idle", downloaded: false }
                  }
                  isSelected={selectedLineIds.has(line.id)}
                  onToggleSelect={() => toggleSelectLine(line.id)}
                  isFocused={index === focusedLineIndex}
                  onFocus={() => {
                    hasPlayedFirstInChecklistRef.current = true;
                    setFocusedLineIndex(index);
                    playLine(line.id);
                  }}
                  onGenerate={() => {
                    queueRef.current = [{ id: line.id, retryCount: 0 }];
                    setIsQueueRunning(true);
                    processNextInQueue();
                  }}
                  onDownload={() => downloadLine(line.id, index)}
                  onPlay={() => playLine(line.id)}
                  isQueueRunning={isQueueRunning}
                  isPlayingChecklistAudio={isPlayingChecklistAudio}
                />
              ))}
            </div>
          </div>
        )}

        {view === "video" && (
          <div
            className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center overflow-hidden font-display"
            style={{ cursor: "none" }}
          >
            {/* Mesh Gradient Background Elements - Only subtle for depth if needed, but user wants pure black outside */}
            {/* We keep them very faint or remove them for the "pure black" request */}

            <div
              className={`absolute top-8 left-0 right-0 z-50 flex justify-center transition-all duration-700 ${hideUI ? "opacity-0 pointer-events-none -translate-y-8" : "opacity-100 translate-y-0"}`}
            >
              <div className="flex items-center gap-6 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl max-w-[95%]">
                <button
                  onClick={() => {
                    if (audioRef.current) audioRef.current.pause();
                    if (playbackTimerRef.current)
                      clearInterval(playbackTimerRef.current);
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current);
                      countdownIntervalRef.current = null;
                    }
                    if (introDelayTimeoutRef.current) {
                      clearTimeout(introDelayTimeoutRef.current);
                      introDelayTimeoutRef.current = null;
                    }
                    setIntroCountdown(null);
                    setView("generating");
                    setHideUI(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white transition-all rounded-xl hover:bg-white/10 group"
                  title="Back"
                >
                  <ArrowLeft
                    size={20}
                    className="group-hover:-translate-x-1 transition-transform"
                  />
                </button>
                <div className="h-6 w-[1px] bg-white/10" />
                <button
                  onClick={togglePlayPause}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl font-semibold text-[10px] uppercase tracking-widest transition-all"
                  title="Play / Pause (Space)"
                >
                  {isPaused || (currentLineIndex === -1 && introCountdown === null) ? (
                    <>
                      <Play size={16} className="fill-indigo-400" /> Play
                    </>
                  ) : (
                    <>
                      <Pause size={16} className="fill-indigo-400" /> Pause
                    </>
                  )}
                </button>
                <div className="h-6 w-[1px] bg-white/10" />
                <button
                  onClick={() => startPlayback(0)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all"
                >
                  <RotateCcw size={16} />
                </button>
                <div className="h-6 w-[1px] bg-white/10" />

                <button
                  onClick={previewEndScreen}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all"
                  title="Test Outro Screen"
                >
                  <Eye size={16} />
                </button>
                <div className="h-6 w-[1px] bg-white/10" />

                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 transition-all rounded-xl hover:bg-white/10 ${showSettings ? "text-blue-400 bg-white/10" : "text-slate-400"}`}
                  >
                    <SlidersHorizontal size={20} />
                  </button>

                  <AnimatePresence>
                    {showSettings && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-4 w-72 bg-neutral-900/95 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl z-[60]"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                            Settings
                          </h4>
                          <button
                            onClick={() => setShowSettings(false)}
                            className="text-neutral-500 hover:text-white"
                          >
                            <X size={16} />
                          </button>
                        </div>

                        <div className="space-y-8">
                          {/* Offset */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Timer size={14} className="text-blue-400" />
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Sync Offset
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-blue-400">
                                {timingOffset > 0 ? "+" : ""}
                                {timingOffset}ms
                              </span>
                            </div>
                            <input
                              type="range"
                              min="-500"
                              max="500"
                              step="10"
                              value={timingOffset}
                              onChange={(e) =>
                                setTimingOffset(parseInt(e.target.value))
                              }
                              className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-blue-500 cursor-pointer"
                            />
                          </div>

                          {/* Font Size */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Type size={14} className="text-orange-400" />
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Dialogue Subtitle Size
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-orange-400">
                                {fontSize}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={fontSize}
                              onChange={(e) =>
                                setFontSize(parseInt(e.target.value))
                              }
                              className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-orange-500 cursor-pointer"
                            />
                          </div>

                          {/* Intro Title Font Size */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Type size={14} className="text-purple-400" />
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Intro Title Size
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-purple-400">
                                {introTitleFontSize}px
                              </span>
                            </div>
                            <input
                              type="range"
                              min="80"
                              max="240"
                              step="5"
                              value={introTitleFontSize}
                              onChange={(e) =>
                                updateIntroTitleFontSize(parseInt(e.target.value))
                              }
                              className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-purple-500 cursor-pointer"
                            />
                          </div>

                          {/* Intro Font Family */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Type size={14} className="text-amber-400" />
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                                  Intro Font
                                </span>
                              </div>
                            </div>
                            <select
                              value={introFont}
                              onChange={(e) => updateIntroFont(e.target.value)}
                              className="w-full bg-white/5 text-xs border border-white/10 rounded-xl px-3 py-2 focus:ring-1 ring-amber-500 outline-none cursor-pointer hover:bg-white/10 transition-colors text-white"
                            >
                              {AVAILABLE_FONTS.map((f) => (
                                <option key={f} value={f} className="bg-neutral-900">
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Upward Animation Toggle */}
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                              Upward Text Animation
                            </span>
                            <button
                              type="button"
                              onClick={() => updateDisableZoomAnimation(!disableZoomAnimation)}
                              className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                                !disableZoomAnimation ? "bg-blue-600" : "bg-white/10"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                  !disableZoomAnimation ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-6 w-[1px] bg-white/10" />
                <div className="flex bg-white/10 p-1 rounded-xl">
                  <button
                    onClick={() => setVideoFormat("landscape")}
                    className={`p-2 rounded-lg transition-all ${videoFormat === "landscape" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}
                    title="Landscape (16:9)"
                  >
                    <Monitor size={18} />
                  </button>
                  <button
                    onClick={() => setVideoFormat("portrait")}
                    className={`p-2 rounded-lg transition-all ${videoFormat === "portrait" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}
                    title="Portrait (9:16)"
                  >
                    <Smartphone size={18} />
                  </button>
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {Object.entries(BG_STYLES_CONFIG).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setBgStyle(key as any)}
                        title={config.name}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          bgStyle === key
                            ? "border-pink-500 scale-110 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                            : "border-white/20 hover:border-white/40"
                        } ${config.base.startsWith("bg-gradient") ? "bg-neutral-800" : config.base}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-6 w-[1px] bg-white/10" />
                <button
                  onClick={toggleFullScreen}
                  className="p-2 text-neutral-500 hover:text-white transition-all rounded-xl hover:bg-white/5"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? (
                    <Minimize size={20} />
                  ) : (
                    <Maximize size={20} />
                  )}
                </button>
                <div className="h-6 w-[1px] bg-white/10" />
                <button
                  onClick={() => setHideUI(true)}
                  className="p-2 text-neutral-500 hover:text-white transition-all rounded-xl hover:bg-white/5"
                  title="Hide UI (ESC to Show)"
                >
                  <EyeOff size={20} />
                </button>
              </div>
            </div>

            <div
              className={`relative transition-all duration-700 ${BG_STYLES_CONFIG[bgStyle].base} ${
                videoFormat === "portrait"
                  ? "aspect-[9/16] h-[90vh] rounded-none shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10"
                  : isFullScreen
                    ? "w-full h-full border-none shadow-none"
                    : "w-[90vw] h-[80vh] max-w-6xl rounded-none shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10"
              } flex items-center justify-center overflow-hidden backdrop-blur-xl`}
              style={{ cursor: "none" }}
            >
              {/* Dynamic Gradients */}
              <AnimatePresence>
                {BG_STYLES_CONFIG[bgStyle].glows.map((glowClass, i) => (
                  <motion.div
                    key={`${bgStyle}-glow-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className={`absolute ${
                      i === 0
                        ? "top-0 left-1/4 -translate-y-1/2"
                        : "bottom-0 right-1/4 translate-y-1/2"
                    } ${
                      isFullScreen && videoFormat === "landscape"
                        ? "w-[900px] h-[900px] blur-[160px]"
                        : "w-[600px] h-[600px] blur-[120px]"
                    } ${glowClass} rounded-full pointer-events-none transition-all duration-700`}
                  />
                ))}
              </AnimatePresence>

              {bgStyle === "matrix" && (
                <div className="absolute inset-0 dot-grid opacity-[0.05] pointer-events-none" />
              )}

              <AnimatePresence mode="popLayout">
                {currentLineIndex !== -1 && dialogue[currentLineIndex] ? (
                  <motion.div
                    key={currentLineIndex}
                    initial={{
                      opacity: 0,
                      y: disableZoomAnimation ? 0 : 40,
                      scale: disableZoomAnimation ? 1 : 0.95
                    }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      y: disableZoomAnimation ? 0 : -40,
                      scale: disableZoomAnimation ? 1 : 1.05,
                      filter: disableZoomAnimation ? "none" : "blur(10px)",
                    }}
                    transition={{
                      duration: disableZoomAnimation ? 0.25 : 0.4,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className={`relative z-10 w-full text-center transition-all duration-700 ${
                      isFullScreen && videoFormat === "landscape"
                        ? "px-20 md:px-44"
                        : "px-12 md:px-20"
                    }`}
                  >
                    {!hideName && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                        <motion.span
                          key={`name-${dialogue[currentLineIndex]?.speaker}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 1.2 }}
                          className={`${nameStyle.class} text-center leading-none select-none block w-full truncate whitespace-nowrap`}
                        >
                          {dialogue[currentLineIndex]?.speaker}
                        </motion.span>
                      </div>
                    )}

                    <div
                      className={`flex flex-wrap justify-center gap-x-[0.25em] gap-y-[0.1em] leading-[1.1] font-bold ${getFontSizeClass()}`}
                      style={{ fontFamily: FONT_MAPPING[dialogueFont] }}
                    >
                      {dialogue[currentLineIndex]?.text
                        .split(/\s+/)
                        .map((word, wIdx) => {
                          const isHighlighted = wIdx === currentWordIndex;

                          return (
                            <motion.span
                              key={wIdx}
                              initial={false}
                              animate={{
                                opacity: isHighlighted ? 1 : 0.12,
                                color: isHighlighted ? "#FFFFFF" : "#333333",
                                textShadow: isHighlighted
                                  ? "0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.3)"
                                  : "none",
                              }}
                              transition={{ duration: 0.2 }}
                              className="relative inline-block"
                            >
                              {word}
                            </motion.span>
                          );
                        })}
                    </div>

                    {/* Name at bottom removed per request, now background only */}
                  </motion.div>
                ) : isPlaybackFinished ? (
                  <motion.div
                    key="outro-screen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full select-none text-white overflow-hidden relative"
                    style={{ fontFamily: FONT_MAPPING[outroFont] }}
                  >
                    {/* Mesh Gradient Background Elements (как на основном экране диалогов, чтобы убрать черный квадрат) */}
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none z-0"></div>
                    <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none z-0"></div>
                    <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none z-0"></div>
                    <div className="absolute inset-0 dot-grid opacity-[0.03] pointer-events-none z-0" />

                    {/* Aligned Next Video Section at the Top */}
                    <div className="absolute top-12 sm:top-16 left-0 right-0 flex flex-col items-center pointer-events-none z-40 p-6">
                      <div className="w-full max-w-2xl flex flex-col items-center justify-center gap-6 pointer-events-auto">
                        <AnimatePresence>
                          {outroStep >= 2 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.5 }}
                              className="relative flex items-center justify-center text-center select-none cursor-pointer pointer-events-auto whitespace-nowrap"
                              onClick={() => playUploadedAudio("next")}
                            >
                              <span
                                className={`relative z-10 font-black tracking-[0.15em] whitespace-nowrap ${
                                  isFullScreen ? "text-[38px] md:text-[43px]" : "text-[32px] md:text-[36px]"
                                }`}
                                style={{ fontFamily: FONT_MAPPING[outroFont], color: "#FFFFFF" }}
                              >
                                NEXT LESSON
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Call To Actions aligned perfectly at the bottom edge of the screen */}
                    <div className={`absolute left-0 right-0 w-full h-16 z-40 pointer-events-none transition-all duration-500 ${isFullScreen ? "bottom-32" : "bottom-14"}`}>
                      {/* Left Side: SUBSCRIBE button (designed to point to YT's subscribe) */}
                      <div
                        className="absolute bottom-0 -translate-x-1/2 pointer-events-auto"
                        style={{ left: "15%" }}
                      >
                        <AnimatePresence>
                          {outroStep >= 3 && (
                            <motion.div
                              key="static-subscribe-btn"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                              }}
                              transition={{
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              className="flex flex-col items-center gap-1.5 cursor-pointer select-none relative"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserSubscribed(true);
                                setShowSubscribeTooltip(true);
                                playUploadedAudio("subscribe");
                              }}
                            >
                              {/* Tooltip above button */}
                              <AnimatePresence>
                                {showSubscribeTooltip && (
                                  <motion.div
                                    initial={{
                                      opacity: 0,
                                      y: 10,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    animate={{
                                      opacity: 1,
                                      y: 0,
                                      scale: 1,
                                      x: "-50%",
                                    }}
                                    exit={{
                                      opacity: 0,
                                      y: 5,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className={`absolute bottom-full left-1/2 text-white font-black tracking-widest uppercase z-50 whitespace-nowrap select-none pointer-events-none text-center ${
                                      isFullScreen ? "text-[14.4px] mb-[28.8px]" : "text-[14px] mb-5"
                                    }`}
                                    style={{ fontFamily: FONT_MAPPING[outroFont] }}
                                  >
                                    FOR NEW LESSONS
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Soft White Ambient Glow Backlight */}
                              <div className="absolute -inset-6 bg-white/[0.07] blur-[24px] rounded-full pointer-events-none z-0 shadow-[0_0_40px_12px_rgba(255,255,255,0.06)]" />

                              {/* Button Content - White button with black text, rounded-full, dynamic large text size and borders */}
                              <div className={`relative z-10 font-black rounded-full transition-all duration-300 tracking-wide border shadow-[0_4px_16px_rgba(255,255,255,0.1)] bg-white text-black border-white hover:bg-neutral-100 ${
                                isFullScreen 
                                  ? "text-[21.6px] px-[43.2px] py-[18px] border-[3.6px]" 
                                  : "text-base px-7 py-3"
                              }`} style={{ fontFamily: FONT_MAPPING[outroFont] }}>
                                Subscribe
                              </div>

                              <SketchedArrow
                                delay={0.1}
                                side="left"
                                length={isFullScreen ? 112 : 45}
                                strokeWidth={isFullScreen ? 4.5 : 2}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Right-Center Side: LIKE button (approx 30% from right = 70% left) */}
                      <div
                        className="absolute bottom-0 -translate-x-1/2 pointer-events-auto"
                        style={{ left: "70%" }}
                      >
                        <AnimatePresence>
                          {outroStep >= 4 && (
                            <motion.div
                              key="static-like-btn"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                              }}
                              transition={{
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              className="flex flex-col items-center gap-1.5 cursor-pointer select-none relative"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserLiked(true);
                                setShowLikeTooltip(true);
                                playUploadedAudio("like");
                              }}
                            >
                              {/* Tooltip above button */}
                              <AnimatePresence>
                                {showLikeTooltip && (
                                  <motion.div
                                    initial={{
                                      opacity: 0,
                                      y: 10,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    animate={{
                                      opacity: 1,
                                      y: 0,
                                      scale: 1,
                                      x: "-50%",
                                    }}
                                    exit={{
                                      opacity: 0,
                                      y: 5,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className={`absolute bottom-full left-1/2 text-white font-black tracking-widest uppercase z-50 whitespace-nowrap select-none pointer-events-none text-center ${
                                      isFullScreen ? "text-[14.4px] mb-[28.8px]" : "text-[14px] mb-5"
                                    }`}
                                    style={{ fontFamily: FONT_MAPPING[outroFont] }}
                                  >
                                    IF YOU ENJOYED IT
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              
                              {/* Soft White Ambient Glow Backlight */}
                              <div className="absolute -inset-6 bg-white/[0.05] blur-[24px] rounded-full pointer-events-none z-0" />
                              
                              {/* Button Content - Heart icon only */}
                              <div className="relative z-10 flex items-center justify-center transition-all duration-300 text-white hover:text-neutral-200">
                                <Heart 
                                  className={`transition-all duration-300 text-white ${userLiked ? "fill-white text-white" : "fill-none"}`} 
                                  size={isFullScreen ? 50 : 32}
                                  strokeWidth={isFullScreen ? 3.15 : 2}
                                />
                              </div>
                              
                              <SketchedArrow
                                delay={0.2}
                                side="straight"
                                length={isFullScreen ? 112 : 45}
                                strokeWidth={isFullScreen ? 4.5 : 2}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* SAVE button (approx 10% from right = 90% left) */}
                      <div
                        className="absolute bottom-0 -translate-x-1/2 pointer-events-auto"
                        style={{ left: "90%" }}
                      >
                        <AnimatePresence>
                          {outroStep >= 5 && (
                            <motion.div
                              key="static-save-btn"
                              initial={{ opacity: 0 }}
                              animate={{
                                opacity: 1,
                              }}
                              transition={{
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              className="flex flex-col items-center gap-1.5 cursor-pointer select-none relative"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUserSaved(true);
                                setShowSaveTooltip(true);
                                playUploadedAudio("save");
                              }}
                            >
                              {/* Tooltip above button */}
                              <AnimatePresence>
                                {showSaveTooltip && (
                                  <motion.div
                                    initial={{
                                      opacity: 0,
                                      y: 10,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    animate={{
                                      opacity: 1,
                                      y: 0,
                                      scale: 1,
                                      x: "-50%",
                                    }}
                                    exit={{
                                      opacity: 0,
                                      y: 5,
                                      scale: 0.9,
                                      x: "-50%",
                                    }}
                                    transition={{ duration: 0.2 }}
                                    className={`absolute bottom-full left-1/2 text-white font-black tracking-widest uppercase z-50 whitespace-nowrap select-none pointer-events-none text-center ${
                                      isFullScreen ? "text-[14.4px] mb-[28.8px]" : "text-[14px] mb-5"
                                    }`}
                                    style={{ fontFamily: FONT_MAPPING[outroFont] }}
                                  >
                                    FOR LATER
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Soft White Ambient Glow Backlight */}
                              <div className="absolute -inset-6 bg-white/[0.05] blur-[24px] rounded-full pointer-events-none z-0" />

                              {/* Button Content - Hollow/non-filled Bookmark only */}
                              <div className="relative z-10 flex items-center justify-center transition-all duration-300 text-white hover:text-neutral-200">
                                <Bookmark 
                                  className={`transition-all duration-300 text-white ${userSaved ? "fill-white" : "fill-none"}`} 
                                  size={isFullScreen ? 50 : 32}
                                  strokeWidth={isFullScreen ? 3.15 : 2}
                                />
                              </div>

                              <SketchedArrow
                                delay={0.3}
                                side="right"
                                length={isFullScreen ? 112 : 45}
                                strokeWidth={isFullScreen ? 4.5 : 2}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ) : isPlaybackFinished && false ? (
                  <motion.div
                    key="outro-screen-legacy"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center max-w-4xl px-8 flex flex-col items-center justify-center space-y-10 py-12 select-none relative"
                    style={{ display: "none" }}
                  >
                    {/* Motivator */}
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 0.6 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm md:text-base tracking-[0.2em] font-medium text-slate-300 uppercase"
                    >
                      Thanks for listening!
                    </motion.p>

                    {/* Channel Name */}
                    <div className="space-y-4">
                      <motion.h1
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black tracking-[0.15em] bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent uppercase leading-none"
                      >
                        Lesson Done
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ delay: 0.3 }}
                        className="text-sm md:text-base text-slate-400"
                      >
                        Practice English daily for immediate improvement!
                      </motion.p>
                    </div>

                    {/* Like & Subscribe interactive bar */}
                    <div className="relative flex flex-col sm:flex-row items-center gap-6 pt-6 z-30">
                      {/* Like Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation(); // prevent starting playback
                          setUserLiked(true);
                        }}
                        className={`group min-w-[200px] flex items-center justify-center gap-3 px-8 py-5 rounded-2xl border transition-all shadow-xl select-none ${
                          userLiked
                            ? "bg-rose-500/20 border-rose-500 text-rose-400 scale-[1.02]"
                            : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-rose-500/30 hover:text-white"
                        }`}
                      >
                        <motion.div
                          animate={userLiked ? { scale: [1, 1.4, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          <Heart
                            size={24}
                            className={
                              userLiked
                                ? "fill-rose-500 text-rose-500 animate-pulse"
                                : "text-rose-400 group-hover:scale-110 transition-transform"
                            }
                          />
                        </motion.div>
                        <span className="font-bold text-lg">
                          {userLiked ? "LIKED!" : "LIKE"}
                        </span>
                      </motion.button>

                      {/* Subscribe Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation(); // prevent starting playback
                          setUserSubscribed(true);
                        }}
                        className={`group min-w-[200px] flex items-center justify-center gap-3 px-8 py-5 rounded-2xl border transition-all shadow-xl select-none ${
                          userSubscribed
                            ? "bg-indigo-500/20 border-indigo-500 text-indigo-400 scale-[1.02]"
                            : "bg-white/[0.03] border-white/10 text-slate-300 hover:border-indigo-500/30 hover:text-white"
                        }`}
                      >
                        <motion.div
                          animate={
                            userSubscribed
                              ? { rotate: [0, -15, 15, -15, 15, 0] }
                              : {}
                          }
                          transition={{ duration: 0.5 }}
                        >
                          <Bell
                            size={24}
                            className={
                              userSubscribed
                                ? "fill-indigo-500 text-indigo-500"
                                : "text-indigo-400 group-hover:scale-110 transition-transform"
                            }
                          />
                        </motion.div>
                        <span className="font-bold text-lg">
                          {userSubscribed ? "SUBSCRIBED!" : "SUBSCRIBE"}
                        </span>
                      </motion.button>
                    </div>

                    {/* Instruction tip */}
                    <motion.p
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="text-xs font-mono tracking-[0.15em] text-lime-400 select-none uppercase pt-2"
                    >
                      Click Either Button to Interact!
                    </motion.p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="intro-screen"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => {
                      if (!introStarted) {
                        setIntroStarted(true);
                      } else {
                        setIsIntroPreviewOnly(false);
                        setIntroResetCounter((prev) => prev + 1);
                      }
                    }}
                    className="relative w-full h-full flex flex-col items-center justify-center px-12 text-center select-none cursor-none"
                    style={{ fontFamily: FONT_MAPPING[introFont] }}
                  >
                    {/* Top title: English Podcast */}
                    <AnimatePresence>
                      {introStarted && (
                        <motion.div
                          key="english-podcast-title"
                          initial={{ opacity: 0, y: 50 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", damping: 14, stiffness: 80 }}
                          className={`absolute top-[12%] select-none flex items-center justify-center ${
                            englishPodcastHuge
                              ? "left-4 right-4 w-[calc(100%-2rem)]"
                              : videoFormat === "portrait"
                                ? "left-1/2 -translate-x-1/2 w-[90%] max-w-sm"
                                : "left-[1.5cm] right-[1.5cm]"
                          }`}
                        >
                          <svg
                            viewBox="0 0 1000 130"
                            className="w-full h-auto select-none overflow-hidden px-1"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            <text
                              x="500"
                              y="95"
                              textAnchor="middle"
                              fill="white"
                              textLength={englishPodcastHuge ? "965" : "865"}
                              lengthAdjust="spacingAndGlyphs"
                              style={{
                                fontFamily: FONT_MAPPING[introFont],
                                fontWeight: 900,
                                letterSpacing: englishPodcastHuge ? "0.15em" : "0.08em",
                              }}
                              className="uppercase select-none fill-white font-black"
                              fontSize="110"
                            >
                              ENGLISH PODCAST
                            </text>
                          </svg>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Centered Main Title / Theme (Centered between ENGLISH PODCAST and bottom of screen) */}
                    <AnimatePresence>
                      {introStarted && videoIntroPhase >= 2 && (
                        <div className="absolute top-[20%] bottom-0 left-0 right-0 flex items-center justify-center p-4 md:p-8 z-10 pointer-events-none">
                          <motion.div
                            key="theme-title-container"
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ type: "spring", damping: 14, stiffness: 80 }}
                            className={`w-full text-center pointer-events-auto ${
                              isFullScreen ? "max-w-[92vw] px-4" : "max-w-5xl px-8"
                            }`}
                          >
                            <h1
                              className="font-extrabold tracking-tight text-white leading-tight"
                              style={{
                                fontFamily: FONT_MAPPING[introFont],
                                ...(() => {
                                  const text = themeValue || "Introducing Yourself and Your Family";
                                  const len = text.trim().length;
                                  const baseFs = introTitleFontSize || 180;
                                  let fontSizePx: number;
                                  if (isFullScreen) {
                                    if (len <= 18) fontSizePx = baseFs;
                                    else if (len <= 30) fontSizePx = Math.round(baseFs * 0.78);
                                    else if (len <= 45) fontSizePx = Math.round(baseFs * 0.60);
                                    else if (len <= 65) fontSizePx = Math.round(baseFs * 0.48);
                                    else if (len <= 90) fontSizePx = Math.round(baseFs * 0.38);
                                    else fontSizePx = Math.round(baseFs * 0.30);
                                  } else {
                                    const panelBase = baseFs * 0.48;
                                    if (len <= 18) fontSizePx = Math.round(panelBase);
                                    else if (len <= 30) fontSizePx = Math.round(panelBase * 0.78);
                                    else if (len <= 45) fontSizePx = Math.round(panelBase * 0.60);
                                    else if (len <= 65) fontSizePx = Math.round(panelBase * 0.48);
                                    else fontSizePx = Math.round(panelBase * 0.38);
                                  }
                                  return {
                                    fontSize: `${fontSizePx}px`,
                                    lineHeight: 1.1,
                                  };
                                })(),
                              }}
                            >
                              {themeValue || "Introducing Yourself and Your Family"}
                            </h1>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification for Clipboard Copy */}
      <AnimatePresence>
        {copiedToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 right-8 z-50 bg-blue-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-blue-400 font-bold text-sm"
          >
            <Check size={18} className="stroke-[3]" />
            <span>Скопировано в буфер обмена!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
