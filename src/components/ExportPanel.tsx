import { useState, useRef, useEffect, RefObject } from "react";
import { VideoConfig, LyricLine, Template } from "../types";
import { API_BASE } from "../lib/apiBase";
import { Download, Film, Sparkles, Check, AlertTriangle, Monitor, PlayCircle, Loader2 } from "lucide-react";
import { drawLyrics, BackgroundState } from "../utils/canvasRenderer";
import { TEMPLATES, PALETTES } from "../templates";

interface ExportPanelProps {
  config: VideoConfig;
  onChangeConfig: (newConfig: Partial<VideoConfig>) => void;
  lyrics: LyricLine[];
  audioUrl: string | null;
  audioElementRef: RefObject<HTMLAudioElement | null>;
  activeTemplate: Template;
  waveformPeaks?: number[];
}

export default function ExportPanel({
  config,
  onChangeConfig,
  lyrics,
  audioUrl,
  audioElementRef,
  activeTemplate,
  waveformPeaks,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [exportExtension, setExportExtension] = useState("mp4");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgStateRef = useRef<BackgroundState>(new BackgroundState());
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    setIsMobile(mobileCheck);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const updates: Partial<VideoConfig> = {};
      let needsUpdate = false;
      if (config.resolution === "4k" || config.resolution === "1080p") {
        updates.resolution = "480p";
        needsUpdate = true;
      }
      if (config.fps === 60) {
        updates.fps = 30;
        needsUpdate = true;
      }
      if (needsUpdate) {
        onChangeConfig(updates);
      }
    }
  }, [isMobile, config.resolution, config.fps]);

  const handleExport = async (forceMimeType?: string) => {
    if (!audioUrl || !audioElementRef.current || lyrics.length === 0) {
      setExportError("Please upload an audio track and ensure you have lyrics to export.");
      return;
    }

    let wakeLock: any = null;
    let handleVisibilityChange: (() => void) | null = null;

    const audio = audioElementRef.current;
    setExporting(true);
    setProgress(0);
    setDownloadUrl(null);
    setExportError(null);
    setExportStatus("Configuring canvas pipelines...");

    try {
      // Request screen wake lock to avoid screen turning off during export
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await (navigator as any).wakeLock.request("screen");
        }
      } catch (wakeLockErr) {
        console.warn("Wake lock not available:", wakeLockErr);
      }
      // Determine size based on resolution selection
      let renderW = 848;
      let renderH = 480;
      if (config.resolution === "360p") {
        renderW = 640;
        renderH = 360;
      } else if (config.resolution === "480p") {
        renderW = 848;
        renderH = 480;
      } else if (config.resolution === "540p") {
        renderW = 960;
        renderH = 544;
      } else if (config.resolution === "720p") {
        renderW = 1280;
        renderH = 720;
      } else if (config.resolution === "1080p") {
        renderW = 1920;
        renderH = 1080;
      } else if (config.resolution === "4k") {
        renderW = 3840;
        renderH = 2160;
      }

      // Adjust dimensions dynamically for aspect ratio
      if (config.aspectRatio === "9:16") {
        const originalW = renderW;
        renderW = renderH;
        renderH = originalW;
      } else if (config.aspectRatio === "1:1") {
        renderW = renderH; // Square format based on height (e.g. 720x720, 1080x1080)
      }

      // Create an offscreen export canvas
      const canvas = document.createElement("canvas");
      canvas.width = renderW;
      canvas.height = renderH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not initialize 2D render context.");

      setExportStatus(`Preparing high-res ${config.resolution} canvas (${renderW}x${renderH})...`);

      // Prepare canvas capture stream at selected fps
      const canvasStream = (canvas as any).captureStream(config.fps);

      // Route audio to MediaStreamDestination so we bundle the audio track in the exported file
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Persistently cache the AudioContext on the global window to prevent
      // subsequent exports from throwing "HTMLMediaElement already connected to a different MediaElementSourceNode"
      // when the ExportPanel is unmounted and remounted.
      if (!(window as any).__exportAudioContext) {
        (window as any).__exportAudioContext = new AudioContextClass();
      }
      const audioCtx = (window as any).__exportAudioContext;
      audioCtxRef.current = audioCtx;

      // Resume AudioContext if suspended (browser autoplay policy security)
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      const dest = audioCtx.createMediaStreamDestination();
      
      // Persistently cache the MediaElementAudioSourceNode on the global window to prevent
      // subsequent exports from throwing "HTMLMediaElement already connected to a different MediaElementSourceNode"
      if (!(window as any).__audioSourceNodes) {
        (window as any).__audioSourceNodes = new Map();
      }
      
      let source: MediaElementAudioSourceNode;
      if ((window as any).__audioSourceNodes.has(audio)) {
        source = (window as any).__audioSourceNodes.get(audio);
      } else {
        source = audioCtx.createMediaElementSource(audio);
        (window as any).__audioSourceNodes.set(audio, source);
      }

      // Safe clean re-routing connection block
      try {
        source.disconnect();
      } catch (e) {}

      // Connect to output destination and speakers
      source.connect(dest);
      source.connect(audioCtx.destination);

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      // Set up MediaRecorder options
      let selectedMimeType = "video/webm;codecs=vp9,opus";
      let detectedExt = "webm";
      let options: { mimeType?: string; videoBitsPerSecond?: number; audioBitsPerSecond?: number } = {};

      const mimeTypesToTry = [
        "video/mp4;codecs=h264,aac",
        "video/mp4;codecs=avc1,aac",
        "video/webm;codecs=h264,opus",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus"
      ];

      // Calculate target bitrate to balance quality and mobile memory usage
      let videoBitsPerSecond = 2500000; // default 2.5 Mbps
      if (config.resolution === "360p") {
        videoBitsPerSecond = isMobile ? 350000 : 500000;
      } else if (config.resolution === "480p") {
        videoBitsPerSecond = isMobile ? 550000 : 800000;
      } else if (config.resolution === "540p") {
        videoBitsPerSecond = isMobile ? 800000 : 1200000;
      } else if (config.resolution === "720p") {
        videoBitsPerSecond = isMobile ? 1500000 : 2500000;
      } else if (config.resolution === "1080p") {
        videoBitsPerSecond = isMobile ? 3000000 : 5000000;
      } else if (config.resolution === "4k") {
        videoBitsPerSecond = 12000000;
      }

      if (typeof MediaRecorder !== "undefined") {
        let mimeTypeFound = false;
        const typesToTest = forceMimeType ? [forceMimeType] : mimeTypesToTry;
        for (const mime of typesToTest) {
          if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mime)) {
            selectedMimeType = mime;
            options = { 
              mimeType: mime,
              videoBitsPerSecond,
              audioBitsPerSecond: 128000
            };
            mimeTypeFound = true;
            const isRealH264 = /h264|avc1/i.test(mime);
            detectedExt = isRealH264 && mime.includes("mp4") ? "mp4" : "webm";
            break;
          }
        }
        if (!mimeTypeFound) {
          options = {
            videoBitsPerSecond,
            audioBitsPerSecond: 128000
          };
          detectedExt = "webm";
        }
      } else {
        throw new Error("Media recording is not supported in this browser. Please use Chrome, Firefox, or Safari.");
      }

      setExportStatus("Multiplexing video and audio streams...");

      const recordedChunks: Blob[] = [];
      
      let mediaRecorder: MediaRecorder;
      try {
        console.log("[Export Engine] Attempting to initialize MediaRecorder with options:", options);
        mediaRecorder = new MediaRecorder(combinedStream, options);
      } catch (firstErr) {
        console.warn("[Export Engine] Failed to initialize MediaRecorder with specified options, trying without bitrates...", firstErr);
        try {
          const simplifiedOptions = options.mimeType ? { mimeType: options.mimeType } : {};
          mediaRecorder = new MediaRecorder(combinedStream, simplifiedOptions);
        } catch (secondErr) {
          console.warn("[Export Engine] Failed with simplified options, trying default constructor (no options)...", secondErr);
          try {
            mediaRecorder = new MediaRecorder(combinedStream);
          } catch (thirdErr: any) {
            console.error("[Export Engine] All MediaRecorder attempts failed.", thirdErr);
            throw new Error(`MediaRecorder initialization failed: ${thirdErr.message || "Codec or configuration not supported"}`);
          }
        }
      }

      // Read back the ACTUAL mimeType settled on and derive detectedExt from that instead
      const actualMimeType = mediaRecorder.mimeType || selectedMimeType;
      const isRealH264 = /h264|avc1/i.test(actualMimeType);
      detectedExt = isRealH264 && actualMimeType.includes("mp4") ? "mp4" : "webm";
      selectedMimeType = actualMimeType;

      mediaRecorderRef.current = mediaRecorder;

      // Listen for visibility changes during export to pause audio & recording
      handleVisibilityChange = () => {
        if (document.hidden) {
          audio.pause();
          if (mediaRecorder.state === "recording") {
            mediaRecorder.pause();
          }
        } else if (!document.hidden && audio.paused) {
          audio.play().catch(() => {});
          if (mediaRecorder.state === "paused") {
            mediaRecorder.resume();
          }
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (wakeLock) {
          try {
            await wakeLock.release();
          } catch (e) {}
        }
        if (handleVisibilityChange) {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        }

        const videoBlob = new Blob(recordedChunks, { type: selectedMimeType });
        
        if (exportExtension === "mp4" && detectedExt !== "mp4") {
          try {
            setExportStatus("Transcoding recorded stream to high-compatibility standard MP4...");
            setProgress(99);

            const formData = new FormData();
            formData.append("video", videoBlob, "render.webm");

            const response = await fetch(`${API_BASE}/api/transcode`, {
              method: "POST",
              body: formData
            });

            if (!response.ok) {
              throw new Error("Server transcoding pipeline failed to compile standard format.");
            }

            const mp4Blob = await response.blob();
            const videoUrl = URL.createObjectURL(mp4Blob);
            setDownloadUrl(videoUrl);
            setExporting(false);
            setExportStatus("Export completed successfully!");
          } catch (transcodeErr: any) {
            console.error("[Transcoder Fallback Active]:", transcodeErr);
            const videoUrl = URL.createObjectURL(videoBlob);
            setDownloadUrl(videoUrl);
            setExportExtension("webm");
            setExportError("MP4 transcoding pipeline was busy, downloaded the high-quality WebM draft instead.");
            setExporting(false);
          }
        } else {
          const videoUrl = URL.createObjectURL(videoBlob);
          setDownloadUrl(videoUrl);
          setExporting(false);
          setExportStatus("Export completed successfully!");
        }

        try {
          source.disconnect();
          source.connect(audioCtx.destination);
        } catch (cleanupErr) {
          console.warn("Cleanup audio graph issue:", cleanupErr);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event.error);
        
        // Transparent fallback to safe WebM format if MP4 encoding fails
        if (selectedMimeType.startsWith("video/mp4") && forceMimeType !== "video/webm") {
          console.warn("[Export Engine] MP4 encoder error. Falling back to safe WebM format...");
          setExportStatus("MPEG-4 hardware encoder rejected resolution profile. Retrying with safe WebM...");
          
          audio.pause();
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          try {
            mediaRecorder.stop();
          } catch (e) {}
          
          setTimeout(() => {
            handleExport("video/webm");
          }, 500);
          return;
        }

        setExportError(event.error?.message || "Recording failed unexpectedly. Try a lower resolution or FPS.");
        setExporting(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };

      // Reset audio to start
      audio.currentTime = 0;
      const totalDuration = audio.duration || lyrics[lyrics.length - 1].end + 2.0;

      // Start recording with 1000ms timeslices. This is CRITICAL for mobile
      // compatibility as it prevents the browser's native C++ MediaRecorder encoder
      // from accumulating frames in raw RAM buffers and crashing the browser tab.
      mediaRecorder.start(1000);
      audio.play();

      setExportStatus(`Recording professional ${config.fps}fps kinetic motion graphics...`);

      const palette = PALETTES.find((p) => p.id === config.customPaletteId) || activeTemplate.palette;

      lastFrameTimeRef.current = 0;

      const renderLoop = (timestamp: number) => {
        const frameInterval = 1000 / config.fps;
        if (timestamp - lastFrameTimeRef.current >= frameInterval) {
          lastFrameTimeRef.current = timestamp;

          const time = audio.currentTime;
          const progressPercent = Math.min(100, (time / totalDuration) * 100);
          setProgress(progressPercent);

          bgStateRef.current.draw(ctx, time, renderW, renderH, config.backgroundEffect, palette);
          drawLyrics(ctx, time, lyrics, renderW, renderH, config, activeTemplate, waveformPeaks);

          if (!(time < totalDuration && !audio.paused)) {
            if (mediaRecorder.state !== "inactive") {
              try {
                mediaRecorder.stop();
              } catch (stopErr) {
                console.warn("Error stopping media recorder on completion:", stopErr);
              }
            }
            return; // stop scheduling further frames
          }
        }
        animationFrameRef.current = requestAnimationFrame(renderLoop);
      };

      animationFrameRef.current = requestAnimationFrame(renderLoop);

    } catch (err: any) {
      if (wakeLock) {
        try {
          await wakeLock.release();
        } catch (e) {}
      }
      if (handleVisibilityChange) {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      console.error(err);
      setExportError(err.message || "An error occurred during video rendering.");
      setExporting(false);
    }
  };

  const cancelExport = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (stopErr) {
        console.warn("Error stopping media recorder on cancel:", stopErr);
      }
    }
    setExporting(false);
    setExportStatus("Render cancelled.");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 overflow-hidden shadow-xl" id="export-panel">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <Film className="w-5 h-5 text-indigo-400" />
        <h3 className="text-md font-semibold text-slate-100 font-sans tracking-tight">
          Export & Render Engine
        </h3>
      </div>

      {exporting ? (
        // Render Active Status
        <div className="flex flex-col items-center justify-center py-6 text-center" id="export-active-state">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <h4 className="text-sm font-bold text-slate-200 mb-1">
            Rendering Video: {progress.toFixed(0)}%
          </h4>
          <p className="text-xs text-indigo-300 font-sans italic mb-4 max-w-xs truncate">
            {exportStatus}
          </p>

          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden mb-4">
            <div className="bg-indigo-500 h-full transition-all duration-150" style={{ width: `${progress}%` }} />
          </div>

          <p className="text-[10px] text-amber-400 bg-amber-950/30 border border-amber-900/40 px-3 py-1.5 rounded-lg mb-6 max-w-xs leading-normal font-sans">
            ⚠️ Keep this tab open and your screen on until export finishes.
          </p>

          <button
            onClick={cancelExport}
            className="px-4 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/20 text-rose-300 text-xs font-semibold rounded-lg cursor-pointer transition-all"
          >
            Cancel Render
          </button>
        </div>
      ) : (
        // Configuration & Action Menu
        <div className="space-y-4" id="export-idle-state">
          {/* Mobile Safeguard Warning */}
          {isMobile && (
            <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3.5 py-3 rounded-xl shadow-inner font-sans leading-relaxed">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Mobile Safeguard Active</span>
                Canvas video recording on mobile devices is highly resource-intensive. To guarantee your tab does not crash, we recommend using <strong>480p or 360p @ 30 FPS</strong>.
              </div>
            </div>
          )}

          {/* Output Format Information */}
          <div>
            <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block flex items-center gap-1.5">
              <span>Output Format</span>
            </label>
            <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-200">High-Compatibility MP4</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Optimized for social sharing (Instagram, WhatsApp, TikTok)</span>
              </div>
              <span className="text-[10px] text-indigo-400 font-bold bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/40 font-mono">H.264 MP4</span>
            </div>
          </div>

          {/* Resolution Choice */}
          <div>
            <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block">
              Resolution Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["360p", "480p", "540p", "720p", "1080p", "4k"] as const).map((res) => {
                const isActive = config.resolution === res;
                const isDisabled = isMobile && (res === "1080p" || res === "4k");
                return (
                  <button
                    key={res}
                    disabled={isDisabled}
                    onClick={() => onChangeConfig({ resolution: res })}
                    className={`p-2 rounded-lg border text-xs font-semibold font-mono flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                      isDisabled
                        ? "opacity-35 cursor-not-allowed bg-slate-950/20 border-slate-900/40 text-slate-600"
                        : isActive
                        ? "bg-indigo-600/90 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <span>{res.toUpperCase()}</span>
                    <span className="text-[8px] opacity-60">
                      {isDisabled ? "Locked" : res === "360p" ? "640x360" : res === "480p" ? "848x480" : res === "540p" ? "960x544" : res === "720p" ? "1280x720" : res === "1080p" ? "1920x1080" : "3840x2160"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FPS Choice */}
          <div>
            <label className="text-xs font-bold text-slate-400 tracking-wider uppercase font-mono mb-2 block">
              Motion Graphics Framerate
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([30, 60] as const).map((fps) => {
                const isActive = config.fps === fps;
                const isDisabled = isMobile && fps === 60;
                return (
                  <button
                    key={fps}
                    disabled={isDisabled}
                    onClick={() => onChangeConfig({ fps })}
                    className={`p-2.5 rounded-lg border text-xs font-semibold font-mono flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isDisabled
                        ? "opacity-35 cursor-not-allowed bg-slate-950/20 border-slate-900 text-slate-600"
                        : isActive
                        ? "bg-indigo-600/90 border-indigo-500 text-white shadow-lg shadow-indigo-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <span>{fps} FPS</span>
                    <span className="text-[9px] opacity-60">
                      {isDisabled ? "Locked" : fps === 60 ? "Pro Motion Smooth" : "Standard Cinema"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {exportError && (
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {downloadUrl ? (
            // Success State
            <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-4 flex flex-col items-center text-center gap-3" id="export-success-state">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Check className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-300">Video Rendered Successfully!</span>
                <span className="text-[10px] text-slate-300 mt-0.5 font-sans leading-normal">
                  Encoded in highly compatible format. Tap download below to save and share instantly to WhatsApp, Instagram, iMessage, and more.
                </span>
              </div>
              <a
                href={downloadUrl}
                download={`kinetic_lyrics_${config.resolution}_${config.fps}fps.${exportExtension}`}
                className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-lg shadow-emerald-500/10"
              >
                <Download className="w-4 h-4" />
                Download Lyric Video
              </a>
            </div>
          ) : (
            // Trigger Button
            <button
              onClick={handleExport}
              disabled={!audioUrl}
              className={`w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                audioUrl
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/15"
                  : "bg-slate-800 text-slate-500 border border-slate-800/80 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4 text-indigo-300" />
              Render & Export ({config.resolution.toUpperCase()} @ {config.fps}fps)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
