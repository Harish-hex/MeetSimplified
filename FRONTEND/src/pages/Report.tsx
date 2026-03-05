import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AnalysisResults from "@/components/AnalysisResults";
import type { AnalysisResult } from "@/types/analysis";

const Report = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = (location.state as { data?: AnalysisResult })?.data;

  // If no data, redirect back to upload
  if (!data) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] animate-pulse-glow" />
        </div>
        <div className="relative z-10 glass-card p-8 text-center max-w-md">
          <h2 className="font-heading font-semibold text-lg mb-2">No Analysis Data</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Upload and analyze a transcript first.
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn-gradient px-6 py-2.5 rounded-lg font-heading font-semibold text-sm"
          >
            Go to Upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/8 blur-[120px] animate-pulse-glow" />
        <div className="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[120px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Header */}
        <motion.div
          className="mb-8 flex items-center gap-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={() => navigate("/")}
            className="glass-card w-10 h-10 flex items-center justify-center shrink-0 hover:bg-muted/30 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold gradient-text">
              Analysis Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-generated insights from your meeting transcript
            </p>
          </div>
        </motion.div>

        <AnalysisResults data={data} />

        {/* Metadata footer */}
        {data.metadata && (
          <motion.div
            className="mt-6 glass-card p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground/80">
              <span>Model: {data.metadata.model}</span>
              <span>Duration: {data.metadata.total_duration_human}</span>
              <span>Segments: {data.metadata.segment_count}</span>
              <span>Processed in: {data.metadata.processing_time_sec}s</span>
              {data.metadata.speakers_detected.length > 0 && (
                <span>Speakers: {data.metadata.speakers_detected.join(", ")}</span>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Report;
