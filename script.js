// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCt270LSDtenYrUwDklX49eXno22pJKwWM",
  authDomain: "schooltodolist-33f05.firebaseapp.com",
  projectId: "schooltodolist-33f05",
  storageBucket: "schooltodolist-33f05.firebasestorage.app",
  messagingSenderId: "92850422234",
  appId: "1:92850422234:web:28cb16300c63126cbbc0e3",
  measurementId: "G-3407L7BB0G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Elemen DOM
const authContainer = document.getElementById('auth-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const userGreeting = document.getElementById('user-greeting');
const daySelector = document.querySelector('.day-selector');
const taskList = document.getElementById('task-list');

let currentUser = null; // Menyimpan informasi pengguna yang sedang login
let currentDay = "Senin"; // Hari default

// Jadwal Pelajaran (Data Frontend)
const schedule = {
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

// Fungsi untuk mengelola UI berdasarkan status login
function updateUI(user) {
    if (user) {
        currentUser = user;
        authContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        userGreeting.textContent = `Halo, ${user.displayName || user.email}!`;
        renderTasks(currentDay); // Muat tugas untuk hari ini
    } else {
        currentUser = null;
        authContainer.style.display = 'block';
        dashboardContainer.style.display = 'none';
        taskList.innerHTML = ''; // Kosongkan daftar tugas
    }
}

// Event listener untuk Login Google
loginButton.addEventListener('click', () => {
    auth.signInWithPopup(provider)
        .then((result) => {
            // Pengguna berhasil login
            console.log('User logged in:', result.user);
        })
        .catch((error) => {
            console.error('Login error:', error);
            alert('Gagal login dengan Google: ' + error.message);
        });
});

// Event listener untuk Logout
logoutButton.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            console.log('User logged out');
        })
        .catch((error) => {
            console.error('Logout error:', error);
            alert('Gagal logout: ' + error.message);
        });
});

// Memantau perubahan status autentikasi
auth.onAuthStateChanged((user) => {
    updateUI(user);
});

// Fungsi untuk render daftar tugas
async function renderTasks(day) {
    taskList.innerHTML = 'Loading tasks...';
    const dailySchedule = schedule[day];
    if (!dailySchedule || dailySchedule.length === 0) {
        taskList.innerHTML = '<p>Tidak ada tugas untuk hari ini.</p>';
        return;
    }

    try {
        // Panggil Google Apps Script untuk mendapatkan status tugas dari Google Sheet
        const response = await fetch('https://script.google.com/macros/s/AKfycbzJtgajo4DWLGy9SnyW9FqQfGpHrjsh3cSa9Brc-kdVIHdh0QsXjYPhJYEHZ_HxyEDMig/exec' + day + '&email=' + currentUser.email);
        const taskStatus = await response.json(); // Akan berisi array objek { subject, isCompleted, adminApproved, id }

        taskList.innerHTML = ''; // Kosongkan sebelum mengisi
        dailySchedule.forEach((item, index) => {
            const taskData = taskStatus.find(ts => ts.subject === item.subject);
            const isCompleted = taskData ? (taskData.isCompleted === true || taskData.isCompleted === 'TRUE') : false; // Handle boolean dari GS
            const adminApproved = taskData ? (taskData.adminApproved === true || taskData.adminApproved === 'TRUE') : false; // Handle boolean dari GS
            const taskId = taskData ? taskData.id : `task-${day}-${index}`; // Gunakan ID dari GS jika ada

            const taskItem = document.createElement('div');
            taskItem.className = `task-item ${isCompleted ? 'completed' : ''}`;
            taskItem.dataset.taskId = taskId;

            taskItem.innerHTML = `
                <input type="checkbox" id="${taskId}" ${isCompleted ? 'checked' : ''} ${isCompleted ? 'disabled' : ''}>
                <div class="task-details">
                    <h3>${item.subject}</h3>
                    <p>Guru: ${item.teacher}</p>
                </div>
                ${isCompleted ? `<span class="admin-status ${adminApproved ? 'approved' : 'pending'}">${adminApproved ? 'Disetujui Admin' : 'Menunggu Persetujuan'}</span>` : ''}
            `;
            taskList.appendChild(taskItem);

            const checkbox = taskItem.querySelector(`#${taskId}`);
            // Hanya tambahkan event listener jika belum selesai
            if (!isCompleted) {
                checkbox.addEventListener('change', () => handleTaskCompletion(taskId, item.subject, item.teacher, day, checkbox.checked));
            }
        });
    } catch (error) {
        console.error("Error fetching tasks:", error);
        taskList.innerHTML = '<p>Gagal memuat tugas. Silakan coba lagi nanti.</p>';
    }
}

// Fungsi untuk menangani penandaan tugas selesai
async function handleTaskCompletion(taskId, subject, teacher, day, isCompleted) {
    if (!currentUser) {
        alert("Anda harus login untuk menandai tugas.");
        return;
    }

    // Konfirmasi dari pengguna
    const confirmation = confirm(`Apakah Anda yakin ingin menandai "${subject}" sebagai ${isCompleted ? 'selesai' : 'belum selesai'}?`);
    if (!confirmation) {
        // Batalkan perubahan checkbox jika pengguna membatalkan
        const checkbox = document.getElementById(taskId);
        checkbox.checked = !isCompleted;
        return;
    }

    try {
        const response = await fetch('YOUR_APPS_SCRIPT_WEB_APP_URL', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'markTask',
                id: taskId,
                subject: subject,
                teacher: teacher,
                day: day,
                email: currentUser.email,
                isCompleted: isCompleted,
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            alert('Tugas berhasil diperbarui!');
            renderTasks(day); // Muat ulang tugas untuk memperbarui tampilan
        } else {
            alert('Gagal memperbarui tugas: ' + result.message);
            // Kembalikan status checkbox jika gagal
            const checkbox = document.getElementById(taskId);
            checkbox.checked = !isCompleted;
        }
    } catch (error) {
        console.error("Error marking task:", error);
        alert('Terjadi kesalahan saat memperbarui tugas.');
        // Kembalikan status checkbox jika gagal
        const checkbox = document.getElementById(taskId);
        checkbox.checked = !isCompleted;
    }
}


// Event listener untuk pemilihan hari
daySelector.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
        // Hapus kelas 'active' dari semua tombol
        document.querySelectorAll('.day-selector button').forEach(btn => btn.classList.remove('active'));
        // Tambahkan kelas 'active' ke tombol yang diklik
        event.target.classList.add('active');
        currentDay = event.target.dataset.day;
        if (currentUser) {
            renderTasks(currentDay);
        }
    }
});

// Inisialisasi: set hari default menjadi hari ini
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const todayIndex = new Date().getDay(); // 0 = Minggu, 1 = Senin, dst.
let initialDay = days[todayIndex];
if (todayIndex === 0 || todayIndex === 6) { // Jika hari Minggu atau Sabtu
    initialDay = "Senin"; // Default ke Senin
}

currentDay = initialDay;
const initialDayButton = document.querySelector(`.day-selector button[data-day="${initialDay}"]`);
if (initialDayButton) {
    initialDayButton.classList.add('active');
}
