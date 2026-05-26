FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FFMPEG_BINARY=ffmpeg \
    REMOTION_DIR=/app/Remotion \
    REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    fonts-noto-core \
    nodejs \
    npm \
    vim \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY Remotion/package.json Remotion/package-lock.json ./Remotion/

RUN npm --prefix /app/Remotion install

COPY app ./app
COPY Remotion ./Remotion
COPY scripts ./scripts
COPY .env.example ./.env.example
COPY README.md ./README.md

RUN mkdir -p /app/output /app/generated /app/temp /app/input /app/Remotion/public/audio

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
