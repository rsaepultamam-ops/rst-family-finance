/**
 * =========================================================================
 * RST Family Finance - Database Engine via Google Apps Script (Google Drive)
 * =========================================================================
 * 
 * Skrip ini berfungsi sebagai REST API Database Engine untuk aplikasi RST Family.
 * Berjalan langsung di Google Drive / Google Sheets Anda tanpa butuh Google Cloud Console.
 * 
 * PANDUAN DEPLOY:
 * 1. Buka spreadsheet database Anda di Google Drive.
 * 2. Klik menu "Extensions" (Ekstensi) > "Apps Script".
 * 3. Hapus semua kode default dan tempel kode ini ke dalam Code.gs.
 * 4. Atur SECRET_KEY di bawah ini (sama dengan nilai GAS_SECRET_KEY di .env / Vercel).
 * 5. Pilih fungsi "setupDatabase" di dropdown atas lalu klik "Run" untuk inisialisasi sheet otomatis.
 * 6. Klik "Deploy" (Terapkan) > "New deployment" (Penerapan baru).
 *    - Type: Web app
 *    - Description: RST Family DB Engine v1
 *    - Execute as: Me (email Anda)
 *    - Who has access: Anyone (Siapa saja)
 * 7. Salin Web app URL dan masukkan ke GAS_WEB_APP_URL di .env / Vercel.
 */

// Ganti token ini dengan string rahasia pilihan Anda (harus cocok dengan GAS_SECRET_KEY di server)
var SECRET_KEY = "rst_family_secure_token_2026";

/**
 * Endpoint POST untuk semua operasi CRUD Database
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  var hasLock = lock.tryLock(15000); // Tunggu antrian hingga 15 detik agar aman dari race-condition

  if (!hasLock) {
    return jsonResponse({
      success: false,
      message: "Database Google Sheets sedang sibuk. Silakan coba kembali sesaat lagi."
    }, 429);
  }

  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);

    // Verifikasi Token Rahasia jika SECRET_KEY diaktifkan
    if (SECRET_KEY && SECRET_KEY.trim() !== "") {
      if (!payload.secret || payload.secret !== SECRET_KEY) {
        return jsonResponse({
          success: false,
          message: "Akses ditolak: Secret Key Google Apps Script tidak valid."
        }, 403);
      }
    }

    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = null;

    switch (action) {
      // ----------------------------------------------------
      // SYSTEM & SETUP
      // ----------------------------------------------------
      case "ping":
        result = {
          status: "connected",
          spreadsheetName: ss.getName(),
          spreadsheetId: ss.getId(),
          spreadsheetUrl: ss.getUrl(),
          serverTime: new Date().toISOString()
        };
        break;

      case "setup":
        result = setupDatabase();
        break;

      case "batchImport":
        result = handleBatchImport(ss, payload.data);
        break;

      // ----------------------------------------------------
      // TRANSAKSI
      // ----------------------------------------------------
      case "getTransactions":
        result = handleGetTransactions(ss, payload.params || {});
        break;

      case "getTransactionById":
        result = handleGetRowById(ss, "Transactions", "ID", payload.id);
        break;

      case "addTransaction":
        result = handleAddTransaction(ss, payload.data);
        break;

      case "updateTransaction":
        result = handleUpdateRow(ss, "Transactions", "ID", payload.id, payload.data, ["Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan", "User", "Diubah"]);
        break;

      case "deleteTransaction":
        result = handleDeleteRow(ss, "Transactions", "ID", payload.id);
        break;

      case "clearAllTransactions":
        result = handleClearTransactions(ss);
        break;

      // ----------------------------------------------------
      // KATEGORI
      // ----------------------------------------------------
      case "getCategories":
        result = handleGetCategories(ss, payload.includeInactive);
        break;

      case "addCategory":
        result = handleAddCategory(ss, payload.data);
        break;

      case "updateCategory":
        result = handleUpdateRow(ss, "Categories", "ID", payload.id, payload.data, ["Nama", "Tipe", "Ikon", "Warna", "Aktif", "Custom"]);
        break;

      case "deleteCategory":
        result = handleDeleteCategory(ss, payload.id);
        break;

      // ----------------------------------------------------
      // USERS
      // ----------------------------------------------------
      case "getUsers":
        result = handleGetUsers(ss);
        break;

      case "getUserByUsername":
        result = handleGetUserByUsername(ss, payload.username);
        break;

      case "getUserById":
        result = handleGetRowById(ss, "Users", "ID", payload.id);
        break;

      case "addUser":
        result = handleAddUser(ss, payload.data);
        break;

      case "updateUser":
        result = handleUpdateRow(ss, "Users", "ID", payload.id, payload.data, ["Nama", "Password", "Role", "Email", "Telegram Chat ID", "Aktif"]);
        break;

      case "deleteUser":
        result = handleDeleteUser(ss, payload.id);
        break;

      // ----------------------------------------------------
      // SETTINGS
      // ----------------------------------------------------
      case "getSettings":
        result = handleGetSettings(ss);
        break;

      case "updateSetting":
        result = handleUpdateSetting(ss, payload.key, payload.value);
        break;

      // ----------------------------------------------------
      // NOTIFIKASI LOG
      // ----------------------------------------------------
      case "getNotificationLogs":
        result = handleGetNotificationLogs(ss);
        break;

      case "addNotificationLog":
        result = handleAddNotificationLog(ss, payload.data);
        break;

      default:
        return jsonResponse({
          success: false,
          message: "Aksi tidak dikenal: " + action
        }, 400);
    }

    return jsonResponse({
      success: true,
      data: result
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      message: err.toString(),
      stack: err.stack
    }, 500);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Endpoint GET untuk Health Check dari Browser
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return jsonResponse({
    success: true,
    message: "RST Family Finance Database Engine is ACTIVE via Google Apps Script (Drive).",
    spreadsheet: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper Format Response JSON
 */
