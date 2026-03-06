import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, AlertCircle, Database, Upload as UploadIcon, RefreshCw, Target } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import AnalysisResults from "@/components/AnalysisResults";
import ChatPanel from "@/components/ChatPanel";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  analyzeTranscript,
  analyzeMeetingById,
  listMeetings,
  type MeetingEntry,
} from "@/services/api";
import type { AnalysisResult } from "@/types/analysis";

type InputMode = "corpus" | "upload";

const Index = () => {
  // ── Input state ────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>("corpus");
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<Date>();
  const [attendees, setAttendees] = useState("");

  // ── Meeting picker state ───────────────────────────────────
  const [meetings, setMeetings] = useState<MeetingEntry[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<string>("");
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // ── Analysis state ─────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusTopic, setFocusTopic] = useState("");

  // ── Load meetings list on mount ────────────────────────────
  useEffect(() => {
    setLoadingMeetings(true);
    listMeetings()
      .then((m) => {
        setMeetings(m);
        if (m.length > 0) setSelectedMeeting(m[0].id);
      })
      .catch(() => {
        // Corpus not available — user can still upload files
      })
      .finally(() => setLoadingMeetings(false));
  }, []);

  const canAnalyze =
    inputMode === "corpus" ? !!selectedMeeting : !!file;

  const handleAnalyze = async () => {
    if (!canAnalyze) return;

    setIsAnalyzing(true);
    setProgress(0);
    setResult(null);
    setError(null);

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress((prev) => {
        if (prev < 30) return prev + 2;
        if (prev < 60) return prev + 1;
        if (prev < 85) return prev + 0.5;
        if (prev < 95) return prev + 0.1;
        return 95;
      });
    }, 200);

    try {
      const meetingDate = date ? format(date, "yyyy-MM-dd") : undefined;
      const attendeeStr = attendees || undefined;
      const focusStr = focusTopic.trim() || undefined;

      let data: AnalysisResult;
      if (inputMode === "corpus") {
        data = await analyzeMeetingById(selectedMeeting, meetingDate, attendeeStr, focusStr);
      } else {
        data = await analyzeTranscript(file!, meetingDate, attendeeStr, focusStr);
      }

      setProgress(100);
      setTimeout(() => {
        setResult(data);
        setIsAnalyzing(false);
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
      setIsAnalyzing(false);
      setProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-black/3 blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-black/2 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl lg:text-5xl font-heading font-bold gradient-text">
            Transcript Analyzer
          </h1>
          <p className="mt-3 text-black/50 max-w-lg mx-auto">
            Upload your meeting transcript and get AI-powered summaries, decisions, action items, and risk analysis in seconds.
          </p>
        </motion.div>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* Left: Input Controls */}
          <motion.div
            className="glass-card p-6 space-y-5 lg:sticky lg:top-8"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {/* ── Input Mode Tabs ─────────────────────────── */}
            <div className="flex rounded-lg overflow-hidden border border-border/50">
              <button
                onClick={() => setInputMode("corpus")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all",
                  inputMode === "corpus"
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:bg-white/10"
                )}
              >
                <Database className="w-3.5 h-3.5" />
                Select Meeting
              </button>
              <button
                onClick={() => setInputMode("upload")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-medium transition-all",
                  inputMode === "upload"
                    ? "bg-white/20 text-white"
                    : "text-white/50 hover:bg-white/10"
                )}
              >
                <UploadIcon className="w-3.5 h-3.5" />
                Upload File
              </button>
            </div>

            {/* ── Corpus Meeting Picker ───────────────────── */}
            {inputMode === "corpus" && (
              <motion.div
                className="space-y-1.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label className="text-xs font-medium text-white/50">
                  Select a Meeting from AMI Corpus
                </label>
                {loadingMeetings ? (
                  <div className="glass-card p-4 flex items-center justify-center gap-2 text-sm text-white/50">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading meetings...
                  </div>
                ) : meetings.length > 0 ? (
                  <select
                    value={selectedMeeting}
                    onChange={(e) => setSelectedMeeting(e.target.value)}
                    className="w-full glass-card px-3 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-white/40 transition-all appearance-none cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                    }}
                  >
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} — {m.speakers} speakers
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="glass-card p-4 text-xs text-white/50">
                    No meetings found. Make sure the AMI corpus directory is available.
                  </div>
                )}
                <p className="text-[10px] text-white/40">
                  {meetings.length} meetings available from the AMI Meeting Corpus
                </p>
              </motion.div>
            )}

            {/* ── File Upload ────────────────────────────── */}
            {inputMode === "upload" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <FileUpload
                  selectedFile={file}
                  onFileSelect={setFile}
                  onClear={() => setFile(null)}
                />
              </motion.div>
            )}

            {/* Meeting Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">
                Meeting Date (Optional)
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full glass-card px-3 py-2.5 text-sm text-left flex items-center gap-2 transition-colors hover:bg-white/10",
                      !date && "text-white/50"
                    )}
                  >
                    <CalendarIcon className="w-4 h-4" />
                    {date ? format(date, "PPP") : "Select a date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white border border-black/10 shadow-lg rounded-xl" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Attendees */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">
                Attendees (Optional)
              </label>
              <input
                type="text"
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="e.g. Sarah, Marcus, Priya"
                className="w-full glass-card px-3 py-2.5 text-sm bg-transparent placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/40 transition-all"
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !canAnalyze}
              className="w-full btn-gradient py-3 rounded-lg font-heading font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Analyze Transcript
                </>
              )}
            </button>

            {isAnalyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/50 mb-1">
                  <span>Processing transcript with AI...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-full absolute left-0 top-0"
                    style={{ background: "var(--gradient-accent)" }}
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2, ease: "linear" }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                className="glass-card p-4 border-l-2 border-l-red-500/60"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-400">Analysis Failed</p>
                    <p className="text-xs text-white/50 mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Metadata display after results */}
            {result && result.metadata && (
              <motion.div
                className="glass-card p-3 space-y-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-xs font-medium text-white/50">Processing Info</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-white/60">
                  <span>Model: {result.metadata.model}</span>
                  <span>Time: {result.metadata.processing_time_sec}s</span>
                  <span>Segments: {result.metadata.segment_count}</span>
                  <span>Duration: {result.metadata.total_duration_human}</span>
                </div>
                {result.metadata.speakers_detected.length > 0 && (
                  <p className="text-xs text-white/60">
                    Speakers: {result.metadata.speakers_detected.join(", ")}
                  </p>
                )}
              </motion.div>
            )}

            {/* Regenerate with different focus */}
            {result && !isAnalyzing && (
              <motion.div
                className="glass-card p-3 space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                <p className="text-xs font-medium text-white/70 flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" />
                  Regenerate with Focus Topic
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={focusTopic}
                    onChange={(e) => setFocusTopic(e.target.value)}
                    placeholder="e.g. budget, design, timeline..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all"
                  />
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="px-3 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Re-analyze
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right: Results */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AnalysisResults data={result} />
                  {result.success && <ChatPanel meetingId={result.meeting_id} />}
                </motion.div>
              ) : !isAnalyzing ? (
                <motion.div
                  key="placeholder"
                  className="rounded-2xl border border-black/10 bg-white p-12 flex flex-col items-center justify-center text-center min-h-[400px] shadow-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-black/5 mb-4">
                    <Zap className="w-8 h-8 text-black/30" />
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-black/70">
                    Ready to Analyze
                  </h3>
                  <p className="text-sm text-black/40 mt-2 max-w-sm">
                    {inputMode === "corpus"
                      ? "Select a meeting from the corpus and click \"Analyze\" to see AI-powered insights."
                      : "Upload a transcript and click \"Analyze\" to see AI-powered insights appear here."}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
