import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Zap, CalendarIcon, AlertCircle } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { analyzeTranscript } from "@/services/api";
import type { AnalysisResult } from "@/types/analysis";

const Upload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState<Date>();
  const [attendees, setAttendees] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const meetingDate = date ? format(date, "yyyy-MM-dd") : undefined;
      const data: AnalysisResult = await analyzeTranscript(
        file,
        meetingDate,
        attendees || undefined
      );
      // Navigate to report page with the data
      navigate("/report", { state: { data } });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Analysis failed. Please try again."
      );
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
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
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            Upload your meeting transcript and get AI-powered summaries, decisions, action items, and risk analysis in seconds.
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div
          className="glass-card p-6 space-y-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div>
            <h2 className="font-heading font-semibold text-lg">Upload Transcript</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Drop a .txt or .json file to begin
            </p>
          </div>

          <FileUpload
            selectedFile={file}
            onFileSelect={setFile}
            onClear={() => setFile(null)}
          />

          {/* Meeting Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Meeting Date (Optional)
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "w-full glass-card px-3 py-2.5 text-sm text-left flex items-center gap-2 transition-colors hover:bg-muted/30",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="w-4 h-4" />
                  {date ? format(date, "PPP") : "Select a date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 glass-card border-border" align="start">
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
            <label className="text-xs font-medium text-muted-foreground">
              Attendees (Optional)
            </label>
            <input
              type="text"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="e.g. Sarah, Marcus, Priya"
              className="w-full glass-card px-3 py-2.5 text-sm bg-transparent placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !file}
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
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-accent)" }}
                  initial={{ width: "0%" }}
                  animate={{ width: "90%" }}
                  transition={{ duration: 25, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Processing transcript with AI...
              </p>
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
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Upload;
