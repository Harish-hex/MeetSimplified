import { motion } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ConfidenceGauge from "./ConfidenceGauge";
import {
  CheckCircle2,
  ListChecks,
  AlertTriangle,
  Sparkles,
  Calendar,
  User,
  Quote,
  ShieldAlert,
  AlertCircle,
  Download,
  Loader2,
  SearchX,
} from "lucide-react";
import type { AnalysisResult, FailsafeResponse } from "@/types/analysis";

interface AnalysisResultsProps {
  data: AnalysisResult;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const GlassSection = ({
  children,
  index,
  className = "",
}: {
  children: React.ReactNode;
  index: number;
  className?: string;
}) => {
  const isDark = index % 2 === 0;
  return (
    <motion.div
      className={`rounded-2xl p-6 transition-colors duration-500 ${
        isDark
          ? "bg-black text-white [&_.muted-text]:text-white/50"
          : "bg-white text-black border border-black/10 shadow-sm [&_.muted-text]:text-black/50"
      } ${className}`}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      {children}
    </motion.div>
  );
};

const SectionHeader = ({
  icon: Icon,
  title,
  light = false,
}: {
  icon: React.ElementType;
  title: string;
  light?: boolean;
}) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${light ? "bg-black/10" : "bg-white/10"}`}>
      <Icon className={`w-4 h-4 ${light ? "text-black" : "text-white"}`} />
    </div>
    <h3 className="font-heading font-semibold text-lg">{title}</h3>
  </div>
);

const AnalysisResults = ({ data }: AnalysisResultsProps) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yOffset = 10;
      let remainingHeight = imgHeight;

      // First page
      pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);
      remainingHeight -= (pageHeight - 20);

      // Additional pages if content overflows
      while (remainingHeight > 0) {
        pdf.addPage();
        yOffset -= (pageHeight - 20);
        pdf.addImage(imgData, "PNG", 10, yOffset, imgWidth, imgHeight);
        remainingHeight -= (pageHeight - 20);
      }

      const meetingId = data.meeting_id || "report";
      pdf.save(`synthetix-${meetingId}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  }, [data.meeting_id]);
  // ── Failsafe Response ──────────────────────────────────────
  if (!data.success) {
    const failsafe = data as FailsafeResponse;
    return (
      <div>
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isDownloading ? "Generating..." : "Download PDF"}
          </button>
        </div>
        <div ref={reportRef} className="space-y-5">
        <GlassSection index={0}>
          <ConfidenceGauge
            value={data.confidence_score}
            label={data.confidence_label}
          />
        </GlassSection>

        <GlassSection index={1} className="border-l-2 border-l-amber-500/50">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/15 shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg text-amber-400">
                Insufficient Confidence
              </h3>
              <p className="text-sm muted-text mt-2 leading-relaxed">
                {failsafe.message}
              </p>
            </div>
          </div>
        </GlassSection>

        {failsafe.issues.length > 0 && (
          <GlassSection index={2}>
            <SectionHeader icon={AlertCircle} title="Issues Detected" />
            <ul className="space-y-2">
              {failsafe.issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm muted-text leading-relaxed"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </GlassSection>
        )}

        {data.metadata.warnings.length > 0 && (
          <GlassSection index={3}>
            <SectionHeader icon={AlertTriangle} title="Warnings" />
            <ul className="space-y-2">
              {data.metadata.warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm muted-text leading-relaxed"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </GlassSection>
        )}
        </div>
      </div>
    );
  }

  // ── Success Response ───────────────────────────────────────
  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/90 transition-colors disabled:opacity-50"
        >
          {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isDownloading ? "Generating..." : "Download PDF"}
        </button>
      </div>
      {data.focus_topic_found === false && (
        <motion.div
          className="mb-5 rounded-2xl bg-black p-6 text-white flex items-start gap-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10 shrink-0">
            <SearchX className="w-5 h-5 text-white/70" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg">Topic Not Found</h3>
            <p className="text-sm text-white/60 mt-1 leading-relaxed">
              {data.meeting_summary[0] || "The requested focus topic was not discussed in this meeting transcript."}
            </p>
            <p className="text-xs text-white/40 mt-2">
              Try a different topic or re-analyze without a focus topic to see the full meeting analysis.
            </p>
          </div>
        </motion.div>
      )}
      <div ref={reportRef} className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-min">
      {/* Row 1: Confidence + Summary */}
      <GlassSection index={0}>
        <ConfidenceGauge
          value={data.confidence_score}
          label={data.confidence_label}
        />
      </GlassSection>

      <GlassSection index={1}>
        <SectionHeader icon={Sparkles} title="Meeting Summary" light />
        <ul className="space-y-2">
          {data.meeting_summary.map((point, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm leading-relaxed"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black shrink-0" />
              {point}
            </li>
          ))}
        </ul>
      </GlassSection>

      {/* Row 2: Decisions + Risks side by side */}
      <GlassSection index={2}>
        <SectionHeader icon={CheckCircle2} title="Key Decisions" />
        <div className="space-y-2.5">
          {data.key_decisions.length > 0 ? (
            data.key_decisions.map((d) => (
              <div key={d.id} className="rounded-xl p-3.5 bg-white/5 border border-white/10">
                <p className="font-medium text-sm">{d.title}</p>
                <p className="text-xs text-white/60 mt-1 leading-relaxed">
                  {d.description}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/40 italic">
              No key decisions identified.
            </p>
          )}
        </div>
      </GlassSection>

      <GlassSection index={3}>
        <SectionHeader icon={AlertTriangle} title="Risks & Open Questions" light />
        <div className="space-y-2.5">
          {data.risks_and_open_questions.length > 0 ? (
            data.risks_and_open_questions.map((r) => (
              <div
                key={r.id}
                className="rounded-xl p-3.5 bg-black/5 border-l-2 border-l-black/30"
              >
                <p className="font-medium text-sm">{r.title}</p>
                <p className="text-xs text-black/60 mt-1 leading-relaxed">
                  {r.description}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-black/40 italic">
              No risks or open questions identified.
            </p>
          )}
        </div>
      </GlassSection>

      {/* Row 3: Action Items full width */}
      <GlassSection index={4} className="md:col-span-2">
        <SectionHeader icon={ListChecks} title="Action Items" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.action_items.length > 0 ? (
            data.action_items.map((item) => (
              <div key={item.id} className="rounded-xl p-4 space-y-2 bg-white/5 border border-white/10">
                <p className="font-medium text-sm">{item.task}</p>
                <div className="flex flex-wrap gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3 h-3" />
                    {item.owner}
                  </span>
                  {item.due_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {item.due_date}
                    </span>
                  )}
                </div>
                {item.evidence && (
                  <div className="flex gap-2 text-xs text-white/40 italic">
                    <Quote className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{item.evidence}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-white/40 italic md:col-span-2">
              No action items identified.
            </p>
          )}
        </div>
      </GlassSection>

      {/* Warnings banner */}
      {data.metadata.warnings.length > 0 && (
        <GlassSection index={5} className="md:col-span-2 border-l-2 border-l-amber-500/40">
          <SectionHeader icon={AlertTriangle} title="Analysis Warnings" light />
          <ul className="space-y-1.5">
            {data.metadata.warnings.map((w, i) => (
              <li
                key={i}
                className="text-xs muted-text leading-relaxed flex gap-2"
              >
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </GlassSection>
      )}
      </div>
    </div>
  );
};

export default AnalysisResults;
