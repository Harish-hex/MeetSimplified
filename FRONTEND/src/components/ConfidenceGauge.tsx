import { motion } from "framer-motion";

interface ConfidenceGaugeProps {
  value: number;
  label?: string;
}

const ConfidenceGauge = ({
  value,
  label = "High confidence in transcript analysis accuracy",
}: ConfidenceGaugeProps) => {
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  // Color based on confidence level
  const getColor = () => {
    if (value >= 70) return { start: "hsl(0 0% 15%)", end: "hsl(0 0% 35%)" };
    if (value >= 40) return { start: "hsl(0 0% 40%)", end: "hsl(0 0% 55%)" };
    return { start: "hsl(0 0% 60%)", end: "hsl(0 0% 75%)" };
  };

  const colors = getColor();

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="8"
          />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-2xl font-heading font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {value}%
          </motion.span>
        </div>
      </div>
      <div>
        <h3 className="font-heading font-semibold text-lg">Confidence Score</h3>
        <p className="text-sm muted-text mt-1">{label}</p>
      </div>
    </div>
  );
};

export default ConfidenceGauge;
