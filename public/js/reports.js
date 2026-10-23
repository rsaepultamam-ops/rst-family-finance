/**
 * RST Family Finance - Monthly Reports Module
 */

let categoryDonutChart = null;
let categoryBarChart = null;
let dailyLineChart = null;

let selectedReportMonth = new Date().getMonth() + 1;
let selectedReportYear = new Date().getFullYear();

const INDO_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

async function loadMonthlyReport() {
  const monthSelect = document.getElementById('report-month-select');
  const yearSelect = document.getElementById('report-year-select');

  if (monthSelect) selectedReportMonth = parseInt(monthSelect.value, 10);
  if (yearSelect) selectedReportYear = parseInt(yearSelect.value, 10);

  try {
    const res = await API.get('/api/reports/monthly', {
      month: selectedReportMonth,
      year: selectedReportYear
    });

    if (!res.success || !res.data) return;

    const data = res.data;
    const summary = data.summary;
    const comparison = data.comparison;
    const categoryBreakdown = data.categoryBreakdown || [];
    const dailyTrend = data.dailyTrend || {};

    // Update Indicators
    const elMasuk = document.getElementById('rpt-pemasukan');
    const elKeluar = document.getElementById('rpt-pengeluaran');
    const elSaldo = document.getElementById('rpt-saldo');
    const elAvg = document.getElementById('rpt-avg-daily');
    const elMaxDay = document.getElementById('rpt-max-day');
    const elCompBadge = document.getElementById('rpt-comparison-badge');

    if (elMasuk) elMasuk.textContent = formatCurrency(summary.totalIncome);
    if (elKeluar) elKeluar.textContent = formatCurrency(summary.totalExpense);
    if (elSaldo) elSaldo.textContent = formatCurrency(summary.balance);
    if (elAvg) elAvg.textContent = formatCurrency(summary.dailyAverageExpense) + ' / hari';
    if (elMaxDay) {
      if (summary.highestExpenseAmount > 0) {
        elMaxDay.textContent = `${formatDate(summary.highestExpenseDay)} (${formatCurrency(summary.highestExpenseAmount)})`;
      } else {
        elMaxDay.textContent = '-';
      }
    }

    if (elCompBadge) {
      const pct = comparison.expenseChangePercent;
      if (pct > 0) {
        elCompBadge.innerHTML = `<span class="text-danger" style="font-weight:700;">▲ +${pct}%</span> dibandingkan bulan lalu (${formatCurrency(comparison.prevMonthExpense)})`;
      } else if (pct < 0) {
        elCompBadge.innerHTML = `<span class="text-success" style="font-weight:700;">▼ ${pct}%</span> dibandingkan bulan lalu (${formatCurrency(comparison.prevMonthExpense)})`;
      } else {
        elCompBadge.innerHTML = `Pengeluaran sama persis dengan bulan lalu (${formatCurrency(comparison.prevMonthExpense)})`;
      }
    }

    // Render Charts
    renderCategoryCharts(categoryBreakdown);
    renderDailyTrendChart(dailyTrend);

    // Render Table Breakdown
    renderCategoryTable(categoryBreakdown, summary.totalExpense);

  } catch (err) {
    console.error('Error loading report:', err);
    showToast('Gagal memuat laporan bulanan: ' + err.message, 'error');
  }
}

function renderCategoryCharts(categories) {
  // Donut Chart
  const donutCtx = document.getElementById('chart-category-donut');
  if (donutCtx && typeof Chart !== 'undefined') {
    if (categoryDonutChart) categoryDonutChart.destroy();

    if (categories.length === 0) {
      // Empty state
      categoryDonutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: ['Belum ada pengeluaran'],
          datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
    } else {
      categoryDonutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
          labels: categories.map(c => `${c.ikon} ${c.nama}`),
          datasets: [{
            data: categories.map(c => c.total),
            backgroundColor: categories.map(c => c.warna || '#3B82F6'),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 12,
                font: { family: 'Inter', size: 12 }
              }
            },
            tooltip: {
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw || 0;
                  return ` ${formatCurrency(val)}`;
                }
              }
            }
          },
          cutout: '65%'
        }
      });
    }
  }

  // Bar Chart
  const barCtx = document.getElementById('chart-category-bar');
  if (barCtx && typeof Chart !== 'undefined') {
    if (categoryBarChart) categoryBarChart.destroy();

    categoryBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: categories.slice(0, 8).map(c => c.nama),
        datasets: [{
          label: 'Nominal Pengeluaran',
          data: categories.slice(0, 8).map(c => c.total),
          backgroundColor: categories.slice(0, 8).map(c => c.warna || '#3B82F6'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ` ${formatCurrency(ctx.raw)}`; }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(v) {
                return 'Rp ' + (v >= 1000000 ? (v/1000000).toFixed(1) + ' jt' : (v/1000).toFixed(0) + ' rb');
              }
            }
          }
        }
      }
    });
  }
}

