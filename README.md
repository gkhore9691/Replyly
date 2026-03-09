# Replyly — Distributed Backend Debugging Tool

HTTP request capture, inspection, and replay tool for distributed Node.js backends.
Debug production issues by replaying exact requests against any environment.

🔗 **Status:** Active development

## 🧠 The Problem

Reproducing bugs in distributed systems is hard. Replyly captures live HTTP traffic and lets you replay requests against dev, staging, or prod — with full headers, body, and timing intact.

## ✨ Features

- Capture & store incoming HTTP requests with full metadata
- Replay any request against any target environment
- Request diffing — compare responses across environments
- Real-time request stream via WebSockets
- Distributed agent architecture — deploy alongside any Node.js service
- Redis-backed queue for high-throughput capture
- Dashboard for request inspection and replay management

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, TypeScript |
| Queue | Redis |
| Real-time | WebSockets |
| Frontend | Next.js, TypeScript |
| Architecture | Distributed agents + central collector |

## 🚀 Getting Started
```bash
npm install
npm run dev
```

## 🗺 Roadmap

- [x] HTTP request capture agent
- [x] Replay engine
- [ ] Response diffing
- [ ] Distributed tracing integration
- [ ] Kafka support for high-volume streams
