# Deploying API to Render (Web Service)

This guide contains the exact configuration and commands to host the NestJS API on Render.

---

## 1. Render Basic Settings

### Name
```
swasthsaathi-api
```

### Environment / Runtime
```
Node
```

### Region
```
Singapore (or closest to your users)
```

### Branch
```
master
```

### Root Directory
*(Leave this field completely empty / blank)*

---

## 2. Build & Start Commands

### Build Command
```bash
npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @repo/contracts build && pnpm --filter api build
```

### Start Command
```bash
pnpm --filter api start:prod
```

### Health Check Path
```
/api
```

---

## 3. Environment Variables

Add these key-value pairs in **Render Dashboard > Environment**:

### Required

```env
NODE_VERSION=20
```

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

```env
CLERK_SECRET_KEY=sk_live_your_clerk_secret_key
```

```env
GEMINI_API_KEY=your_google_gemini_api_key
```

```env
OPENAI_API_KEY=your_openai_api_key
```

---

### Optional

```env
CLERK_PUBLISHABLE_KEY=pk_live_your_clerk_publishable_key
```

```env
OPENAI_MODEL=gpt-4o
```

```env
OPENAI_TITLE_MODEL=gpt-4o-mini
```

```env
AGENT_RUNS_PER_HOUR=30
```

```env
VOICE_CALLS_PER_HOUR=20
```
