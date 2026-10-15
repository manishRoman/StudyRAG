# 🎓 StudyRAG — AI-Powered Study & Knowledge Assistant

StudyRAG is a full-stack Retrieval-Augmented Generation (RAG) platform that helps students and researchers chat with their study materials, memorize concepts with interactive flashcards, and ground all AI answers with precise page-level citations.

---

## 🌟 Key Features

- 📑 **Smart PDF Ingestion & Semantic Search**: Upload lecture notes, textbooks, and slides. Documents are split into semantic chunks and indexed in **Pinecone Cloud Vector DB**.
- 💬 **Context-Aware AI Chat**: Powered by **Google Gemini 2.5**, providing structured answers grounded in your notes with exact **📌 SOURCES & page citations**.
- 🃏 **AI Flashcard Generation**: Automatically generates review decks from your documents with interactive flip animations and mastery tracking.
- 🔐 **Authentication System**: Secure user accounts with username and password authentication powered by **Supabase**.
- 🎨 **Modern Dark Glassmorphic UI**: Built with **React 19**, **Vite**, and **Tailwind CSS**, featuring dark space aesthetics, glowing orb accents, and responsive layout.

---

## 🏗️ Architecture

```
                      ┌────────────────────────┐
                      │   React + Vite (UI)    │
                      │     (Vercel Cloud)     │
                      └───────────┬────────────┘
                                  │ REST API
                                  ▼
                      ┌────────────────────────┐
                      │   FastAPI Web Server   │
                      │     (Render Cloud)     │
                      └───┬────────────────┬───┘
                          │                │
            Vector Search │                │ User Auth & Data
                          ▼                ▼
                ┌──────────────────┐  ┌──────────────────┐
                │  Pinecone Cloud  │  │  Supabase Cloud  │
                │  (studyrag-index)│  │   (PostgreSQL)   │
                └──────────────────┘  └──────────────────┘
```

---

## 🚀 Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Axios
- **Backend**: FastAPI, Uvicorn, LangChain Text Splitters, PyMuPDF (fitz)
- **AI Model**: Google Gemini 2.5 Flash
- **Vector Database**: Pinecone Cloud (Serverless, 384-dim embeddings)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security)
- **Embeddings**: `sentence-transformers/all-MiniLM-L6-v2`

---

## 💻 Local Development Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Create a `.env` file in `backend/`:
```env
GEMINI_API_KEY=your_gemini_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=studyrag-index
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 🌐 Deployment

- **Backend**: Deploy on **Render** (Free Web Service) using the `backend/` directory.
- **Frontend**: Deploy on **Vercel** (Free) using the `frontend/` directory with `VITE_API_URL` pointing to your Render backend.
