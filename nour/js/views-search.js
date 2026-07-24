// Assistant conversationnel Nour : historique, contexte, reformulation par LLM,
// récupération locale, génération distante sourcée et secours local explicite.
import {
  $view, esc, bindTopbar, topbar, copyText, shareText, toast, sheet, closeSheet,
} from './app.js';
import { icon } from './icons.js';
import {
  state, save, createConversation, activeConversation, selectConversation,
  appendConversationMessage, deleteConversation,
} from './state.js';
import { aiHealth, aiPlan, aiAnswer } from './ai.js';
import {
  retrieveSources, buildLocalFallback, conversationHistory,
} from './rag.js';

const STARTERS = [
  'Quel est le rôle de l’homme dans l’Islam ?',
  'Quel est le rôle de la femme dans l’Islam ?',
  'Pourquoi la prière est-elle obligatoire ?',
  'Que faire si je rate une prière ?',
  'Explique-moi simplement la médisance.',
  'Quelle invocation réciter lorsque j’ai peur ?',
];

let currentController = null;
let currentRun = 0;
let status = { mode: 'checking', provider: null, model: null };

export async function viewSearch(initial = '') {
  stopGeneration();
  let conversation = activeConversation() || createConversation();

  $view.innerHTML = `
    ${topbar('Assistant Nour')}
    <section class="chat-shell">
      <header class="chat-toolbar">
        <div>
          <div class="chat-status" id="chatStatus"><span></span> Vérification du modèle…</div>
          <p id="chatModel">Le moteur local prépare les sources vérifiées.</p>
        </div>
        <div class="chat-toolbar-actions">
          <button class="btn-icon" id="chatHistory" aria-label="Historique des conversations">${icon('clock', 19)}</button>
          <button class="btn-icon" id="chatNew" aria-label="Nouvelle conversation">${icon('plus', 20)}</button>
        </div>
      </header>

      <div class="chat-messages" id="chatMessages" aria-live="polite"></div>

      <div class="chat-suggestions" id="chatSuggestions"></div>

      <form class="chat-composer" id="chatForm">
        <textarea id="chatInput" rows="1" maxlength="1200"
          placeholder="Posez votre question à Nour…" aria-label="Votre message"></textarea>
        <button class="chat-send" id="chatSend" type="submit" aria-label="Envoyer">${icon('navigation', 20)}</button>
        <button class="chat-stop" id="chatStop" type="button" hidden>${icon('stop', 15)} Arrêter</button>
      </form>
      <p class="chat-disclaimer">Les réponses religieuses doivent rester sourcées. Pour une situation personnelle,
      consultez une personne qualifiée.</p>
    </section>`;
  bindTopbar();

  const input = document.getElementById('chatInput');
  bindStaticActions();
  renderConversation(conversation);
  refreshStatus();

  if (initial) {
    input.value = initial;
    requestAnimationFrame(() => sendNewMessage(initial));
  } else {
    requestAnimationFrame(() => input.focus());
  }

  function bindStaticActions() {
    document.getElementById('chatForm').onsubmit = event => {
      event.preventDefault();
      sendNewMessage(input.value);
    };
    document.getElementById('chatStop').onclick = stopGeneration;
    document.getElementById('chatNew').onclick = () => {
      stopGeneration();
      conversation = createConversation();
      input.value = '';
      renderConversation(conversation);
      input.focus();
    };
    document.getElementById('chatHistory').onclick = openHistory;
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(132, input.scrollHeight)}px`;
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendNewMessage(input.value);
      }
    });
  }

  async function refreshStatus() {
    const health = await aiHealth();
    status = health.configured
      ? { mode: 'remote', provider: health.provider, model: health.model }
      : { mode: 'local', provider: null, model: null };
    renderStatus();
  }

  function renderStatus() {
    const badge = document.getElementById('chatStatus');
    const model = document.getElementById('chatModel');
    if (!badge || !model) return;
    const remote = status.mode === 'remote';
    badge.className = `chat-status ${remote ? 'remote' : 'local'}`;
    badge.innerHTML = `<span></span> ${remote ? 'Assistant IA distant' : 'Recherche locale'}`;
    model.textContent = remote
      ? `${status.provider || 'Fournisseur compatible'} · ${status.model || 'modèle configuré'}`
      : 'Aucun LLM distant disponible : Nour affiche uniquement les contenus locaux.';
  }

  function renderConversation(selected, options = {}) {
    conversation = selected;
    const root = document.getElementById('chatMessages');
    if (!root) return;
    root.innerHTML = conversation.messages.length
      ? conversation.messages.map(message => messageHtml(message)).join('')
      : welcomeHtml();
    bindMessageActions();
    renderSuggestions(options.suggestions);
    requestAnimationFrame(() => {
      root.lastElementChild?.scrollIntoView({ block: 'end', behavior: options.instant ? 'auto' : 'smooth' });
    });
  }

  function welcomeHtml() {
    return `<div class="chat-welcome">
      <div class="chat-mark">${icon('sparkle', 25)}</div>
      <h2>As-salâm ‘alaykoum, ${esc(state.settings.userName || 'Malick')}</h2>
      <p>Posez une question, demandez une explication plus simple ou poursuivez la conversation.
      Avec un modèle distant configuré, Nour reformule la demande, récupère ses sources locales puis rédige
      une réponse dont les citations sont contrôlées avant affichage.</p>
      <div class="chat-honesty"><b>Deux modes clairement distingués</b>
        <span><strong>Assistant IA distant</strong> : réponse rédigée par le modèle configuré.</span>
        <span><strong>Recherche locale</strong> : extraits et synthèses éditoriales, sans prétendre être ChatGPT.</span>
      </div>
    </div>`;
  }

  function messageHtml(message) {
    if (message.role === 'user') {
      return `<article class="chat-row user" data-message="${esc(message.id)}">
        <div class="chat-bubble user-bubble">${esc(message.content)}</div>
      </article>`;
    }
    const response = message.response || {};
    const sources = message.sources || [];
    const verses = sources.filter(source => source.type === 'quran');
    const hadiths = sources.filter(source => source.type === 'hadith');
    const duas = sources.filter(source => source.type === 'dua');
    const modeLabel = message.mode === 'remote'
      ? `${esc(message.model?.provider || 'IA')} · ${esc(message.model?.model || 'modèle distant')}`
      : message.kind === 'clarification' ? 'Question de clarification' : 'Recherche locale';
    const validation = message.validation?.status === 'validated'
      ? `<span class="chat-validated">${icon('check', 12)} Citations validées</span>` : '';

    return `<article class="chat-row assistant" data-message="${esc(message.id)}">
      <div class="assistant-avatar">${icon('sparkle', 16)}</div>
      <div class="chat-bubble assistant-bubble">
        <div class="assistant-meta">
          <span class="mode-pill ${message.mode === 'remote' ? 'remote' : 'local'}">${modeLabel}</span>
          ${validation}
        </div>
        ${message.kind === 'clarification' ? `
          <section class="answer-section direct"><p>${esc(response.answer_directe || '')}</p></section>
        ` : `
          <section class="answer-section direct">
            <h3>1. Réponse directe</h3>
            <p>${renderCitations(response.answer_directe || '', sources)}</p>
          </section>
          <section class="answer-section">
            <h3>2. Explication</h3>
            <p>${renderCitations(response.explication || 'Aucune explication supplémentaire disponible.', sources)}</p>
          </section>
          <section class="answer-section">
            <h3>3. Nuances importantes</h3>
            ${response.nuances?.length
              ? `<ul>${response.nuances.map(item => `<li>${renderCitations(item, sources)}</li>`).join('')}</ul>`
              : '<p class="muted">Aucune nuance supplémentaire n’est établie par les sources récupérées.</p>'}
          </section>
          ${sourceSection('4. Versets utilisés', verses, 'Aucun verset utilisé dans cette réponse.')}
          ${sourceSection('5. Hadiths authentiques utilisés', hadiths, 'Aucun hadith utilisé dans cette réponse.')}
          ${duas.length ? sourceSection('Invocations utilisées', duas, '') : ''}
          ${sourceSection('6. Références cliquables', sources, 'Aucune référence validée.')}
        `}
        ${message.mode !== 'remote' ? `<div class="local-mode-warning">
          ${icon('info', 14)} Recherche locale : aucun LLM distant n’a rédigé cette réponse.
        </div>` : ''}
        <div class="assistant-actions">
          <button data-copy="${esc(message.id)}">${icon('copy', 14)} Copier</button>
          <button data-share="${esc(message.id)}">${icon('share', 14)} Partager</button>
          <button data-regen="${esc(message.id)}">${icon('refresh', 14)} Régénérer</button>
        </div>
      </div>
    </article>`;
  }

  function sourceSection(title, sources, empty) {
    return `<section class="answer-section sources">
      <h3>${title}</h3>
      ${sources.length ? `<div class="source-list">${sources.map(sourceHtml).join('')}</div>`
        : `<p class="muted">${esc(empty)}</p>`}
    </section>`;
  }

  function sourceHtml(source) {
    const type = source.type === 'quran' ? 'Coran'
      : source.type === 'hadith' ? 'Hadith'
      : source.type === 'dua' ? 'Invocation' : 'Explication';
    return `<a class="chat-source" href="${esc(source.url)}">
      <span class="source-type">${type}</span>
      <span><b>${esc(source.ref)}</b>${source.grade ? `<small>${esc(source.grade)}</small>` : ''}</span>
      ${icon('chevR', 14)}
    </a>`;
  }

  function renderCitations(text, sources) {
    const sourceMap = new Map(sources.map(source => [source.id.toUpperCase(), source]));
    return esc(text).replace(/\[([A-Z]:[^\]\s]+)\]/gi, (whole, id) => {
      const source = sourceMap.get(id.toUpperCase());
      return source
        ? `<a class="inline-citation" href="${esc(source.url)}" title="${esc(source.ref)}">[${esc(id)}]</a>`
        : '';
    }).replace(/\n/g, '<br>');
  }

  function renderSuggestions(suggestions) {
    const root = document.getElementById('chatSuggestions');
    if (!root) return;
    const list = suggestions?.length
      ? suggestions
      : conversation.messages.length ? ['Explique davantage', 'Quelles sont tes sources ?', 'Résume simplement']
        : STARTERS;
    root.innerHTML = list.slice(0, 6).map(question =>
      `<button class="chat-suggestion" data-question="${esc(question)}">${esc(question)}</button>`).join('');
    root.querySelectorAll('[data-question]').forEach(button => {
      button.onclick = () => sendNewMessage(button.dataset.question);
    });
  }

  function bindMessageActions() {
    document.querySelectorAll('[data-copy]').forEach(button => {
      button.onclick = () => {
        const message = conversation.messages.find(item => item.id === button.dataset.copy);
        if (message) copyText(assistantPlainText(message));
      };
    });
    document.querySelectorAll('[data-share]').forEach(button => {
      button.onclick = () => {
        const message = conversation.messages.find(item => item.id === button.dataset.share);
        if (message) shareText('Réponse de Nour', assistantPlainText(message));
      };
    });
    document.querySelectorAll('[data-regen]').forEach(button => {
      button.onclick = () => regenerate(button.dataset.regen);
    });
  }

  function assistantPlainText(message) {
    const response = message.response || {};
    const lines = [
      'Réponse directe', response.answer_directe,
      '', 'Explication', response.explication,
      ...(response.nuances?.length ? ['', 'Nuances', ...response.nuances.map(item => `• ${item}`)] : []),
      ...(message.sources?.length ? ['', 'Sources', ...message.sources.map(source => `• ${source.ref}`)] : []),
      '', message.mode === 'remote'
        ? `Réponse générée par ${message.model?.provider || 'un modèle distant'} — ${message.model?.model || ''}`
        : 'Mode Recherche locale — aucune génération par un LLM distant.',
    ];
    return lines.filter(item => item !== undefined && item !== null).join('\n').trim();
  }

  async function sendNewMessage(raw) {
    const text = String(raw || '').trim();
    if (!text || currentController) return;
    if (!conversation.messages.length && conversation.title === 'Nouvelle conversation') conversation.title = text.slice(0, 52);
    const userMessage = { role: 'user', content: text };
    appendConversationMessage(conversation, userMessage);
    input.value = '';
    input.style.height = 'auto';
    renderConversation(conversation);
    await generateReply(conversation.messages[conversation.messages.length - 1]);
  }

  async function regenerate(assistantId) {
    if (currentController) return;
    const assistantIndex = conversation.messages.findIndex(message => message.id === assistantId);
    if (assistantIndex < 0) return;
    let userIndex = assistantIndex - 1;
    while (userIndex >= 0 && conversation.messages[userIndex].role !== 'user') userIndex--;
    if (userIndex < 0) return;
    const userMessage = conversation.messages[userIndex];
    conversation.messages.splice(assistantIndex, 1);
    save();
    renderConversation(conversation);
    await generateReply(userMessage);
  }

  async function generateReply(userMessage) {
    const run = ++currentRun;
    currentController = new AbortController();
    setBusy(true);
    showTyping();
    const previousAssistant = [...conversation.messages]
      .reverse().find(message => message.role === 'assistant');
    const history = conversationHistory(
      conversation.messages.filter(message => message.id !== userMessage.id),
    );

    try {
      const health = await aiHealth({ signal: currentController.signal, refresh: true });
      let payload;
      if (health.configured) {
        status = { mode: 'remote', provider: health.provider, model: health.model };
        renderStatus();
        const plan = await aiPlan({
          message: userMessage.content,
          history,
          signal: currentController.signal,
        });
        if (plan.clarification) {
          payload = {
            role: 'assistant',
            mode: 'remote',
            kind: 'clarification',
            response: {
              answer_directe: plan.clarification,
              explication: '',
              nuances: [],
              follow_up_suggestions: [],
            },
            sources: [],
            validation: { status: 'clarification' },
            model: plan.model,
          };
        } else {
          const retrieval = await retrieveSources(plan.search_query, {
            smart: state.settings.searchSmart,
            phonetic: state.settings.searchPhonetic,
          });
          const generated = await aiAnswer({
            message: userMessage.content,
            searchQuery: plan.search_query,
            history,
            sources: retrieval.sources,
            style: plan.style,
            signal: currentController.signal,
          });
          payload = {
            role: 'assistant',
            mode: 'remote',
            response: generated.response,
            sources: generated.sources,
            validation: generated.validation,
            model: generated.model,
            retrieval: retrieval.stats,
          };
        }
      } else {
        status = { mode: 'local', provider: null, model: null };
        renderStatus();
        const retrieval = await retrieveSources(userMessage.content, {
          smart: state.settings.searchSmart,
          phonetic: state.settings.searchPhonetic,
        });
        payload = {
          role: 'assistant',
          ...buildLocalFallback(retrieval, previousAssistant, userMessage.content),
          retrieval: retrieval.stats,
        };
      }

      if (currentController.signal.aborted || run !== currentRun) return;
      await progressivePreview(payload, currentController.signal);
      if (currentController.signal.aborted || run !== currentRun) return;
      appendConversationMessage(conversation, payload);
      renderConversation(conversation, { suggestions: payload.response?.follow_up_suggestions });
    } catch (error) {
      if (error?.name === 'AbortError' || currentController?.signal.aborted) {
        showStopped();
      } else {
        const retrieval = await retrieveSources(userMessage.content, {
          smart: state.settings.searchSmart,
          phonetic: state.settings.searchPhonetic,
        });
        const fallback = {
          role: 'assistant',
          ...buildLocalFallback(retrieval, previousAssistant, userMessage.content),
          retrieval: retrieval.stats,
        };
        appendConversationMessage(conversation, fallback);
        status = { mode: 'local', provider: null, model: null };
        renderStatus();
        renderConversation(conversation, { suggestions: fallback.response.follow_up_suggestions });
        toast('Modèle distant indisponible — recherche locale affichée');
      }
    } finally {
      if (run === currentRun) {
        currentController = null;
        setBusy(false);
      }
    }
  }

  function showTyping() {
    const root = document.getElementById('chatMessages');
    root.insertAdjacentHTML('beforeend', `<article class="chat-row assistant" id="chatTyping">
      <div class="assistant-avatar">${icon('sparkle', 16)}</div>
      <div class="chat-bubble assistant-bubble typing-bubble">
        <span></span><span></span><span></span>
        <small>Analyse de la question et vérification des sources…</small>
      </div>
    </article>`);
    root.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  async function progressivePreview(payload, signal) {
    document.getElementById('chatTyping')?.remove();
    const root = document.getElementById('chatMessages');
    const draft = document.createElement('article');
    draft.className = 'chat-row assistant';
    draft.id = 'chatDraft';
    draft.innerHTML = `<div class="assistant-avatar">${icon('sparkle', 16)}</div>
      <div class="chat-bubble assistant-bubble">
        <div class="assistant-meta"><span class="mode-pill ${payload.mode === 'remote' ? 'remote' : 'local'}">
          ${payload.mode === 'remote' ? 'Assistant IA distant' : 'Recherche locale'}</span></div>
        <section class="answer-section direct"><p id="streamDirect"></p></section>
        <section class="answer-section"><p id="streamExplain"></p></section>
      </div>`;
    root.appendChild(draft);
    const direct = payload.response?.answer_directe || '';
    const explanation = payload.response?.explication || '';
    await typeText(document.getElementById('streamDirect'), direct, signal);
    await typeText(document.getElementById('streamExplain'), explanation, signal);
  }

  async function typeText(element, text, signal) {
    if (!element || !text) return;
    const chunks = text.match(/.{1,8}(?:\s|$)/g) || [text];
    for (const chunk of chunks) {
      if (signal.aborted) throw new DOMException('Génération arrêtée', 'AbortError');
      element.textContent += chunk;
      await new Promise(resolve => setTimeout(resolve, 12));
    }
  }

  function showStopped() {
    document.getElementById('chatTyping')?.remove();
    document.getElementById('chatDraft')?.remove();
    const root = document.getElementById('chatMessages');
    root.insertAdjacentHTML('beforeend', `<div class="chat-stopped">${icon('stop', 13)}
      Génération arrêtée. Vous pouvez régénérer la réponse.</div>`);
  }

  function setBusy(busy) {
    document.getElementById('chatSend').hidden = busy;
    document.getElementById('chatStop').hidden = !busy;
    document.getElementById('chatInput').disabled = busy;
    document.getElementById('chatSuggestions').classList.toggle('disabled', busy);
  }

  function openHistory() {
    const conversations = state.chatConversations;
    sheet(`<h2 style="margin:0 0 12px">Conversations</h2>
      <button class="btn" id="historyNew" style="width:100%;margin-bottom:10px">${icon('plus', 16)} Nouvelle conversation</button>
      <div class="conversation-list">
        ${conversations.map(item => `<div class="conversation-item ${item.id === conversation.id ? 'active' : ''}">
          <button class="conversation-open" data-open-chat="${esc(item.id)}">
            <b>${esc(item.title)}</b>
            <small>${formatDate(item.updatedAt)} · ${item.messages.length} message${item.messages.length > 1 ? 's' : ''}</small>
          </button>
          <button class="btn-icon" data-delete-chat="${esc(item.id)}" aria-label="Supprimer">${icon('trash', 16)}</button>
        </div>`).join('') || '<p class="muted">Aucune conversation enregistrée.</p>'}
      </div>`, root => {
      root.querySelector('#historyNew').onclick = () => {
        closeSheet();
        conversation = createConversation();
        renderConversation(conversation);
        input.focus();
      };
      root.querySelectorAll('[data-open-chat]').forEach(button => {
        button.onclick = () => {
          const selected = selectConversation(button.dataset.openChat);
          if (!selected) return;
          conversation = selected;
          closeSheet();
          renderConversation(conversation, { instant: true });
        };
      });
      root.querySelectorAll('[data-delete-chat]').forEach(button => {
        button.onclick = () => {
          const id = button.dataset.deleteChat;
          deleteConversation(id);
          conversation = activeConversation() || createConversation();
          closeSheet();
          renderConversation(conversation);
        };
      });
    });
  }
}

function stopGeneration() {
  if (!currentController) return;
  currentController.abort();
  currentController = null;
  currentRun += 1;
  const input = document.getElementById('chatInput');
  if (input) input.disabled = false;
  const send = document.getElementById('chatSend');
  const stop = document.getElementById('chatStop');
  if (send) send.hidden = false;
  if (stop) stop.hidden = true;
}

function formatDate(timestamp) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(timestamp));
  } catch { return ''; }
}