function jsonResponse(data, code) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// AUTO SETUP DATABASE (Otomatis Buat Sheet & Isi Data Awal)
// =========================================================================
function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Transactions Sheet
  var wsTrx = getOrCreateSheet(ss, "Transactions");
  setupHeader(wsTrx, ["ID", "Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan", "User", "Dibuat", "Diubah"]);

  // 2. Categories Sheet
  var wsCat = getOrCreateSheet(ss, "Categories");
  var catHeader = ["ID", "Nama", "Tipe", "Ikon", "Warna", "Aktif", "Custom", "Dibuat Oleh"];
  setupHeader(wsCat, catHeader);
  if (wsCat.getLastRow() <= 1) {
    var defaultCats = [
      ["CAT-001", "Makanan & Minuman", "Pengeluaran", "🍚", "#FF6B6B", true, false, "system"],
      ["CAT-002", "Transportasi", "Pengeluaran", "🚗", "#4ECDC4", true, false, "system"],
      ["CAT-003", "Rumah Tangga", "Pengeluaran", "🏠", "#45B7D1", true, false, "system"],
      ["CAT-004", "Listrik & Air", "Pengeluaran", "💡", "#FFA726", true, false, "system"],
      ["CAT-005", "Pulsa & Internet", "Pengeluaran", "📱", "#AB47BC", true, false, "system"],
      ["CAT-006", "Kesehatan", "Pengeluaran", "🏥", "#EF5350", true, false, "system"],
      ["CAT-007", "Pendidikan", "Pengeluaran", "🎓", "#5C6BC0", true, false, "system"],
      ["CAT-008", "Pakaian", "Pengeluaran", "👕", "#EC407A", true, false, "system"],
      ["CAT-009", "Hiburan", "Pengeluaran", "🎉", "#FFA000", true, false, "system"],
      ["CAT-010", "Sosial & Sumbangan", "Pengeluaran", "🤝", "#66BB6A", true, false, "system"],
      ["CAT-011", "Tabungan & Investasi", "Pengeluaran", "💰", "#26A69A", true, false, "system"],
      ["CAT-012", "Lain-lain", "Pengeluaran", "📦", "#78909C", true, false, "system"],
      ["CAT-101", "Gaji", "Pemasukan", "💼", "#10B981", true, false, "system"],
      ["CAT-102", "Bonus", "Pemasukan", "💵", "#059669", true, false, "system"],
      ["CAT-103", "Usaha", "Pemasukan", "🏪", "#0D9488", true, false, "system"],
      ["CAT-104", "Hadiah/Transfer", "Pemasukan", "🎁", "#14B8A6", true, false, "system"],
      ["CAT-105", "Lain-lain", "Pemasukan", "📦", "#6B7280", true, false, "system"]
    ];
    wsCat.getRange(2, 1, defaultCats.length, catHeader.length).setValues(defaultCats);
  }

  // 3. Users Sheet
  var wsUsers = getOrCreateSheet(ss, "Users");
  var userHeader = ["ID", "Nama", "Username", "Password", "Role", "Email", "Telegram Chat ID", "Aktif", "Dibuat"];
  setupHeader(wsUsers, userHeader);
  if (wsUsers.getLastRow() <= 1) {
    var defaultUsers = [
      ["USR-001", "Risman (Kepala Keluarga)", "risman", "$2a$10$GZNoRJFZnmBWLWvJY2ZuK./hZIVJ4V0.pw/jc/dsGkWJO8K7NxCHm", "admin", "risman@keluarga.rst", "", true, new Date().toISOString()],
      ["USR-002", "Siti Julaeha (Anggota Keluarga)", "sitijulaeha", "$2a$10$rsPoQxkpVD7e1fYROtqRK.mFSsae7uJta5JNfvUF8biWhx6mHh/mq", "anggota", "siti@keluarga.rst", "", true, new Date().toISOString()]
    ];
    wsUsers.getRange(2, 1, defaultUsers.length, userHeader.length).setValues(defaultUsers);
  }

  // 4. Settings Sheet
  var wsSettings = getOrCreateSheet(ss, "Settings");
  var setHeader = ["Key", "Value", "Diubah"];
  setupHeader(wsSettings, setHeader);
  if (wsSettings.getLastRow() <= 1) {
    var defaultSettings = [
      ["cloud_sync_enabled", "true", new Date().toISOString()],
      ["sync_status", "google_apps_script_active", new Date().toISOString()],
      ["notif_daily_enabled", "true", new Date().toISOString()],
      ["notif_daily_time", "20:00", new Date().toISOString()],
      ["notif_channel", "both", new Date().toISOString()],
      ["telegram_bot_token", "", new Date().toISOString()]
    ];
    wsSettings.getRange(2, 1, defaultSettings.length, setHeader.length).setValues(defaultSettings);
  }

  // 5. Notifikasi Log Sheet
  var wsNotif = getOrCreateSheet(ss, "Notifikasi_Log");
  setupHeader(wsNotif, ["ID", "Tipe", "Channel", "Penerima", "Status", "Waktu Kirim"]);

  // Hapus "Sheet1" default jika ada dan tidak terpakai
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }

  return {
    status: "ok",
    message: "Inisialisasi tabel database RST Family Finance berhasil!",
    sheets: ["Transactions", "Categories", "Users", "Settings", "Notifikasi_Log"]
  };
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function resolveSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) return sheet;

  // Cek alias Bahasa Indonesia / Inggris
  var aliases = {
    "Transactions": "Transaksi",
    "Transaksi": "Transactions",
    "Categories": "Kategori",
    "Kategori": "Categories",
    "Users": "Pengguna",
    "Pengguna": "Users",
    "Settings": "Pengaturan",
    "Pengaturan": "Settings",
    "Notifikasi_Log": "Notifications",
    "Notifications": "Notifikasi_Log"
  };

  if (aliases[sheetName]) {
    sheet = ss.getSheetByName(aliases[sheetName]);
    if (sheet) return sheet;
  }

  // Jika belum ada sama sekali, otomatis buat sheet baru dengan header standar
  sheet = getOrCreateSheet(ss, sheetName);
  var defaultHeadersMap = {
    "Transactions": ["ID", "Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan", "User", "Dibuat", "Diubah"],
    "Transaksi": ["ID", "Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan", "User", "Dibuat", "Diubah"],
    "Categories": ["ID", "Nama", "Tipe", "Ikon", "Warna", "Aktif", "Custom", "Dibuat Oleh"],
    "Kategori": ["ID", "Nama", "Tipe", "Ikon", "Warna", "Aktif", "Custom", "Dibuat Oleh"],
    "Users": ["ID", "Nama", "Username", "Password", "Role", "Email", "Telegram Chat ID", "Aktif", "Dibuat"],
    "Settings": ["Key", "Value", "Diubah"],
    "Notifikasi_Log": ["ID", "Tipe", "Channel", "Penerima", "Status", "Waktu Kirim"]
  };

  if (defaultHeadersMap[sheetName]) {
    setupHeader(sheet, defaultHeadersMap[sheetName]);
  }

  return sheet;
}

function setupHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var cur = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needUpdate = false;
    for (var i = 0; i < headers.length; i++) {
      if (cur[i] !== headers[i]) { needUpdate = true; break; }
    }
    if (needUpdate) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  // Format Header: Bold, Gray background, Freeze row 1
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#f1f5f9")
    .setFontColor("#0f172a");
  sheet.setFrozenRows(1);
}

// =========================================================================
// SPREADSHEET READ/WRITE HELPERS
// =========================================================================

function getSheetObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var val = data[i][j];
      // Normalize dates to YYYY-MM-DD or ISO string
      if (val instanceof Date) {
        if (headers[j] === "Tanggal") {
          var y = val.getFullYear();
          var m = String(val.getMonth() + 1).padStart(2, '0');
          var d = String(val.getDate()).padStart(2, '0');
          val = y + '-' + m + '-' + d;
        } else {
          val = val.toISOString();
        }
      }
      row[headers[j]] = val;
    }
    rows.push(row);
  }
  return rows;
}

function handleGetRowById(ss, sheetName, keyCol, idVal) {
  var sheet = resolveSheet(ss, sheetName);
  var list = getSheetObjects(sheet);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i][keyCol]) === String(idVal)) {
      return list[i];
    }
  }
  return null;
}

function handleUpdateRow(ss, sheetName, keyCol, idVal, updateData, allowedCols) {
  var sheet = resolveSheet(ss, sheetName);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error("Kolom primary key tidak ditemukan: " + keyCol);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(idVal)) {
      for (var k in updateData) {
        if (allowedCols && allowedCols.indexOf(k) === -1 && k !== "Diubah") continue;
        var colIdx = headers.indexOf(k);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updateData[k]);
        }
      }
      // Update timestamp 'Diubah' jika kolom ada
      var diubahIdx = headers.indexOf("Diubah");
      if (diubahIdx !== -1 && !updateData.Diubah) {
        sheet.getRange(i + 1, diubahIdx + 1).setValue(new Date().toISOString());
      }
      return handleGetRowById(ss, sheetName, keyCol, idVal);
    }
  }
  throw new Error("Data dengan " + keyCol + " = " + idVal + " tidak ditemukan.");
}

