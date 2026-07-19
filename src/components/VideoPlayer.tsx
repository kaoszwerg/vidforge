import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { IconButton } from "./ui/IconButton";
import { ProgressBar } from "./ui/ProgressBar";
import { Slider } from "./ui/Slider";
import { usePreparePlayer, type PreparedSource } from "../hooks/usePreparePlayer";
import { useT } from "../i18n";
import { errorMessage } from "../lib/errors";
import { formatDuration } from "../lib/format";

export interface VideoPlayerProps {
  /** Absolute path of the video to play, as produced by `scan_folder`. */
  path: string;
}

interface ReadyPlayerProps {
  source: PreparedSource;
  t: ReturnType<typeof useT>;
  volume: number;
  muted: boolean;
  onVolumeChange: (value: number) => void;
  onMutedChange: (muted: boolean) => void;
}

/**
 * The `<video>` element and its HUD transport bar, rendered once a source is ready. `VideoPlayer` below
 * mounts this with `key={source.srcUrl}`, so a new (or re-prepared) source gets fresh play/position/
 * duration state simply by remounting — the idiomatic alternative to resetting state from inside an
 * effect, which `react-hooks/set-state-in-effect` rejects (an effect may synchronize an external system
 * from React state; it may not use React state to reset React state). `volume`/`muted` are owned by the
 * parent instead, specifically so they are NOT reset by that remount — every other video player keeps the
 * volume/mute choice across tracks, and this one does too.
 */
function ReadyPlayer({
  source,
  t,
  volume,
  muted,
  onVolumeChange,
  onMutedChange,
}: ReadyPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Set only by the <video> element's own `error` DOM event — a media decode/network failure that
  // arrives as an event, never a thrown exception, so it needs its own handling here rather than relying
  // on the app's global crash handlers (rule:crash-handling), which never see it.
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Sync the DOM <video>'s volume/mute from the parent-owned state. Neither is settable as a React/HTML
  // prop: `volume` has no reflected content attribute at all, and `muted` needs the live property kept
  // in sync, not just an initial value — exactly the "update an external system from React state" case
  // effects exist for (unlike the state reset this component deliberately avoids, above).
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.volume = volume;
  }, [volume]);
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const onFullscreenChange = () =>
      setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setPlaybackError(t("player.playbackError")));
    } else {
      video.pause();
    }
  };

  const onSeek = (value: number) => {
    const video = videoRef.current;
    if (video) video.currentTime = value;
    setCurrentTime(value);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      void document.exitFullscreen?.();
      return;
    }
    // Fullscreen may be unavailable or the request denied (a platform/webview restriction —
    // rule:cross-platform) — not fatal, playback just continues inline.
    void el.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div ref={containerRef} className="hud-clip-sm bg-elevated space-y-3 p-2">
      {playbackError ? (
        <p className="text-danger text-sm">{playbackError}</p>
      ) : (
        <>
          <div className="bg-deep flex aspect-video w-full items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              src={source.srcUrl}
              className="h-full w-full object-contain"
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setPlaybackError(t("player.playbackError"))}
            />
          </div>

          <div className="flex items-center gap-2">
            <IconButton label={playing ? t("player.pause") : t("player.play")} onClick={togglePlay}>
              {playing ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
            </IconButton>

            <span className="text-dim w-10 shrink-0 text-right font-mono text-xs">
              {formatDuration(currentTime)}
            </span>
            <Slider
              value={currentTime}
              min={0}
              max={duration > 0 ? duration : 0}
              step={0.1}
              onChange={onSeek}
              ariaLabel={t("player.seek")}
              disabled={duration <= 0}
              className="flex-1"
            />
            <span className="text-dim w-10 shrink-0 font-mono text-xs">
              {formatDuration(duration)}
            </span>

            <IconButton
              label={muted ? t("player.unmute") : t("player.mute")}
              onClick={() => onMutedChange(!muted)}
            >
              {muted || volume === 0 ? (
                <VolumeX size={14} strokeWidth={2} />
              ) : (
                <Volume2 size={14} strokeWidth={2} />
              )}
            </IconButton>
            <Slider
              value={muted ? 0 : volume}
              min={0}
              max={1}
              step={0.05}
              onChange={onVolumeChange}
              ariaLabel={t("player.volume")}
              className="w-20"
            />

            <IconButton label={t("player.fullscreen")} onClick={toggleFullscreen}>
              {fullscreen ? (
                <Minimize size={14} strokeWidth={2} />
              ) : (
                <Maximize size={14} strokeWidth={2} />
              )}
            </IconButton>
          </div>

          {source.transcoded ? (
            <p className="text-dim text-xs">{t("player.transcodedNote")}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Fully HUD-skinned internal player (ADR-PROJ-001 §5): an HTML5 `<video>` embedded directly in the
 * Detail view — no VLC, no separate OS window. `usePreparePlayer` turns `path` into a cached,
 * webview-playable source first (remux or transcode happens backend-side); `ReadyPlayer` above drives it
 * through a custom transport bar built from HUD primitives once ready. The native `controls` attribute is
 * never set — every control the user touches (play/pause, seek, volume, fullscreen) is
 * `IconButton`/`Slider` from `src/components/ui`, so nothing here is OS chrome (ADR-APP-026). `<video>`
 * itself is not banned outside the primitive layer (see `eslint.config.mjs`'s `no-restricted-syntax`), so
 * it stays where the feature that owns it lives.
 */
export function VideoPlayer({ path }: VideoPlayerProps) {
  const t = useT();
  const { source, isPending, isError, error } = usePreparePlayer(path);

  // Owned here rather than in ReadyPlayer, specifically so a source change (ReadyPlayer remounts by key
  // below) does not reset the user's volume/mute choice mid-session.
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const onVolumeChange = (value: number) => {
    setVolume(value);
    if (value > 0 && muted) setMuted(false);
  };

  if (isPending) {
    return (
      <div className="space-y-2">
        <p className="text-dim text-sm">{t("player.preparing")}</p>
        <ProgressBar percent={0} indeterminate />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-danger text-sm">{t("player.error", { message: errorMessage(error) })}</p>
    );
  }

  if (!source) return null;

  return (
    <ReadyPlayer
      key={source.srcUrl}
      source={source}
      t={t}
      volume={volume}
      muted={muted}
      onVolumeChange={onVolumeChange}
      onMutedChange={setMuted}
    />
  );
}
