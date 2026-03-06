# Synthetix-4.0 Meeting Analyzer

An AI-powered web application that analyzes meeting transcripts to automatically generate summaries, extract key decisions, identify action items with owners and due dates, and highlight risks or open questions. Featuring a beautiful "glassmorphism" UI and interactive AI regeneration capabilities.

## Features

- **Automated Analysis:** Upload a `.txt` or `.json` transcript or select from the pre-loaded AMI corpus to instantly get actionable insights.
- **Magic Editor (Regeneration):** Unhappy with a section? Use custom prompts to have the AI regenerate specific parts of the analysis (e.g., "Make the summary 3 bullet points").
- **Live Meeting Q&A (RAG):** Chat directly with your transcript to find specific quotes or answers accurately without reading the whole file.
- **Export to PDF:** Download the final beautifully formatted report in one click.

---

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- An active OpenAI API Key

---

## Setup Instructions

This project is split into two parts: the Python backend (FastAPI) and the React frontend (Vite/Tailwind).

### 1. Backend Setup

Open a terminal and navigate to the root directory `Synthetix-4.0`.

1. **Create and activate a virtual environment (recommended):**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows, use: .venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory (or copy `.env.example` if available) and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the backend server:**
   ```bash
   python3 main.py
   ```
   *The backend API will run on `http://localhost:8000`.*

---

### 2. Frontend Setup

Open a new terminal window and navigate to the frontend directory:

1. **Change directory:**
   ```bash
   cd FRONTEND
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   *The frontend will run on `http://localhost:8080` (or another port specified in the terminal). Open this URL in your browser.*

---

## Usage

1. Open `http://localhost:8080` in your web browser.
2. Choose either **Select Meeting** (from the built-in corpus) or **Upload File** to provide a meeting transcript.
3. Click **Analyze Transcript** and wait for the AI processing to complete.
4. Review the generated cards. You can chat with the meeting using the right-hand panel, or click the **Regenerate** buttons on any card to refine its contents.
5. Click **Download PDF** when you are ready to export the final executive report.