function handleDeleteRow(ss, sheetName, keyCol, idVal) {
  var sheet = resolveSheet(ss, sheetName);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + sheetName);
  var data = sheet.getDataRange().getValues();
  var keyIdx = data[0].indexOf(keyCol);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyIdx]) === String(idVal)) {
      sheet.deleteRow(i + 1);
      return { id: idVal, deleted: true };
    }
  }
  throw new Error("Data untuk dihapus tidak ditemukan.");
}

// =========================================================================
// TRANSACTIONS LOGIC
// =========================================================================

function handleGetTransactions(ss, filters) {
  var sheet = resolveSheet(ss, "Transactions");
  var list = getSheetObjects(sheet);

  // Filter
  if (filters.search) {
    var q = String(filters.search).toLowerCase();
    list = list.filter(function(t) {
      return (String(t.Keterangan || '').toLowerCase().indexOf(q) !== -1) ||
             (String(t.Kategori || '').toLowerCase().indexOf(q) !== -1);
    });
  }

  if (filters.tipe && filters.tipe !== "Semua") {
    list = list.filter(function(t) { return t.Tipe === filters.tipe; });
  }

  if (filters.kategori && filters.kategori !== "Semua") {
    list = list.filter(function(t) { return t.Kategori === filters.kategori; });
  }

  if (filters.user && filters.user !== "Semua") {
    list = list.filter(function(t) { return t.User === filters.user; });
  }

  if (filters.startDate) {
    list = list.filter(function(t) { return String(t.Tanggal) >= String(filters.startDate); });
  }

  if (filters.endDate) {
    list = list.filter(function(t) { return String(t.Tanggal) <= String(filters.endDate); });
  }

  if (filters.month && filters.year) {
    var mStr = String(filters.month).padStart(2, '0');
    var prefix = filters.year + "-" + mStr;
    list = list.filter(function(t) { return String(t.Tanggal || '').startsWith(prefix); });
  }

  // Sort: Terbaru lebih dahulu
  list.sort(function(a, b) {
    var dDiff = new Date(b.Tanggal) - new Date(a.Tanggal);
    if (dDiff !== 0) return dDiff;
    return String(b.Dibuat || '').localeCompare(String(a.Dibuat || ''));
  });

  return list;
}

