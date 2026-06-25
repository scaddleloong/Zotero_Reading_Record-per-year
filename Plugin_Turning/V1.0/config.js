/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/24
config.js V1.0: _defaultModel helper, removed dead code

Annotation_Information_End */

const _PREF = "extensions.reading-tracker.";

const _DEFAULTS = {
  endpoint: "",
  apiKey: "",
  model: ""
};

function _r(key, fallback) {
  try {
    const v = Zotero.Prefs.get(_PREF + key);
    return v !== undefined && v !== null ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

function _w(key, val) {
  Zotero.Prefs.set(_PREF + key, val);
}

function getAPIConfig() {
  const cfg = {};
  for (const k of Object.keys(_DEFAULTS)) {
    cfg[k] = _r(k, _DEFAULTS[k]);
  }
  return cfg;
}

function setAPIConfig(obj) {
  for (const k of Object.keys(_DEFAULTS)) {
    if (k in obj) _w(k, obj[k]);
  }
}

function clearAPIConfig() {
  for (const k of Object.keys(_DEFAULTS)) {
    try { Zotero.Prefs.clear(_PREF + k); } catch (e) {}
  }
}

// ------- URL helpers: accept base URL, auto-resolve to actual endpoint -------

function _isAnthropic(base) {
  return base.indexOf("anthropic.com") !== -1;
}

function _defaultModel(endpoint) {
  return _isAnthropic(endpoint || "") ? "claude-sonnet-4-6" : "deepseek-chat";
}

function _stripPath(url) {
  // If user pasted a full path like https://api.deepseek.com/v1/chat/completions,
  // strip it back to base for consistent handling
  return url.replace(/\/?(chat\/completions|v\d\/chat\/completions|v\d\/messages|v\d\/models|models)\/?$/, "");
}

function resolveChatEndpoint(base) {
  base = _stripPath(base);
  if (_isAnthropic(base)) {
    return base.replace(/\/+$/, "") + "/v1/messages";
  }
  return base.replace(/\/+$/, "") + "/v1/chat/completions";
}

function resolveModelsEndpoint(base) {
  base = _stripPath(base);
  return base.replace(/\/+$/, "") + "/v1/models";
}

// ------- Settings window (chrome-privileged functions injected) -------

function _generateSettingsHTML() {
  const cfg = getAPIConfig();

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reading Tracker Settings</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:24px 28px;color:#24292f;background:#fff}
h2{font-size:17px;font-weight:600;margin:0 0 2px 0}
.sub{color:#656d76;font-size:12px;margin:0 0 22px 0}
.field{margin-bottom:16px;max-width:520px}
.field label{display:block;font-size:13px;font-weight:500;margin-bottom:3px;color:#24292f}
.field input{width:100%;padding:6px 10px;font-size:13px;border:1px solid #d0d7de;border-radius:6px;background:#fff;color:#24292f;box-sizing:border-box;outline:none}
.field input:focus{border-color:#0969da;box-shadow:0 0 0 3px rgba(9,105,218,0.15)}
.field .hint{font-size:11px;color:#656d76;margin-top:3px;word-break:break-all}
.btn-row{display:flex;align-items:center;gap:12px;margin-top:6px;max-width:520px;flex-wrap:wrap}
.btn{padding:6px 16px;font-size:13px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;cursor:pointer}
.btn:hover{background:#eaeef2}
.btn.primary{background:#0969da;color:#fff;border-color:#0969da}
.btn.primary:hover{background:#0860ca}
.status{font-size:13px}
.status.ok{color:#1a7f37}
.status.err{color:#cf222e}
.status.wait{color:#656d76}
code{font-size:12px;background:#f6f8fa;padding:1px 4px;border-radius:3px}
</style>
</head>
<body>
<h2>&#x2699;&#xFE0F; Reading Tracker &mdash; AI Settings</h2>
<p class="sub">Enter your API endpoint, key and model. Stored locally &mdash; never synced with Zotero.</p>

<div class="field">
  <label for="endpoint">API Endpoint URL</label>
  <input type="url" id="endpoint" value="${cfg.endpoint}" placeholder="https://api.deepseek.com" spellcheck="false"/>
  <div class="hint">Enter the base URL of your API provider. E.g. <code>https://api.deepseek.com</code>, <code>https://api.openai.com</code>, <code>https://api.anthropic.com</code>.</div>
</div>

<div class="field">
  <label for="apiKey">API Key</label>
  <input type="password" id="apiKey" value="${cfg.apiKey}" placeholder="sk-..." spellcheck="false"/>
  <div class="hint">Stored in Zotero profile (prefs.js) &mdash; never leaves your machine except when making API calls.</div>
</div>

<div class="field">
  <label for="model">Model</label>
  <input type="text" id="model" value="${cfg.model}" placeholder="e.g. deepseek-chat, gpt-4o, claude-sonnet-4-6" spellcheck="false"/>
  <div class="hint">Model name sent in the request body.</div>
</div>

<div class="btn-row">
  <button class="btn" id="btn-test">&#x1F50C; Test Connection</button>
  <button class="btn primary" id="btn-save">&#x1F4BE; Save</button>
  <span class="status" id="status-msg"></span>
</div>

<script>
var endpointEl = document.getElementById('endpoint');
var apiKeyEl = document.getElementById('apiKey');
var modelEl = document.getElementById('model');
var statusEl = document.getElementById('status-msg');
var _to;

function setStatus(text, cls) {
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
  statusEl.textContent = text;
}

// ---- Save: calls chrome-privileged function injected by config.js ----
document.getElementById('btn-save').addEventListener('click', function() {
  if (typeof window._saveAPIConfig !== 'function') {
    setStatus('Internal error: save function unavailable', 'err');
    return;
  }
  window._saveAPIConfig({
    endpoint: endpointEl.value,
    apiKey: apiKeyEl.value,
    model: modelEl.value
  });
  setStatus('Saved to Zotero profile (prefs.js)', 'ok');
  clearTimeout(_to);
  _to = setTimeout(function(){ setStatus('', ''); }, 3000);
});

// ---- Test: calls chrome-privileged function injected by config.js ----
document.getElementById('btn-test').addEventListener('click', async function() {
  var endpoint = endpointEl.value;
  var apiKey = apiKeyEl.value;
  var model = modelEl.value;

  if (!endpoint) { setStatus('Please enter an API endpoint URL.', 'err'); return; }
  if (!apiKey)   { setStatus('Please enter an API key.', 'err'); return; }

  if (typeof window._testAPIConnection !== 'function') {
    setStatus('Internal error: test function unavailable', 'err');
    return;
  }

  setStatus('Testing connection...', 'wait');

  try {
    var result = await window._testAPIConnection({ endpoint: endpoint, apiKey: apiKey, model: model });
    if (result.ok) {
      setStatus('Connected!', 'ok');
    } else if (result.status === 0) {
      setStatus('Cannot reach server. Check the URL.', 'err');
    } else if (result.status === 401 || result.status === 403) {
      setStatus('Authentication failed. Check your API key.', 'err');
    } else {
      setStatus('Server returned HTTP ' + result.status, 'err');
    }
  } catch (e) {
    setStatus('Unexpected error: ' + (e.message || e), 'err');
  }

  clearTimeout(_to);
  _to = setTimeout(function(){ setStatus('', ''); }, 10000);
});
<\/script>
</body></html>`;
}

function openSettingsWindow() {
  if (typeof _readingTrackerRootURI === "undefined") {
    Zotero.debug("Reading Tracker: _readingTrackerRootURI not set");
    return;
  }

  const html = _generateSettingsHTML();

  const win = Services.ww.openWindow(null, "about:blank", "_blank",
    "chrome,resizable,scrollbars,width=620,height=480,left=200,top=200", null);

  // Inject chrome-privileged functions BEFORE document.write
  // These run in the bootstrap sandbox (system principal) → no CORS, full Zotero API

  win._saveAPIConfig = function(cfg) {
    setAPIConfig(cfg);
    Zotero.debug("Reading Tracker: API config saved via settings window");
  };

  win._testAPIConnection = async function(cfg) {
    try {
      const base = cfg.endpoint;
      const isAnthropic = _isAnthropic(base);

      if (isAnthropic) {
        const fullUrl = resolveChatEndpoint(base);
        const headers = {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01"
        };
        const body = JSON.stringify({
          model: cfg.model || _defaultModel(cfg.endpoint),
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }]
        });

        const resp = await fetch(fullUrl, { method: "POST", headers, body });
        let detail = "";
        if (!resp.ok) {
          detail = "HTTP " + resp.status;
        }
        return { ok: resp.ok, status: resp.status, detail };

      } else {
        // OpenAI-compatible (DeepSeek, etc.) — GET /v1/models to verify auth
        const modelsUrl = resolveModelsEndpoint(base);
        const headers = { "Authorization": "Bearer " + cfg.apiKey };

        try {
          const r = await fetch(modelsUrl, { method: "GET", headers });
          if (r.ok) {
            return { ok: true, status: r.status, detail: "" };
          }
          // Non-200 from /v1/models — extract error detail
          return { ok: false, status: r.status, detail: "" };
        } catch (e) {
          // Network error trying /v1/models
          return { ok: false, status: 0, detail: "Cannot reach " + modelsUrl + " — " + (e.message || e) };
        }
      }
    } catch (e) {
      return { ok: false, status: 0, detail: e.message || String(e) };
    }
  };

  win.addEventListener("load", function onLoad() {
    win.removeEventListener("load", onLoad);
    win.document.open();
    win.document.write(html);
    win.document.close();
  });
}

Zotero.debug("Reading Tracker: config.js loaded");
