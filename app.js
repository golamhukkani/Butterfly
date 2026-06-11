const $ = id => document.getElementById(id);

let teamOverrides = {};

const els = {
  search: $('search'),
  stageFilter: $('stageFilter'),
  matches: $('matches'),
  modal: $('modal'),
  matchNo: $('matchNo'),
  modalTitle: $('modalTitle'),
  modalMeta: $('modalMeta'),
  winner: $('winner'),
  closeModal: $('closeModal'),
  predictionForm: $('predictionForm'),
  submitBtn: $('submitBtn'),
  formMsg: $('formMsg'),
  name: $('name'),
  contact: $('contact'),
  score1: $('score1'),
  score2: $('score2'),
  comment: $('comment')
};

function apiReady() {
  return window.API_URL &&
    !window.API_URL.includes('PASTE_YOUR') &&
    /^https:\/\//i.test(window.API_URL) &&
    window.API_URL.includes('/exec');
}

function getTeam(match, slot) {
  return teamOverrides[`${match.matchNo}_${slot}`] ||
    match[`team${slot}`] ||
    match[`team${slot}Code`] ||
    `Team ${slot}`;
}

function buildUrl(payload) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    params.append(key, value == null ? '' : String(value));
  });
  return `${window.API_URL}?${params.toString()}`;
}

function apiJsonp(payload, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (!apiReady()) {
      reject(new Error('API URL is not configured. Paste the Apps Script /exec URL in config.js.'));
      return;
    }

    const callbackName = `jsonp_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const script = document.createElement('script');
    let timer;

    window[callbackName] = data => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();

      if (data && data.ok === false) {
        reject(new Error(data.error || 'API returned an error.'));
      } else {
        resolve(data || { ok: true });
      }
    };

    script.onerror = () => {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      reject(new Error('Could not connect to the Apps Script API.'));
    };

    timer = setTimeout(() => {
      delete window[callbackName];
      script.remove();
      reject(new Error('API timeout. Check Apps Script deployment access.'));
    }, timeoutMs);

    const sep = buildUrl(payload).includes('?') ? '&' : '?';
    script.src = `${buildUrl(payload)}${sep}callback=${encodeURIComponent(callbackName)}`;
    document.body.appendChild(script);
  });
}

async function loadOverrides() {
  if (!apiReady()) {
    render();
    return;
  }

  try {
    const data = await apiJsonp({ action: 'config' });
    teamOverrides = data.teams || {};
  } catch (err) {
    console.warn(err);
  }

  render();
}

function populateStages() {
  [...new Set(MATCHES.map(m => m.stage).filter(Boolean))].forEach(stage => {
    const option = document.createElement('option');
    option.value = stage;
    option.textContent = stage;
    els.stageFilter.appendChild(option);
  });
}

function render() {
  const query = els.search.value.toLowerCase();
  const stage = els.stageFilter.value;

  els.matches.innerHTML = '';

  MATCHES
    .filter(match => !stage || match.stage === stage)
    .filter(match => {
      const haystack = JSON.stringify(match).toLowerCase();
      return haystack.includes(query) ||
        getTeam(match, 1).toLowerCase().includes(query) ||
        getTeam(match, 2).toLowerCase().includes(query);
    })
    .forEach(match => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="meta">Match ${match.matchNo} • ${match.stage}</div>
        <div class="teams">
          ${getTeam(match, 1)} <span class="code">(${match.team1Code || ''})</span>
          <br>vs<br>
          ${getTeam(match, 2)} <span class="code">(${match.team2Code || ''})</span>
        </div>
        <div class="meta">${match.day}, ${match.date} • ${match.time} BST<br>${match.venue}</div>
        <button>Predict now</button>
      `;

      card.querySelector('button').onclick = () => openModal(match);
      els.matches.appendChild(card);
    });
}

function openModal(match) {
  els.modal.classList.remove('hidden');
  els.matchNo.value = match.matchNo;
  els.modalTitle.textContent = `Match ${match.matchNo}: ${getTeam(match, 1)} vs ${getTeam(match, 2)}`;
  els.modalMeta.textContent = `${match.stage} • ${match.day}, ${match.date} ${match.time} BST • ${match.venue}`;
  els.winner.innerHTML = `
    <option value="">Select winner</option>
    <option>${getTeam(match, 1)}</option>
    <option>${getTeam(match, 2)}</option>
    <option>Draw</option>
  `;
  els.formMsg.textContent = '';
}

els.closeModal.onclick = () => els.modal.classList.add('hidden');
els.search.oninput = render;
els.stageFilter.onchange = render;

els.predictionForm.onsubmit = async event => {
  event.preventDefault();

  els.submitBtn.disabled = true;
  els.formMsg.textContent = 'Submitting...';

  const payload = {
    action: 'submit',
    matchNo: els.matchNo.value,
    name: els.name.value.trim(),
    contact: els.contact.value.trim(),
    score1: els.score1.value,
    score2: els.score2.value,
    winner: els.winner.value,
    comment: els.comment.value.trim(),
    userAgent: navigator.userAgent
  };

  try {
    await apiJsonp(payload);
    els.formMsg.textContent = 'Submitted successfully!';
    els.predictionForm.reset();
    setTimeout(() => els.modal.classList.add('hidden'), 900);
  } catch (err) {
    console.error(err);
    els.formMsg.textContent = err.message || 'Submission failed. Check the Apps Script setup.';
  } finally {
    els.submitBtn.disabled = false;
  }
};

populateStages();
loadOverrides();