function renderDailyTrendChart(dailyTrend) {
  const lineCtx = document.getElementById('chart-daily-trend');
  if (!lineCtx || typeof Chart === 'undefined') return;

  if (dailyLineChart) dailyLineChart.destroy();

  dailyLineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: (dailyTrend.labels || []).map(l => `Tgl ${l}`),
      datasets: [
        {
          label: 'Pengeluaran (Rp)',
          data: dailyTrend.expense || [],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 3,
          pointBackgroundColor: '#ef4444'
        },
        {
          label: 'Pemasukan (Rp)',
          data: dailyTrend.income || [],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#10b981'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { family: 'Inter', size: 12 } }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(v) {
              return 'Rp ' + (v >= 1000000 ? (v/1000000).toFixed(1) + ' jt' : (v/1000).toFixed(0) + ' rb');
            }
          }
        }
      }
    }
  });
}

function renderCategoryTable(categories, totalExpense) {
  const tbody = document.getElementById('rpt-category-table-body');
  if (!tbody) return;

  if (categories.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Belum ada pengeluaran pada bulan ini.</td></tr>`;
    return;
  }

  tbody.innerHTML = categories.map((c, idx) => `
    <tr>
      <td style="width: 40px; color: var(--text-muted); font-size: 12px;">#${idx + 1}</td>
      <td>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">${c.ikon}</span>
          <div>
            <strong>${c.nama}</strong>
            <div style="width: 120px; height: 6px; background: #e2e8f0; border-radius: 999px; margin-top: 4px; overflow: hidden;">
              <div style="width: ${c.percentage}%; height: 100%; background: ${c.warna}; border-radius: 999px;"></div>
            </div>
          </div>
        </div>
      </td>
      <td style="font-weight: 600; font-size: 13px;">${c.percentage}%</td>
      <td style="text-align: right; font-weight: 700; color: var(--expense);">
        ${formatCurrency(c.total)}
      </td>
    </tr>
  `).join('');
}

// Navigation buttons (Bulan sebelumnya / berikutnya)
function changeReportMonth(offset) {
  selectedReportMonth += offset;
  if (selectedReportMonth > 12) {
    selectedReportMonth = 1;
    selectedReportYear++;
  } else if (selectedReportMonth < 1) {
    selectedReportMonth = 12;
    selectedReportYear--;
  }

  const mSel = document.getElementById('report-month-select');
  const ySel = document.getElementById('report-year-select');
  if (mSel) mSel.value = selectedReportMonth;
  if (ySel) ySel.value = selectedReportYear;

  loadMonthlyReport();
}

function initReportSelectors() {
  const mSel = document.getElementById('report-month-select');
  const ySel = document.getElementById('report-year-select');

  if (mSel) {
    mSel.innerHTML = INDO_MONTHS.map((m, idx) => `
      <option value="${idx + 1}" ${idx + 1 === selectedReportMonth ? 'selected' : ''}>${m}</option>
    `).join('');
    mSel.addEventListener('change', loadMonthlyReport);
  }

  if (ySel) {
    const years = [2024, 2025, 2026, 2027, 2028];
    ySel.innerHTML = years.map(y => `
      <option value="${y}" ${y === selectedReportYear ? 'selected' : ''}>${y}</option>
    `).join('');
    ySel.addEventListener('change', loadMonthlyReport);
  }
}

window.loadMonthlyReport = loadMonthlyReport;
window.changeReportMonth = changeReportMonth;
window.initReportSelectors = initReportSelectors;
