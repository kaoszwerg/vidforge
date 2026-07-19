//! The job queue (ADR-PROJ-001 §4). A single dispatcher pulls enqueued job ids and runs up to
//! `concurrency` of them at once (a `Semaphore`); each job spawns one ffmpeg child, parses its
//! `-progress pipe:1` stream into a percent, and can be cancelled (the child is killed and the partial
//! output removed). Every state/percent change is emitted as a `job://update` event.
//!
//! Crash safety (ADR-APP-032): the two spawned tasks are recorded in `crash-boundaries.json`. The
//! dispatcher only ends when its channel closes; a single job's failure becomes `JobState::Failed` and
//! never takes the worker or dispatcher down.

use crate::dto::{CustomEncode, JobDto, JobState};
use crate::jobs::preset;
use crate::state::AppState;
use std::collections::HashMap;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::sync::{mpsc, Notify, Semaphore};

/// The Tauri event name carrying a [`JobDto`] on every job update.
pub const JOB_EVENT: &str = "job://update";

struct Cancel {
    flag: AtomicBool,
    notify: Notify,
}

struct JobRecord {
    dto: JobDto,
    custom: Option<CustomEncode>,
    cancel: Arc<Cancel>,
}

struct Inner {
    jobs: Mutex<HashMap<String, JobRecord>>,
    order: Mutex<Vec<String>>,
    app: AppHandle,
    next_id: AtomicU64,
    tx: mpsc::UnboundedSender<String>,
}

/// Managed state: the handle the commands use to enqueue/cancel/list jobs.
pub struct JobQueue {
    inner: Arc<Inner>,
}

impl JobQueue {
    /// Start the queue with a fixed worker `concurrency` (from settings). Spawns the dispatcher.
    pub fn start(app: AppHandle, concurrency: usize) -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        let inner = Arc::new(Inner {
            jobs: Mutex::new(HashMap::new()),
            order: Mutex::new(Vec::new()),
            app,
            next_id: AtomicU64::new(1),
            tx,
        });
        let disp = inner.clone();
        tauri::async_runtime::spawn(dispatcher(disp, rx, concurrency.max(1)));
        tracing::info!(concurrency = concurrency.max(1), "job queue started");
        Self { inner }
    }

    /// Create a job (state `Queued`), record it, emit it, and hand it to the dispatcher. Returns the DTO.
    pub fn enqueue(
        &self,
        input_path: String,
        preset_id: String,
        custom: Option<CustomEncode>,
        output_dir: &Path,
    ) -> JobDto {
        let id = format!("job-{}", self.inner.next_id.fetch_add(1, Ordering::SeqCst));
        let input = Path::new(&input_path);
        let input_name = input
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&input_path)
            .to_string();
        let output = preset::output_path(input, output_dir, &preset_id, custom.as_ref());
        let dto = JobDto {
            id: id.clone(),
            input_path: input_path.clone(),
            input_name,
            output_path: output.to_string_lossy().to_string(),
            preset_id,
            state: JobState::Queued,
            percent: 0.0,
            error: None,
        };
        {
            let mut jobs = self.inner.jobs.lock().expect("jobs lock");
            jobs.insert(
                id.clone(),
                JobRecord {
                    dto: dto.clone(),
                    custom,
                    cancel: Arc::new(Cancel {
                        flag: AtomicBool::new(false),
                        notify: Notify::new(),
                    }),
                },
            );
            self.inner
                .order
                .lock()
                .expect("order lock")
                .push(id.clone());
        }
        emit(&self.inner, &dto);
        // The dispatcher outlives the queue for the process lifetime; a send error would only mean it is
        // gone, in which case the job stays Queued and visible rather than vanishing.
        if self.inner.tx.send(id).is_err() {
            tracing::error!("job dispatcher is gone; job stays queued");
        }
        tracing::info!(job = %dto.id, input = %dto.input_path, preset = %dto.preset_id, "job enqueued");
        dto
    }

    /// Request cancellation of a job. A running job's ffmpeg child is killed; a queued one is skipped.
    pub fn cancel(&self, id: &str) {
        let jobs = self.inner.jobs.lock().expect("jobs lock");
        if let Some(rec) = jobs.get(id) {
            rec.cancel.flag.store(true, Ordering::SeqCst);
            rec.cancel.notify.notify_one();
            tracing::info!(job = id, "job cancel requested");
        }
    }

    /// A snapshot of all jobs, in enqueue order.
    pub fn list(&self) -> Vec<JobDto> {
        let jobs = self.inner.jobs.lock().expect("jobs lock");
        let order = self.inner.order.lock().expect("order lock");
        order
            .iter()
            .filter_map(|id| jobs.get(id).map(|r| r.dto.clone()))
            .collect()
    }
}

