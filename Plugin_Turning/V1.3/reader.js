/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/08/06
reader.js V1.3: AI_QA — selection popup button + streaming Q&A dialog

Annotation_Information_End */

// ---- Reader registration lifecycle ----
var _aiqaRegistered = false;

// Selection popup handler: append an AI_QA button next to Highlight/Copy
function _aiqaOnTextSelectionPopup(event) {
    try {
        var doc = event.doc;
        var params = event.params;
        var append = event.append;
        var text = (params.annotation && params.annotation.text) || "";
        if (!text.trim()) return; // formula/image selection may yield no text

        var btn = doc.createElement("div");
        btn.textContent = _loc("aiqa.popup.button");
        btn.style.cssText =
            "cursor:pointer;padding:2px 8px;margin-left:6px;" +
            "border:1px solid rgba(0,0,0,.15);border-radius:4px;" +
            "font-size:13px;user-select:none;white-space:nowrap";
        btn.addEventListener("click", function() {
            openAIQAWindow(text);
        });
        append(btn);
    } catch (e) {
        Zotero.debug("_aiqaOnTextSelectionPopup error: " + e);
    }
}

function registerAIQAReader() {
    if (_aiqaRegistered) return;
    if (!Zotero.Reader || !Zotero.Reader.registerEventListener) return;
    Zotero.Reader.registerEventListener(
        "renderTextSelectionPopup",
        _aiqaOnTextSelectionPopup,
        "reading-tracker@scaddleloong"
    );
    _aiqaRegistered = true;
}

function unregisterAIQAReader() {
    if (!_aiqaRegistered) return;
    try {
        Zotero.Reader.unregisterEventListener("renderTextSelectionPopup", _aiqaOnTextSelectionPopup);
    } catch (e) {
        Zotero.debug("unregisterAIQAReader error: " + e);
    }
    _aiqaRegistered = false;
}