function handleAddTransaction(ss, data) {
  var sheet = resolveSheet(ss, "Transactions");

  var id = data.id || ("TRX-" + Utilities.formatDate(new Date(data.tanggal || new Date()), "GMT+7", "yyyyMMdd") + "-" + Utilities.getUuid().substr(0, 4).toUpperCase());
  var row = [
    id,
    data.tanggal,
    data.tipe,
    data.kategori,
    Number(data.jumlah) || 0,
    data.keterangan || "",
    data.user || "",
    new Date().toISOString(),
    new Date().toISOString()
  ];

  sheet.appendRow(row);
  return {
    ID: id,
    Tanggal: data.tanggal,
    Tipe: data.tipe,
    Kategori: data.kategori,
    Jumlah: Number(data.jumlah) || 0,
    Keterangan: data.keterangan || "",
    User: data.user,
    Dibuat: row[7],
    Diubah: row[8]
  };
}

function handleClearTransactions(ss) {
  var sheet = resolveSheet(ss, "Transactions");
  if (!sheet) return { success: true };
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  return { success: true, cleared: true };
}

// =========================================================================
// CATEGORIES LOGIC
// =========================================================================

function handleGetCategories(ss, includeInactive) {
  var sheet = resolveSheet(ss, "Categories");

  // Jika baris data masih kosong, otomatis isi dengan 17 kategori default
  if (sheet.getLastRow() <= 1) {
    var defaultCats = [
      ["CAT-001", "Makanan & Minuman", "Pengeluaran", "🍚", "#FF6B6B", true, false, "system"],
      ["CAT-002", "Transportasi", "Pengeluaran", "🚗", "#4ECDC4", true, false, "system"],
      ["CAT-003", "Rumah Tangga", "Pengeluaran", "🏠", "#45B7D1", true, false, "system"],
      ["CAT-004", "Listrik & Air", "Pengeluaran", "💡", "#FFA726", true, false, "system"],
      ["CAT-005", "Pulsa & Internet", "Pengeluaran", "📱", "#AB47BC", true, false, "system"],
      ["CAT-006", "Kesehatan", "Pengeluaran", "🏥", "#EF5350", true, false, "system"],
      ["CAT-007", "Pendidikan", "Pengeluaran", "🎓", "#5C6BC0", true, false, "system"],
      ["CAT-008", "Pakaian", "Pengeluaran", "👕", "#EC407A", true, false, "system"],
      ["CAT-009", "Hiburan", "Pengeluaran", "🎉", "#FFA000", true, false, "system"],
      ["CAT-010", "Sosial & Sumbangan", "Pengeluaran", "🤝", "#66BB6A", true, false, "system"],
      ["CAT-011", "Tabungan & Investasi", "Pengeluaran", "💰", "#26A69A", true, false, "system"],
      ["CAT-012", "Lain-lain", "Pengeluaran", "📦", "#78909C", true, false, "system"],
      ["CAT-101", "Gaji", "Pemasukan", "💼", "#10B981", true, false, "system"],
      ["CAT-102", "Bonus", "Pemasukan", "💵", "#059669", true, false, "system"],
      ["CAT-103", "Usaha", "Pemasukan", "🏪", "#0D9488", true, false, "system"],
      ["CAT-104", "Hadiah/Transfer", "Pemasukan", "🎁", "#14B8A6", true, false, "system"],
      ["CAT-105", "Lain-lain", "Pemasukan", "📦", "#6B7280", true, false, "system"]
    ];
    sheet.getRange(2, 1, defaultCats.length, 8).setValues(defaultCats);
  }

  var list = getSheetObjects(sheet);

  list = list.map(function(c) {
    return {
      ID: c.ID,
      Nama: c.Nama,
      Tipe: c.Tipe,
      Ikon: c.Ikon,
      Warna: c.Warna,
      Aktif: (c.Aktif === true || String(c.Aktif).toLowerCase() === "true" || c.Aktif === 1),
      Custom: (c.Custom === true || String(c.Custom).toLowerCase() === "true" || c.Custom === 1),
      "Dibuat Oleh": c["Dibuat Oleh"] || "admin"
    };
  });

  if (!includeInactive) {
    list = list.filter(function(c) { return c.Aktif; });
  }
  return list;
}

