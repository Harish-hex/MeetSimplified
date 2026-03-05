/**
 * TypeScript types matching the Synthetix-4.0 backend API response.
 */

export interface Decision {
    id: number;
    title: string;
    description: string;
}

export interface RiskOrQuestion {
    id: number;
    title: string;
    description: string;
}

export interface ActionItem {
    id: number;
    task: string;
    owner: string;
    due_date: string | null;
    evidence: string;
}

export interface Metadata {
    model: string;
    total_duration_sec: number;
    total_duration_human: string;
    speakers_detected: string[];
    processing_time_sec: number;
    segment_count: number;
    warnings: string[];
}

export interface AnalyzeResponse {
    meeting_id: string;
    success: true;
    confidence_score: number;
    confidence_label: string;
    meeting_summary: string[];
    key_decisions: Decision[];
    risks_and_open_questions: RiskOrQuestion[];
    action_items: ActionItem[];
    metadata: Metadata;
}

export interface FailsafeResponse {
    meeting_id: string;
    success: false;
    confidence_score: number;
    confidence_label: string;
    message: string;
    issues: string[];
    metadata: Metadata;
}

export type AnalysisResult = AnalyzeResponse | FailsafeResponse;

export interface ChatSource {
    segment_id: number;
    speaker: string;
    text: string;
    similarity: number;
}

export interface ChatResponse {
    answer: string;
    sources: ChatSource[];
    confidence: string;
    meeting_id: string;
}
