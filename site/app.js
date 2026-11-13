const REPO = 'Study-Dump/OAIP-Battles-IEF';
const TEAMS = [1, 2, 3, 4, 5];

const REASON_LABELS = {
  timeout: 'таймаут',
  runtime_error: 'ошибка выполнения',
  output_mismatch: 'неверный ответ',
  'missing input.txt or expected_output.txt': 'нет файлов теста',
};

const state = {
  results: null,
  history: { battles: [] },
  selectedId: null,
};

const els = {
  select: document.getElementById('battle-select'),
  battle: document.getElementById('panel-battle'),
  matrix: document.getElementById('panel-matrix'),
  history: document.getElementById('panel-history'),
  clear: document.getElementById('clear-btn'),
  reload: document.getElementById('reload-btn'),
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function teamLabel(team) {
  return team == null || team === '' ? 'ничья' : `team${team}`;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtMs(sec) {
  return Number.isFinite(sec) ? `${(sec * 1000).toFixed(sec < 1 ? 1 : 0)} мс` : '—';
}

function avgTime(team) {
  const tests = (team.tests || []).filter((t) => !t.skipped && Number.isFinite(t.time_sec));
  if (!tests.length) return '—';
  return fmtMs(tests.reduce((sum, t) => sum + t.time_sec, 0) / tests.length);
}

function battleTeams(battle) {
  return Array.isArray(battle.teams) ? battle.teams : [];
}

async function fetchJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn(`Не удалось загрузить ${url}:`, error);
    return fallback;
  }
}

function battles() {
  const list = Array.isArray(state.history.battles) ? [...state.history.battles] : [];
  if (state.results && state.results.id && !list.some((b) => b.id === state.results.id)) {
    list.unshift(state.results);
  }
  return list;
}

function selectedBattle() {
  const all = battles();
  return all.find((b) => b.id === state.selectedId) || all[0] || null;
}

function emptyState(title, text, href) {
  const link = href
    ? `<a class="btn ghost" href="${href}" target="_blank" rel="noopener">Открыть GitHub</a>`
    : '';
  return `<div class="empty-state"><h3>${title}</h3><p>${text}</p>${link}</div>`;
}

function renderAll() {
  renderSelector();
  renderBattle(selectedBattle());
  renderMatrix();
  renderHistory();
}

function renderSelector() {
  const all = battles();
  els.select.disabled = all.length === 0;

  if (!all.length) {
    els.select.innerHTML = '<option>Нет баттлов</option>';
    return;
  }

  els.select.innerHTML = all.map((battle) => {
    const winner = battle.winner ? `победитель: team${battle.winner}` : 'ничья';
    return `<option value="${esc(battle.id)}">${esc(battle.battle)} — ${fmtDate(battle.timestamp)} — ${winner}</option>`;
  }).join('');

  els.select.value = state.selectedId ?? all[0].id;
}

function selectBattle(id) {
  state.selectedId = id;
  window.history.replaceState(null, '', id ? `#${encodeURIComponent(id)}` : location.pathname);
  els.select.value = id ?? '';
  renderBattle(selectedBattle());
}

function renderTeamCard(team, winner) {
  const isWinner = winner != null && String(winner) === String(team.team);
  const tests = team.tests || [];
  const failed = tests.filter((t) => !t.skipped && !t.passed).length;
  const skipped = tests.filter((t) => t.skipped).length;
  const badge = isWinner ? '<span class="badge win">Победитель</span>' : '';
  const note = team.total === 0
    ? '<p class="note warn">Соперник не прислал тестов — счёт 0/0.</p>'
    : '';

  return `
    <article class="team-card ${isWinner ? 'winner' : ''}">
      <div class="team-head">
        <span class="team-name">${esc(teamLabel(team.team))}</span>
        ${badge}
      </div>
      <div class="score"><strong>${team.passed ?? 0}</strong><span>/${team.total ?? 0}</span></div>
      <dl class="stats">
        <div><dt>Атакован</dt><dd>${team.attacked_by ? esc(teamLabel(team.attacked_by)) : '—'}</dd></div>
        <div><dt>Ср. время</dt><dd>${avgTime(team)}</dd></div>
        <div><dt>Провалов</dt><dd>${failed}</dd></div>
        <div><dt>Пропущено</dt><dd>${skipped}</dd></div>
      </dl>
      ${note}
    </article>
  `;
}

