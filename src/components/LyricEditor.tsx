import React, { useState, useRef, useEffect } from "react";
import { LyricLine, Word } from "../types";
import { API_BASE } from "../lib/apiBase";
import { 
  Clock, Edit2, Trash2, Plus, Check, Play, CornerDownRight, 
  AlignLeft, Sparkles, Sliders, Music, Zap, Layers, RefreshCw, Loader2 
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { 
  analyzeAudio, 
  autoAlignLyricsToVocals, 
  AudioAnalysis, 
  decodeAudioFile,
  computeWaveformPeaks
} from "../utils/audioAnalyzer";

interface LyricEditorProps {
  lyrics: LyricLine[];
  currentTime: number;
  onUpdateLyrics: (newLyrics: LyricLine[]) => void;
  onSeek: (time: number) => void;
  audioUrl?: string | null;
  audioFile?: File | null;
  onUpdateWaveformPeaks?: (peaks: number[]) => void;
}

export default function LyricEditor({
  lyrics,
  currentTime,
  onUpdateLyrics,
  onSeek,
  audioUrl,
  audioFile,
  onUpdateWaveformPeaks,
}: LyricEditorProps) {
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);

  const [editingWordIdx, setEditingWordIdx] = useState<{ lineIdx: number; wordIdx: number } | null>(null);
  const [editWordText, setEditWordText] = useState("");
  const [editWordStart, setEditWordStart] = useState(0);
  const [editWordEnd, setEditWordEnd] = useState(0);

  // Wavesurfer and analysis state
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // AI Auto-Trim Feature States & Handler
  const [isTrimLoading, setIsTrimLoading] = useState(false);
  const [trimError, setTrimError] = useState<string | null>(null);

  const handleAiTrimLyrics = async () => {
    if (!lyrics || lyrics.length === 0) return;
    
    setIsTrimLoading(true);
    setTrimError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/trim-lyrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics })
      });

      if (!response.ok) {
        let errMsg = "Failed to optimize and auto-cut lyrics using AI";
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      if (data.lyrics && Array.isArray(data.lyrics)) {
        onUpdateLyrics(data.lyrics);
        setSuccessMsg("AI optimized, trimmed, and auto-cut long lyric phrases perfectly!");
        setTimeout(() => {
          setSuccessMsg(null);
        }, 4000);
      }
    } catch (err: any) {
      console.error(err);
      setTrimError(err.message || "An error occurred during AI trimming.");
      setTimeout(() => {
        setTrimError(null);
      }, 5000);
    } finally {
      setIsTrimLoading(false);
    }
  };

  // Dragging and timeline track states
  const [duration, setDuration] = useState<number>(0);
  const [dragging, setDragging] = useState<{
    lineIdx: number;
    type: "start" | "end" | "move";
    initialMouseX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    console.log("[LyricEditor] Initializing WaveSurfer timeline with audio:", audioUrl);
    
    let ws: WaveSurfer | null = null;
    try {
      ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "rgba(100, 116, 139, 0.25)", // slate-500 translucency
        progressColor: "#6366f1", // Indigo-500
        cursorColor: "#818cf8", // Indigo-400
        cursorWidth: 2,
        height: 60,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        url: audioUrl,
      });

      wavesurferRef.current = ws;

      // Click or scrub on WaveSurfer timeline seeks playback
      ws.on("interaction", (newTime) => {
        onSeek(newTime);
      });

      ws.on("ready", () => {
        setDuration(ws.getDuration());
      });

      ws.on("decode", () => {
        setDuration(ws.getDuration());
      });
    } catch (wsErr) {
      console.error("Error setting up Wavesurfer element:", wsErr);
    }

    return () => {
      if (ws) {
        try {
          ws.destroy();
        } catch (err) {
          console.warn("WaveSurfer cleanup error:", err);
        }
      }
    };
  }, [audioUrl]);

  // Keep Wavesurfer playhead synced to parent playback state
  useEffect(() => {
    if (wavesurferRef.current) {
      const ws = wavesurferRef.current;
      const d = ws.getDuration();
      if (d > 0 && d !== duration) {
        setDuration(d);
      }
      // Only set time if wavesurfer is loaded and duration is valid
      if (d > 0 && Math.abs(ws.getCurrentTime() - currentTime) > 0.05) {
        try {
          ws.setTime(currentTime);
        } catch (seekErr) {
          // ignore transient seek errors during media load
        }
      }
    }
  }, [currentTime, duration]);

  // Decode and analyze audio using OfflineAudioContext when a new audio file is loaded
  useEffect(() => {
    if (!audioFile) return;

    const runAnalysis = async () => {
      setAnalyzing(true);
      setSuccessMsg(null);
      try {
        const decoded = await decodeAudioFile(audioFile);
        const res = await analyzeAudio(decoded);
        setAnalysis(res);
        
        // Compute peaks and pass back to parent App state
        const peaks = computeWaveformPeaks(decoded);
        if (onUpdateWaveformPeaks) {
          onUpdateWaveformPeaks(peaks);
        }
      } catch (err) {
        console.warn("[LyricEditor] Web Audio API analysis failed:", err);
      } finally {
        setAnalyzing(false);
      }
    };

    runAnalysis();
  }, [audioFile]);

  // Auto-align handler
  const handleAutoAlign = () => {
    if (!analysis || !lyrics) return;

    const aligned = autoAlignLyricsToVocals(lyrics, analysis.vocals);
    onUpdateLyrics(aligned);
    
    setSuccessMsg("Aligned lyrics to detected vocal onsets!");
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4000);
  };

  // Adjust timing using instant boundary markers (Set Start/End to Current Time)
  const updateLineBoundary = (lineIdx: number, newTime: number, type: "start" | "end") => {
    const updated = [...lyrics];
    const line = { ...updated[lineIdx] };
    
    if (type === "start") {
      line.start = Number(newTime.toFixed(2));
      if (line.start >= line.end) {
        line.end = Number((line.start + 2.5).toFixed(2));
      }
    } else {
      line.end = Number(newTime.toFixed(2));
      if (line.end <= line.start) {
        line.start = Number(Math.max(0, line.end - 2.5).toFixed(2));
      }
    }

    // Proportional redistribution of individual word timing intervals
    const wordsCount = line.words ? line.words.length : 0;
    if (wordsCount > 0) {
      const duration = line.end - line.start;
      const wordDur = duration / wordsCount;
      line.words = line.words.map((w, wIdx) => ({
        text: w.text,
        start: Number((line.start + wIdx * wordDur).toFixed(2)),
        end: Number((line.start + (wIdx + 1) * wordDur).toFixed(2))
      }));
    }

    updated[lineIdx] = line;
    onUpdateLyrics(updated);
  };

  // Mouse Down handler for dragging blocks on the waveform timeline
  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    lineIdx: number,
    type: "start" | "end" | "move"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const line = lyrics[lineIdx];
    setDragging({
      lineIdx,
      type,
      initialMouseX: e.clientX,
      initialStart: line.start,
      initialEnd: line.end,
    });
  };

  // Continuous dragging window effect to adjust manual line timings precisely
  useEffect(() => {
    if (!dragging || !duration) return;

    const handleMouseMove = (e: MouseEvent) => {
      const trackElement = document.getElementById("draggable-timeline-track");
      if (!trackElement) return;

      const rect = trackElement.getBoundingClientRect();
      const deltaX = e.clientX - dragging.initialMouseX;
      const deltaTime = (deltaX / rect.width) * duration;

      const updated = [...lyrics];
      const line = { ...updated[dragging.lineIdx] };

      if (dragging.type === "start") {
        const targetStart = dragging.initialStart + deltaTime;
        line.start = Number(Math.max(0, Math.min(dragging.initialEnd - 0.2, targetStart)).toFixed(2));
      } else if (dragging.type === "end") {
        const targetEnd = dragging.initialEnd + deltaTime;
        line.end = Number(Math.max(dragging.initialStart + 0.2, Math.min(duration, targetEnd)).toFixed(2));
      } else if (dragging.type === "move") {
        const lineDur = dragging.initialEnd - dragging.initialStart;
        let targetStart = dragging.initialStart + deltaTime;
        let targetEnd = targetStart + lineDur;

        if (targetStart < 0) {
          targetStart = 0;
          targetEnd = lineDur;
        } else if (targetEnd > duration) {
          targetEnd = duration;
          targetStart = duration - lineDur;
        }

        line.start = Number(targetStart.toFixed(2));
        line.end = Number(targetEnd.toFixed(2));
      }

      // Proportional redistribution of individual word timing intervals
      const wordsCount = line.words ? line.words.length : 0;
      if (wordsCount > 0) {
        const durationRange = line.end - line.start;
        const wordDur = durationRange / wordsCount;
        line.words = line.words.map((w, wIdx) => ({
          text: w.text,
          start: Number((line.start + wIdx * wordDur).toFixed(2)),
          end: Number((line.start + (wIdx + 1) * wordDur).toFixed(2))
        }));
      }

      updated[dragging.lineIdx] = line;
      onUpdateLyrics(updated);
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, duration, lyrics, onUpdateLyrics]);

  const startEditLine = (idx: number, line: LyricLine) => {
    setEditingLineIdx(idx);
    setEditText(line.text);
    setEditStart(line.start);
    setEditEnd(line.end);
    setEditingWordIdx(null); // clear word edit
  };

  const saveEditLine = (idx: number) => {
    const updated = [...lyrics];
    const line = { ...updated[idx] };
    
    line.text = editText;
    line.start = Number(editStart);
    line.end = Number(editEnd);

    // If text changed, rebuild the words list matching the new words
    const words = editText.split(/\s+/).filter(w => w.length > 0);
    const duration = line.end - line.start;
    const wordDur = duration / Math.max(1, words.length);

    line.words = words.map((w, wIdx) => ({
      text: w,
      start: Number((line.start + wIdx * wordDur).toFixed(2)),
      end: Number((line.start + (wIdx + 1) * wordDur).toFixed(2))
    }));

    updated[idx] = line;
    onUpdateLyrics(updated);
    setEditingLineIdx(null);
  };

  const deleteLine = (idx: number) => {
    const updated = lyrics.filter((_, i) => i !== idx);
    onUpdateLyrics(updated);
  };

  const addNewLine = () => {
    const lastLine = lyrics[lyrics.length - 1];
    const start = lastLine ? lastLine.end + 1.0 : 0.0;
    const end = start + 3.5;
    
    const newLine: LyricLine = {
      text: "New lyric phrase line",
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      words: [
        { text: "New", start: start, end: start + 1.0 },
        { text: "lyric", start: start + 1.0, end: start + 2.0 },
        { text: "phrase", start: start + 2.0, end: start + 3.0 },
        { text: "line", start: start + 3.0, end: end }
      ]
    };

    onUpdateLyrics([...lyrics, newLine].sort((a, b) => a.start - b.start));
  };

  // Edit single word timing
  const startEditWord = (lineIdx: number, wordIdx: number, word: Word) => {
    setEditingWordIdx({ lineIdx, wordIdx });
    setEditWordText(word.text);
    setEditWordStart(word.start);
    setEditWordEnd(word.end);
    setEditingLineIdx(null); // clear line edit
  };

  const saveEditWord = () => {
    if (!editingWordIdx) return;
    const { lineIdx, wordIdx } = editingWordIdx;
    const updated = [...lyrics];
    const line = { ...updated[lineIdx] };
    
    // Deep copy words array so we don't mutate elements
    line.words = line.words ? line.words.map(w => ({ ...w })) : [];
    const word = { ...line.words[wordIdx] };

    word.text = editWordText;
    word.start = Number(editWordStart);
    word.end = Number(editWordEnd);

    line.words[wordIdx] = word;

    // Update overall line start/end if words expand past boundaries
    if (wordIdx === 0 && word.start < line.start) {
      line.start = word.start;
    }
    if (wordIdx === line.words.length - 1 && word.end > line.end) {
      line.end = word.end;
    }

    // Keep words array sorted by start time by sorting a copy
    line.words = [...line.words].sort((a, b) => a.start - b.start);
    // Rebuild line text from constituent words
    line.text = line.words.map(w => w.text).join(" ");

    updated[lineIdx] = line;
    onUpdateLyrics(updated);
    setEditingWordIdx(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 overflow-hidden shadow-xl" id="lyric-timeline-panel">
      {/* Timeline Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" />
          <h3 className="text-md font-semibold text-slate-100 font-sans tracking-tight">
            Vocal Synchronization Editor
          </h3>
        </div>
        <button
          onClick={addNewLine}
          className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-md shadow-indigo-500/10"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Line
        </button>
      </div>

      {/* WaveSurfer Interactive Waveform panel */}
      {audioUrl && (
        <div className="mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-sans font-semibold text-slate-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              Timeline Waveform Scrubber
            </span>
            {analyzing ? (
              <span className="text-[10px] text-indigo-400 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analyzing vocal structure...
              </span>
            ) : analysis ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">
                  BPM: {analysis.bpm} (Detected)
                </span>
                <button
                  onClick={handleAutoAlign}
                  className="flex items-center gap-1 bg-emerald-600/95 hover:bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-all shadow-md shadow-emerald-500/15"
                  title="Align lyric timings with detected vocal intervals"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Align
                </button>
                <button
                  onClick={handleAiTrimLyrics}
                  disabled={isTrimLoading}
                  className="flex items-center gap-1 bg-indigo-600/95 hover:bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer transition-all shadow-md shadow-indigo-500/15"
                  title="Auto-trim and auto-cut/split wordy or long lyric blocks"
                >
                  {isTrimLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-indigo-200" />
                  )}
                  AI Auto-Trim
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-slate-500">Analysis pending...</span>
            )}
          </div>

          {/* Actual Wavesurfer container div */}
          <div 
            ref={containerRef} 
            id="waveform-timeline-container" 
            className="bg-slate-950/80 rounded-lg p-1.5 border border-slate-900/80 cursor-pointer overflow-hidden relative" 
          />

          {/* Draggable Waveform Timeline for manual adjustments */}
          {duration > 0 && (
            <div className="mt-2" id="draggable-timeline-wrapper">
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400 font-sans">
                <span className="font-semibold flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-indigo-400" />
                  Draggable Timeline (Drag edges to trim start/end, drag middle to slide)
                </span>
                <span className="font-mono font-bold text-slate-500 bg-slate-900/80 px-1 py-0.2 rounded border border-slate-800">
                  {duration.toFixed(1)}s total
                </span>
              </div>
              
              <div 
                id="draggable-timeline-track"
                className="h-10 bg-slate-950/90 rounded-lg border border-slate-800 relative overflow-hidden select-none cursor-crosshair"
                onClick={(e) => {
                  // Click on empty space of track seeks to that time
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const targetTime = (clickX / rect.width) * duration;
                  onSeek(Math.max(0, Math.min(duration, targetTime)));
                }}
              >
                {/* Visual grid ticks */}
                <div className="absolute inset-0 flex justify-between pointer-events-none opacity-10">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="w-[1px] h-full bg-slate-400" />
                  ))}
                </div>

                {/* Draw each lyric line as a draggable horizontal block */}
                {lyrics.map((line, idx) => {
                  const leftPct = (line.start / duration) * 100;
                  const widthPct = ((line.end - line.start) / duration) * 100;
                  const isCurrent = currentTime >= line.start && currentTime <= line.end;
                  const isEditing = editingLineIdx === idx;

                  // Skip rendering invalid lines or lines out of range
                  if (leftPct < 0 || widthPct <= 0 || leftPct > 100) return null;

                  return (
                    <div
                      key={idx}
                      className={`absolute top-1 bottom-1 rounded border flex items-center justify-between px-1 text-[9px] font-mono transition-all group overflow-hidden ${
                        isEditing
                          ? "bg-indigo-500/35 border-indigo-400 shadow-lg shadow-indigo-500/10 z-20 text-indigo-200"
                          : isCurrent
                          ? "bg-emerald-500/25 border-emerald-400/80 z-10 text-emerald-300"
                          : "bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-700/50 hover:border-slate-600 hover:text-slate-200"
                      }`}
                      style={{
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        cursor: "grab",
                      }}
                      title={`${line.text} (${line.start.toFixed(1)}s - ${line.end.toFixed(1)}s)`}
                      onMouseDown={(e) => handleTimelineMouseDown(e, idx, "move")}
                    >
                      {/* Left Drag Handle */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-2.5 bg-indigo-500/20 hover:bg-indigo-400 group-hover:bg-indigo-500/40 rounded-l transition-colors cursor-col-resize flex items-center justify-center border-r border-indigo-500/20"
                        onMouseDown={(e) => handleTimelineMouseDown(e, idx, "start")}
                      >
                        <div className="w-[1px] h-3 bg-white/40" />
                      </div>

                      {/* Display Text Clip */}
                      <span className="mx-3 truncate pointer-events-none text-[8px] font-sans select-none font-semibold">
                        {line.text}
                      </span>

                      {/* Right Drag Handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2.5 bg-indigo-500/20 hover:bg-indigo-400 group-hover:bg-indigo-500/40 rounded-r transition-colors cursor-col-resize flex items-center justify-center border-l border-indigo-500/20"
                        onMouseDown={(e) => handleTimelineMouseDown(e, idx, "end")}
                      >
                        <div className="w-[1px] h-3 bg-white/40" />
                      </div>
                    </div>
                  );
                })}

                {/* Red Playhead line */}
                <div 
                  className="absolute top-0 bottom-0 w-[2px] bg-rose-500 shadow-md shadow-rose-500/50 z-30 pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                >
                  <div className="absolute top-0 -translate-x-1/2 w-2 h-2 rounded-full bg-rose-500" />
                </div>
              </div>
            </div>
          )}

          {/* Success messages */}
          {successMsg && (
            <div className="text-[10px] text-center text-emerald-400 font-medium py-0.5 bg-emerald-950/20 rounded border border-emerald-900/20">
              {successMsg}
            </div>
          )}

          {/* Audio HUD: Detected segments drawer */}
          {analysis && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-900 max-h-[80px] overflow-y-auto" id="audio-hud-chips">
              <span className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1 mr-1 py-0.5">
                <Layers className="w-2.5 h-2.5" /> Structure:
              </span>
              
              {analysis.instrumentals.map((inst, idx) => (
                <button
                  key={`inst-${idx}`}
                  onClick={() => onSeek(inst.start)}
                  className="text-[9px] font-mono font-bold bg-indigo-950/40 hover:bg-indigo-950/60 text-indigo-400 border border-indigo-900/30 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title={`Jump to instrumental ${inst.type}`}
                >
                  🎵 {inst.type.toUpperCase()} ({inst.start.toFixed(1)}s - {inst.end.toFixed(1)}s)
                </button>
              ))}

              {analysis.vocals.slice(0, 3).map((voc, idx) => (
                <button
                  key={`voc-${idx}`}
                  onClick={() => onSeek(voc.start)}
                  className="text-[9px] font-mono font-bold bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  title="Jump to vocal start"
                >
                  🎙️ VOCAL {idx + 1} ({voc.start.toFixed(1)}s)
                </button>
              ))}
              {analysis.vocals.length > 3 && (
                <span className="text-[9px] text-slate-500 font-mono py-0.5">
                  + {analysis.vocals.length - 3} more segments
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Timeline Instructions */}
      <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50 mb-3 flex items-center justify-between">
        <span className="font-sans flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          Select/scrub above. Use manual buttons on lists, or Auto-Align!
        </span>
        <span className="font-mono text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
          Sync: {currentTime.toFixed(2)}s
        </span>
      </div>

      {/* Scrollable vertical list of lyric events */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[350px] md:max-h-none" id="timeline-scrollable-container">
        {lyrics.map((line, lineIdx) => {
          const isActive = currentTime >= line.start && currentTime <= line.end;
          const isLineEditing = editingLineIdx === lineIdx;

          return (
            <div
              key={lineIdx}
              className={`rounded-xl border p-4 transition-all duration-300 relative ${
                isActive
                  ? "bg-slate-850 border-indigo-500 shadow-indigo-500/5 shadow-md"
                  : isLineEditing
                  ? "bg-slate-950 border-indigo-400"
                  : "bg-slate-950/25 border-slate-800/80 hover:bg-slate-900/30"
              }`}
              id={`timeline-row-${lineIdx}`}
            >
              {isLineEditing ? (
                // 1. Line Edit Mode Form
                <div className="space-y-3" id={`edit-form-${lineIdx}`}>
                  <div className="flex items-center gap-2">
                    <AlignLeft className="w-4 h-4 text-indigo-400" />
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
                      placeholder="Line text lyrics..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                    <div>
                      <span className="text-[10px] font-bold font-mono text-slate-500 block mb-1 uppercase">Start (sec)</span>
                      <input
                        type="number"
                        step="0.05"
                        value={editStart}
                        onChange={(e) => setEditStart(parseFloat(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-indigo-300"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold font-mono text-slate-500 block mb-1 uppercase">End (sec)</span>
                      <input
                        type="number"
                        step="0.05"
                        value={editEnd}
                        onChange={(e) => setEditEnd(parseFloat(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-indigo-300"
                      />
                    </div>
                  </div>

                  {/* Slider visual sync */}
                  <div className="flex flex-col gap-1.5 bg-slate-900/30 p-2.5 rounded-lg border border-slate-850">
                    <span className="text-[10px] font-bold font-mono text-slate-500 block uppercase">Continuous Range Scrubber</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max={line.end + 5}
                        step="0.1"
                        value={editStart}
                        onChange={(e) => setEditStart(parseFloat(e.target.value))}
                        className="flex-1 accent-indigo-500 cursor-pointer h-1"
                      />
                      <span className="text-[10px] font-mono font-bold text-slate-400">{(editEnd - editStart).toFixed(2)}s dur</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingLineIdx(null)}
                      className="text-[11px] font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEditLine(lineIdx)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Line
                    </button>
                  </div>
                </div>
              ) : (
                // 2. Standard View Mode Row
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      {/* Playhead jump trigger */}
                      <button
                        onClick={() => onSeek(line.start)}
                        className={`p-1.5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                          isActive
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        }`}
                        title="Jump to line"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <p className={`text-xs font-semibold leading-relaxed ${isActive ? "text-slate-100" : "text-slate-300"}`}>
                        {line.text}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity">
                      {/* Timing Adjustment Shortcuts */}
                      <button
                        onClick={() => updateLineBoundary(lineIdx, currentTime, "start")}
                        className="px-1.5 py-0.5 text-slate-400 hover:text-indigo-400 cursor-pointer rounded hover:bg-slate-800 text-[9px] font-mono font-bold border border-slate-800"
                        title="Align line START to current playhead position"
                      >
                        [Start
                      </button>
                      <button
                        onClick={() => updateLineBoundary(lineIdx, currentTime, "end")}
                        className="px-1.5 py-0.5 text-slate-400 hover:text-indigo-400 cursor-pointer rounded hover:bg-slate-800 text-[9px] font-mono font-bold border border-slate-800"
                        title="Align line END to current playhead position"
                      >
                        End]
                      </button>
                      <button
                        onClick={() => startEditLine(lineIdx, line)}
                        className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer rounded hover:bg-slate-800"
                        title="Edit Line Text"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteLine(lineIdx)}
                        className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer rounded hover:bg-slate-800"
                        title="Delete Line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Word-by-word precise timeline layout */}
                  <div className="flex flex-wrap gap-1.5 pl-8 pt-1" id={`words-timeline-${lineIdx}`}>
                    {line.words?.map((word, wIdx) => {
                      const isWordActive = currentTime >= word.start && currentTime <= word.end;
                      const isWordEditing = editingWordIdx?.lineIdx === lineIdx && editingWordIdx?.wordIdx === wIdx;

                      if (isWordEditing) {
                        return (
                          <div
                            key={wIdx}
                            className="bg-slate-900 border border-indigo-400 rounded-lg p-2.5 flex flex-col gap-2 w-full max-w-xs z-10"
                            id="word-edit-bubble"
                          >
                            <input
                              type="text"
                              value={editWordText}
                              onChange={(e) => setEditWordText(e.target.value)}
                              className="bg-slate-950 border border-slate-800 text-xs font-bold text-indigo-300 rounded px-2 py-1 outline-none"
                              placeholder="Word text..."
                            />
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                              <div>
                                <span className="text-slate-500 block">Start</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  value={editWordStart}
                                  onChange={(e) => setEditWordStart(parseFloat(e.target.value))}
                                  className="w-full bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 text-indigo-300"
                                />
                              </div>
                              <div>
                                <span className="text-slate-500 block">End</span>
                                <input
                                  type="number"
                                  step="0.05"
                                  value={editWordEnd}
                                  onChange={(e) => setEditWordEnd(parseFloat(e.target.value))}
                                  className="w-full bg-slate-950 border border-slate-850 rounded px-1.5 py-0.5 text-indigo-300"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                onClick={() => setEditingWordIdx(null)}
                                className="text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveEditWord}
                                className="text-[9px] font-bold text-white bg-indigo-600 px-2.5 py-1 rounded cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={wIdx}
                          onDoubleClick={() => startEditWord(lineIdx, wIdx, word)}
                          onClick={() => onSeek(word.start)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all duration-200 border cursor-pointer ${
                            isWordActive
                              ? "bg-indigo-500 text-white border-indigo-400 shadow-indigo-500/20 shadow-md scale-105"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                          }`}
                          title="Double click to edit word alignment"
                        >
                          {word.text} <span className="text-[9px] opacity-40 font-normal font-sans">({word.start.toFixed(1)}s)</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* General duration block */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pl-8 pt-1">
                    <span className="flex items-center gap-1">
                      <CornerDownRight className="w-3 h-3 text-slate-600" />
                      Span: {line.start.toFixed(2)}s to {line.end.toFixed(2)}s
                    </span>
                    <span className="bg-slate-900 border border-slate-850 px-1.5 py-0.2 rounded font-bold text-indigo-300">
                      {(line.end - line.start).toFixed(2)}s total
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
