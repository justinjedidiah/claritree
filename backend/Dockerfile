FROM python:3.13.1-slim AS builder

WORKDIR /backend

RUN pip install --no-cache-dir uv

COPY requirements.txt .

RUN uv pip install --no-cache-dir --system -r requirements.txt

# runtime
FROM python:3.13.1-slim AS runtime

WORKDIR /app

COPY --from=builder /usr/local/lib/python3.13/site-packages /usr/local/lib/python3.13/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY . .

EXPOSE 8000

CMD ["/bin/sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]