function renderCode(text) {
  return text ? esc(text) : '<span class="empty">(пусто)</span>';
}

function renderFailure(test) {
  let reason = REASON_LABELS[test.reason] || test.reason || 'провал';
  if (test.reason === 'runtime_error' && test.exit_code != null) {
    reason += ` (код ${test.exit_code})`;
  }
  const stderr = test.stderr
    ? `<div class="pane"><h4>stderr</h4><pre class="bad">${esc(test.stderr)}</pre></div>`
    : '';
  const diff = test.diff
    ? `<p class="diff">Первое расхождение — строка ${test.diff.first_diff_line}:
         <code>${esc(test.diff.actual_line || '(пусто)')}</code> вместо
         <code>${esc(test.diff.expected_line || '(пусто)')}</code></p>`
    : '';

  return `
    <details class="failure">
      <summary>
        <span class="failure-title">${esc(teamLabel(test.team))} · ${esc(test.name)}</span>
        <span class="meta">автор: ${esc(teamLabel(test.author))} · ${esc(reason)} · ${fmtMs(test.time_sec)}</span>
      </summary>
      <div class="failure-body">
        ${diff}
        <div class="panes">
          <div class="pane"><h4>Input</h4><pre>${renderCode(test.input)}</pre></div>
          <div class="pane"><h4>Actual</h4><pre class="bad">${renderCode(test.actual_output)}</pre></div>
          <div class="pane"><h4>Expected</h4><pre class="good">${renderCode(test.expected_output)}</pre></div>
          ${stderr}
        </div>
      </div>
    </details>
  `;
}

function renderBattle(battle) {
  if (!battle) {
    els.battle.innerHTML = emptyState(
      'Пока нет баттлов',
      'Создайте в GitHub ветку <code>vs/A-B</code> (A и B — номера команд от 1 до 5) и сделайте в ней коммит. CI соберёт решения, прогонит тесты и обновит эту страницу.',
      `https://github.com/${REPO}/branches`
    );
    return;
  }

  const teams = battleTeams(battle);
  const failures = [];
  teams.forEach((team) => {
    (team.tests || [])
      .filter((t) => !t.skipped && !t.passed)
      .forEach((test) => failures.push({ team: team.team, ...test }));
  });

  const cards = teams.map((team) => renderTeamCard(team, battle.winner)).join('');
  const failuresHtml = failures.length
    ? failures.map(renderFailure).join('')
    : emptyState('Провалов нет', 'Все тесты соперника пройдены.');

  els.battle.innerHTML = `
    <div class="panel-head">
      <h2>${esc(battle.battle)}</h2>
      <p class="muted">${fmtDate(battle.timestamp)} · победитель: <strong>${esc(teamLabel(battle.winner))}</strong></p>
    </div>
    <div class="score-grid">${cards}</div>
    <div class="panel-head">
      <h2>Провалы <span class="count">${failures.length}</span></h2>
      <p class="muted">Input, фактический и ожидаемый вывод по каждому сломанному тесту.</p>
    </div>
    <div class="failures">${failuresHtml}</div>
  `;
}