// ---- Escaping for embedding selected text into generated HTML ----
function _aiqaEscape(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ---- Q&A dialog window ----
function _aiqaGenerateHTML(selectedText) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${_loc("aiqa.title")}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:24px 28px;color:#24292f;background:#fff}
h2{font-size:17px;font-weight:600;margin:0 0 2px 0}
.sub{color:#656d76;font-size:12px;margin:0 0 22px 0}
.field{margin-bottom:16px}
.field label{display:block;font-size:13px;font-weight:500;margin-bottom:3px;color:#24292f}
.qa-textarea{width:100%;padding:6px 10px;font-size:13px;border:1px solid #d0d7de;border-radius:6px;background:#fff;color:#24292f;box-sizing:border-box;outline:none;font-family:inherit;resize:vertical}
.qa-textarea:focus{border-color:#0969da;box-shadow:0 0 0 3px rgba(9,105,218,0.15)}
.btn-row{display:flex;align-items:center;gap:12px;margin:6px 0 16px 0;flex-wrap:wrap}
.btn{padding:6px 16px;font-size:13px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;cursor:pointer}
.btn:hover{background:#eaeef2}
.btn.primary{background:#0969da;color:#fff;border-color:#0969da}
.btn.primary:hover{background:#0860ca}
.btn:disabled{opacity:.5;cursor:default}
.status{font-size:13px}
.status.ok{color:#1a7f37}
.status.err{color:#cf222e}
.status.wait{color:#656d76}
#aiqa-answer{white-space:pre-wrap;word-break:break-word;min-height:180px;max-height:320px;overflow-y:auto;background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:10px 12px;font-size:13px;line-height:1.55}
</style>
</head>
<body>
<h2>🤖 ${_loc("aiqa.title")}</h2>
<p class="sub">${_loc("aiqa.subtitle")}</p>

<div class="field">
  <label for="aiqa-selected">${_loc("aiqa.selected.label")}</label>
  <textarea id="aiqa-selected" class="qa-textarea" rows="5" spellcheck="false">${_aiqaEscape(selectedText)}</textarea>
</div>

<div class="field">
  <label for="aiqa-question">${_loc("aiqa.question.label")}</label>
  <input id="aiqa-question" class="qa-textarea" type="text" placeholder="${_loc("aiqa.question.placeholder")}" spellcheck="false"/>
</div>

<div class="btn-row">
  <button class="btn primary" id="aiqa-send">${_loc("aiqa.btn.send")}</button>
  <button class="btn" id="aiqa-stop" style="display:none">${_loc("aiqa.btn.stop")}</button>
  <button class="btn" id="aiqa-copy" style="display:none">${_loc("aiqa.btn.copy")}</button>
  <span class="status" id="aiqa-status"></span>
</div>

<div class="field">
  <label>${_loc("aiqa.answer.label")}</label>
  <div id="aiqa-answer">${_loc("aiqa.answer.empty")}</div>
</div>

<script>
var selectedEl = document.getElementById('aiqa-selected');
var questionEl = document.getElementById('aiqa-question');
var sendBtn = document.getElementById('aiqa-send');
var stopBtn = document.getElementById('aiqa-stop');
var copyBtn = document.getElementById('aiqa-copy');
var statusEl = document.getElementById('aiqa-status');
var answerEl = document.getElementById('aiqa-answer');

function setStatus(text, cls) {
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
  statusEl.textContent = text;
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  stopBtn.style.display = busy ? '' : 'none';
  copyBtn.style.display = (!busy && answerEl.textContent && answerEl.textContent !== _loc('aiqa.answer.empty')) ? '' : 'none';
}

sendBtn.addEventListener('click', async function() {
  var question = questionEl.value.trim();
  if (!question) { setStatus(_loc('aiqa.error.empty.question'), 'err'); return; }
  if (typeof window._aiQAAsk !== 'function') {
    setStatus(_loc('aiqa.error.unavailable'), 'err');
    return;
  }
  var selected = selectedEl.value;
  setBusy(true);
  answerEl.textContent = '';
  setStatus(_loc('aiqa.status.wait'), 'wait');
  try {
    var res = await window._aiQAAsk(selected, question);
    if (res && res.ok) {
      setStatus(_loc('aiqa.status.done'), 'ok');
    } else if (res && res.aborted) {
      setStatus(_loc('aiqa.status.aborted'), 'wait');
    } else if (res && res.error) {
      setStatus(res.error, 'err');
    } else {
      setStatus(_loc('ai.error.generic'), 'err');
    }
  } catch (e) {
    setStatus(_loc('ai.error.runtime', e.message || e), 'err');
  }
  setBusy(false);
});

questionEl.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') sendBtn.click();
});

stopBtn.addEventListener('click', function() {
  if (typeof window._aiQAStop === 'function') window._aiQAStop();
});

copyBtn.addEventListener('click', function() {
  if (typeof window._aiQACopy !== 'function') return;
  window._aiQACopy(answerEl.textContent);
  setStatus(_loc('aiqa.copy.ok'), 'ok');
});
<\/script>
</body></html>`;
}

function openAIQAWindow(selectedText) {
    var html = _aiqaGenerateHTML(selectedText || "");

    var win = Services.ww.openWindow(null, "about:blank", "_blank",
        "chrome,resizable,scrollbars,width=760,height=640,left=200,top=120", null);

    var abortCtrl = null;

    // Privileged functions injected BEFORE load (run in bootstrap sandbox → no CORS, full Zotero API)
    win._loc = _loc;
    win._aiQAAsk = async function(userText, question) {
        var cfg = getAPIConfig();
        if (!cfg.endpoint || !cfg.apiKey) {
            return { ok: false, error: _loc("ai.error.noconfig") };
        }
        var targetLang = _loc("ai.prompt.lang");
        var userPrompt = "Selected text (from an academic PDF):\n" + userText +
            "\n\nQuestion: " + question;
        var sysMsg = "You are an AI reading assistant. Answer the user's question " +
            "based on the selected text above. Write your entire answer in " + targetLang + ". " +
            "Be precise and educational, explaining step by step when asked about formulas.";
        abortCtrl = new AbortController();
        var answerEl = win.document.getElementById("aiqa-answer");
        var full = "";
        return await callAIStream(userPrompt, sysMsg, function(delta) {
            full += delta;
            if (answerEl) answerEl.textContent = full;
        }, { signal: abortCtrl.signal });
    };
    win._aiQAStop = function() {
        if (abortCtrl) abortCtrl.abort();
    };
    win._aiQACopy = function(text) {
        try {
            Cc["@mozilla.org/widget/clipboardhelper;1"]
                .getService(Ci.nsIClipboardHelper).copyString(String(text));
        } catch (e) {
            Zotero.debug("_aiQACopy error: " + e);
        }
    };

    win.addEventListener("load", function onLoad() {
        win.removeEventListener("load", onLoad);
        win.document.open();
        win.document.write(html);
        win.document.close();
    });
}

Zotero.debug("Reading Tracker: reader.js loaded");
