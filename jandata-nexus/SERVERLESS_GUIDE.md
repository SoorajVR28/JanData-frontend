# JanData Nexus — Data-Access & Serverless Setup Guide

This guide explains how to set up, configure, and use the **JanData Nexus Data-Access Engine** and store your **Groq API key in a Serverless Function**.

---

## 1. Architecture Overview

```text
User Question
     ↓
Frontend (runJanDataPipeline)
     ↓
Groq Serverless Function  ───►  Parses Question to Controlled JanData JSON Query
     ↓
Supabase Query Engine     ───►  Queries `observations` & `document_chunks` (RLS enabled)
     ↓
Groq Serverless Function  ───►  Synthesizes Structured Data into Natural-Language Answer + Provenance
     ↓
Display Answer to User
```

---

## 2. Storing Groq API Key in a Serverless Function

To protect your `GROQ_API_KEY`, it **must never be committed to git or exposed in browser client JavaScript**.

### Option A: Vercel / Netlify Serverless Function (Recommended for Vercel users)

The project includes an API route handler in [`api/groq.js`](file:///c:/Users/Ravichandra/OneDrive/Desktop/SOORAJ/PROJECTS/JanData-frontend/jandata-nexus/api/groq.js).

1. Deploy your frontend project to **Vercel**.
2. Go to **Vercel Dashboard → Project Settings → Environment Variables**.
3. Add a new variable:
   - **Key**: `GROQ_API_KEY`
   - **Value**: `gsk_your_groq_api_key_here`
4. The client will automatically call `/api/groq` securely!

---

### Option B: Supabase Edge Functions (Recommended for Supabase-only stack)

The project includes a Deno Edge Function in [`supabase/functions/groq-chat/index.ts`](file:///c:/Users/Ravichandra/OneDrive/Desktop/SOORAJ/PROJECTS/JanData-frontend/jandata-nexus/supabase/functions/groq-chat/index.ts).

1. Install the Supabase CLI:
   ```bash
   npm i -g supabase
   ```
2. Link your project and deploy the function:
   ```bash
   supabase link --project-ref your-supabase-project-ref
   supabase secrets set GROQ_API_KEY=gsk_your_groq_api_key_here
   supabase functions deploy groq-chat
   ```
3. Update your `.env` in the frontend:
   ```env
   VITE_GROQ_SERVERLESS_URL=https://your-project-ref.supabase.co/functions/v1/groq-chat
   ```

---

### Option C: Local Development with Vite (`npm run dev`)

For local testing without deploying to Vercel or Supabase immediately:

1. Create a `.env` file inside `jandata-nexus/`:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-publishable-anon-key
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. The custom Vite dev plugin in [`vite.config.js`](file:///c:/Users/Ravichandra/OneDrive/Desktop/SOORAJ/PROJECTS/JanData-frontend/jandata-nexus/vite.config.js) will intercept `/api/groq` requests and proxy them securely to Groq using your local `GROQ_API_KEY`.

---

## 3. How to Use the Pipeline in Frontend Code

Import `runJanDataPipeline` from `src/services/jandataPipeline.js` in your React components or chat handler:

```javascript
import { runJanDataPipeline } from './services/jandataPipeline.js';

async function handleUserMessage(question) {
  // Execute end-to-end pipeline
  const result = await runJanDataPipeline(question);

  if (result.success) {
    console.log("Parsed Controlled Query JSON:", result.controlledQuery);
    console.log("Structured Supabase Results:", result.dbResults);
    console.log("Final Natural Language Answer:", result.answer);
    
    // Display result.answer in UI
  } else {
    console.error("Pipeline Error:", result.error);
  }
}
```

---

## 4. Query Intent Examples

### 1. Single Indicator Query
- **Question**: *"What was the paddy production in Dakshina Kannada in 2026?"*
- **Controlled JSON Query**:
  ```json
  {
    "intent": "query",
    "entity": { "name": "Dakshina Kannada", "type": "district" },
    "domain": "agriculture",
    "indicator": "paddy_production",
    "year": 2026
  }
  ```

### 2. Cross-Indicator / Join Query
- **Question**: *"Compare paddy production and groundwater levels in Dakshina Kannada in 2026."*
- **Controlled JSON Query**:
  ```json
  {
    "intent": "compare_indicators",
    "entity": { "name": "Dakshina Kannada", "type": "district" },
    "year": 2026,
    "indicators": ["paddy_production", "groundwater_level"]
  }
  ```

### 3. Cross-Domain Query
- **Question**: *"Find districts where school enrollment is low (< 50000) and unemployment is high (> 10)."*
- **Controlled JSON Query**:
  ```json
  {
    "intent": "cross_domain_query",
    "entity_type": "district",
    "year": 2026,
    "conditions": [
      { "indicator": "school_enrollment", "operator": "<", "value": 50000 },
      { "indicator": "unemployment_rate", "operator": ">", "value": 10 }
    ]
  }
  ```

### 4. Semantic Search Query
- **Question**: *"Why did the report expect lower crop coverage?"*
- **Controlled JSON Query**:
  ```json
  {
    "intent": "semantic_search",
    "query": "reasons for expected lower crop coverage"
  }
  ```

### 5. Hybrid Query
- **Question**: *"What was rainfall in Dakshina Kannada and why did the report say crop coverage was expected to decline?"*
- **Controlled JSON Query**:
  ```json
  {
    "intent": "hybrid",
    "structured": {
      "intent": "query",
      "entity": { "name": "Dakshina Kannada", "type": "district" },
      "indicator": "rainfall",
      "year": 2026
    },
    "semantic": {
      "intent": "semantic_search",
      "query": "reasons for expected lower crop coverage"
    }
  }
  ```

---

## 5. Supabase RLS Setup

Run the SQL statements in [`supabase_rls_policies.sql`](file:///c:/Users/Ravichandra/OneDrive/Desktop/SOORAJ/PROJECTS/JanData-frontend/jandata-nexus/supabase_rls_policies.sql) in your Supabase SQL Editor to ensure Row Level Security (RLS) is enabled and grants `SELECT` access to the frontend anon key.