async fn dispatcher(
    inner: Arc<Inner>,
    mut rx: mpsc::UnboundedReceiver<String>,
    concurrency: usize,
) {
    let sem = Arc::new(Semaphore::new(concurrency));
    loop {
        let Some(id) = rx.recv().await else {
            tracing::debug!("job dispatcher channel closed; stopping");
            break;
        };
        let permit = match sem.clone().acquire_owned().await {
            Ok(p) => p,
            Err(_) => break, // semaphore closed — never happens here, but handled rather than assumed
        };
        let inner2 = inner.clone();
        tauri::async_runtime::spawn(async move {
            run_job(inner2, id).await;
            drop(permit);
        });
    }
}

async fn run_job(inner: Arc<Inner>, id: String) {
    let Some((input, preset_id, custom, output, cancel)) = snapshot(&inner, &id) else {
        return;
    };
    if cancel.flag.load(Ordering::SeqCst) {
        set_state(&inner, &id, JobState::Cancelled, 0.0, None);
        return;
    }
    let Some((ffmpeg, ffprobe)) = resolve_tools(&inner.app) else {
        set_state(
            &inner,
            &id,
            JobState::Failed,
            0.0,
            Some("ffmpeg is not available".to_string()),
        );
        return;
    };
    set_state(&inner, &id, JobState::Running, 0.0, None);

    let duration = probe_duration(&ffprobe, &input).await;
    let args = match preset::build_args(
        &preset_id,
        custom.as_ref(),
        Path::new(&input),
        Path::new(&output),
    ) {
        Ok(a) => a,
        Err(e) => {
            set_state(&inner, &id, JobState::Failed, 0.0, Some(e.to_string()));
            return;
        }
    };
    if let Some(parent) = Path::new(&output).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            set_state(
                &inner,
                &id,
                JobState::Failed,
                0.0,
                Some(format!("create output dir: {e}")),
            );
            return;
        }
    }

    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new(&ffmpeg)));
    cmd.args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            set_state(
                &inner,
                &id,
                JobState::Failed,
                0.0,
                Some(format!("could not start ffmpeg: {e}")),
            );
            return;
        }
    };
    let stdout = child.stdout.take().expect("piped stdout");
    let mut lines = BufReader::new(stdout).lines();

    let mut cancelled = false;
    let mut last_whole = -1.0_f64;
    loop {
        tokio::select! {
            line = lines.next_line() => match line {
                Ok(Some(l)) => {
                    if let Some(pct) = parse_progress(&l, duration) {
                        if pct.floor() > last_whole {
                            last_whole = pct.floor();
                            update_percent(&inner, &id, pct);
                        }
                    }
                }
                _ => break, // stdout closed (process ending) or a read error
            },
            _ = cancel.notify.notified() => {
                cancelled = true;
                let _ = child.start_kill();
                break;
            }
        }
    }
    if cancel.flag.load(Ordering::SeqCst) {
        cancelled = true;
        let _ = child.start_kill();
    }

    let mut stderr_text = String::new();
    if let Some(mut se) = child.stderr.take() {
        let _ = se.read_to_string(&mut stderr_text).await;
    }
    let status = child.wait().await;

    if cancelled {
        let _ = std::fs::remove_file(&output);
        set_state(&inner, &id, JobState::Cancelled, 0.0, None);
        tracing::info!(job = %id, "job cancelled");
        return;
    }
    match status {
        Ok(s) if s.success() => {
            set_state(&inner, &id, JobState::Done, 100.0, None);
            tracing::info!(job = %id, output = %output, "job done");
        }
        Ok(s) => {
            let tail = stderr_text.lines().last().unwrap_or("").trim().to_string();
            let _ = std::fs::remove_file(&output);
            set_state(
                &inner,
                &id,
                JobState::Failed,
                0.0,
                Some(format!("ffmpeg exited {s}: {tail}")),
            );
            tracing::error!(job = %id, "job failed");
        }
        Err(e) => {
            set_state(
                &inner,
                &id,
                JobState::Failed,
                0.0,
                Some(format!("waiting for ffmpeg failed: {e}")),
            );
        }
    }
}

