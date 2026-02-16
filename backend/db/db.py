from pathlib import Path 
from sqlalchemy import create_engine

SCRIPT_DIR = Path(__file__).parent.absolute()
DATABASE_URL = f"sqlite:///{SCRIPT_DIR / 'finance.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

def get_conn():
    return engine.connect()
