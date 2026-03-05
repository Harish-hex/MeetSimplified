import { motion } from "framer-motion";
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
} from "lucide-react";
import type { AnalysisResult } from "@/types/analysis";

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
}) => (
  <motion.div
    className={`glass-card p-6 ${className}`}
    custom={index}
    initial="hidden"
    animate="visible"
    variants={cardVariants}
  >
    {children}
  </motion.div>
);

const SectionHeader = ({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <h3 className="font-heading font-semibold text-lg">{title}</h3>
  </div>
);

const AnalysisResults = ({ data }: AnalysisResultsProps) => {
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

        {data.metadata.warnings.length > 0 && (
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

  // ── Success Response ───────────────────────────────────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 auto-rows-min">
      {/* Row 1: Confidence + Summary */}
      <GlassSection index={0}>
        <ConfidenceGauge
          value={data.confidence_score}
          label={data.confidence_label}
        />
      </GlassSection>

      <GlassSection index={1}>
        <SectionHeader icon={Sparkles} title="Meeting Summary" />
        <ul className="space-y-2">
          {data.meeting_summary.map((point, i) => (
            <li
              key={i}
              className="flex gap-2.5 text-sm text-secondary-foreground leading-relaxed"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
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
              <div key={d.id} className="glass-card p-3.5">
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
      </GlassSection>

      <GlassSection index={3}>
        <SectionHeader icon={AlertTriangle} title="Risks & Open Questions" />
        <div className="space-y-2.5">
          {data.risks_and_open_questions.length > 0 ? (
            data.risks_and_open_questions.map((r) => (
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
      </GlassSection>

      {/* Row 3: Action Items full width */}
      <GlassSection index={4} className="md:col-span-2">
        <SectionHeader icon={ListChecks} title="Action Items" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.action_items.length > 0 ? (
            data.action_items.map((item) => (
              <div key={item.id} className="glass-card p-4 space-y-2">
                <p className="font-medium text-sm">{item.task}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
                  <div className="flex gap-2 text-xs text-muted-foreground/80 italic">
                    <Quote className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{item.evidence}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground/60 italic md:col-span-2">
              No action items identified.
            </p>
          )}
        </div>
      </GlassSection>

      {/* Warnings banner */}
      {data.metadata.warnings.length > 0 && (
        <GlassSection index={5} className="md:col-span-2 border-l-2 border-l-amber-500/40">
          <SectionHeader icon={AlertTriangle} title="Analysis Warnings" />
          <ul className="space-y-1.5">
            {data.metadata.warnings.map((w, i) => (
              <li
                key={i}
                className="text-xs text-muted-foreground leading-relaxed flex gap-2"
              >
                <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </GlassSection>
      )}
    </div>
  );
};

export default AnalysisResults;