#[allow(clippy::type_complexity)]
fn snapshot(
    inner: &Arc<Inner>,
    id: &str,
) -> Option<(String, String, Option<CustomEncode>, String, Arc<Cancel>)> {
    let jobs = inner.jobs.lock().expect("jobs lock");
    let r = jobs.get(id)?;
    Some((
        r.dto.input_path.clone(),
        r.dto.preset_id.clone(),
        r.custom.clone(),
        r.dto.output_path.clone(),
        r.cancel.clone(),
    ))
}

fn set_state(inner: &Arc<Inner>, id: &str, state: JobState, percent: f64, error: Option<String>) {
    let dto = {
        let mut jobs = inner.jobs.lock().expect("jobs lock");
        let Some(r) = jobs.get_mut(id) else { return };
        r.dto.state = state;
        r.dto.percent = percent;
        r.dto.error = error;
        r.dto.clone()
    };
    emit(inner, &dto);
}

fn update_percent(inner: &Arc<Inner>, id: &str, percent: f64) {
    let dto = {
        let mut jobs = inner.jobs.lock().expect("jobs lock");
        let Some(r) = jobs.get_mut(id) else { return };
        r.dto.percent = percent;
        r.dto.clone()
    };
    emit(inner, &dto);
}

fn emit(inner: &Arc<Inner>, dto: &JobDto) {
    if let Err(e) = inner.app.emit(JOB_EVENT, dto.clone()) {
        tracing::warn!(error = %e, "could not emit job update");
    }
}

fn resolve_tools(app: &AppHandle) -> Option<(String, String)> {
    let state = app.state::<AppState>();
    let settings = state.settings.get();
    let bin = crate::ffmpeg::managed_bin_dir(app).ok()?;
    let ffmpeg =
        crate::ffmpeg::discover::find_tool("ffmpeg", settings.ffmpeg_path.as_deref(), &bin)?.0;
    let ffprobe =
        crate::ffmpeg::discover::find_tool("ffprobe", settings.ffprobe_path.as_deref(), &bin)?.0;
    Some((
        ffmpeg.to_string_lossy().to_string(),
        ffprobe.to_string_lossy().to_string(),
    ))
}

async fn probe_duration(ffprobe: &str, input: &str) -> f64 {
    let mut cmd = tokio::process::Command::from(crate::ffmpeg::command(Path::new(ffprobe)));
    cmd.args(["-v", "quiet", "-print_format", "json", "-show_format"]);
    cmd.arg(input);
    let out = match cmd.output().await {
        Ok(o) => o,
        Err(_) => return 0.0,
    };
    serde_json::from_slice::<serde_json::Value>(&out.stdout)
        .ok()
        .and_then(|j| {
            j.get("format")
                .and_then(|f| f.get("duration"))
                .and_then(|d| d.as_str())
                .and_then(|s| s.parse::<f64>().ok())
        })
        .unwrap_or(0.0)
}

/// Percent from an ffmpeg `-progress` line (`out_time_us=<microseconds>`), capped at 99.9 while running
/// (100 is set only on a clean exit). Returns `None` for other lines or an unknown duration.
fn parse_progress(line: &str, duration_secs: f64) -> Option<f64> {
    let us: f64 = line
        .trim()
        .strip_prefix("out_time_us=")?
        .trim()
        .parse()
        .ok()?;
    if duration_secs > 0.0 {
        Some(((us / 1_000_000.0) / duration_secs * 100.0).clamp(0.0, 99.9))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_progress_computes_percent_from_out_time_us() {
        // 5s into a 10s clip -> 50%
        assert_eq!(parse_progress("out_time_us=5000000", 10.0), Some(50.0));
        // capped below 100 while running
        assert_eq!(parse_progress("out_time_us=10000000", 10.0), Some(99.9));
    }

    #[test]
    fn parse_progress_ignores_other_lines_and_unknown_duration() {
        assert_eq!(parse_progress("frame=12", 10.0), None);
        assert_eq!(parse_progress("out_time_us=1000000", 0.0), None);
    }
}