function handleAddCategory(ss, data) {
  var sheet = resolveSheet(ss, "Categories");
  var list = getSheetObjects(sheet);

  var exists = list.some(function(c) {
    return String(c.Nama).toLowerCase() === String(data.nama).trim().toLowerCase() && c.Tipe === data.tipe;
  });
  if (exists) {
    throw new Error('Kategori "' + data.nama + '" untuk ' + data.tipe + ' sudah ada.');
  }

  var id = data.id || ("CAT-" + String(list.length + 1).padStart(3, '0'));
  var row = [
    id,
    String(data.nama).trim(),
    data.tipe,
    data.ikon || "📁",
    data.warna || "#3B82F6",
    true,
    true,
    data.dibuatOleh || "admin"
  ];

  sheet.appendRow(row);
  return {
    ID: id,
    Nama: row[1],
    Tipe: row[2],
    Ikon: row[3],
    Warna: row[4],
    Aktif: true,
    Custom: true,
    "Dibuat Oleh": row[7]
  };
}

function handleDeleteCategory(ss, id) {
  // Soft delete (ubah Aktif = false)
  return handleUpdateRow(ss, "Categories", "ID", id, { Aktif: false }, ["Aktif"]);
}

// =========================================================================
// USERS LOGIC
// =========================================================================

function handleGetUsers(ss) {
  var sheet = resolveSheet(ss, "Users");
  var list = getSheetObjects(sheet);

  return list.map(function(u) {
    return {
      ID: u.ID,
      Nama: u.Nama,
      Username: u.Username,
      Password: u.Password,
      Role: u.Role,
      Email: u.Email,
      "Telegram Chat ID": u["Telegram Chat ID"] || "",
      Aktif: (u.Aktif === true || String(u.Aktif).toLowerCase() === "true" || u.Aktif === 1),
      Dibuat: u.Dibuat
    };
  });
}

function handleGetUserByUsername(ss, username) {
  var users = handleGetUsers(ss);
  var q = String(username || '').toLowerCase().trim();

  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uName = String(u.Username || '').toLowerCase().trim();
    if (uName === q) return u;
    if (q === 'admin' && uName === 'risman') return u;
    if (q === 'risman' && uName === 'admin') return u;
    if (q === 'siti' && (uName === 'sitijulaeha' || uName === 'siti')) return u;
    if (q === 'sitijulaeha' && (uName === 'siti' || uName === 'sitijulaeha')) return u;
  }
  return null;
}

function handleAddUser(ss, data) {
  var sheet = resolveSheet(ss, "Users");
  var list = getSheetObjects(sheet);

  var existing = list.some(function(u) {
    return String(u.Username).toLowerCase() === String(data.username).toLowerCase();
  });
  if (existing) {
    throw new Error('Username "' + data.username + '" sudah digunakan.');
  }

  var id = data.id || ("USR-" + String(list.length + 1).padStart(3, '0'));
  var row = [
    id,
    data.nama,
    String(data.username).toLowerCase().trim(),
    data.password, // hashed password
    data.role || "anggota",
    data.email || "",
    data.telegramChatId || "",
    true,
    new Date().toISOString()
  ];

  sheet.appendRow(row);
  return {
    ID: id,
    Nama: data.nama,
    Username: row[2],
    Role: row[4],
    Email: row[5],
    "Telegram Chat ID": row[6],
    Aktif: true,
    Dibuat: row[8]
  };
}

function handleDeleteUser(ss, id) {
  // Soft delete
  return handleUpdateRow(ss, "Users", "ID", id, { Aktif: false }, ["Aktif"]);
}

// =========================================================================
// SETTINGS LOGIC
// =========================================================================

function handleGetSettings(ss) {
  var sheet = resolveSheet(ss, "Settings");
  var list = getSheetObjects(sheet);
  var settings = {};
  for (var i = 0; i < list.length; i++) {
    settings[list[i].Key] = list[i].Value;
  }
  return settings;
}

function handleUpdateSetting(ss, key, value) {
  var sheet = resolveSheet(ss, "Settings");
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(String(value));
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      var res = {};
      res[key] = value;
      return res;
    }
  }

  // Jika belum ada, tambahkan row baru
  sheet.appendRow([key, String(value), new Date().toISOString()]);
  var newRes = {};
  newRes[key] = value;
  return newRes;
}

