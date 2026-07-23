import { LyricLine, Word } from "../types";

export interface AudioAnalysis {
  bpm: number;
  beats: number[];
  vocals: { start: number; end: number }[];
  silences: { start: number; end: number }[];
  instrumentals: { start: number; end: number; type: "intro" | "break" | "outro" }[];
}

/**
 * Decodes an audio file into an AudioBuffer using standard browser AudioContext
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Use the modern promise-based decodeAudioData if available, fallback to callback
    return await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }
}

/**
 * Analyzes an AudioBuffer using OfflineAudioContext and digital signal processing
 * to detect BPM, beats, vocal segments, silences, and instrumental regions.
 */
export async function analyzeAudio(audioBuffer: AudioBuffer): Promise<AudioAnalysis> {
  const duration = audioBuffer.duration;
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Analyze mono first channel

  console.log(`[AudioAnalyzer] Analyzing ${duration.toFixed(2)}s track at ${sampleRate}Hz...`);

  // To make Web Audio API do the filtering, we set up OfflineAudioContexts.
  // 1. Create a lowpass path (under 150Hz) for beat/tempo analysis
  const beatBpm = await detectBPMOffline(audioBuffer);
  
  // 2. Vocal detection: filter with bandpass (300Hz - 3000Hz) to isolate human voice
  const vocals = await detectVocalsOffline(audioBuffer);

  // 3. Silence detection: find areas with extremely low RMS energy
  const silences = detectSilences(channelData, sampleRate, duration);

  // 4. Instrumental detection: complement of vocals and silences
  const instrumentals = detectInstrumentals(vocals, silences, duration);

  console.log(`[AudioAnalyzer] Analysis complete:`, {
    bpm: beatBpm.bpm,
    vocalSegmentsCount: vocals.length,
    silencesCount: silences.length,
    instrumentalsCount: instrumentals.length,
  });

  return {
    bpm: beatBpm.bpm,
    beats: beatBpm.beats,
    vocals,
    silences,
    instrumentals,
  };
}

/**
 * Detects BPM and beat positions using OfflineAudioContext lowpass filtering and peak autocorrelation.
 */
