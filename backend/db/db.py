from sqlalchemy import create_engine, text

DATABASE_URL = "sqlite:///finance.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

def get_conn():
    return engine.connect()