// =========================================================================
// NOTIFIKASI LOG LOGIC
// =========================================================================

function handleGetNotificationLogs(ss) {
  var sheet = resolveSheet(ss, "Notifikasi_Log");
  var list = getSheetObjects(sheet);
  return list.reverse(); // Terbaru di atas
}

function handleAddNotificationLog(ss, data) {
  var sheet = resolveSheet(ss, "Notifikasi_Log");
  if (!sheet) return null;

  var id = "LOG-" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd-HHmmss") + "-" + Utilities.getUuid().substr(0, 4);
  var row = [
    id,
    data.tipe || "Pengingat",
    data.channel || "both",
    data.penerima || "",
    data.status || "sukses",
    new Date().toISOString()
  ];

  sheet.appendRow(row);
  return {
    ID: id,
    Tipe: row[1],
    Channel: row[2],
    Penerima: row[3],
    Status: row[4],
    "Waktu Kirim": row[5]
  };
}

// =========================================================================
// BATCH IMPORT DATA (Migrasi dari Excel ke Spreadsheet Sekali Jalan)
// =========================================================================
function handleBatchImport(ss, bundle) {
  var results = { categories: 0, users: 0, transactions: 0, settings: 0 };

  // 1. Categories
  if (bundle.categories && bundle.categories.length > 0) {
    var wsCat = getOrCreateSheet(ss, "Categories");
    setupHeader(wsCat, ["ID", "Nama", "Tipe", "Ikon", "Warna", "Aktif", "Custom", "Dibuat Oleh"]);
    if (wsCat.getLastRow() > 1) {
      wsCat.deleteRows(2, wsCat.getLastRow() - 1);
    }
    var catRows = bundle.categories.map(function(c) {
      return [c.ID, c.Nama, c.Tipe, c.Ikon, c.Warna, c.Aktif, c.Custom, c["Dibuat Oleh"] || "admin"];
    });
    wsCat.getRange(2, 1, catRows.length, catRows[0].length).setValues(catRows);
    results.categories = catRows.length;
  }

  // 2. Users
  if (bundle.users && bundle.users.length > 0) {
    var wsUsers = getOrCreateSheet(ss, "Users");
    setupHeader(wsUsers, ["ID", "Nama", "Username", "Password", "Role", "Email", "Telegram Chat ID", "Aktif", "Dibuat"]);
    if (wsUsers.getLastRow() > 1) {
      wsUsers.deleteRows(2, wsUsers.getLastRow() - 1);
    }
    var userRows = bundle.users.map(function(u) {
      return [u.ID, u.Nama, u.Username, u.Password, u.Role, u.Email || "", u["Telegram Chat ID"] || "", u.Aktif, u.Dibuat || new Date().toISOString()];
    });
    wsUsers.getRange(2, 1, userRows.length, userRows[0].length).setValues(userRows);
    results.users = userRows.length;
  }

  // 3. Transactions
  if (bundle.transactions && bundle.transactions.length > 0) {
    var wsTrx = getOrCreateSheet(ss, "Transactions");
    setupHeader(wsTrx, ["ID", "Tanggal", "Tipe", "Kategori", "Jumlah", "Keterangan", "User", "Dibuat", "Diubah"]);
    if (wsTrx.getLastRow() > 1) {
      wsTrx.deleteRows(2, wsTrx.getLastRow() - 1);
    }
    var trxRows = bundle.transactions.map(function(t) {
      return [t.ID, t.Tanggal, t.Tipe, t.Kategori, Number(t.Jumlah) || 0, t.Keterangan || "", t.User || "", t.Dibuat || new Date().toISOString(), t.Diubah || new Date().toISOString()];
    });
    wsTrx.getRange(2, 1, trxRows.length, trxRows[0].length).setValues(trxRows);
    results.transactions = trxRows.length;
  }

  // 4. Settings
  if (bundle.settings) {
    var wsSet = getOrCreateSheet(ss, "Settings");
    setupHeader(wsSet, ["Key", "Value", "Diubah"]);
    for (var k in bundle.settings) {
      handleUpdateSetting(ss, k, bundle.settings[k]);
    }
    results.settings = Object.keys(bundle.settings).length;
  }

  return results;
}
