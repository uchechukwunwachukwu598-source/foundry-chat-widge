# Getting your Azure AI Foundry agent onto your Systeme.io site

You have two files that work as a pair:

- **server.js** – the secure "middleman" (never touches your website directly)
- **widget.html** – the chat box that visitors see on your site

Your Foundry project endpoint is already filled in for you:
`https://mailuchenwachukwu-3494-resource.services.ai.azure.com/api/projects/mailuchenwachukwu-3494`

You still need **3 pieces of information from Azure** before this works. Here's exactly where to find them.

---

## Step 1 — Get your Agent ID

1. Go to [ai.azure.com](https://ai.azure.com) and open your project.
2. Open **Agents**, click on the agent you published.
3. Copy its ID — it looks like `asst_xxxxxxxxxxxxxxxx`.
4. Paste it into `server.js` where it says `PASTE_YOUR_AGENT_ID_HERE`.

## Step 2 — Create a "login" for your server (an App Registration)

Your server needs its own Microsoft login (separate from your personal one) so it can talk to your agent securely.

1. Go to [portal.azure.com](https://portal.azure.com) → search **"App registrations"** → **New registration**.
2. Give it any name (e.g. "Website Chat Bridge") → click **Register**.
3. On its overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
4. Go to **Certificates & secrets** → **New client secret** → copy the secret **value** immediately (it's only shown once).
5. Now give this app permission to use your Foundry project: in your Foundry project, go to **Access control (IAM)** → **Add role assignment** → choose a role like **Azure AI User** → assign it to the app you just created (search by the name you gave it).

Paste these three values into `server.js`:
- `TENANT_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`

*(Safer alternative: instead of pasting these into the file, set them as "Environment Variables" in whatever hosting service you use in Step 3 — the code already checks for those first.)*

## Step 3 — Put server.js online

This little server needs to run somewhere 24/7. The easiest free/cheap options for someone non-technical:

- **Render.com** (recommended — free tier, simple):
  1. Create a free account.
  2. Click **New → Web Service**, upload/connect this `foundry-chat-widget` folder.
  3. Set the start command to `npm start`.
  4. Add your TENANT_ID / CLIENT_ID / CLIENT_SECRET / AGENT_ID as Environment Variables in its settings.
  5. Once deployed, Render gives you a URL like `https://your-app.onrender.com`.

- Or ask a freelancer (Fiverr/Upwork) to "deploy this Node.js Express app to Render or Azure App Service" — this step takes an experienced person about 10 minutes.

## Step 4 — Point the widget at your server

Open `widget.html`, find this line near the bottom:

```js
const PROXY_URL = "https://YOUR-DEPLOYED-SERVER-URL.example.com/api/chat";
```

Replace it with your real Render URL + `/api/chat`, for example:

```js
const PROXY_URL = "https://your-app.onrender.com/api/chat";
```

## Step 5 — Put the widget on your Systeme.io page

You have two easy options:

**Option A — Host widget.html somewhere and embed it as an iframe**
Upload `widget.html` to any free static host (Render can serve this too, or Netlify/GitHub Pages). Then in Systeme.io:
1. Edit your page → drag in a **Raw HTML / Embed code** block.
2. Paste:
   ```html
   <iframe src="https://your-widget-url.example.com/widget.html"
           style="width:100%; max-width:420px; height:600px; border:none;">
   </iframe>
   ```
3. Save and publish.

**Option B — Paste the whole widget.html content directly**
In the same Raw HTML block in Systeme.io, paste the entire contents of `widget.html` directly (Systeme.io will render the HTML/CSS/JS inline). This skips needing a separate host for the widget itself — only `server.js` needs separate hosting.

---

## Quick test before going live

Open `widget.html` in your own browser first (double-click the file), send a test message, and confirm you get a real reply back from your agent. Once that works locally, do Steps 3–5 to make it public.

If anything errors out, the message will show in your browser's developer console (right-click → Inspect → Console tab) — happy to help you read it if you paste it back to me.
