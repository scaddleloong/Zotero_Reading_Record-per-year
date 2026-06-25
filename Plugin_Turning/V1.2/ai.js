/* Annotation_Information_Start

Author: scaddleloong@gmail.com
Date: 2026/06/24
ai.js V1.2: structured AI paper analysis (9 fields)

Annotation_Information_End */

// Generate AI summary for a single item
async function generateArticleSummary(itemKey) {
    try {
        var libraryID = Zotero.Libraries.userLibraryID;
        var item = Zotero.Items.getByLibraryAndKey(libraryID, itemKey);
        if (!item) return _loc("ai.error.item");

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

        var targetLang = _loc("ai.prompt.lang");
        promptText += "\n\nBased on ALL of the above information (reader notes and annotations) for this paper, " +
            "provide a structured analysis. " +
            "IMPORTANT: All field VALUES (the content after each colon) must be written in " + targetLang + ". " +
            "Only the field names (before the colon) remain in English. " +
            "Use your training knowledge to look up bibliographic data (DOI, journal, impact factor) " +
            "from the article title. If unsure, state what you know and mark unknowns as 'N/A'. " +
            "Format your response exactly as follows (field names in English, " +
            "each field on its own line, separated by exactly one blank line):\n\n" +
            "Anno_Abstract: (a comprehensive 200–300 word abstract/summary of this paper, written based on " +
            "all the reader's notes and annotations provided above; MUST be in " + targetLang + ")\n" +
            "\n" +
            "Biggest_Take-home_Message: (one-sentence summary of the most important takeaway)\n" +
            "\n" +
            "Review_DOI: (the DOI of this article)\n" +
            "\n" +
            "Review_Jor: (the journal name)\n" +
            "\n" +
            "Jor_IF: (the most recent JCR (Journal Citation Reports) impact factor. " +
            "Try the current year first (2025 JCR IF), then work backwards year by year " +
            "(2024, 2023, 2022...) until you find one. " +
            "Always note which year's IF you are reporting, e.g. '2024 JCR IF = xx.x')\n" +
            "\n" +
            "Pub_Date: (publication date)\n" +
            "\n" +
            "Main_Subject: (the main subject or topic)\n" +
            "\n" +
            "Key_Words: (3–5 key words)\n" +
            "\n" +
            "Major_Defect: (major limitations or defects of the study)\n" +
            "\n" +
            "Major_Q: (the core question this article addresses or solves)\n" +
            "\n" +
            "(Note: replace the parenthetical descriptions above with your actual analysis, " +
            "keep exactly one blank line between each field, no extra blank lines)";

        var sysMsg = "You are an academic reading assistant specializing in structured paper analysis. " +
            "For each article, identify it from the provided metadata and use your training knowledge " +
            "to supply accurate bibliographic information (DOI, journal, impact factor). " +
            "Provide critical, insightful analysis based on all available reader annotations and notes. " +
            "IMPORTANT: Write your entire response in " + targetLang + ". " +
            "Only the 9 field names (Anno_Abstract, Biggest_Take-home_Message, etc.) remain in English " +
            "— all descriptive content after the colons must be in " + targetLang + ".";

        return await callAI(promptText, sysMsg);
    } catch (e) {
        Zotero.debug("generateArticleSummary error: " + e);
        return _loc("ai.error.generic");
    }
}

// Low-level AI API call (supports both Anthropic and OpenAI-compatible)
async function callAI(userPrompt, systemPrompt) {
    var cfg = getAPIConfig();
    if (!cfg.endpoint || !cfg.apiKey) {
        return _loc("ai.error.noconfig");
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
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }]
        });
        var resp = await fetch(endpoint, {
            method: "POST", headers: headers, body: body
        });
        if (!resp.ok) return _loc("ai.error.http", resp.status);
        var data = await resp.json();
        if (data.content && data.content.length > 0) return data.content[0].text;
        return _loc("ai.error.response");
    } else {
        var messages = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "user", content: userPrompt });
        var body = JSON.stringify({
            model: model,
            max_tokens: 2048,
            messages: messages
        });
        var headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + cfg.apiKey
        };
        var resp = await fetch(endpoint, {
            method: "POST", headers: headers, body: body
        });
        if (!resp.ok) return _loc("ai.error.http", resp.status);
        var data = await resp.json();
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        }
        return _loc("ai.error.response");
    }
}

Zotero.debug("Reading Tracker: ai.js loaded");
