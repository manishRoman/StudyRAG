import os
import fitz  # PyMuPDF
import json
import re
import hashlib
import secrets
import sqlite3
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from google import genai
from google.genai import types
from supabase import create_client, Client

load_dotenv(override=True)

app = FastAPI(title="AI RAG Backend with Pinecone")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.environ.get("PINECONE_INDEX_NAME", "studyrag-index")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Initialize Supabase client
supabase_client: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"Connected to Supabase Project: {SUPABASE_URL}")
    except Exception as e:
        print(f"Error initializing Supabase: {e}")
        supabase_client = None

# Local SQLite fallback for authentication
LOCAL_DB_PATH = "studyrag_users.db"

def init_local_db():
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_local_db()

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{key.hex()}"

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        salt, expected_key = stored_hash.split(":")
        key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return secrets.compare_digest(key.hex(), expected_key)
    except Exception:
        return False

def get_user_by_username(username: str):
    if supabase_client:
        try:
            res = supabase_client.table("users").select("*").ilike("username", username).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
            return None
        except Exception as e:
            print(f"Supabase lookup error (fallback to local): {e}")

    conn = sqlite3.connect(LOCAL_DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", (username,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def create_user(username: str, password_hash: str):
    if supabase_client:
        try:
            res = supabase_client.table("users").insert({
                "username": username,
                "password_hash": password_hash
            }).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"Supabase insert error: {e}")
            raise HTTPException(status_code=500, detail=f"Supabase database error: {str(e)}")

    try:
        conn = sqlite3.connect(LOCAL_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (?, ?)", (username, password_hash))
        conn.commit()
        uid = cursor.lastrowid
        conn.close()
        return {"id": uid, "username": username}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different username.")

# Initialize services
try:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
except Exception as e:
    print(f"Error initializing Gemini: {e}")
    gemini_client = None

try:
    # 1. Initialize local embedding model (384 dimensions)
    embed_model = SentenceTransformer("all-MiniLM-L6-v2")

    # 2. Connect to Pinecone Cloud
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(PINECONE_INDEX_NAME)
    print(f"Connected to Pinecone Index: {PINECONE_INDEX_NAME}")
except Exception as e:
    print(f"Error initializing Pinecone/Embeddings: {e}")
    embed_model = None
    index = None


class AuthRequest(BaseModel):
    username: str
    password: str

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    selected_docs: list[str] = []

class Flashcard(BaseModel):
    front: str
    back: str

class FlashcardDeck(BaseModel):
    cards: list[Flashcard]


@app.get("/")
def read_root():
    return {
        "message": "Welcome to the AI RAG API with Pinecone Cloud and Supabase",
        "index_name": PINECONE_INDEX_NAME,
        "supabase_connected": supabase_client is not None
    }


@app.post("/auth/signup")
def signup(req: AuthRequest):
    username = req.username.strip()
    password = req.password.strip()

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    existing = get_user_by_username(username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another username or log in.")

    pwd_hash = hash_password(password)
    user = create_user(username, pwd_hash)

    return {
        "success": True,
        "message": "Account created successfully!",
        "user": {
            "id": user.get("id"),
            "username": username,
            "role": "Student Plan"
        }
    }


@app.post("/auth/login")
def login(req: AuthRequest):
    username = req.username.strip()
    password = req.password.strip()

    user = get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    if not verify_password(user.get("password_hash", ""), password):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return {
        "success": True,
        "message": "Logged in successfully!",
        "user": {
            "id": user.get("id"),
            "username": user.get("username", username),
            "role": "Student Plan"
        }
    }


@app.get("/auth/status")
def auth_status():
    return {
        "supabase_connected": supabase_client is not None,
        "provider": "Supabase Cloud" if supabase_client is not None else "Local Storage"
    }


@app.get("/documents")
def list_documents():
    """Returns all unique PDF source names stored in Pinecone."""
    if not index:
        return {"documents": []}

    try:
        doc_sample_ids = {}
        doc_chunk_counts = {}
        for page in index.list():
            vectors = page.vectors if hasattr(page, 'vectors') else page
            if not vectors:
                continue
            for item in vectors:
                vid = item.id if hasattr(item, 'id') else str(item)
                m = re.match(r'^(.*)_p\d+_c\d+$', vid)
                prefix = m.group(1) if m else vid
                doc_chunk_counts[prefix] = doc_chunk_counts.get(prefix, 0) + 1
                if prefix not in doc_sample_ids:
                    doc_sample_ids[prefix] = vid

        if not doc_sample_ids:
            return {"documents": []}

        sample_ids = list(doc_sample_ids.values())
        fetch_res = index.fetch(ids=sample_ids)

        documents = []
        vectors_dict = getattr(fetch_res, 'vectors', {}) or {}
        for sid, vec in vectors_dict.items():
            meta = getattr(vec, 'metadata', {}) or {}
            source_name = meta.get('source')
            m = re.match(r'^(.*)_p\d+_c\d+$', sid)
            prefix = m.group(1) if m else sid
            if not source_name:
                source_name = prefix

            count = doc_chunk_counts.get(prefix, 1)
            documents.append({
                "name": source_name,
                "size": f"{count} chunks (Pinecone)"
            })

        return {"documents": documents}
    except Exception as e:
        print(f"Error fetching documents from Pinecone: {e}")
        return {"documents": [], "error": str(e)}


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    """Deletes all vector chunks associated with a document from Pinecone."""
    if not index:
        raise HTTPException(status_code=500, detail="Pinecone not initialized.")

    try:
        ids_to_delete = []
        clean_filename = filename.replace(" ", "_")
        for page in index.list():
            vectors = page.vectors if hasattr(page, 'vectors') else page
            if not vectors:
                continue
            for item in vectors:
                vid = item.id if hasattr(item, 'id') else str(item)
                # match prefix
                if vid.startswith(clean_filename + "_p") or vid.startswith(filename + "_p"):
                    ids_to_delete.append(vid)

        if ids_to_delete:
            index.delete(ids=ids_to_delete)
            return {"message": f"Successfully deleted {len(ids_to_delete)} chunks for '{filename}'.", "deleted": True}
        else:
            return {"message": f"No records found for '{filename}'.", "deleted": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not index or not embed_model:
        raise HTTPException(status_code=500, detail="Pinecone or Embedding model is not initialized.")

    try:
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        doc = fitz.open(temp_path)
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

        all_chunks = []
        all_metadatas = []
        all_ids = []

        for page_num, page in enumerate(doc):
            page_text = page.get_text()
            if not page_text.strip():
                continue

            page_chunks = text_splitter.split_text(page_text)
            for i, chunk in enumerate(page_chunks):
                all_chunks.append(chunk)
                all_metadatas.append({
                    "text": chunk,
                    "source": file.filename,
                    "page": page_num + 1
                })
                # Pinecone IDs only need to be ASCII strings
                all_ids.append(f"{file.filename}_p{page_num+1}_c{i}".replace(" ", "_"))

        doc.close()
        if os.path.exists(temp_path):
            os.remove(temp_path)

        if not all_chunks:
            return {"message": f"No readable text found in {file.filename}."}

        # Generate 384-dim embeddings
        embeddings = embed_model.encode(all_chunks).tolist()

        # Batch upsert into Pinecone (batches of 50)
        batch_size = 50
        vectors_to_upsert = []
        for i in range(len(all_ids)):
            vectors_to_upsert.append({
                "id": all_ids[i],
                "values": embeddings[i],
                "metadata": all_metadatas[i]
            })

            if len(vectors_to_upsert) >= batch_size or i == len(all_ids) - 1:
                index.upsert(vectors=vectors_to_upsert)
                vectors_to_upsert = []

        return {"message": f"Successfully memorized and saved {len(all_chunks)} chunks from {file.filename} to Pinecone Cloud!"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
async def chat(request: ChatRequest):
    if not index or not embed_model or not gemini_client:
        raise HTTPException(status_code=500, detail="Services not initialized properly.")

    try:
        prompt = request.message
        history_context = ""
        for msg in request.history[-5:]:
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_context += f"{role}: {msg.get('content')}\n"

        # Embed query vector
        query_vector = embed_model.encode(prompt).tolist()

        # Build filter if specific document selected
        query_filter = None
        if request.selected_docs:
            if len(request.selected_docs) == 1:
                query_filter = {"source": {"$eq": request.selected_docs[0]}}
            else:
                query_filter = {"source": {"$in": request.selected_docs}}

        # Query Pinecone for top 3 matching chunks
        query_params = {
            "vector": query_vector,
            "top_k": 3,
            "include_metadata": True
        }
        if query_filter:
            query_params["filter"] = query_filter

        query_res = index.query(**query_params)
        matches = query_res.get("matches", [])

        if not matches:
            return {"response": "I couldn't find any relevant information in your uploaded documents in Pinecone."}

        context_list = []
        for match in matches:
            meta = match.get("metadata", {})
            text = meta.get("text", "")
            source = meta.get("source", "Unknown Document")
            page = meta.get("page", 1)
            citation = f"[Source: {source}, Page: {page}]"
            context_list.append(f"{citation}\nContent: {text}")

        final_context = "\n\n".join(context_list)

        gemini_prompt = f"""
        You are a helpful document assistant. Use the context and history provided below to answer the user's question.

        --- CHAT HISTORY ---
        {history_context}

        --- RETRIEVED DOCUMENT CONTEXT (FROM PINECONE CLOUD) ---
        {final_context}

        --- NEW QUESTION ---
        {prompt}

        STYLE RULES:
        1. Use the Chat History to understand context/pronouns (like "it" or "that").
        2. Write a clean, natural response without parenthetical citations in the middle of sentences.
        3. At the end of your response, add a thin horizontal line and a section called '📌 SOURCES'.
        4. In the 'SOURCES' section, list the unique filenames and page numbers you actually used.
        """

        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=gemini_prompt,
        )
        return {"response": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/flashcards")
async def get_flashcards(source: str = None):
    if not index or not gemini_client or not embed_model:
        raise HTTPException(status_code=500, detail="Services not initialized.")

    try:
        # Query Pinecone for general sample chunks
        dummy_vector = [0.0] * 384
        query_params = {
            "vector": dummy_vector,
            "top_k": 10,
            "include_metadata": True
        }
        if source:
            query_params["filter"] = {"source": {"$eq": source}}

        query_res = index.query(**query_params)
        matches = query_res.get("matches", [])

        if not matches:
            return {"cards": [], "message": "Pinecone database is empty. Please upload a PDF first!"}

        combined_texts = [m.get("metadata", {}).get("text", "") for m in matches if m.get("metadata", {}).get("text")]
        combined_document_text = "\n\n".join(combined_texts[:5])

        prompt = f"""
        Analyze the following text context and generate exactly 5 high-quality study flashcards.
        The 'front' should contain a precise question, concept, or term from the text.
        The 'back' should contain a clear, concise explanation or answer.

        Context:
        {combined_document_text}
        """

        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=FlashcardDeck,
                temperature=0.3
            ),
        )
        return json.loads(response.text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
