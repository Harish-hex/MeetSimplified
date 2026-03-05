/**
 * API service for communicating with the Synthetix-4.0 backend.
 */

import type { AnalysisResult } from "@/types/analysis";

const API_BASE = "http://localhost:8000";

/**
 * Check if the backend is reachable.
 */
export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * A single meeting entry from the backend.
 */
export interface MeetingEntry {
    id: string;
    speakers: number;
}

/**
 * Fetch the list of available AMI meetings from the backend.
 */
export async function listMeetings(): Promise<MeetingEntry[]> {
    const res = await fetch(`${API_BASE}/meetings`);
    if (!res.ok) {
        throw new Error("Could not load meetings list.");
    }
    const data = await res.json();
    return data.meetings ?? [];
}

/**
 * Send a transcript file to the backend for analysis.
 */
export async function analyzeTranscript(
    file: File,
    meetingDate?: string,
    attendees?: string
): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append("file", file);

    if (meetingDate) {
        formData.append("meeting_date", meetingDate);
    }
    if (attendees) {
        formData.append("attendees", attendees);
    }

    const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const detail = errorBody?.detail || `Server error (${res.status})`;
        throw new Error(detail);
    }

    return res.json();
}

/**
 * Analyze an AMI corpus meeting by its ID (no file upload needed).
 * The backend converts the XML corpus data and analyzes in one step.
 */
export async function analyzeMeetingById(
    meetingId: string,
    meetingDate?: string,
    attendees?: string
): Promise<AnalysisResult> {
    const formData = new FormData();

    if (meetingDate) {
        formData.append("meeting_date", meetingDate);
    }
    if (attendees) {
        formData.append("attendees", attendees);
    }

    const res = await fetch(`${API_BASE}/analyze/meeting/${meetingId}`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const detail = errorBody?.detail || `Server error (${res.status})`;
        throw new Error(detail);
    }

    return res.json();
}

/**
 * Ask the meeting transcript a question using the RAG chat backend.
 */
export async function chatWithMeeting(
    meetingId: string,
    question: string
): Promise<import("../types/analysis").ChatResponse> {
    const res = await fetch(`${API_BASE}/chat/${meetingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
    });

    if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        const detail = errorBody?.detail || `Server error (${res.status})`;
        throw new Error(detail);
    }

    return res.json();
}
