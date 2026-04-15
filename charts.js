/* ============================================================
   CHARTS MODULE — Chart.js configurations
   ============================================================ */

const ChartColors = {
  accent: '#F59E0B',
  accentLight: '#FBBF24',
  green: '#22C55E',
  red: '#EF4444',
  void: '#6B7280',
  pending: '#3B82F6',
  text: '#9CA3AF',
  grid: 'rgba(255, 255, 255, 0.04)',
  gradientTop: 'rgba(245, 158, 11, 0.3)',
  gradientBottom: 'rgba(245, 158, 11, 0.0)',
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: ChartColors.text,
        font: { family: "'DM Sans', sans-serif", size: 11 },
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(17, 17, 24, 0.95)',
      titleColor: '#F1F1F4',
      bodyColor: '#9CA3AF',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: { family: "'Outfit', sans-serif", weight: '600', size: 13 },
      bodyFont: { family: "'DM Sans', sans-serif", size: 12 },
      displayColors: true,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      ticks: { color: ChartColors.text, font: { size: 10, family: "'DM Sans', sans-serif" } },
      grid: { color: ChartColors.grid },
      border: { color: 'rgba(255,255,255,0.06)' },
    },
    y: {
      ticks: { color: ChartColors.text, font: { size: 10, family: "'DM Sans', sans-serif" } },
      grid: { color: ChartColors.grid },
      border: { color: 'rgba(255,255,255,0.06)' },
    },
  },
};

// Store chart instances for updates
const chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

/* ── Profit Acumulado (Line) ──────────────────────────────── */
function renderProfitChart(labels, data) {
  destroyChart('profit');
  const ctx = document.getElementById('chartProfit');
  if (!ctx) return;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, ChartColors.gradientTop);
  gradient.addColorStop(1, ChartColors.gradientBottom);

  chartInstances['profit'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Profit Acumulado (R$)',
        data,
        borderColor: ChartColors.accent,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: ChartColors.accentLight,
        pointBorderColor: 'transparent',
        pointHoverRadius: 6,
        pointHoverBackgroundColor: ChartColors.accentLight,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        borderWidth: 2.5,
      }],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: (v) => 'R$ ' + v.toFixed(2),
          },
        },
      },
    },
  });
}

/* ── Distribuição de Resultados (Doughnut) ────────────────── */
function renderResultsChart(greens, reds, voids, pendings) {
  destroyChart('results');
  const ctx = document.getElementById('chartResults');
  if (!ctx) return;

  chartInstances['results'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['GREEN', 'RED', 'VOID', 'PENDING'],
      datasets: [{
        data: [greens, reds, voids, pendings],
        backgroundColor: [
          ChartColors.green,
          ChartColors.red,
          ChartColors.void,
          ChartColors.pending,
        ],
        borderColor: 'rgba(10, 10, 15, 0.8)',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        ...chartDefaults.plugins,
        legend: {
          ...chartDefaults.plugins.legend,
          position: 'bottom',
        },
      },
    },
  });
}

/* ── Profit por Dia da Semana (Bar) ───────────────────────── */
function renderWeekdayChart(labels, data) {
  destroyChart('weekday');
  const ctx = document.getElementById('chartWeekday');
  if (!ctx) return;

  const colors = data.map(v => v >= 0 ? ChartColors.green : ChartColors.red);
  chartInstances['weekday'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Profit (R$)',
        data,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: (v) => 'R$ ' + v.toFixed(2),
          },
        },
      },
    },
  });
}

/* ── Win Rate por Categoria (Bar) ─────────────────────────── */
function renderCategoryChart(labels, winRates, counts) {
  destroyChart('category');
  const ctx = document.getElementById('chartCategory');
  if (!ctx) return;

  chartInstances['category'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: ChartColors.accent + '50',
        borderColor: ChartColors.accent,
        borderWidth: 1.5,
        borderRadius: 6,
      }],
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            afterLabel: (ctx) => `${counts[ctx.dataIndex]} apostas`,
          },
        },
      },
      scales: {
        ...chartDefaults.scales,
        x: {
          ...chartDefaults.scales.x,
          max: 100,
          ticks: {
            ...chartDefaults.scales.x.ticks,
            callback: (v) => v + '%',
          },
        },
      },
    },
  });
}

/* ── Performance por Faixa de Odd (Bar) ───────────────────── */
function renderOddRangeChart(labels, winRates, counts) {
  destroyChart('oddRange');
  const ctx = document.getElementById('chartOddRange');
  if (!ctx) return;

  const colors = winRates.map(v => v >= 60 ? ChartColors.green : v >= 45 ? ChartColors.accent : ChartColors.red);
  chartInstances['oddRange'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
      }],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
        tooltip: {
          ...chartDefaults.plugins.tooltip,
          callbacks: {
            afterLabel: (ctx) => `${counts[ctx.dataIndex]} apostas`,
          },
        },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          max: 100,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: (v) => v + '%',
          },
        },
      },
    },
  });
}

/* ── Profit por Jogador (Horizontal Bar) ──────────────────── */
function renderPlayerProfitChart(labels, profits) {
  destroyChart('playerProfit');
  const ctx = document.getElementById('chartPlayerProfit');
  if (!ctx) return;

  const colors = profits.map(v => v >= 0 ? ChartColors.green : ChartColors.red);
  chartInstances['playerProfit'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Profit (R$)',
        data: profits,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 6,
      }],
    },
    options: {
      ...chartDefaults,
      indexAxis: 'y',
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
      },
      scales: {
        ...chartDefaults.scales,
        x: {
          ...chartDefaults.scales.x,
          ticks: {
            ...chartDefaults.scales.x.ticks,
            callback: (v) => 'R$ ' + v.toFixed(2),
          },
        },
      },
    },
  });
}

/* ── Projeção Exponencial (Line) ──────────────────────────── */
function renderProjectionChart(steps, values) {
  destroyChart('projection');
  const ctx = document.getElementById('chartProjection');
  if (!ctx) return;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 350);
  gradient.addColorStop(0, 'rgba(34, 197, 94, 0.25)');
  gradient.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

  chartInstances['projection'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: steps.map(s => `#${s}`),
      datasets: [{
        label: 'Valor Acumulado (R$)',
        data: values,
        borderColor: ChartColors.green,
        backgroundColor: gradient,
        fill: true,
        tension: 0.3,
        pointRadius: values.length > 40 ? 0 : 3,
        pointBackgroundColor: ChartColors.green,
        pointBorderColor: 'transparent',
        pointHoverRadius: 6,
        borderWidth: 2.5,
      }],
    },
    options: {
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        legend: { display: false },
      },
      scales: {
        ...chartDefaults.scales,
        y: {
          ...chartDefaults.scales.y,
          ticks: {
            ...chartDefaults.scales.y.ticks,
            callback: (v) => {
              if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1) + 'k';
              return 'R$ ' + v.toFixed(2);
            },
          },
        },
      },
    },
  });
}
