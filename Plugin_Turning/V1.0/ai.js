/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/24
ai.js V1.0: smarter default model selection

Annotation_Information_End */

// Generate AI summary for a single item
async function generateArticleSummary(itemKey) {
    try {
        var libraryID = Zotero.Libraries.userLibraryID;
        var item = Zotero.Items.getByLibraryAndKey(libraryID, itemKey);
        if (!item) return "Item not found.";

        // ----- metadata -----
        var title = item.getDisplayTitle() || "(untitled)";
        var creators = "";
        try {
            var allCreators = item.getCreators();
            if (allCreators && allCreators.length > 0) {
                creators = allCreators.map(function(c) {
                    return (c.firstName || "") + " " + (c.lastName || "");
                }).join(", ");
            }
        } catch (e) {}

        var date = _getField(item, "date");
        var source = _getField(item, "publicationTitle") ||
                     _getField(item, "publisher") || "";

        // ----- notes -----
        var noteTexts = [];
        try {
            var noteRefs = item.getNotes();
            if (noteRefs && noteRefs.length > 0) {
                for (var i = 0; i < noteRefs.length; i++) {
                    var noteItem = Zotero.Items.get(noteRefs[i].id);
                    if (!noteItem) continue;
                    var t = (noteItem.getNote() || "")
                        .replace(/<[^>]+>/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                    if (t) {
                        if (t.length > 500) t = t.slice(0, 500) + "...";
                        noteTexts.push(t);
                    }
                }
            }
        } catch (e) {}

        // ----- annotations -----
        var anns = [];
        try {
            var attIDs = item.getAttachments();
            if (attIDs && attIDs.length > 0) {
                for (var j = 0; j < attIDs.length; j++) {
                    var att = Zotero.Items.get(attIDs[j]);
                    if (!att) continue;
                    var items = [];
                    if (typeof att.getAnnotations === "function") {
                        try { items = att.getAnnotations() || []; } catch (e2) {}
                    }
                    if (items.length === 0 &&
                        typeof Zotero.Items.getAnnotations === "function") {
                        try {
                            items = Zotero.Items.getAnnotations(att.id) || [];
                        } catch (e2) {}
                    }
                    for (var k = 0; k < items.length; k++) {
                        try {
                            var txt = String(
                                items[k].getField("annotationText") ||
                                items[k].annotationText || ""
                            );
                            var cmt = String(
                                items[k].getField("annotationComment") ||
                                items[k].annotationComment || ""
                            );
                            if (txt.trim() || cmt.trim()) {
                                anns.push({ t: txt.trim(), cm: cmt.trim() });
                            }
                        } catch (e2) {}
                    }
                }
            }
        } catch (e) {}

        // ----- build prompt -----
        var promptText = "Title: " + title;
        if (creators) promptText += "\nAuthor(s): " + creators;
        if (date) promptText += "\nDate: " + date;
        if (source) promptText += "\nSource: " + source;

        if (noteTexts.length > 0) {
            promptText += "\n\nReader notes:";
            for (var n = 0; n < noteTexts.length; n++) {
                promptText += "\n- " + noteTexts[n];
            }
        }

        if (anns.length > 0) {
            promptText += "\n\nReader annotations / highlights:";
            var limit = Math.min(anns.length, 15);
            for (var a = 0; a < limit; a++) {
                if (anns[a].t) promptText += "\n- Highlight: \"" + anns[a].t + "\"";
                if (anns[a].cm) promptText += " → Note: " + anns[a].cm;
            }
        }

        promptText += "\n\nBased on the above information, provide a concise summary " +
            "of this article in English (200–300 words). Cover the main topic, " +
            "key points visible in the reader's notes/annotations, and the article's " +
            "overall value. If there are no notes or annotations, summarize based on " +
            "title and metadata alone.";

        var sysMsg = "You are a helpful academic reading assistant. " +
            "Generate concise, insightful article summaries.";

        return await callAI(promptText, sysMsg);
    } catch (e) {
        Zotero.debug("generateArticleSummary error: " + e);
        return "Error generating summary. Check your API configuration and try again.";
    }
}

// Low-level AI API call (supports both Anthropic and OpenAI-compatible)
async function callAI(userPrompt, systemPrompt) {
    var cfg = getAPIConfig();
    if (!cfg.endpoint || !cfg.apiKey) {
        return "⚠️ API not configured. Open Settings → ⚙️ and set up your API.";
    }

    var endpoint = resolveChatEndpoint(cfg.endpoint);
    var model = cfg.model || _defaultModel(cfg.endpoint);

    if (_isAnthropic(cfg.endpoint)) {
        var headers = {
            "Content-Type": "application/json",
            "x-api-key": cfg.apiKey,
            "anthropic-version": "2023-06-01"
        };
        var body = JSON.stringify({
            model: model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
        });
        var resp = await fetch(endpoint, {
            method: "POST", headers: headers, body: body
        });
        if (!resp.ok) return "API error: HTTP " + resp.status;
        var data = await resp.json();
        if (data.content && data.content.length > 0) return data.content[0].text;
        return "Unexpected API response.";
    } else {
        var messages = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "user", content: userPrompt });
        var body = JSON.stringify({
            model: model,
            max_tokens: 1024,
            messages: messages
        });
        var headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + cfg.apiKey
        };
        var resp = await fetch(endpoint, {
            method: "POST", headers: headers, body: body
        });
        if (!resp.ok) return "API error: HTTP " + resp.status;
        var data = await resp.json();
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        return "Unexpected API response.";
    }
}

Zotero.debug("Reading Tracker: ai.js loaded");
