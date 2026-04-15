/* ============================================================
   APP.JS — Basketball Leverage Tracker
   Main application logic
   ============================================================ */

// ── Supabase Client ────────────────────────────────────────
// ── Supabase Client ────────────────────────────────────────
const SUPABASE_URL = 'https://mkegokkldfslwlvlonky.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWdva2tsZGZzbHdsdmxvbmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTIxODEsImV4cCI6MjA4ODY4ODE4MX0.9TO_8if1iGRcj0G1wICD9RwiPRVc0cFigSxwh1FV1gA';

let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.error('Supabase client init failed:', e);
}

// ── State ──────────────────────────────────────────────────
let allBets = [];
let filteredBets = [];
let sortColumn = 'date';
let sortDirection = 'desc';
let editingBetId = null;

// ── Tabs (global function, called via inline onclick) ──────
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
  const content = document.getElementById('content-' + tabName);
  if (content) content.classList.add('active');
}

// ── Initialization ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try {
    setupFilters();
    setupSorting();
    setDefaultDate();
    await loadBets();
    calculateProjection();
  } catch (err) {
    console.error('Initialization error:', err);
  }
});

// ── Data Loading ───────────────────────────────────────────
async function loadBets() {
  try {
    const { data, error } = await sb
      .from('bets')
      .select('*')
      .order('date', { ascending: false })
      .order('sequence_id', { ascending: false })
      .order('sequence_step', { ascending: false });

    if (error) throw error;
    allBets = (data || []).map(b => {
      const rawLegs = Array.isArray(b.legs) && b.legs.length > 0
        ? b.legs
        : [{
            player: b.player || null,
            team: b.team || '',
            opponent: b.opponent || '',
            category: b.category || '',
            line: b.line,
            pick: b.pick || 'Over',
          }];
      const legs = rawLegs.map(l => ({
        player: l.player || null,
        team: l.team || '',
        opponent: l.opponent || '',
        category: l.category || '',
        line: l.line != null ? Number(l.line) : null,
        pick: l.pick || 'Over',
      }));
      return {
        ...b,
        odd: Number(b.odd),
        stake: Number(b.stake),
        payout: Number(b.payout),
        profit: Number(b.profit),
        line: b.line != null ? Number(b.line) : null,
        sequence_id: Number(b.sequence_id),
        sequence_step: Number(b.sequence_step),
        legs,
      };
    });
    applyFilters();
    updateDashboard();
    updateAnalysis();
    populateSuggestions();
  } catch (err) {
    console.error('Erro ao carregar apostas:', err);
    showToast('Erro ao carregar dados', 'error');
  }
}

// ── Filters ────────────────────────────────────────────────
function setupFilters() {
  ['filterDate', 'filterResult', 'filterCategory', 'filterPlayer'].forEach(id => {
    document.getElementById(id).addEventListener('input', applyFilters);
    document.getElementById(id).addEventListener('change', applyFilters);
  });
}

function applyFilters() {
  const dateFilter = document.getElementById('filterDate').value;
  const resultFilter = document.getElementById('filterResult').value;
  const categoryFilter = document.getElementById('filterCategory').value;
  const playerFilter = document.getElementById('filterPlayer').value.toLowerCase();

  filteredBets = allBets.filter(bet => {
    if (dateFilter && bet.date !== dateFilter) return false;
    if (resultFilter && bet.result !== resultFilter) return false;
    if (categoryFilter && !bet.legs.some(l => l.category === categoryFilter)) return false;
    if (playerFilter && !bet.legs.some(l => (l.player || '').toLowerCase().includes(playerFilter))) return false;
    return true;
  });

  sortBets();
  renderTable();
}

// ── Sorting ────────────────────────────────────────────────
function setupSorting() {
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (sortColumn === col) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = col;
        sortDirection = 'desc';
      }
      document.querySelectorAll('.data-table th').forEach(h => h.classList.remove('sorted'));
      th.classList.add('sorted');
      th.querySelector('.sort-icon').textContent = sortDirection === 'asc' ? '▲' : '▼';
      sortBets();
      renderTable();
    });
  });
}

