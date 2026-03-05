import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import ConfidenceGauge from "./ConfidenceGauge";
import RegenerateCard from "./RegenerateCard";
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
      className={`rounded-2xl p-6 transition-colors duration-500 ${isDark
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

          {data.metadata?.warnings?.length > 0 && (
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

  // Local state for regenerated sections (only mounts if success === true)
  const [localSummary, setLocalSummary] = useState(data.meeting_summary);
  const [localDecisions, setLocalDecisions] = useState(data.key_decisions);
  const [localRisks, setLocalRisks] = useState(data.risks_and_open_questions);
  const [localActionItems, setLocalActionItems] = useState(data.action_items);

  // Reset local state if 'data' prop entirely changes (new meeting analyzed)
  useEffect(() => {
    setLocalSummary(data.meeting_summary);
    setLocalDecisions(data.key_decisions);
    setLocalRisks(data.risks_and_open_questions);
    setLocalActionItems(data.action_items);
  }, [data]);

  // ── Failsafe Response ──────────────────────────────────────
  if (!data.success) {
    return (
      <div className="space-y-5">
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
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {data.message}
              </p>
            </div>
          </div>
        </GlassSection>

        {data.issues.length > 0 && (
          <GlassSection index={2}>
            <SectionHeader icon={AlertCircle} title="Issues Detected" />
            <ul className="space-y-2">
              {data.issues.map((issue, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </GlassSection>
        )}

        {data.metadata?.warnings?.length > 0 && (
          <GlassSection index={3}>
            <SectionHeader icon={AlertTriangle} title="Warnings" />
            <ul className="space-y-2">
              {data.metadata.warnings.map((w, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm text-muted-foreground leading-relaxed"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </GlassSection>
        )}
      </div>
    );
  }

  const meetingId = data.meeting_id ?? "unknown";

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

        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants}>
          <RegenerateCard
            meetingId={meetingId}
            section="summary"
            title="Meeting Summary"
            icon={Sparkles}
            onRegenerated={(res) => setLocalSummary(res.meeting_summary)}
            examplePrompts={[
              "Make it 5 bullet points focused on design decisions",
              "Be extremely brief and concise",
              "Expand on the technical architecture discussion"
            ]}
          >
            <ul className="space-y-2">
              {localSummary.map((point, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 text-sm text-secondary-foreground leading-relaxed"
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </RegenerateCard>
        </motion.div>

        {/* Row 2: Decisions + Risks side by side */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
          <RegenerateCard
            meetingId={meetingId}
            section="decisions"
            title="Key Decisions"
            icon={CheckCircle2}
            onRegenerated={(res) => setLocalDecisions(res.key_decisions)}
            examplePrompts={[
              "Include more context for why each decision was made",
              "Did we officially decide on the budget?",
              "Focus only on product-level decisions"
            ]}
          >
            <div className="space-y-2.5">
              {localDecisions.length > 0 ? (
                localDecisions.map((d) => (
                  <div key={d.id} className="glass-card p-3.5 border-l-2 border-l-primary/50">
                    <p className="font-medium text-sm">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {d.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">
                  No key decisions identified.
                </p>
              )}
            </div>
          </RegenerateCard>
        </motion.div>

        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
          <RegenerateCard
            meetingId={meetingId}
            section="risks"
            title="Risks & Open Questions"
            icon={AlertTriangle}
            onRegenerated={(res) => setLocalRisks(res.risks_and_open_questions)}
            examplePrompts={[
              "List any technical blockers mentioned",
              "What questions did David ask that weren't answered?",
              "Focus on scheduling and timeline risks"
            ]}
          >
            <div className="space-y-2.5">
              {localRisks.length > 0 ? (
                localRisks.map((r) => (
                  <div
                    key={r.id}
                    className="glass-card p-3.5 border-l-2 border-l-accent/50"
                  >
                    <p className="font-medium text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {r.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/60 italic">
                  No risks or open questions identified.
                </p>
              )}
            </div>
          </RegenerateCard>
        </motion.div>

        {/* Row 3: Action Items full width */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants} className="md:col-span-2">
          <RegenerateCard
            meetingId={meetingId}
            section="action_items"
            title="Action Items"
            icon={ListChecks}
            onRegenerated={(res) => setLocalActionItems(res.action_items)}
            examplePrompts={[
              "Did anyone explicitly promise to email the client?",
              "Make sure to list the exact due dates for everything",
              "Merge action items assigned to the same person"
            ]}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localActionItems.length > 0 ? (
                localActionItems.map((item) => (
                  <div key={item.id} className="glass-card p-4 flex flex-col justify-between space-y-3">
                    <p className="font-medium text-sm">{item.task}</p>

                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                          <User className="w-3 h-3 text-primary" />
                          {item.owner}
                        </span>
                        {item.due_date && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-accent" />
                            {item.due_date}
                          </span>
                        )}
                      </div>
                      {item.evidence && (
                        <div className="flex gap-2 text-[11px] text-muted-foreground/70 italic bg-muted/30 p-2 rounded-md">
                          <Quote className="w-3 h-3 mt-0.5 shrink-0 opacity-50" />
                          <span>"{item.evidence}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground/60 italic md:col-span-2">
                  No action items identified.
                </p>
              )}
            </div>
          </RegenerateCard>
        </motion.div>

        {/* Warnings banner */}
        {data.metadata?.warnings?.length > 0 && (
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
