# MeetSimplified(Meeting Analyzer)

MeetSimplified is an AI-powered web application that helps you quickly understand what happened in a meeting. Instead of manually reading through long transcripts, the app analyzes them automatically and produces a clear summary, highlights key decisions, identifies action items (with owners and due dates), and flags possible risks or unanswered questions.

The interface uses a clean **Minimalist UI**, and it also allows you to regenerate or refine parts of the AI analysis interactively.

---

# Features

### Automated Transcript Analysis  
Upload a `.txt` or `.json` meeting transcript, or choose one from the built-in AMI meeting corpus. The system will automatically analyze it and produce structured insights.

### Magic Editor (AI Regeneration)  
Not satisfied with a generated section? You can regenerate individual parts using custom prompts.  
Example:  
> “Rewrite the summary as 3 bullet points.”

### Live Meeting Q&A (RAG Chat)  
Ask questions directly about the meeting transcript. The AI retrieves relevant sections and provides accurate answers without you needing to search the entire file.

### Export to PDF  
Once you're happy with the results, download the complete formatted report as a PDF with a single click.

---

# Prerequisites

Before running the project, make sure you have the following installed:

- **Node.js** (v16 or higher)  
- **Python** (v3.9 or higher)  
- **An OpenAI API key**

---

# Setup Instructions

The project has two main parts:

- **Backend** – Python (FastAPI)  
- **Frontend** – React (Vite + Tailwind)

You’ll need to run both.

---

# 1. Backend Setup

Open a terminal and navigate to the root directory:

```
Synthetix-4.0
```

### Create a virtual environment (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Windows:

```bash
.venv\Scripts\activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Environment setup

Create a `.env` file in the root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

### Start the backend server

```bash
python3 main.py
```

The backend API will start running at:

```
http://localhost:8000
```

---

# 2. Frontend Setup

Open a **new terminal window** and navigate to the frontend directory.

### Change directory

```bash
cd FRONTEND
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

The frontend will start at something like:

```
http://localhost:8080
```

Open that URL in your browser.

---

# Usage

1. Open the application in your browser.  
2. Choose one of the following options:
   - **Select Meeting** – pick a transcript from the built-in dataset  
   - **Upload File** – upload your own `.txt` or `.json` transcript  
3. Click **Analyze Transcript** and wait for the AI to process the meeting.  
4. Review the generated insights:
   - Summary  
   - Key decisions  
   - Action items  
   - Risks or open questions  
5. Use the **chat panel** to ask questions about the meeting.  
6. If needed, click **Regenerate** on any section to refine the AI output.  
7. Once satisfied, click **Download PDF** to export the final report.

---
