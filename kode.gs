// ID Spreadsheet Anda
const SPREADSHEET_ID = '1T7IB7rVSkvZqsnbbPATN0sj9Wup_ukTb2LzfhqZ4OHo'; // Ganti dengan ID Google Sheet Anda
const SHEET_NAME = 'Task1'; // Nama sheet tempat data tugas disimpan

// Konfigurasi Telegram Bot
const TELEGRAM_BOT_TOKEN = '8317197414:AAFBgc-rcNqsC3D0StNFub5iw-yAfM3kyLY'; // Ganti dengan token bot Telegram Anda
const TELEGRAM_CHAT_ID = ' -1003286615923'; // Ganti dengan chat ID grup/personal Telegram Anda

// --- Fungsi Utama untuk Penanganan Permintaan Web (doGet dan doPost) ---

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getTasks') {
    return handleGetTasks(e);
  } else {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const action = e.parameter.action;

  if (action === 'markTask') {
    return handleMarkTask(e);
  } else if (action === 'approveTask') { // Untuk admin nanti
    return handleApproveTask(e);
  }
  else {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// --- Fungsi Pembantu untuk Interaksi Google Sheet ---

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME);
}

function getHeaderRow(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function getRowsAsObjects(sheet) {
  const header = getHeaderRow(sheet);
  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  const objects = data.map(row => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
  return objects;
}

// --- Handler untuk Permintaan Frontend ---

function handleGetTasks(e) {
  const day = e.parameter.day;
  const studentEmail = e.parameter.email;

  if (!day || !studentEmail) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing day or email parameter.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet();
  const allTasks = getRowsAsObjects(sheet);

  // Filter tugas berdasarkan hari dan email siswa
  const filteredTasks = allTasks.filter(task =>
    task.Day === day && task.StudentEmail === studentEmail
  );

  // Jika belum ada tugas yang terekam untuk hari dan siswa ini,
  // kita mungkin ingin menginisialisasi dari jadwal di frontend.
  // Namun, untuk kesederhanaan, kita hanya akan mengembalikan yang ada.
  // Frontend akan membandingkan dengan jadwal lokalnya.
  const responseTasks = filteredTasks.map(task => ({
    id: task.ID,
    subject: task.Subject,
    teacher: task.Teacher,
    isCompleted: task.IsCompleted,
    adminApproved: task.AdminApproved
  }));

  return ContentService.createTextOutput(JSON.stringify(responseTasks))
    .setMimeType(ContentService.MimeType.JSON);
}


function handleMarkTask(e) {
  const id = e.parameter.id; // Bisa ID yang sudah ada atau yang dibuat frontend
  const subject = e.parameter.subject;
  const teacher = e.parameter.teacher;
  const day = e.parameter.day;
  const studentEmail = e.parameter.email;
  const isCompleted = e.parameter.isCompleted === 'true'; // Konversi ke boolean

  if (!subject || !day || !studentEmail) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing parameters.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet();
  const header = getHeaderRow(sheet);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  let rowToUpdate = -1;
  let existingTaskId = null;

  // Cari tugas berdasarkan Subject, Day, dan StudentEmail
  for (let i = 1; i < values.length; i++) { // Mulai dari baris kedua (indeks 1)
    const row = values[i];
    const rowObj = {};
    header.forEach((h, colIndex) => {
      rowObj[h] = row[colIndex];
    });

    if (rowObj.Subject === subject && rowObj.Day === day && rowObj.StudentEmail === studentEmail) {
      rowToUpdate = i;
      existingTaskId = rowObj.ID;
      break;
    }
  }

  if (rowToUpdate !== -1) {
    // Tugas sudah ada, update statusnya
    sheet.getRange(rowToUpdate + 1, header.indexOf('IsCompleted') + 1).setValue(isCompleted);
    sheet.getRange(rowToUpdate + 1, header.indexOf('AdminApproved') + 1).setValue(false); // Reset persetujuan admin
    sheet.getRange(rowToUpdate + 1, header.indexOf('CompletionDate') + 1).setValue(isCompleted ? new Date() : '');
  } else {
    // Tugas belum ada, tambahkan baris baru
    const newID = Utilities.getUuid(); // Buat ID unik
    const newRow = [
      newID,
      day,
      subject,
      teacher,
      studentEmail,
      isCompleted,
      false, // AdminApproved default false
      isCompleted ? new Date() : ''
    ];
    sheet.appendRow(newRow);
    existingTaskId = newID; // Gunakan ID baru untuk notifikasi
  }

  // Kirim notifikasi Telegram jika tugas ditandai selesai
  if (isCompleted) {
    sendTelegramNotification(day, subject, studentEmail);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Task updated successfully', taskId: existingTaskId }))
    .setMimeType(ContentService.MimeType.JSON);
}


// --- Fungsi untuk Admin (bisa diakses dari UI admin terpisah atau Google Sheet langsung) ---

function handleApproveTask(e) {
  // Hanya admin yang bisa memanggil fungsi ini.
  // Anda mungkin perlu implementasi mekanisme otorisasi lebih lanjut di sini (misalnya, memeriksa email admin yang diizinkan).
  const taskId = e.parameter.id;
  const adminEmail = e.parameter.adminEmail; // Admin yang menyetujui

  if (!taskId || !adminEmail) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing task ID or admin email.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = getSheet();
  const header = getHeaderRow(sheet);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  let taskToApprove = null;
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][header.indexOf('ID')] === taskId) {
      taskToApprove = values[i];
      rowIndex = i;
      break;
    }
  }

  if (taskToApprove && taskToApprove[header.indexOf('IsCompleted')] === true) {
    sheet.getRange(rowIndex + 1, header.indexOf('AdminApproved') + 1).setValue(true);
    // Tambahkan log admin yang menyetujui jika perlu
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Task approved successfully.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (taskToApprove && taskToApprove[header.indexOf('IsCompleted')] === false) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Task is not yet completed by student.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  else {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Task not found.' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// --- Fungsi Integrasi Telegram ---

function sendTelegramNotification(day, subject, studentEmail) {
  const message = `🔔 *Pemberitahuan Tugas Baru!* 🔔\n\n` +
                  `Siswa: ${studentEmail}\n` +
                  `Hari: ${day}\n` +
                  `Mata Pelajaran: ${subject}\n\n` +
                  `Telah menandai tugasnya sebagai selesai dan sedang menunggu persetujuan admin.`;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const options = {
    'method': 'post',
    'payload': {
      'chat_id': TELEGRAM_CHAT_ID,
      'text': message,
      'parse_mode': 'Markdown'
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    Logger.log('Telegram API response: ' + response.getContentText());
  } catch (e) {
    Logger.log('Error sending Telegram notification: ' + e.toString());
  }
}

// --- Fungsi untuk Inisialisasi Database Awal (Opsional) ---
// Fungsi ini bisa dijalankan sekali untuk mengisi Google Sheet dengan jadwal awal.
// Ini hanya contoh, karena frontend akan membandingkan dan menambahkan.
function initializeTasksFromSchedule() {
  const sheet = getSheet();
  const header = getHeaderRow(sheet);

  // Pastikan header sudah benar
  const expectedHeader = ['ID', 'Day', 'Subject', 'Teacher', 'StudentEmail', 'IsCompleted', 'AdminApproved', 'CompletionDate'];
  const headerMismatch = expectedHeader.some((h, i) => header[i] !== h);
  if (headerMismatch) {
    Logger.log("Header mismatch! Please ensure your Google Sheet has the correct headers: " + expectedHeader.join(', '));
    return;
  }

  // Mengosongkan data yang ada (hati-hati saat menggunakan ini di produksi)
  // sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();

  const allRows = [];
  const daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

  // Jadwal Pelajaran (Duplikasi dari Frontend untuk inisialisasi)
  const masterSchedule = {
      "Senin": [
          { subject: "Matematika Tk. Lanjut", teacher: "Slamet Riadi" },
          { subject: "PKWU", teacher: "Isti’anah" },
          { subject: "Seni Budaya", teacher: "Dyah Iswarini" },
          { subject: "Bahasa Inggris", teacher: "Tjitjik Siti Munifah" },
          { subject: "Mulok Jawa", teacher: "Eksa Hertin Probowati" },
          { subject: "Informatika", teacher: "Sigit Hadi Waluyo" }
      ],
      "Selasa": [
          { subject: "Matematika Tk. Lanjut", teacher: "Slamet Riadi" },
          { subject: "Matematika", teacher: "Suharto" },
          { subject: "Bahasa Indonesia", teacher: "Muh. Sholehuddin" },
          { subject: "PABP", teacher: "Saleh" },
          { subject: "Sejarah", teacher: "Mis Endang Sutin" },
          { subject: "Geografi", teacher: "Suci Romadoni" }
      ],
      "Rabu": [
          { subject: "PPKn", teacher: "Solihin Bahari" },
          { subject: "Bahasa Inggris", teacher: "Tjitjik Siti Munifah" },
          { subject: "Geografi", teacher: "Suci Romadoni" },
          { subject: "Informatika", teacher: "Sigit Hadi Waluyo" },
          { subject: "Bahasa Indonesia", teacher: "Muh. Sholehuddin" },
          { subject: "Fisika", teacher: "Ita Dwi Irawati" }
      ],
      "Kamis": [
          { subject: "Fisika", teacher: "Ita Dwi Irawati" },
          { subject: "Matematika", teacher: "Suharto" },
          { subject: "Matematika Tk. Lanjut", teacher: "Slamet Riadi" },
          { subject: "Informatika", teacher: "Sigit Hadi Waluyo" },
          { subject: "BK", teacher: "Anung Bayu Saptowo" },
          { subject: "Geografi", teacher: "Suci Romadoni" }
      ],
      "Jumat": [
          { subject: "PJOK", teacher: "Tito Januar" },
          { subject: "Fisika", teacher: "Ita Dwi Irawati" }
      ]
  };

  // Anda bisa mengisi ini dengan daftar email siswa yang diizinkan untuk menguji inisialisasi
  // const studentEmails = ['siswa1@example.com', 'siswa2@example.com'];
  // Contoh sederhana, kita tidak inisialisasi semua tugas untuk semua siswa di sini.
  // Data akan dibuat ketika siswa pertama kali menandai tugas.
  Logger.log("Ini adalah fungsi inisialisasi opsional. Tugas akan dibuat otomatis saat siswa menandai selesai.");
}
