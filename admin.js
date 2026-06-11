const $ = id => document.getElementById(id);

let current = {};

function apiReady() {
  return window.API_URL &&
    !window.API_URL.includes('PASTE_YOUR') &&
    /^https:\/\//i.test(window.API_URL) &&
    window.API_URL.includes('/exec');
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

function rowsNeedingNames() {
  return MATCHES.filter(match => {
    const t1 = String(match.team1 || '');
    const t2 = String(match.team2 || '');
    const c1 = String(match.team1Code || '');
    const c2 = String(match.team2Code || '');

    return !t1 || !t2 ||
      /^(W|L|R|A|B|C|D|E|F|G|H|I|J|K|1|2|3|4|5|6|7|8|9|0)/i.test(c1) ||
      /^(W|L|R|A|B|C|D|E|F|G|H|I|J|K|1|2|3|4|5|6|7|8|9|0)/i.test(c2);
  });
}

async function loadEditor() {
  adminMsg.textContent = 'Loading...';

  if (!apiReady()) {
    adminMsg.textContent = 'API URL is missing. Add your /exec URL in config.js first.';
    return;
  }

  try {
    const data = await apiJsonp({ action: 'config' });
    current = data.teams || {};
    editor.innerHTML = '';

    rowsNeedingNames().forEach(match => {
      ['1', '2'].forEach(slot => {
        const key = `${match.matchNo}_${slot}`;
        const base = match[`team${slot}`] || match[`team${slot}Code`] || `Team ${slot}`;
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
          <div class="meta">Match ${match.matchNo} • Team ${slot} slot</div>
          <b>${base}</b>
          <input data-key="${key}" value="${current[key] || ''}" placeholder="Qualified team name">
        `;
        editor.appendChild(div);
      });
    });

    adminMsg.textContent = 'Loaded.';
  } catch (err) {
    console.error(err);
    adminMsg.textContent = err.message || 'Could not load. Check API URL and Apps Script deployment.';
  }
}

loadBtn.onclick = loadEditor;

saveBtn.onclick = async () => {
  adminMsg.textContent = 'Saving...';

  if (!password.value) {
    adminMsg.textContent = 'Enter password first.';
    return;
  }

  try {
    const check = await apiJsonp({ action: 'checkPassword', password: password.value });

    if (!check.ok) {
      adminMsg.textContent = 'Wrong password.';
      return;
    }

    const teams = {};
    document.querySelectorAll('[data-key]').forEach(input => {
      if (input.value.trim()) teams[input.dataset.key] = input.value.trim();
    });

    await apiJsonp({
      action: 'saveConfig',
      password: password.value,
      teams: JSON.stringify(teams)
    });

    adminMsg.textContent = 'Team names saved. Refresh the public page to see the changes.';
  } catch (err) {
    console.error(err);
    adminMsg.textContent = err.message || 'Save failed. Check API URL, deployment access, and internet connection.';
  }
};

csvBtn.onclick = () => {
  if (!password.value) {
    adminMsg.textContent = 'Enter password first.';
    return;
  }

  window.open(buildUrl({ action: 'csv', password: password.value }), '_blank');
};
