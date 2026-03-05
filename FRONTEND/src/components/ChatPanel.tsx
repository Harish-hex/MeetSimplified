import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { chatWithMeeting } from "@/services/api";
import type { ChatSource } from "@/types/analysis";
import { cn } from "@/lib/utils";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources?: ChatSource[];
    confidence?: string;
    isError?: boolean;
}

interface ChatPanelProps {
    meetingId: string;
}

export default function ChatPanel({ meetingId }: ChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: "user",
            content: input,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        try {
            const response = await chatWithMeeting(meetingId, userMsg.content);
            const assistantMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: response.answer,
                sources: response.sources,
                confidence: response.confidence,
            };
            setMessages((prev) => [...prev, assistantMsg]);
        } catch (err) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: err instanceof Error ? err.message : "Chat failed. Please try again.",
                isError: true,
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="glass-card flex flex-col h-[500px] overflow-hidden mt-8">
            <div className="p-4 border-b border-white/10 bg-black/20 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <h3 className="font-heading font-semibold">Ask the Meeting</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary ml-auto flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Live Q&A
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/60 space-y-4">
                        <MessageSquare className="w-8 h-8 opacity-50 text-primary" />
                        <p className="text-sm">Ask anything about this meeting</p>
                        <div className="flex flex-col gap-2 mt-2 w-full max-w-sm">
                            <button
                                onClick={() => setInput("What was decided about pricing?")}
                                className="text-xs px-3 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-primary/30 transition-colors text-left text-muted-foreground/80"
                            >
                                "What was decided about pricing?"
                            </button>
                            <button
                                onClick={() => setInput("Who is responsible for the design?")}
                                className="text-xs px-3 py-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-primary/30 transition-colors text-left text-muted-foreground/80"
                            >
                                "Who is responsible for the design?"
                            </button>
                        </div>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((msg) => (
                        <MessageBubble key={msg.id} msg={msg} />
                    ))}
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex justify-start"
                        >
                            <div className="bg-black/30 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Searching transcript...</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 bg-black/20">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Type your question..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                        disabled={isTyping}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
    const isUser = msg.role === "user";
    const [showSources, setShowSources] = useState(false);

    // Parse [segment N] markers into styled spans
    const formattedContent = () => {
        if (isUser || msg.isError) return msg.content;
        const parts = msg.content.split(/(\[segment \d+\])/g);
        return parts.map((part, i) => {
            if (part.match(/\[segment \d+\]/)) {
                return (
                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary">
                        {part.replace('[segment ', '').replace(']', '')}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn("flex flex-col max-w-[85%]", isUser ? "ml-auto items-end" : "mr-auto items-start")}
        >
            <div
                className={cn(
                    "px-4 py-3 text-sm rounded-2xl",
                    isUser
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : msg.isError
                            ? "bg-red-500/10 text-red-200 rounded-tl-sm border border-red-500/20"
                            : "bg-black/30 text-white/90 rounded-tl-sm border border-white/5"
                )}
            >
                <p className="leading-relaxed whitespace-pre-wrap">{formattedContent()}</p>
            </div>

            {!isUser && !msg.isError && msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 w-full max-w-full">
                    <button
                        onClick={() => setShowSources(!showSources)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors pl-1"
                    >
                        {showSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showSources ? "Hide sources" : `View ${msg.sources.length} source segments`}
                    </button>

                    <AnimatePresence>
                        {showSources && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden mt-1.5"
                            >
                                <div className="space-y-1.5 pl-1 ml-1.5 border-l-2 border-primary/20">
                                    {msg.sources.map((src, i) => (
                                        <div key={i} className="bg-black/20 rounded p-2.5 text-[11px] text-muted-foreground/80">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold text-primary/70">{src.speaker}</span>
                                                <span className="text-[9px] opacity-40">Seg {src.segment_id}</span>
                                            </div>
                                            <p className="italic leading-relaxed">"{src.text}"</p>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}