async function detectBPMOffline(audioBuffer: AudioBuffer): Promise<{ bpm: number; beats: number[] }> {
  const duration = audioBuffer.duration;
  // Use a smaller sample rate for faster offline rendering
  const targetSampleRate = 8000;
  const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineContext(1, targetSampleRate * duration, targetSampleRate);

  // Buffer source node
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Lowpass filter (150Hz) to isolate kick drum and primary rhythm transients
  const filter = offlineCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 150;

  source.connect(filter);
  filter.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const filteredData = renderedBuffer.getChannelData(0);

  // Compute energy envelope in 20ms chunks (hop size 10ms)
  const chunkSize = Math.floor(targetSampleRate * 0.02); // 20ms
  const hopSize = Math.floor(targetSampleRate * 0.01);  // 10ms
  const envelopes: number[] = [];
  const times: number[] = [];

  for (let i = 0; i < filteredData.length - chunkSize; i += hopSize) {
    let sumSquares = 0;
    for (let j = 0; j < chunkSize; j++) {
      sumSquares += filteredData[i + j] * filteredData[i + j];
    }
    const rms = Math.sqrt(sumSquares / chunkSize);
    envelopes.push(rms);
    times.push((i + chunkSize / 2) / targetSampleRate);
  }

  // First-order forward difference (onset detection curve)
  const onsets: number[] = [];
  for (let i = 1; i < envelopes.length; i++) {
    onsets.push(Math.max(0, envelopes[i] - envelopes[i - 1]));
  }

  // Find onset peaks
  const peaks: { index: number; time: number; value: number }[] = [];
  const localWindow = 15; // Local window size for peak detection
  for (let i = localWindow; i < onsets.length - localWindow; i++) {
    const val = onsets[i];
    let isPeak = true;
    for (let j = -localWindow; j <= localWindow; j++) {
      if (onsets[i + j] > val) {
        isPeak = false;
        break;
      }
    }
    if (isPeak && val > 0.01) {
      peaks.push({ index: i, time: times[i], value: val });
    }
  }

  // Calculate inter-onset intervals (IOIs) to estimate BPM
  const intervals: number[] = [];
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < Math.min(peaks.length, i + 8); j++) {
      const diff = peaks[j].time - peaks[i].time;
      if (diff >= 0.3 && diff <= 1.5) { // 40 BPM to 200 BPM range
        intervals.push(diff);
      }
    }
  }

  // Bin intervals to find the most common one (tempo)
  let bestBpm = 120; // Default
  if (intervals.length > 0) {
    const binSize = 0.01; // 10ms bins
    const bins: { [key: number]: number } = {};
    intervals.forEach((val) => {
      const b = Math.round(val / binSize) * binSize;
      bins[b] = (bins[b] || 0) + 1;
    });

    let maxCount = 0;
    let bestInterval = 0.5; // 120 bpm
    Object.keys(bins).forEach((key) => {
      const interval = parseFloat(key);
      if (bins[interval] > maxCount) {
        maxCount = bins[interval];
        bestInterval = interval;
      }
    });

    const calculatedBpm = 60 / bestInterval;
    // Normalize BPM to be between 70 and 140
    bestBpm = calculatedBpm;
    while (bestBpm < 70) bestBpm *= 2;
    while (bestBpm > 140) bestBpm /= 2;
    bestBpm = Math.round(bestBpm);
  }

  // Generate perfect grid beats aligned with actual peak transients
  const beatDuration = 60 / bestBpm;
  const beats: number[] = [];
  
  // Find the first major peak to align the beat grid
  const majorPeaks = peaks.filter(p => p.value > 0.05).sort((a, b) => b.value - a.value);
  let startOffset = majorPeaks.length > 0 ? majorPeaks[0].time % beatDuration : 0;

  for (let t = startOffset; t < duration; t += beatDuration) {
    beats.push(Number(t.toFixed(3)));
  }

  return { bpm: bestBpm, beats };
}

/**
 * Isolates vocals with an offline bandpass filter (300Hz-3000Hz) and extracts vocal onset timelines.
 */
