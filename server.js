/**
 * Foundry Agent Chat Proxy
 * ------------------------
 * This tiny server is the "middleman" between your public website widget
 * and your private Azure AI Foundry agent.
 *
 * WHY THIS EXISTS:
 * Your Foundry agent requires a Microsoft Entra ID (Azure AD) login token,
 * not a simple password. That login must happen on a server you control —
 * never inside a browser — or anyone visiting your site could steal it.
 * This file does that login for you, then forwards chat messages.
 *
 * YOU DO NOT NEED TO UNDERSTAND THIS CODE. You only need to fill in the
 * values in the "SETTINGS" section below (or set them as Environment
 * Variables wherever you host this — that's the safer option).
 */

const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ======================= SETTINGS =======================
// Fill these in, OR (safer) set them as environment variables
// on whatever hosting service you use (Render, Azure, Railway, etc.)
// with these exact names: TENANT_ID, CLIENT_ID, CLIENT_SECRET, AGENT_ID

const PROJECT_ENDPOINT =
  "https://mailuchenwachukwu-3494-resource.services.ai.azure.com/api/projects/mailuchenwachukwu-3494";

const TENANT_ID = process.env.TENANT_ID || "PASTE_YOUR_TENANT_ID_HERE";
const CLIENT_ID = process.env.CLIENT_ID || "PASTE_YOUR_CLIENT_ID_HERE";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "PASTE_YOUR_CLIENT_SECRET_HERE";
const AGENT_ID = process.env.AGENT_ID || "PASTE_YOUR_AGENT_ID_HERE"; // looks like asst_xxxxxxxx

const API_VERSION = "2025-05-15-preview";
// ==========================================================

let cachedToken = null;
let cachedTokenExpiry = 0;

// Logs in to Azure using the app credentials, and reuses the login
// until it's close to expiring (so we're not logging in on every message).
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiry - 60) {
    return cachedToken;
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://ai.azure.com/.default",
    grant_type: "client_credentials",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Azure login failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

// Small helper for calling the Foundry Agent REST API.
async function foundryFetch(path, token, options = {}) {
  const url = `${PROJECT_ENDPOINT}${path}${path.includes("?") ? "&" : "?"}api-version=${API_VERSION}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Foundry API error (${resp.status}) on ${path}: ${errText}`);
  }
  return resp.json();
}

// Waits for the agent to finish "thinking" before we ask for the answer.
async function waitForRunToFinish(threadId, runId, token) {
  const maxTries = 60; // ~60 seconds max wait
  for (let i = 0; i < maxTries; i++) {
    const run = await foundryFetch(`/threads/${threadId}/runs/${runId}`, token);
    if (run.status === "completed") return run;
    if (["failed", "cancelled", "expired"].includes(run.status)) {
      throw new Error(`Agent run did not complete: ${run.status}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Agent took too long to respond.");
}

// The one endpoint your website widget will call.
// Body: { message: "hi there", threadId: "optional, to continue a conversation" }
app.post("/api/chat", async (req, res) => {
  try {
    const { message, threadId } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' in request." });
    }

    const token = await getAccessToken();

    // Create-and-run in one step: if threadId is provided, we add the
    // message to the existing thread instead of starting a new one.
    let thread;
    if (threadId) {
      await foundryFetch(`/threads/${threadId}/messages`, token, {
        method: "POST",
        body: JSON.stringify({ role: "user", content: message }),
      });
      thread = { id: threadId };
    }

    const run = threadId
      ? await foundryFetch(`/threads/${threadId}/runs`, token, {
          method: "POST",
          body: JSON.stringify({ assistant_id: AGENT_ID }),
        })
      : await foundryFetch(`/threads/runs`, token, {
          method: "POST",
          body: JSON.stringify({
            assistant_id: AGENT_ID,
            thread: { messages: [{ role: "user", content: message }] },
          }),
        });

    const finalThreadId = threadId || run.thread_id;
    await waitForRunToFinish(finalThreadId, run.id, token);

    const messages = await foundryFetch(`/threads/${finalThreadId}/messages`, token);
    const latest = messages.data.find((m) => m.role === "assistant");
    const replyText =
      latest?.content?.[0]?.text?.value || "(The agent didn't return any text.)";

    res.json({ reply: replyText, threadId: finalThreadId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Foundry chat proxy is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
