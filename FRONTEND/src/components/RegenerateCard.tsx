import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Send } from "lucide-react";
import { regenerateSection } from "@/services/api";

type SectionType = "summary" | "decisions" | "risks" | "action_items";

interface RegenerateCardProps {
    meetingId: string;
    section: SectionType;
    title: string;
    icon: React.ElementType;
    className?: string;
    children: React.ReactNode;
    onRegenerated: (newData: any) => void;
    examplePrompts?: string[];
}

export default function RegenerateCard({
    meetingId,
    section,
    title,
    icon: Icon,
    className = "",
    children,
    onRegenerated,
    examplePrompts = [],
}: RegenerateCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [instruction, setInstruction] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRegenerate = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!instruction.trim()) return;

        setIsLoading(true);
        setError(null);
        try {
            const result = await regenerateSection(meetingId, section, instruction);
            onRegenerated(result);
            setIsOpen(false);
            setInstruction("");
        } catch (err: any) {
            setError(err.message || "Failed to regenerate section.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePromptClick = (prompt: string) => {
        setInstruction(prompt);
    };

    return (
        <div className={`glass-card p-6 relative overflow-hidden flex flex-col h-full ${className}`}>
            {/* Loading Overlay */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl"
                    >
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm font-medium text-primary shadow-sm">
                                Regenerating with magic...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/15">
                        <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-heading font-semibold text-lg">{title}</h3>
                </div>

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`p-2 rounded-full transition-colors flex items-center gap-1.5 text-xs font-medium ${isOpen ? "bg-primary/20 text-primary" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                        }`}
                    title="Regenerate this section"
                >
                    <Sparkles className="w-4 h-4" />
                    <span className="hidden sm:inline">Regenerate</span>
                </button>
            </div>

            {/* Regenerate Input Box */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                        animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
                        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-muted/30 border border-primary/20 rounded-xl space-y-3">
                            <p className="text-xs text-muted-foreground font-medium">
                                How should the AI rewrite this section?
                            </p>

                            {examplePrompts.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {examplePrompts.map((prompt, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handlePromptClick(prompt)}
                                            className="text-[10px] px-2 py-1 rounded-full bg-background border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleRegenerate} className="flex gap-2 relative">
                                <input
                                    type="text"
                                    value={instruction}
                                    onChange={(e) => setInstruction(e.target.value)}
                                    placeholder="e.g. Make it 3 bullet points focused on UI"
                                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-shadow"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!instruction.trim() || isLoading}
                                    className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 shrink-0"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>

                            {error && (
                                <p className="text-xs text-red-500 font-medium px-1">
                                    {error}
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}
