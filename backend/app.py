from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.chat_router import chat_router
from routers.data_router import data_router

app = FastAPI()

# ---------
# Utils
# ---------

origins = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "https://claritree.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------
# Routes
# ---------

@app.get("/")
def root():
    return {"status": "ok"}

app.include_router(chat_router)
app.include_router(data_router)