async function detectVocalsOffline(audioBuffer: AudioBuffer): Promise<{ start: number; end: number }[]> {
  const duration = audioBuffer.duration;
  const targetSampleRate = 4000; // Low rate is fine for energy tracking
  const OfflineContext = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineContext(1, targetSampleRate * duration, targetSampleRate);

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  // Bandpass filter to capture human vocal frequencies
  const bandpass = offlineCtx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1150; // Central frequency
  bandpass.Q.value = 1.2; // Moderately wide Q

  source.connect(bandpass);
  bandpass.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const vocalData = renderedBuffer.getChannelData(0);

  // Compute energy in 150ms windows
  const windowSeconds = 0.15;
  const windowSize = Math.floor(targetSampleRate * windowSeconds);
  const hopSize = Math.floor(targetSampleRate * 0.05); // 50ms slide

  const vocalSustained: { time: number; energy: number }[] = [];
  let maxEnergy = 0.0001;

  for (let i = 0; i < vocalData.length - windowSize; i += hopSize) {
    let sumSquares = 0;
    for (let j = 0; j < windowSize; j++) {
      sumSquares += vocalData[i + j] * vocalData[i + j];
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    vocalSustained.push({
      time: (i + windowSize / 2) / targetSampleRate,
      energy: rms,
    });
    if (rms > maxEnergy) maxEnergy = rms;
  }

  // Dynamic threshold: vocal is present if filtered energy exceeds 8% of peak vocal band energy
  const threshold = maxEnergy * 0.08;
  const activeSegments: { start: number; end: number }[] = [];
  let currentStart: number | null = null;

  for (let i = 0; i < vocalSustained.length; i++) {
    const isVocal = vocalSustained[i].energy > threshold;
    const t = vocalSustained[i].time;

    if (isVocal && currentStart === null) {
      currentStart = t;
    } else if (!isVocal && currentStart !== null) {
      // End segment
      if (t - currentStart >= 0.4) { // Only keep segments at least 400ms long
        activeSegments.push({ start: currentStart, end: t });
      }
      currentStart = null;
    }
  }

  if (currentStart !== null && duration - currentStart >= 0.4) {
    activeSegments.push({ start: currentStart, end: duration });
  }

  // Merge segments close to each other (closer than 1.5 seconds) to handle breath pauses
  const merged: { start: number; end: number }[] = [];
  if (activeSegments.length > 0) {
    let prev = activeSegments[0];
    for (let i = 1; i < activeSegments.length; i++) {
      const curr = activeSegments[i];
      if (curr.start - prev.end < 1.5) {
        prev.end = curr.end;
      } else {
        merged.push(prev);
        prev = curr;
      }
    }
    merged.push(prev);
  }

  return merged;
}

/**
 * Locates moments of total or near silence in the audio channel.
 */
function detectSilences(channelData: Float32Array, sampleRate: number, duration: number): { start: number; end: number }[] {
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms
  const hopSize = Math.floor(sampleRate * 0.05); // 50ms
  const silenceThreshold = 0.005; // -46dB approximate threshold

  const silences: { start: number; end: number }[] = [];
  let currentStart: number | null = null;

  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let sumSquares = 0;
    for (let j = 0; j < windowSize; j++) {
      sumSquares += channelData[i + j] * channelData[i + j];
    }
    const rms = Math.sqrt(sumSquares / windowSize);
    const t = (i + windowSize / 2) / sampleRate;

    const isSilent = rms < silenceThreshold;

    if (isSilent && currentStart === null) {
      currentStart = t;
    } else if (!isSilent && currentStart !== null) {
      if (t - currentStart >= 0.5) { // Minimum 500ms silence
        silences.push({ start: currentStart, end: t });
      }
      currentStart = null;
    }
  }

  if (currentStart !== null && duration - currentStart >= 0.5) {
    silences.push({ start: currentStart, end: duration });
  }

  return silences;
}

/**
 * Extracts instrumental regions as periods where vocal energy is absent
 */
function detectInstrumentals(
  vocals: { start: number; end: number }[],
  silences: { start: number; end: number }[],
  duration: number
): { start: number; end: number; type: "intro" | "break" | "outro" }[] {
  const instrumentals: { start: number; end: number; type: "intro" | "break" | "outro" }[] = [];
  if (vocals.length === 0) {
    return [{ start: 0, end: duration, type: "intro" }];
  }

  // 1. Check for Intro (before the first vocal start)
  const firstVocal = vocals[0].start;
  if (firstVocal > 2.0) {
    instrumentals.push({ start: 0, end: firstVocal, type: "intro" });
  }

  // 2. Check for Breaks (between vocal segments)
  for (let i = 0; i < vocals.length - 1; i++) {
    const endVoc = vocals[i].end;
    const nextStartVoc = vocals[i + 1].start;
    const breakDuration = nextStartVoc - endVoc;

    // A break must be at least 3 seconds long to count as a structural instrumental break
    if (breakDuration >= 3.0) {
      // Exclude silent zones inside the break
      let actualStart = endVoc;
      let actualEnd = nextStartVoc;

      // Snug target boundaries around silence overlaps if present
      silences.forEach((sil) => {
        if (sil.start >= endVoc && sil.end <= nextStartVoc) {
          if (sil.start - actualStart > 1.0) {
            actualEnd = sil.start;
          } else {
            actualStart = sil.end;
          }
        }
      });

      if (actualEnd - actualStart >= 2.0) {
        instrumentals.push({ start: actualStart, end: actualEnd, type: "break" });
      }
    }
  }

  // 3. Check for Outro (after the last vocal end)
  const lastVocal = vocals[vocals.length - 1].end;
  if (duration - lastVocal > 2.0) {
    instrumentals.push({ start: lastVocal, end: duration, type: "outro" });
  }

  return instrumentals;
}

/**
 * Snaps lyric line starts and ends to the actual nearest vocal segments sequentially.
 * Resolves overlapping boundaries and snaps constituent words proportionally.
 */
