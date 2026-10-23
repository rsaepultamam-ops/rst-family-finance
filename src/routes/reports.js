const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getTransactions, getCategories } = require('../services/excelService');

router.use(authMiddleware);

/**
 * GET /api/reports/monthly
 * Query: month (1-12), year (e.g. 2026)
 */
router.get('/monthly', async (req, res) => {
  try {
    const today = new Date();
    const month = parseInt(req.query.month, 10) || (today.getMonth() + 1);
    const year = parseInt(req.query.year, 10) || today.getFullYear();

    const mStr = String(month).padStart(2, '0');
    const monthPrefix = `${year}-${mStr}`;

    // Previous month calculation
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const prevMStr = String(prevMonth).padStart(2, '0');
    const prevMonthPrefix = `${prevYear}-${prevMStr}`;

    const [allTransactions, categories] = await Promise.all([
      getTransactions(),
      getCategories(true)
    ]);

    // Current month transactions
    const currentMonthTxs = allTransactions.filter(t => (t.Tanggal || '').startsWith(monthPrefix));
    // Previous month transactions
    const prevMonthTxs = allTransactions.filter(t => (t.Tanggal || '').startsWith(prevMonthPrefix));

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryExpenseMap = {};
    const categoryIncomeMap = {};
    const dailyExpenseMap = {};
    const dailyIncomeMap = {};

    // Get number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayKey = `${year}-${mStr}-${String(d).padStart(2, '0')}`;
      dailyExpenseMap[dayKey] = 0;
      dailyIncomeMap[dayKey] = 0;
    }

    currentMonthTxs.forEach(t => {
      const amt = Number(t.Jumlah) || 0;
      const dateKey = t.Tanggal;

      if (t.Tipe === 'Pengeluaran') {
        totalExpense += amt;
        categoryExpenseMap[t.Kategori] = (categoryExpenseMap[t.Kategori] || 0) + amt;
        if (dailyExpenseMap[dateKey] !== undefined) {
          dailyExpenseMap[dateKey] += amt;
        } else {
          dailyExpenseMap[dateKey] = amt;
        }
      } else if (t.Tipe === 'Pemasukan') {
        totalIncome += amt;
        categoryIncomeMap[t.Kategori] = (categoryIncomeMap[t.Kategori] || 0) + amt;
        if (dailyIncomeMap[dateKey] !== undefined) {
          dailyIncomeMap[dateKey] += amt;
        } else {
          dailyIncomeMap[dateKey] = amt;
        }
      }
    });

    const balance = totalIncome - totalExpense;

    // Previous month summary
    let prevMonthExpense = 0;
    let prevMonthIncome = 0;
    prevMonthTxs.forEach(t => {
      const amt = Number(t.Jumlah) || 0;
      if (t.Tipe === 'Pengeluaran') prevMonthExpense += amt;
      else if (t.Tipe === 'Pemasukan') prevMonthIncome += amt;
    });

    const expenseChangePercent = prevMonthExpense > 0 
      ? Math.round(((totalExpense - prevMonthExpense) / prevMonthExpense) * 100) 
      : 0;

    // Highest expense day
    let highestExpenseDay = '-';
    let highestExpenseAmount = 0;
    Object.entries(dailyExpenseMap).forEach(([date, amount]) => {
      if (amount > highestExpenseAmount) {
        highestExpenseAmount = amount;
        highestExpenseDay = date;
      }
    });

    // Daily average
    const daysToCount = (year === today.getFullYear() && month === (today.getMonth() + 1)) 
      ? Math.max(1, today.getDate()) 
      : daysInMonth;
    const dailyAverageExpense = Math.round(totalExpense / daysToCount);

    // Build category breakdowns with icons and colors
    const categoryBreakdown = Object.entries(categoryExpenseMap).map(([nama, total]) => {
      const catMeta = categories.find(c => c.Nama.toLowerCase() === nama.toLowerCase()) || {};
      const percentage = totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0;
      return {
        nama,
        total,
        percentage,
        ikon: catMeta.Ikon || '📦',
        warna: catMeta.Warna || '#3B82F6'
      };
    }).sort((a, b) => b.total - a.total);

    // Daily chart series
    const dailyLabels = Object.keys(dailyExpenseMap).map(d => d.slice(8)); // day numbers 01, 02..
    const dailyExpenseData = Object.values(dailyExpenseMap);
    const dailyIncomeData = Object.values(dailyIncomeMap);

    res.json({
      success: true,
      data: {
        period: { month, year, monthPrefix, daysInMonth },
        summary: {
          totalIncome,
          totalExpense,
          balance,
          dailyAverageExpense,
          highestExpenseDay,
          highestExpenseAmount,
          transactionCount: currentMonthTxs.length
        },
        comparison: {
          prevMonth,
          prevYear,
          prevMonthExpense,
          prevMonthIncome,
          expenseChangePercent
        },
        categoryBreakdown,
        dailyTrend: {
          labels: dailyLabels,
          dates: Object.keys(dailyExpenseMap),
          expense: dailyExpenseData,
          income: dailyIncomeData
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/reports/daily
 * Query: date (YYYY-MM-DD, default today)
 */
router.get('/daily', async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const transactions = await getTransactions({ startDate: dateStr, endDate: dateStr });

    let totalIncome = 0;
    let totalExpense = 0;
    transactions.forEach(t => {
      const amt = Number(t.Jumlah) || 0;
      if (t.Tipe === 'Pemasukan') totalIncome += amt;
      else if (t.Tipe === 'Pengeluaran') totalExpense += amt;
    });

    res.json({
      success: true,
      data: {
        date: dateStr,
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        count: transactions.length,
        transactions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
