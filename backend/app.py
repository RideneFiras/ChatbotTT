from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import os
import json
import whisper
import torch

app = FastAPI()

# Autoriser le CORS pour le frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Monter le dossier frontend comme fichiers statiques
app.mount("/static", StaticFiles(directory="../frontend"), name="static")
import starlette
from starlette.staticfiles import StaticFiles

app.mount("/staticf", StaticFiles(directory="./staticf", html=True), name="staticf")

audio_output_path = os.path.join("staticf", "generated_audio.mp3")

# Load Whisper model at startup (you can adjust the size: tiny, base, small, medium, large)
print(" Loading Whisper model...")
whisper_model = whisper.load_model("base", device="cpu")
print(" Whisper model loaded.")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    return JSONResponse(content={"filename": file.filename, "status": "success"})

import httpx

#N8N_URL = "http://localhost:5678/webhook-test/n8n-chatbot"

@app.post("/chat")
async def chat_endpoint(payload: dict):
    user_message = payload.get("message", "")
    print(f"➡ Received message from frontend: {user_message}")

    async with httpx.AsyncClient() as client:
        try:
            print(f"➡ Sending to n8n at {N8N_URL}...")
            n8n_response = await client.post(
                N8N_URL,
                json={"message": user_message},
                timeout=30
            )
            print(f" n8n raw status: {n8n_response.status_code}")
            print(f" n8n raw response text: {n8n_response.text}")

            n8n_response.raise_for_status()

            try:
                result = n8n_response.json()
                print(f"Parsed JSON from n8n: {json.dumps(result, indent=2)}")
            except Exception as json_err:
                print(f"Failed to parse JSON from n8n: {json_err}")
                return {"response": " Invalid JSON response from n8n."}

            # Look directly for 'answer' and 'suggested_questions'
            if isinstance(result, list) and len(result) > 0:
                first = result[0]
                answer = first.get("answer")
                suggestions = first.get("suggested_questions", [])
                return {
                    "response": answer,
                    "suggested_questions": suggestions
                }

            print("⚠ Unexpected format in n8n response.")
            return {"response": "Unexpected format in n8n response."}

        except httpx.HTTPError as e:
            print(f" HTTP error contacting n8n: {e}")
            return {"response": f" Error contacting chatbot: {str(e)}"}

        except Exception as e:
            print(f" General error: {e}")
            return {"response": f" Unexpected error: {str(e)}"}


from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import os
import whisper
import httpx
from gtts import gTTS

N8N_URL = "http://localhost:5678/webhook/n8n-chatbot"

@app.post("/voice-chat")
async def voice_chat(file: UploadFile = File(...)):
    temp_audio_file = "temp_audio.webm"
    with open(temp_audio_file, "wb") as f:
        f.write(await file.read())

    try:
        result = whisper_model.transcribe(temp_audio_file)
        os.remove(temp_audio_file)
        transcribed_text = result["text"]
        print(f"✅ Transcribed text: {transcribed_text}")

        async with httpx.AsyncClient() as client:
            n8n_response = await client.post(
                N8N_URL,
                json={"message": transcribed_text},
                timeout=30
            )
            n8n_response.raise_for_status()
            n8n_result = n8n_response.json()

            #  Handle dictionary or list format from n8n
            data = None
            if isinstance(n8n_result, list) and len(n8n_result) > 0:
                data = n8n_result[0]
            elif isinstance(n8n_result, dict):
                data = n8n_result
            else:
                return {"response": " Unexpected n8n response format."}

            answer = data.get("answer") or data.get("response")
            suggestions = data.get("suggested_questions")

            if not answer:
                return {"response": "'answer' or 'response' key missing from n8n."}

            print(f" Answer from n8n: {answer}")

            # Generate TTS (audio) from the answer
            tts = gTTS(text=answer, lang='fr')
            audio_output_path = "staticf/generated_audio.mp3"
            tts.save(audio_output_path)
            print(f" Audio saved at {audio_output_path}")

            return JSONResponse(content={
                "response": answer,
                "suggested_questions": suggestions,
                "audio_url": "http://localhost:8000/staticf/generated_audio.mp3"

            })

    except Exception as e:
        print(f" Whisper or processing error: {e}")
        return JSONResponse(content={"response": f" Whisper or processing error: {str(e)}"})


@app.get("/")
def serve_index():
    index_path = os.path.join(os.path.dirname(__file__), "../frontend/index.html")
    return FileResponse(index_path)