export function autoAlignLyricsToVocals(lyrics: LyricLine[], vocals: { start: number; end: number }[]): LyricLine[] {
  if (vocals.length === 0 || lyrics.length === 0) return lyrics; // No vocal data to align to

  const sortedLyrics = [...lyrics].sort((a, b) => a.start - b.start);
  const sortedVocals = [...vocals].sort((a, b) => a.start - b.start);

  const result: LyricLine[] = [];
  let vocalIndex = 0;

  for (let i = 0; i < sortedLyrics.length; i++) {
    const line = sortedLyrics[i];
    
    // Find the vocal segment for this lyric line.
    let bestVocal = sortedVocals[Math.min(vocalIndex, sortedVocals.length - 1)];
    
    if (vocalIndex < sortedVocals.length) {
      const currentVocal = sortedVocals[vocalIndex];
      // If the current vocal segment ends way before the lyric line starts, advance the vocal index
      if (currentVocal.end < line.start - 5.0 && vocalIndex < sortedVocals.length - 1) {
        vocalIndex++;
        bestVocal = sortedVocals[vocalIndex];
      }
    }

    let newStart = line.start;
    let newEnd = line.end;

    if (bestVocal) {
      // Only snap if within a reasonable distance (e.g., 6 seconds) to prevent massive jumps
      if (Math.abs(line.start - bestVocal.start) < 6.0) {
        newStart = bestVocal.start;
      }
      if (Math.abs(line.end - bestVocal.end) < 6.0) {
        newEnd = bestVocal.end;
      }
    }

    // Safeguard start < end
    if (newStart >= newEnd) {
      newStart = line.start;
      newEnd = line.end;
    }

    // Move to next vocal segment sequentially for the next lyric line
    if (vocalIndex < sortedVocals.length - 1) {
      vocalIndex++;
    }

    // Align words proportionally within the newly adjusted boundaries
    const originalDuration = line.end - line.start;
    const newDuration = newEnd - newStart;
    const scale = originalDuration > 0 ? newDuration / originalDuration : 1.0;

    const alignedWords: Word[] = (line.words || []).map((w) => {
      const relStart = w.start - line.start;
      const relEnd = w.end - line.start;

      return {
        text: w.text,
        start: Number((newStart + relStart * scale).toFixed(2)),
        end: Number((newStart + relEnd * scale).toFixed(2)),
      };
    });

    result.push({
      text: line.text,
      start: Number(newStart.toFixed(2)),
      end: Number(newEnd.toFixed(2)),
      words: alignedWords,
    });
  }

  // Resolve any overlapping boundaries among the aligned results
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].end > result[i + 1].start) {
      result[i].end = result[i + 1].start;
      
      // Snug fit word times of current line
      if (result[i].words) {
        result[i].words = result[i].words.map(w => {
          if (w.start >= result[i].end) {
            return { ...w, start: Math.max(result[i].start, result[i].end - 0.15), end: result[i].end };
          }
          if (w.end > result[i].end) {
            return { ...w, end: result[i].end };
          }
          return w;
        });
      }
    }
  }

  return result.sort((a, b) => a.start - b.start);
}

/**
 * Downsamples the first channel's data into barCount buckets,
 * each value being the peak (max absolute sample value) within that bucket,
 * normalized to a 0-1 range.
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer, barCount: number = 100): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const samplesPerBar = Math.floor(totalSamples / barCount);
  const peaks: number[] = [];
  let maxPeak = 0;

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = i === barCount - 1 ? totalSamples : (i + 1) * samplesPerBar;
    
    let localMax = 0;
    for (let s = start; s < end; s++) {
      const val = Math.abs(channelData[s]);
      if (val > localMax) {
        localMax = val;
      }
    }
    peaks.push(localMax);
    if (localMax > maxPeak) {
      maxPeak = localMax;
    }
  }

  if (maxPeak > 0) {
    return peaks.map(p => Number((p / maxPeak).toFixed(4)));
  }
  return peaks;
}