function sortBets() {
  filteredBets.sort((a, b) => {
    let vA = a[sortColumn];
    let vB = b[sortColumn];
    if (typeof vA === 'string') vA = vA.toLowerCase();
    if (typeof vB === 'string') vB = vB.toLowerCase();
    if (vA == null) vA = '';
    if (vB == null) vB = '';
    if (vA < vB) return sortDirection === 'asc' ? -1 : 1;
    if (vA > vB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

// ── Table Rendering ────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('betsTableBody');
  const emptyState = document.getElementById('emptyState');

  if (filteredBets.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  tbody.innerHTML = filteredBets.map(bet => {
    const resultClass = bet.result.toLowerCase();
    const profitClass = bet.profit > 0 ? 'money-positive' : bet.profit < 0 ? 'money-negative' : '';
    const payoutClass = bet.payout > 0 ? 'money-positive' : '';
    const legsHtml = bet.legs.map(l => {
      const subject = l.player || (l.category === 'Total Jogo' ? `${l.team} vs ${l.opponent}` : '—');
      const matchTxt = l.team && l.opponent ? ` <span class="leg-cat">(${l.team} vs ${l.opponent})</span>` : '';
      const lineTxt = l.line != null ? ` ${l.pick} ${l.line}` : ` ${l.pick}`;
      return `<div class="legs-list-item"><strong>${escapeHtml(subject)}</strong> — ${escapeHtml(l.category)}${lineTxt}${matchTxt}</div>`;
    }).join('');
    const countBadge = bet.legs.length > 1 ? `<span class="legs-count-badge">${bet.legs.length}x</span>` : '';

    return `
      <tr class="result-${resultClass}">
        <td>${formatDate(bet.date)}</td>
        <td><span class="seq-badge">S${bet.sequence_id}#${bet.sequence_step}</span></td>
        <td><div class="legs-list">${legsHtml}</div>${countBadge}</td>
        <td>${Number(bet.odd).toFixed(2)}</td>
        <td>${formatMoney(bet.stake)}</td>
        <td>
          <span class="result-badge ${resultClass}" onclick="cycleResult('${bet.id}', '${bet.result}')" title="Clique para alterar">
            ${getResultEmoji(bet.result)} ${bet.result}
          </span>
        </td>
        <td class="${payoutClass}">${formatMoney(bet.payout)}</td>
        <td class="${profitClass}">${formatMoney(bet.profit)}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn" onclick="editBet('${bet.id}')" title="Editar">✏️</button>
            <button class="action-btn delete" onclick="deleteBet('${bet.id}')" title="Excluir">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── Result Cycle (quick edit) ──────────────────────────────
async function cycleResult(id, current) {
  const order = ['PENDING', 'GREEN', 'RED', 'VOID'];
  const next = order[(order.indexOf(current) + 1) % order.length];

  const bet = allBets.find(b => b.id === id);
  if (!bet) return;

  let payout = 0;
  let profit = 0;
  if (next === 'GREEN') {
    payout = +(bet.stake * bet.odd).toFixed(2);
    profit = +(payout - bet.stake).toFixed(2);
  } else if (next === 'RED') {
    payout = 0;
    profit = +(-bet.stake).toFixed(2);
  } else if (next === 'VOID') {
    payout = +bet.stake;
    profit = 0;
  }

  try {
    const { error } = await sb
      .from('bets')
      .update({ result: next, payout, profit })
      .eq('id', id);

    if (error) throw error;
    showToast(`Resultado alterado para ${next}`, 'success');
    await loadBets();
  } catch (err) {
    console.error('Erro ao atualizar resultado:', err);
    showToast('Erro ao atualizar', 'error');
  }
}

// ── Dashboard ──────────────────────────────────────────────
function updateDashboard() {
  const resolved = allBets.filter(b => b.result !== 'PENDING' && b.result !== 'VOID');
  const greens = allBets.filter(b => b.result === 'GREEN');
  const reds = allBets.filter(b => b.result === 'RED');
  const voids = allBets.filter(b => b.result === 'VOID');
  const pendings = allBets.filter(b => b.result === 'PENDING');

  const totalInvested = allBets.reduce((s, b) => s + (b.result !== 'VOID' ? Number(b.stake) : 0), 0);
  const totalReturned = allBets.reduce((s, b) => s + Number(b.payout), 0);
  const totalProfit = totalReturned - totalInvested;
  const roi = totalInvested > 0 ? (totalProfit / totalInvested * 100) : 0;
  const winRate = resolved.length > 0 ? (greens.length / resolved.length * 100) : 0;

  // Streaks
  const { maxStreak, currentStreak, currentType } = calcStreaks();

  // Update KPIs
  setKpi('kpiInvested', formatMoney(totalInvested));
  setKpi('kpiReturned', formatMoney(totalReturned));
  setKpi('kpiProfit', formatMoney(totalProfit), totalProfit >= 0 ? 'positive' : 'negative');
  setKpi('kpiROI', roi.toFixed(1) + '%', roi >= 0 ? 'positive' : 'negative');
  setKpi('kpiWinRate', winRate.toFixed(1) + '%');
  document.getElementById('kpiWinRateSub').textContent = `${greens.length}/${resolved.length} apostas`;
  setKpi('kpiMaxStreak', maxStreak.toString());
  setKpi('kpiCurrentStreak', currentStreak.toString());
  document.getElementById('kpiCurrentStreakSub').textContent =
    currentType === 'GREEN' ? '🟢 em andamento' :
    currentType === 'RED' ? '🔴 reds seguidos' : 'sem dados';

  // Header stats
  document.getElementById('headerProfit').textContent = formatMoney(totalProfit);
  document.getElementById('headerProfit').className = 'header-stat-value ' + (totalProfit >= 0 ? 'positive' : 'negative');
  document.getElementById('headerWinRate').textContent = winRate.toFixed(1) + '%';
  document.getElementById('headerStreak').textContent = currentStreak;

  // Charts
  renderDashboardCharts(greens.length, reds.length, voids.length, pendings.length);
}

function setKpi(id, value, colorClass) {
  const el = document.getElementById(id);
  el.textContent = value;
  if (colorClass) {
    el.classList.remove('positive', 'negative');
    el.classList.add(colorClass);
  }
}

function calcStreaks() {
  const sorted = [...allBets]
    .filter(b => b.result === 'GREEN' || b.result === 'RED')
    .sort((a, b) => a.date.localeCompare(b.date) || a.sequence_id - b.sequence_id || a.sequence_step - b.sequence_step);

  let maxStreak = 0;
  let currentStreak = 0;
  let currentType = '';
  let greenStreak = 0;

  for (const bet of sorted) {
    if (bet.result === 'GREEN') {
      greenStreak++;
      maxStreak = Math.max(maxStreak, greenStreak);
    } else {
      greenStreak = 0;
    }
  }

  // Current streak
  currentStreak = 0;
  currentType = '';
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (currentType === '' || sorted[i].result === currentType) {
      currentType = sorted[i].result;
      currentStreak++;
    } else {
      break;
    }
  }

  return { maxStreak, currentStreak, currentType };
}

function renderDashboardCharts(greens, reds, voids, pendings) {
  // Profit accumulation chart
  const profitData = buildProfitAccumulation();
  renderProfitChart(profitData.labels, profitData.values);

  // Results distribution
  renderResultsChart(greens, reds, voids, pendings);

  // Weekday profit
  const weekdayData = buildWeekdayProfit();
  renderWeekdayChart(weekdayData.labels, weekdayData.values);

  // Category win rate
  const catData = buildCategoryWinRate();
  renderCategoryChart(catData.labels, catData.winRates, catData.counts);
}

function buildProfitAccumulation() {
  const sorted = [...allBets]
    .filter(b => b.result !== 'PENDING')
    .sort((a, b) => a.date.localeCompare(b.date) || a.sequence_step - b.sequence_step);

  const labels = [];
  const values = [];
  let acc = 0;

  for (const bet of sorted) {
    acc += Number(bet.profit);
    labels.push(formatDate(bet.date));
    values.push(+acc.toFixed(2));
  }

  return { labels, values };
}

function buildWeekdayProfit() {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const profitByDay = Array(7).fill(0);

  allBets.filter(b => b.result !== 'PENDING').forEach(bet => {
    const d = new Date(bet.date + 'T12:00:00');
    profitByDay[d.getDay()] += Number(bet.profit);
  });

  return { labels: days, values: profitByDay.map(v => +v.toFixed(2)) };
}

function buildCategoryWinRate() {
  const cats = {};
  allBets.filter(b => b.result === 'GREEN' || b.result === 'RED').forEach(bet => {
    bet.legs.forEach(l => {
      const cat = l.category || '—';
      if (!cats[cat]) cats[cat] = { greens: 0, total: 0 };
      cats[cat].total++;
      if (bet.result === 'GREEN') cats[cat].greens++;
    });
  });

  const labels = Object.keys(cats);
  const winRates = labels.map(c => +((cats[c].greens / cats[c].total) * 100).toFixed(1));
  const counts = labels.map(c => cats[c].total);

  return { labels, winRates, counts };
}

// ── Analysis ───────────────────────────────────────────────
function updateAnalysis() {
  updatePlayerRanking();
  updateCategoryTable();
  updateInsights();
  updateAnalysisCharts();
}

function updatePlayerRanking() {
  const players = {};
  allBets.filter(b => b.result === 'GREEN' || b.result === 'RED').forEach(bet => {
    const legs = bet.legs.filter(l => l.player);
    if (legs.length === 0) return;
    const stakeShare = Number(bet.stake) / legs.length;
    const profitShare = Number(bet.profit) / legs.length;
    legs.forEach(l => {
      if (!players[l.player]) players[l.player] = { greens: 0, total: 0, profit: 0, invested: 0 };
      players[l.player].total++;
      players[l.player].invested += stakeShare;
      players[l.player].profit += profitShare;
      if (bet.result === 'GREEN') players[l.player].greens++;
    });
  });

  const sorted = Object.entries(players)
    .map(([name, d]) => ({
      name,
      ...d,
      winRate: ((d.greens / d.total) * 100).toFixed(1),
      roi: d.invested > 0 ? ((d.profit / d.invested) * 100).toFixed(1) : '0.0',
    }))
    .sort((a, b) => b.roi - a.roi);

  const tbody = document.getElementById('playerRankingBody');
  tbody.innerHTML = sorted.map((p, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    const profitClass = p.profit >= 0 ? 'money-positive' : 'money-negative';
    return `
      <tr>
        <td><span class="rank-number ${rankClass}">${i + 1}</span></td>
        <td>${p.name}</td>
        <td>${p.total}</td>
        <td>${p.winRate}%</td>
        <td>${p.roi}%</td>
        <td class="${profitClass}">${formatMoney(p.profit)}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-tertiary);padding:32px;">Sem dados suficientes</td></tr>';
}

function updateCategoryTable() {
  const cats = {};
  allBets.filter(b => b.result === 'GREEN' || b.result === 'RED').forEach(bet => {
    const legs = bet.legs;
    if (legs.length === 0) return;
    const stakeShare = Number(bet.stake) / legs.length;
    const profitShare = Number(bet.profit) / legs.length;
    legs.forEach(l => {
      const cat = l.category || '—';
      if (!cats[cat]) cats[cat] = { greens: 0, total: 0, profit: 0, invested: 0 };
      cats[cat].total++;
      cats[cat].invested += stakeShare;
      cats[cat].profit += profitShare;
      if (bet.result === 'GREEN') cats[cat].greens++;
    });
  });

  const sorted = Object.entries(cats)
    .map(([name, d]) => ({
      name,
      ...d,
      winRate: ((d.greens / d.total) * 100).toFixed(1),
      roi: d.invested > 0 ? ((d.profit / d.invested) * 100).toFixed(1) : '0.0',
    }))
    .sort((a, b) => b.roi - a.roi);

  const tbody = document.getElementById('categoryBody');
  tbody.innerHTML = sorted.map(c => {
    const profitClass = c.profit >= 0 ? 'money-positive' : 'money-negative';
    return `
      <tr>
        <td>${c.name}</td>
        <td>${c.total}</td>
        <td>${c.winRate}%</td>
        <td>${c.roi}%</td>
        <td class="${profitClass}">${formatMoney(c.profit)}</td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);padding:32px;">Sem dados suficientes</td></tr>';
}

function updateInsights() {
  const grid = document.getElementById('insightsGrid');
  const insights = [];
  const resolved = allBets.filter(b => b.result === 'GREEN' || b.result === 'RED');

  if (resolved.length < 3) {
    grid.innerHTML = `
      <div class="insight-card insight-neutral">
        <div class="insight-emoji">🏀</div>
        <div class="insight-text">Registre pelo menos 3 apostas resolvidas para gerar insights automáticos.</div>
      </div>
    `;
    return;
  }

  // Best category (aggregate across legs)
  const cats = {};
  resolved.forEach(b => {
    b.legs.forEach(l => {
      const c = l.category || '—';
      if (!cats[c]) cats[c] = { g: 0, t: 0 };
      cats[c].t++;
      if (b.result === 'GREEN') cats[c].g++;
    });
  });
  const bestCat = Object.entries(cats).sort((a, b) => (b[1].g / b[1].t) - (a[1].g / a[1].t))[0];
  if (bestCat && bestCat[1].t >= 2) {
    const wr = ((bestCat[1].g / bestCat[1].t) * 100).toFixed(0);
    insights.push({
      emoji: '🏆',
      text: `Suas apostas em <span class="insight-metric">${bestCat[0]}</span> têm <span class="insight-metric">${wr}%</span> de acerto — sua categoria mais forte.`,
      type: Number(wr) >= 55 ? 'positive' : 'neutral',
    });
  }

  // Worst category
  const worstCat = Object.entries(cats).filter(c => c[1].t >= 2).sort((a, b) => (a[1].g / a[1].t) - (b[1].g / b[1].t))[0];
  if (worstCat && worstCat[0] !== bestCat?.[0]) {
    const wr = ((worstCat[1].g / worstCat[1].t) * 100).toFixed(0);
    insights.push({
      emoji: '⚠️',
      text: `<span class="insight-metric">${worstCat[0]}</span> tem apenas <span class="insight-metric">${wr}%</span> de acerto (${worstCat[1].g}/${worstCat[1].t}) — considere revisar.`,
      type: Number(wr) < 45 ? 'negative' : 'neutral',
    });
  }

  // Best player (aggregate across legs)
  const players = {};
  resolved.forEach(b => {
    b.legs.forEach(l => {
      if (!l.player) return;
      if (!players[l.player]) players[l.player] = { g: 0, t: 0 };
      players[l.player].t++;
      if (b.result === 'GREEN') players[l.player].g++;
    });
  });
  const bestPlayer = Object.entries(players).filter(p => p[1].t >= 2).sort((a, b) => (b[1].g / b[1].t) - (a[1].g / a[1].t))[0];
  if (bestPlayer) {
    const wr = ((bestPlayer[1].g / bestPlayer[1].t) * 100).toFixed(0);
    insights.push({
      emoji: '⭐',
      text: `<span class="insight-metric">${bestPlayer[0]}</span>: ${bestPlayer[1].g}/${bestPlayer[1].t} greens (<span class="insight-metric">${wr}%</span>) — jogador mais confiável.`,
      type: 'positive',
    });
  }

  // Win rate general
  const totalWR = ((resolved.filter(b => b.result === 'GREEN').length / resolved.length) * 100).toFixed(0);
  insights.push({
    emoji: '📊',
    text: `Win rate geral: <span class="insight-metric">${totalWR}%</span> em <span class="insight-metric">${resolved.length}</span> apostas resolvidas.`,
    type: Number(totalWR) >= 55 ? 'positive' : Number(totalWR) < 45 ? 'negative' : 'neutral',
  });

  // Max sequence
  const { maxStreak } = calcStreaks();
  if (maxStreak > 0) {
    insights.push({
      emoji: '🔥',
      text: `Sua maior sequência de greens foi <span class="insight-metric">${maxStreak} consecutivos</span> — impressionante!`,
      type: 'positive',
    });
  }

  grid.innerHTML = insights.map(ins => `
    <div class="insight-card insight-${ins.type} animate-in">
      <div class="insight-emoji">${ins.emoji}</div>
      <div class="insight-text">${ins.text}</div>
    </div>
  `).join('');
}

function updateAnalysisCharts() {
  // Odd range chart
  const ranges = { '1.40-1.44': { g: 0, t: 0 }, '1.45-1.49': { g: 0, t: 0 }, '1.50-1.54': { g: 0, t: 0 }, '1.55-1.59': { g: 0, t: 0 } };
  allBets.filter(b => b.result === 'GREEN' || b.result === 'RED').forEach(bet => {
    const odd = Number(bet.odd);
    const key = odd < 1.45 ? '1.40-1.44' : odd < 1.50 ? '1.45-1.49' : odd < 1.55 ? '1.50-1.54' : '1.55-1.59';
    ranges[key].t++;
    if (bet.result === 'GREEN') ranges[key].g++;
  });

  const rlabels = Object.keys(ranges);
  const rWinRates = rlabels.map(k => ranges[k].t > 0 ? +((ranges[k].g / ranges[k].t) * 100).toFixed(1) : 0);
  const rCounts = rlabels.map(k => ranges[k].t);
  renderOddRangeChart(rlabels, rWinRates, rCounts);

  // Player profit chart (sum profit share per leg player)
  const players = {};
  allBets.filter(b => b.result !== 'PENDING').forEach(bet => {
    const playerLegs = bet.legs.filter(l => l.player);
    if (playerLegs.length === 0) return;
    const share = Number(bet.profit) / playerLegs.length;
    playerLegs.forEach(l => {
      if (!players[l.player]) players[l.player] = 0;
      players[l.player] += share;
    });
  });

  const sorted = Object.entries(players).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (sorted.length > 0) {
    renderPlayerProfitChart(sorted.map(s => s[0]), sorted.map(s => +s[1].toFixed(2)));
  }
}

// ── Modal / Form ───────────────────────────────────────────
function openModal(betId) {
  editingBetId = betId || null;
  const overlay = document.getElementById('modalOverlay');

  if (editingBetId) {
    const bet = allBets.find(b => b.id === editingBetId);
    if (!bet) return;
    document.getElementById('modalTitle').textContent = 'Editar Aposta';
    document.getElementById('formSubmitBtn').textContent = '💾 Atualizar';
    document.getElementById('editBetId').value = bet.id;
    document.getElementById('formDate').value = bet.date;
    document.getElementById('formOdd').value = bet.odd;
    document.getElementById('formStake').value = bet.stake;
    document.getElementById('formResult').value = bet.result;
    document.getElementById('formNotes').value = bet.notes || '';
    renderLegs(bet.legs.map(l => ({ ...l })));
    calcFormPayout();
  } else {
    document.getElementById('modalTitle').textContent = 'Nova Aposta';
    document.getElementById('formSubmitBtn').textContent = '💾 Salvar Aposta';
    document.getElementById('betForm').reset();
    document.getElementById('editBetId').value = '';
    document.getElementById('formResult').value = 'PENDING';
    setDefaultDate();
    renderLegs([createEmptyLeg()]);
    suggestNextStake();
    calcFormPayout();
  }

  overlay.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  editingBetId = null;
}

// Close on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ── Legs (form state lives in DOM) ─────────────────────────
function createEmptyLeg() {
  return { player: '', team: '', opponent: '', category: '', line: '', pick: 'Over' };
}

function renderLegs(legs) {
  const container = document.getElementById('legsContainer');
  container.innerHTML = '';
  legs.forEach(leg => container.appendChild(buildLegCard(leg)));
  updateLegTitles();
}

function buildLegCard(leg) {
  const card = document.createElement('div');
  card.className = 'leg-card';
  card.innerHTML = `
    <div class="leg-card-header">
      <div class="leg-card-title">Seleção</div>
      <button type="button" class="leg-remove" title="Remover">✕</button>
    </div>
    <div class="leg-grid">
      <div class="form-group">
        <label class="form-label">Categoria</label>
        <select class="form-select leg-category">
          <option value="">Selecione...</option>
          <option value="Pontos Jogador">Pontos Jogador</option>
          <option value="Assistências">Assistências</option>
          <option value="Rebotes">Rebotes</option>
          <option value="3pts">3pts</option>
          <option value="Total Jogo">Total Jogo</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Jogador</label>
        <input type="text" class="form-input leg-player" placeholder="Ex: LeBron James" list="playerSuggestions">
      </div>
      <div class="form-group">
        <label class="form-label">Time</label>
        <input type="text" class="form-input leg-team" placeholder="Ex: Lakers" list="teamSuggestions">
      </div>
      <div class="form-group">
        <label class="form-label">Adversário</label>
        <input type="text" class="form-input leg-opponent" placeholder="Ex: Celtics" list="teamSuggestions">
      </div>
      <div class="leg-row full">
        <div class="form-group">
          <label class="form-label">Pick</label>
          <select class="form-select leg-pick">
            <option value="Over">Over</option>
            <option value="Under">Under</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Linha</label>
          <input type="number" class="form-input leg-line" placeholder="22.5" step="0.5">
        </div>
        <div class="form-group">
          <label class="form-label">&nbsp;</label>
          <div class="form-hint">opcional p/ 3pts</div>
        </div>
      </div>
    </div>
  `;

  card.querySelector('.leg-category').value = leg.category || '';
  card.querySelector('.leg-player').value = leg.player || '';
  card.querySelector('.leg-team').value = leg.team || '';
  card.querySelector('.leg-opponent').value = leg.opponent || '';
  card.querySelector('.leg-pick').value = leg.pick || 'Over';
  card.querySelector('.leg-line').value = leg.line != null && leg.line !== '' ? leg.line : '';

  const catSel = card.querySelector('.leg-category');
  const playerInput = card.querySelector('.leg-player');
  const applyTotalJogo = () => {
    if (catSel.value === 'Total Jogo') {
      playerInput.disabled = true;
      playerInput.value = '';
    } else {
      playerInput.disabled = false;
    }
  };
  catSel.addEventListener('change', applyTotalJogo);
  applyTotalJogo();

  card.querySelector('.leg-remove').addEventListener('click', () => {
    const container = document.getElementById('legsContainer');
    if (container.children.length <= 1) {
      showToast('A aposta precisa de pelo menos uma seleção', 'info');
      return;
    }
    card.remove();
    updateLegTitles();
  });

  return card;
}

function updateLegTitles() {
  const cards = document.querySelectorAll('#legsContainer .leg-card');
  cards.forEach((c, i) => {
    c.querySelector('.leg-card-title').textContent = `Seleção ${i + 1}`;
  });
}

function addLeg() {
  const container = document.getElementById('legsContainer');
  container.appendChild(buildLegCard(createEmptyLeg()));
  updateLegTitles();
}

function collectLegsFromForm() {
  const cards = document.querySelectorAll('#legsContainer .leg-card');
  const legs = [];
  for (const card of cards) {
    const category = card.querySelector('.leg-category').value;
    const player = card.querySelector('.leg-player').value.trim();
    const team = card.querySelector('.leg-team').value.trim();
    const opponent = card.querySelector('.leg-opponent').value.trim();
    const pick = card.querySelector('.leg-pick').value;
    const lineStr = card.querySelector('.leg-line').value;
    const line = lineStr === '' ? null : Number(lineStr);
    legs.push({
      player: category === 'Total Jogo' ? null : (player || null),
      team: team || null,
      opponent: opponent || null,
      category,
      line,
      pick,
    });
  }
  return legs;
}

function validateLegs(legs) {
  if (legs.length === 0) return 'Adicione pelo menos uma seleção.';
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    if (!l.category) return `Seleção ${i + 1}: escolha a categoria.`;
    if (l.category !== 'Total Jogo' && !l.player) return `Seleção ${i + 1}: informe o jogador.`;
    if (l.category !== '3pts' && (l.line == null || Number.isNaN(l.line))) {
      return `Seleção ${i + 1}: informe a linha.`;
    }
  }
  return null;
}

function calcFormPayout() {
  const odd = parseFloat(document.getElementById('formOdd').value) || 0;
  const stake = parseFloat(document.getElementById('formStake').value) || 0;
  const result = document.getElementById('formResult').value;

  let payout = 0;
  let profit = 0;

  if (result === 'GREEN') {
    payout = +(stake * odd).toFixed(2);
    profit = +(payout - stake).toFixed(2);
  } else if (result === 'RED') {
    profit = +(-stake).toFixed(2);
  } else if (result === 'VOID') {
    payout = stake;
    profit = 0;
  }

  document.getElementById('formPayoutDisplay').textContent = formatMoney(payout);
  document.getElementById('formProfitDisplay').textContent = formatMoney(profit);
}

function suggestNextStake() {
  // Find the last bet's payout as suggested stake for leverage strategy
  const sortedBets = [...allBets].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return b.sequence_step - a.sequence_step;
  });

  const lastBet = sortedBets[0];
  const hint = document.getElementById('stakeHint');

  if (lastBet && lastBet.result === 'GREEN' && lastBet.payout > 0) {
    document.getElementById('formStake').value = lastBet.payout.toFixed(2);
    hint.textContent = `💡 Sugestão: R$ ${lastBet.payout.toFixed(2)} (payout da última aposta)`;
    hint.style.color = 'var(--accent-light)';
    calcFormPayout();
  } else {
    hint.textContent = '';
  }
}

function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('formDate').value = today;
}

async function handleSubmitBet(e) {
  e.preventDefault();

  const odd = parseFloat(document.getElementById('formOdd').value);
  const stake = parseFloat(document.getElementById('formStake').value);
  const result = document.getElementById('formResult').value;
  const legs = collectLegsFromForm();

  const validationError = validateLegs(legs);
  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  let payout = 0;
  let profit = 0;
  if (result === 'GREEN') {
    payout = +(stake * odd).toFixed(2);
    profit = +(payout - stake).toFixed(2);
  } else if (result === 'RED') {
    profit = +(-stake).toFixed(2);
  } else if (result === 'VOID') {
    payout = stake;
  }

  // Determine sequence (only for new bets)
  const primary = legs[0];
  const betData = {
    date: document.getElementById('formDate').value,
    // Flat columns mirror the first leg for legacy compatibility / filters
    category: primary.category,
    player: primary.player,
    team: primary.team,
    opponent: primary.opponent,
    line: primary.line,
    pick: primary.pick,
    // Multi-leg canonical storage
    legs,
    odd,
    stake,
    result,
    payout,
    profit,
    notes: document.getElementById('formNotes').value || null,
  };

  try {
    if (editingBetId) {
      const { error } = await sb
        .from('bets')
        .update(betData)
        .eq('id', editingBetId);
      if (error) throw error;
      showToast('Aposta atualizada!', 'success');
    } else {
      const seq = await getNextSequence();
      betData.sequence_id = seq.sequence_id;
      betData.sequence_step = seq.sequence_step;
      const { error } = await sb
        .from('bets')
        .insert(betData);
      if (error) throw error;
      showToast('Aposta registrada!', 'success');
    }

    closeModal();
    await loadBets();
  } catch (err) {
    console.error('Erro ao salvar:', err);
    showToast('Erro ao salvar aposta: ' + err.message, 'error');
  }
}

async function getNextSequence() {
  const sorted = [...allBets].sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    const seqComp = b.sequence_id - a.sequence_id;
    if (seqComp !== 0) return seqComp;
    return b.sequence_step - a.sequence_step;
  });

  if (sorted.length === 0) {
    return { sequence_id: 1, sequence_step: 1 };
  }

  const last = sorted[0];

  // If last bet was RED, start new sequence
  if (last.result === 'RED') {
    return { sequence_id: last.sequence_id + 1, sequence_step: 1 };
  }

  // Otherwise continue current sequence
  return { sequence_id: last.sequence_id, sequence_step: last.sequence_step + 1 };
}

function editBet(id) {
  openModal(id);
}

async function deleteBet(id) {
  if (!confirm('Tem certeza que deseja excluir esta aposta?')) return;

  try {
    const { error } = await sb
      .from('bets')
      .delete()
      .eq('id', id);
    if (error) throw error;
    showToast('Aposta excluída', 'info');
    await loadBets();
  } catch (err) {
    console.error('Erro ao excluir:', err);
    showToast('Erro ao excluir', 'error');
  }
}

// ── Suggestions ────────────────────────────────────────────
function populateSuggestions() {
  const players = new Set();
  const teams = new Set();
  allBets.forEach(bet => {
    bet.legs.forEach(l => {
      if (l.player) players.add(l.player);
      if (l.team) teams.add(l.team);
      if (l.opponent) teams.add(l.opponent);
    });
  });

  const playerList = document.getElementById('playerSuggestions');
  if (playerList) {
    playerList.innerHTML = [...players].map(p => `<option value="${escapeHtml(p)}">`).join('');
  }
  const teamList = document.getElementById('teamSuggestions');
  if (teamList) {
    teamList.innerHTML = [...teams].map(t => `<option value="${escapeHtml(t)}">`).join('');
  }
}

// ── Projection ─────────────────────────────────────────────
function calculateProjection() {
  const initial = parseFloat(document.getElementById('projInitial').value);
  const odd = parseFloat(document.getElementById('projOdd').value) || 1.40;
  const target = parseFloat(document.getElementById('projTarget').value);

  document.getElementById('projOddDisplay').textContent = odd.toFixed(2);

  const tbody = document.getElementById('projTableBody');
  const formulaEl = document.getElementById('projFormula');
  const stepsEl = document.getElementById('projSteps');

  if (!(initial > 0) || !(target > initial) || !(odd > 1)) {
    stepsEl.textContent = '—';
    formulaEl.textContent = 'Preencha valor inicial < valor alvo e odd > 1.00';
    tbody.innerHTML = '';
    document.getElementById('scenariosGrid').innerHTML = '';
    renderProjectionChart([0], [initial || 0]);
    return;
  }

  const n = Math.ceil(Math.log(target / initial) / Math.log(odd));
  const actualTarget = initial * Math.pow(odd, n);

  stepsEl.textContent = n;
  formulaEl.textContent =
    `R$ ${formatNumber(initial)} × ${odd.toFixed(2)}^${n} = R$ ${formatNumber(actualTarget)}`;

  // Scenarios
  const scenarios = [1.40, 1.45, 1.50, 1.55, 1.59];
  document.getElementById('scenariosGrid').innerHTML = scenarios.map(o => {
    const steps = Math.ceil(Math.log(target / initial) / Math.log(o));
    const isActive = Math.abs(o - odd) < 0.005;
    return `
      <div class="scenario-card" style="${isActive ? 'border-color: var(--accent);' : ''}">
        <div class="scenario-odd">${o.toFixed(2)}</div>
        <div class="scenario-steps">${steps}</div>
        <div class="scenario-label">greens</div>
      </div>
    `;
  }).join('');

  // Steps table — show first 10, last 5, and midpoint; collapse middle if > 16 rows
  const headRows = 10;
  const tailRows = 5;
  const showAll = n <= headRows + tailRows + 1;
  const rows = [];
  let current = initial;

  for (let i = 1; i <= n; i++) {
    const ret = +(current * odd).toFixed(2);
    const inHead = i <= headRows;
    const inTail = i > n - tailRows;
    const isMid = i === Math.floor(n / 2);

    if (showAll || inHead || inTail || isMid) {
      rows.push(`
        <tr>
          <td><span class="rank-number">${i}</span></td>
          <td>${formatMoney(current)}</td>
          <td>${odd.toFixed(2)}</td>
          <td class="money-positive">${formatMoney(ret)}</td>
          <td style="color: var(--accent-light); font-weight: 700;">${formatMoney(ret)}</td>
        </tr>
      `);
    } else if (i === headRows + 1) {
      const hiddenBefore = Math.floor(n / 2) - headRows - 1;
      if (hiddenBefore > 0) {
        rows.push(`
          <tr>
            <td colspan="5" style="text-align:center;color:var(--text-tertiary);padding:8px;">
              ··· ${hiddenBefore} steps ocultos ···
            </td>
          </tr>
        `);
      }
    } else if (i === Math.floor(n / 2) + 1) {
      const hiddenAfter = (n - tailRows) - Math.floor(n / 2);
      if (hiddenAfter > 0) {
        rows.push(`
          <tr>
            <td colspan="5" style="text-align:center;color:var(--text-tertiary);padding:8px;">
              ··· ${hiddenAfter} steps ocultos ···
            </td>
          </tr>
        `);
      }
    }
    current = ret;
  }
  tbody.innerHTML = rows.join('');

  // Chart
  const chartSteps = [];
  const chartValues = [];
  let c = initial;
  for (let i = 0; i <= n; i++) {
    chartSteps.push(i);
    chartValues.push(+c.toFixed(2));
    c = +(c * odd).toFixed(2);
  }
  renderProjectionChart(chartSteps, chartValues);
}

// ── Utility Functions ──────────────────────────────────────
function formatMoney(value) {
  return 'R$ ' + Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value) {
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getResultEmoji(result) {
  switch (result) {
    case 'GREEN': return '🟢';
    case 'RED': return '🔴';
    case 'VOID': return '⚪';
    case 'PENDING': return '🔵';
    default: return '';
  }
}

// ── Toast Notifications ────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