function renderMatrix() {
  const aggregate = {};
  battles().forEach((battle) => {
    battleTeams(battle).forEach((team) => {
      const defender = String(team.team);
      const attacker = String(team.attacked_by);
      if (!aggregate[defender]) aggregate[defender] = {};
      if (!aggregate[defender][attacker]) aggregate[defender][attacker] = { passed: 0, total: 0 };
      aggregate[defender][attacker].passed += team.passed || 0;
      aggregate[defender][attacker].total += team.total || 0;
    });
  });

  let rows = '';
  TEAMS.forEach((defender) => {
    rows += `<tr><th scope="row">team${defender}</th>`;
    TEAMS.forEach((attacker) => {
      if (defender === attacker) {
        rows += '<td class="diag">—</td>';
        return;
      }
      const cell = aggregate[String(defender)]?.[String(attacker)];
      if (!cell || !cell.total) {
        rows += '<td class="no-data">—</td>';
        return;
      }
      const ratio = cell.passed / cell.total;
      const cls = ratio >= 0.999 ? 'good' : ratio >= 0.5 ? 'mid' : 'bad';
      rows += `<td class="cell ${cls}" title="Пройдено ${cell.passed} из ${cell.total}">${cell.passed}/${cell.total}</td>`;
    });
    rows += '</tr>';
  });

  els.matrix.innerHTML = `
    <div class="panel-head">
      <h2>Краш-матрица</h2>
      <p class="muted">Строка — кто защищается, столбец — кто атакует. В ячейке — пройдено/всего по всем баттлам истории.</p>
    </div>
    <div class="table-wrap">
      <table class="matrix">
        <thead>
          <tr>
            <th scope="col">Защита \\ Атака</th>
            ${TEAMS.map((t) => `<th scope="col">team${t}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <ul class="legend">
      <li><span class="swatch good"></span> защита выдержала</li>
      <li><span class="swatch mid"></span> частично</li>
      <li><span class="swatch bad"></span> атака пробила</li>
    </ul>
  `;
}

function renderHistory() {
  const all = battles();
  if (!all.length) {
    els.history.innerHTML = emptyState('История пуста', 'Здесь появятся все прошедшие баттлы.');
    return;
  }

  const rows = [...all].reverse().map((battle) => {
    const scores = battleTeams(battle)
      .map((team) => `${teamLabel(team.team)}: ${team.passed ?? 0}/${team.total ?? 0}`)
      .join(' · ');
    const winner = battle.winner ? `победитель: team${esc(battle.winner)}` : 'ничья';
    return `
      <article class="history-row">
        <div class="history-main">
          <strong>${esc(battle.battle)}</strong>
          <span class="muted">${fmtDate(battle.timestamp)}</span>
          <span class="muted">${scores}</span>
        </div>
        <div class="history-side">
          <span class="badge ${battle.winner ? 'win' : ''}">${winner}</span>
          <button type="button" class="btn ghost" data-open="${esc(battle.id)}">Открыть</button>
        </div>
      </article>
    `;
  }).join('');

  els.history.innerHTML = `
    <div class="panel-head">
      <h2>История <span class="count">${all.length}</span></h2>
      <p class="muted">Все баттлы, сохранённые в history.json.</p>
    </div>
    <div class="history-list">${rows}</div>
  `;
}

function setTab(name) {
  document.querySelectorAll('.tabs .tab').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `panel-${name}`);
  });
}

async function load() {
  const [results, historyData] = await Promise.all([
    fetchJson('results.json', null),
    fetchJson('history.json', { battles: [] }),
  ]);

  state.results = results && results.id ? results : null;
  state.history = historyData && Array.isArray(historyData.battles)
    ? historyData
    : { battles: [] };

  const all = battles();
  const fromHash = decodeURIComponent(location.hash.slice(1));
  const defaultId = state.results?.id || all[all.length - 1]?.id || null;
  state.selectedId = all.some((b) => b.id === fromHash) ? fromHash : defaultId;

  if (state.selectedId) {
    window.history.replaceState(null, '', `#${encodeURIComponent(state.selectedId)}`);
  }

  renderAll();
}

els.select.addEventListener('change', (event) => selectBattle(event.target.value));
els.reload.addEventListener('click', load);
els.clear.addEventListener('click', () => {
  const ok = window.confirm(
    'Очистить историю баттлов? Откроется страница workflow в GitHub — там нужно нажать «Run workflow».'
  );
  if (ok) {
    window.open(`https://github.com/${REPO}/actions/workflows/clear-history.yml`, '_blank', 'noopener');
  }
});

document.querySelectorAll('.tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => setTab(tab.dataset.tab));
});

els.history.addEventListener('click', (event) => {
  const button = event.target.closest('[data-open]');
  if (!button) return;
  selectBattle(button.dataset.open);
  setTab('battle');
});

window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (battles().some((b) => b.id === id)) {
    state.selectedId = id;
    els.select.value = id;
    renderBattle(selectedBattle());
  }
});

load();
