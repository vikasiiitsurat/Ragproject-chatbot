const $ = (selector) => document.querySelector(selector);
const namespace = $("#namespace");
const documents = $("#documents");
const conversations = $("#conversations");
const chat = $("#chat");
const status = $("#upload-status");
const filesInput = $("#files");
const dropZone = $("#drop-zone");
let activeConversationId = null;
let accessToken = localStorage.getItem("documentRagAccessToken");
let authMode = "login";

async function api(url, options) {
  const headers = new Headers(options?.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed.");
  return data;
}
function showAuth() { $("#auth-overlay").classList.remove("hidden"); }
function hideAuth() { $("#auth-overlay").classList.add("hidden"); }
function setAuthMode(mode) {
  authMode = mode;
  const register = mode === "register";
  $("#auth-title").textContent = register ? "Create your workspace" : "Welcome back";
  $("#auth-copy").textContent = register ? "Create an account to keep documents private and organized." : "Sign in to access your private research workspace.";
  $("#auth-form button[type=submit]").textContent = register ? "Create account" : "Sign in";
  $("#auth-toggle").textContent = register ? "Already have an account? Sign in" : "Need an account? Create one";
  $("#auth-password").autocomplete = register ? "new-password" : "current-password";
  $("#auth-error").textContent = "";
}
const workspace = () => namespace.value.trim();
function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle("error", isError); }
function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  $("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}
function setButton(form, busy, label) { const button = form.querySelector("button"); button.disabled = busy; button.textContent = busy ? label : button.dataset.label; }
function emptyList(message) { const element = document.createElement("p"); element.className = "sidebar-empty"; element.textContent = message; return element; }
document.querySelectorAll("button").forEach((button) => { button.dataset.label = button.textContent; });

function updateFileSummary() {
  const files = [...filesInput.files];
  $("#file-summary").textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected: ${files.map((file) => file.name).join(", ")}` : "";
}
function documentCard(item) {
  const card = document.createElement("article"); card.className = "document-item";
  const name = document.createElement("strong"); name.textContent = item.name;
  const pill = document.createElement("span"); pill.className = `status-pill ${item.status === "failed" ? "failed" : ""}`; pill.textContent = item.status;
  const detail = document.createElement("small"); detail.textContent = `${item.type.toUpperCase()} · ${item.chunkCount} chunks${item.status === "failed" && item.error ? ` · ${item.error}` : ""}`;
  const remove = document.createElement("button"); remove.className = "delete"; remove.textContent = "Delete"; remove.title = `Delete ${item.name}`;
  remove.onclick = async () => { if (!confirm(`Delete “${item.name}” and all of its indexed chunks?`)) return; try { await api(`/api/documents/${item.id}?namespace=${encodeURIComponent(workspace())}`, { method: "DELETE" }); setStatus(`${item.name} was deleted.`); showToast(`${item.name} was deleted.`); await refreshDashboard(); } catch (error) { setStatus(error.message, true); showToast(error.message, true); } };
  card.append(name, pill, detail, remove); return card;
}
async function refreshDashboard() {
  const [documentData, conversationData] = await Promise.all([api(`/api/documents?namespace=${encodeURIComponent(workspace())}`), api(`/api/chat/conversations?namespace=${encodeURIComponent(workspace())}`)]);
  documents.replaceChildren(...(documentData.documents.length ? documentData.documents.map(documentCard) : [emptyList("No documents yet")]));
  $("#document-count").textContent = documentData.documents.length;
  $("#header-document-count").textContent = documentData.documents.length;
  conversations.replaceChildren(...(conversationData.conversations.length ? conversationData.conversations.map((item) => { const button = document.createElement("button"); button.className = "conversation"; button.title = item.title; button.textContent = item.title; button.onclick = () => loadConversation(item.id); return button; }) : [emptyList("Your chats will appear here")]));
}
function sourceCard(source) {
  const node = $("#source-template").content.cloneNode(true);
  node.querySelector(".source-number").textContent = `[${source.number}]`;
  node.querySelector("strong").textContent = `${source.fileName} · page ${source.page}`;
  node.querySelector("p").textContent = source.preview;
  const link = node.querySelector("a"); const url = source.fileUrl || source.sourceUrl;
  if (url) link.href = source.type === "pdf" ? `${url}#page=${source.page}` : url; else link.remove();
  return node;
}
function renderMessages(messages) {
  chat.replaceChildren();
  messages.forEach((message) => {
    const bubble = document.createElement("article"); bubble.className = `message ${message.role}`;
    const text = document.createElement("p"); text.textContent = message.text; bubble.append(text);
    if (message.sources?.length) { const title = document.createElement("h3"); title.textContent = "Retrieved sources"; bubble.append(title, ...message.sources.map(sourceCard)); }
    chat.append(bubble);
  });
  chat.scrollTop = chat.scrollHeight;
}
async function loadConversation(id) { const data = await api(`/api/chat/conversations/${id}?namespace=${encodeURIComponent(workspace())}`); activeConversationId = id; renderMessages(data.conversation.messages); }
function newChat() { activeConversationId = null; chat.innerHTML = '<div class="empty-state"><span class="empty-icon">⌕</span><h2>What would you like to learn?</h2><p>Upload a document and ask a question. Every answer can be checked against its cited source.</p><div class="suggestions"><button type="button" data-question="Summarize the key points.">Summarize the key points</button><button type="button" data-question="What are the most important deadlines?">Find important deadlines</button><button type="button" data-question="What evidence supports the main conclusion?">Find supporting evidence</button></div></div>'; bindSuggestions(); }
function bindSuggestions() { chat.querySelectorAll("[data-question]").forEach((button) => { button.onclick = () => { $("#question").value = button.dataset.question; $("#question").focus(); }; }); }

$("#new-chat").onclick = newChat;
$("#logout").onclick = () => { localStorage.removeItem("documentRagAccessToken"); accessToken = null; activeConversationId = null; newChat(); showAuth(); };
$("#focus-upload").onclick = () => $("#ingest-card").scrollIntoView({ behavior: "smooth", block: "center" });
namespace.onchange = async () => { newChat(); try { await refreshDashboard(); } catch (error) { setStatus(error.message, true); } };
filesInput.onchange = updateFileSummary;
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add("dragging"); }));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove("dragging"); }));
dropZone.addEventListener("drop", (event) => { filesInput.files = event.dataTransfer.files; updateFileSummary(); });
$("#question").addEventListener("input", (event) => { event.target.style.height = "auto"; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`; });

$("#upload-form").onsubmit = async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!filesInput.files.length) return setStatus("Choose one or more files first.", true);
  const body = new FormData(form); body.append("namespace", workspace()); setStatus("Extracting text, creating chunks, and indexing your files..."); setButton(form, true, "Indexing...");
  try { const data = await api("/api/documents/upload", { method: "POST", body }); const message = `${data.documents.length} document${data.documents.length === 1 ? "" : "s"} indexed and ready to ask about.`; setStatus(message); showToast(message); form.reset(); updateFileSummary(); await refreshDashboard(); }
  catch (error) { setStatus(`Upload failed: ${error.message}`, true); showToast(`Upload failed: ${error.message}`, true); } finally { setButton(form, false); }
};
$("#url-form").onsubmit = async (event) => {
  event.preventDefault(); const form = event.currentTarget; const url = $("#url").value.trim(); if (!url) return setStatus("Paste a public URL first.", true);
  setStatus("Fetching and indexing the web page..."); setButton(form, true, "Indexing...");
  try { const data = await api("/api/documents/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, namespace: workspace() }) }); const message = `“${data.document.name}” is indexed and ready.`; setStatus(message); showToast(message); form.reset(); await refreshDashboard(); }
  catch (error) { setStatus(`URL failed: ${error.message}`, true); showToast(`URL failed: ${error.message}`, true); } finally { setButton(form, false); }
};
$("#question-form").onsubmit = async (event) => {
  event.preventDefault(); const form = event.currentTarget; const question = $("#question").value.trim(); if (!question) return;
  setButton(form, true, "Searching...");
  try { const data = await api("/api/chat/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, namespace: workspace(), conversationId: activeConversationId }) }); activeConversationId = data.conversationId; $("#question").value = ""; $("#question").style.height = "auto"; renderMessages(data.messages); await refreshDashboard(); }
  catch (error) { setStatus(`Question failed: ${error.message}`, true); showToast(`Question failed: ${error.message}`, true); } finally { setButton(form, false); }
};

$("#auth-toggle").onclick = () => setAuthMode(authMode === "login" ? "register" : "login");
$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const error = $("#auth-error");
  error.textContent = "";
  try {
    const result = await api(`/api/auth/${authMode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    accessToken = result.accessToken;
    localStorage.setItem("documentRagAccessToken", accessToken);
    namespace.value = result.workspace || "pdf-rag";
    hideAuth();
    await refreshDashboard();
    showToast(`Welcome, ${result.user.email}.`);
  } catch (requestError) { error.textContent = requestError.message; }
};

bindSuggestions();
if (accessToken) refreshDashboard().catch(() => { accessToken = null; localStorage.removeItem("documentRagAccessToken"); showAuth(); });
else showAuth();
