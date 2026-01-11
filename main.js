// ==========================================
// 1. KONFIGURASI SUPABASE
// ==========================================
const SUPABASE_URL = 'https://arcgcwsacncqeqvtiyir.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyY2djd3NhY25jcWVxdnRpeWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNzAzMjcsImV4cCI6MjA4MzY0NjMyN30.gvPJkIjOS6jD9FDh6Ge7-fxYbbfYH08Pcv4aSKL0FkQ';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. VARIABEL GLOBAL
// ==========================================
let currentUser = null;
// --- 1. VARIABEL GLOBAL UNTUK TEKS WA ---
let namaTokoAktif = "Toko Saya";
let infoBank = "";
let infoRekening = "";
let infoFooter = "Terima kasih sudah berbelanja!";

//

// DOM Elements
const viewLogin = document.getElementById('view-login');
const viewApp = document.getElementById('view-app');
const listProduk = document.getElementById('list-produk');

// ==========================================
// 3. SISTEM AUTH
// ==========================================

async function cekSesi() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        bukaAplikasi();
    } else {
        viewLogin.classList.remove('hidden');
        viewApp.classList.remove('hidden'); // Trik biar transisi halus
        viewApp.style.display = 'none';     // Sembunyikan manual
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btn-login');

    if (!email || !password) return Swal.fire('Ups', 'Isi email & password dulu.', 'warning');

    btn.innerText = "Memproses...";
    btn.disabled = true;

    // 1. Coba Login
    let { data, error } = await db.auth.signInWithPassword({ email, password });

    // 2. Jika Gagal, Coba Daftar
    if (error) {
        const daftar = await db.auth.signUp({ email, password });
        if (daftar.error) {
            Swal.fire('Gagal', daftar.error.message, 'error');
            btn.innerText = "Masuk Aplikasi";
            btn.disabled = false;
            return;
        }
        if (daftar.data.session) {
            data = daftar.data;
        } else {
            Swal.fire('Info', 'Akun dibuat! Silakan login lagi.', 'info');
            btn.innerText = "Masuk Aplikasi";
            btn.disabled = false;
            return;
        }
    }

    if (data.session) {
        currentUser = data.user;
        bukaAplikasi();
    }
}

async function logout() {
    await db.auth.signOut();
    location.reload();
}


// UPDATE fungsi ini di main.js
async function bukaAplikasi() {
    // 1. Cek dulu, boleh masuk gak?
    const bolehMasuk = await cekStatusBayar();
    
    // Kalau gak boleh masuk, STOP di sini. Jangan tampilkan data.
    if (!bolehMasuk) return; 

    // 2. Kalau boleh, lanjut buka aplikasi normal
    viewLogin.style.display = 'none';
    viewApp.classList.remove('hidden');
    viewApp.style.display = 'flex';
    
    // Load Data
    muatPengaturan(); // <
    muatProfilToko();
    ambilData();
    hitungOmzet();
}


// ==========================================
// 4. MANAJEMEN PRODUK
// ==========================================

async function ambilData() {
    listProduk.innerHTML = '<div class="text-center py-10 opacity-50">Loading...</div>';
    const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });

    if (error) listProduk.innerHTML = '<p class="text-center text-red-500">Error</p>';
    else renderList(data);
}

function renderList(products) {
    if (!products || products.length === 0) {
        listProduk.innerHTML = `
            <div class="text-center py-10 flex flex-col items-center opacity-60">
                <span class="text-4xl mb-2">📦</span>
                <p class="text-sm">Belum ada barang</p>
            </div>`;
        return;
    }

    const html = products.map(item => `
        <div class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center mb-2">
            <div class="w-full pr-2">
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-gray-800 text-sm">${item.nama_produk}</h4>
                    <button onclick="hapusProduk('${item.id}', '${item.nama_produk}')" class="text-gray-300 hover:text-red-500">✕</button>
                </div>
                <p class="font-bold text-blue-600 text-sm">Rp ${Number(item.harga).toLocaleString('id-ID')}</p>
            </div>
            <button onclick="kirimInvoice('${item.nama_produk}', ${item.harga})" class="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </button>
        </div>
    `).join('');

    listProduk.innerHTML = html;
}

async function simpanProduk() {
    const nama = document.getElementById('input-nama').value;
    const harga = document.getElementById('input-harga').value;
    
    if (!nama || !harga) return Swal.fire('Eits', 'Isi nama & harga dulu.', 'warning');

    const { error } = await db.from('products').insert([{ nama_produk: nama, harga: harga, stok: 10 }]);
    
    if (error) {
        Swal.fire('Gagal', error.message, 'error');
    } else {
        document.getElementById('input-nama').value = '';
        document.getElementById('input-harga').value = '';
        ambilData();
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
        Toast.fire({ icon: 'success', title: 'Disimpan' });
    }
}

async function hapusProduk(id, nama) {
    const result = await Swal.fire({
        title: 'Hapus Produk?',
        text: `Yakin ingin menghapus "${nama}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });
        
        const { error } = await db.from('products').delete().eq('id', id);

        if (error) {
            Swal.fire('Gagal', error.message, 'error');
        } else {
            Swal.fire('Terhapus!', 'Produk berhasil dihilangkan.', 'success');
            ambilData(); // Refresh list
        }
    }
}

// ==========================================
// 5. TRANSAKSI & OMZET (HEADER BARU)
// ==========================================



async function kirimInvoice(namaProduk, harga) {
    // 1. Cek Kuota Trial (Tetap ada)
    const { data: profil } = await db.from('profiles').select('status_langganan').eq('id', currentUser.id).maybeSingle();
    
    if (profil && profil.status_langganan === 'trial') {
        const { count } = await db.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
        if (count >= 50) {
            Swal.fire({
                title: 'Kuota Trial Habis!',
                text: 'Silakan upgrade ke Premium untuk transaksi tanpa batas.',
                icon: 'info'
            }).then(() => {
                document.getElementById('paywall-screen').classList.remove('hidden');
            });
            return;
        }
    }

    // 2. Konfirmasi Jual
    const result = await Swal.fire({
        title: 'Proses Penjualan',
        text: `Kirim invoice untuk ${namaProduk}?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Kirim WA',
        confirmButtonColor: '#10B981'
    });

    if (result.isConfirmed) {
        const hargaAngka = Number(harga);
        const { data, error } = await db.from('invoices').insert([{ nama_produk: namaProduk, harga_terjual: hargaAngka }]).select();

        if (error) return Swal.fire('Gagal', error.message, 'error');

        // --- FORMAT BARU (LEBIH PRO) ---
        const notaID = Math.floor(1000 + Math.random() * 9000); // Nomor acak 4 digit
        const waktu = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
        
        let pesan = `*INVOICE DIGITAL - ${namaTokoAktif}*\n`;
        pesan += `------------------------------------------\n`;
        pesan += `No. Nota : #SK-${notaID}\n`;
        pesan += `Tanggal  : ${waktu}\n`;
        pesan += `------------------------------------------\n\n`;
        pesan += `*DETAIL PESANAN*\n`;
        pesan += `🔹 ${namaProduk}\n`;
        pesan += `💰 *TOTAL : Rp ${hargaAngka.toLocaleString('id-ID')}*\n\n`;
        pesan += `------------------------------------------\n`;
        
        if(infoBank && infoRekening) {
            pesan += `*METODE PEMBAYARAN*\n`;
            pesan += `🏦 ${infoBank} : ${infoRekening}\n\n`;
        }
        
        pesan += `_${infoFooter}_`;

        window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
        hitungOmzet();
    }
}


async function hitungOmzet() {
    // Ambil data untuk header
    const { data } = await db.from('invoices').select('harga_terjual, created_at').limit(500);
    
    if (data) {
        const hariIni = new Date().toLocaleDateString('en-CA');
        const transaksiHariIni = data.filter(item => {
            return new Date(item.created_at).toLocaleDateString('en-CA') === hariIni;
        });

        // Hitung Total Uang
        const totalUang = transaksiHariIni.reduce((acc, item) => acc + item.harga_terjual, 0);
        // Hitung Jumlah Transaksi
        const totalTrx = transaksiHariIni.length;

        // Update Header Baru
        document.getElementById('total-omzet').innerText = 'Rp ' + Number(totalUang).toLocaleString('id-ID');
        document.getElementById('total-trx').innerText = totalTrx;
    }
}

// --- FITUR RESET OMZET (UPDATE) ---

async function resetOmzet() {
    const result = await Swal.fire({
        title: 'Hapus Data Hari Ini?',
        text: "Semua riwayat penjualan akan dihapus permanen.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Nol-kan!',
        cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });

        // PERBAIKAN DI SINI:
        // Ganti angka 0 dengan UUID Kosong
        const { error } = await db.from('invoices')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); 

        if (error) {
            Swal.fire('Gagal Reset', error.message, 'error');
        } else {
            hitungOmzet(); 
            Swal.fire('Beres!', 'Omzet kembali bersih.', 'success');
        }
    }
}


// ==========================================
// 6. PENGATURAN & NAVIGASI
// ==========================================

async function muatProfilToko() {
    const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    
    if (data) {
        namaTokoAktif = data.nama_toko || "SimpelKas";
        infoBank = data.bank || "";
        infoRekening = data.rekening || "";
        infoFooter = data.footer || "Terima kasih!";
        
        // Isi Form di Tab Akun
        document.getElementById('input-toko').value = namaTokoAktif;
        document.getElementById('input-bank').value = infoBank;
        document.getElementById('input-norek').value = infoRekening;
        document.getElementById('input-footer').value = infoFooter;
    }
}


// --- 2. FUNGSI MUAT PENGATURAN (Panggil ini saat aplikasi dibuka) ---
async function muatPengaturan() {
    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

    if (data) {
        // Masukkan ke variabel global
        namaTokoAktif = data.nama_toko || "Toko Saya";
        infoBank = data.bank || "";
        infoRekening = data.rekening || "";
        infoFooter = data.footer || "Terima kasih!";

        // Masukkan ke kolom input agar user bisa lihat data lama
        document.getElementById('input-toko').value = namaTokoAktif;
        document.getElementById('input-bank').value = infoBank;
        document.getElementById('input-norek').value = infoRekening;
        document.getElementById('input-footer').value = infoFooter;
    }
}

// --- 3. FUNGSI SIMPAN PENGATURAN (Dipanggil saat klik tombol) ---
async function simpanPengaturan() {
    const dataUpdate = {
        nama_toko: document.getElementById('input-toko').value,
        bank: document.getElementById('input-bank').value,
        rekening: document.getElementById('input-norek').value,
        footer: document.getElementById('input-footer').value
    };

    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });

    const { error } = await db
        .from('profiles')
        .update(dataUpdate)
        .eq('id', currentUser.id);

    if (error) {
        Swal.fire('Gagal', error.message, 'error');
    } else {
        // Update variabel global saat itu juga agar teks WA berubah instan
        namaTokoAktif = dataUpdate.nama_toko;
        infoBank = dataUpdate.bank;
        infoRekening = dataUpdate.rekening;
        infoFooter = dataUpdate.footer;

        Swal.fire('Berhasil!', 'Pengaturan teks WA diperbarui.', 'success');
    }
}

// --- SISTEM LANGGANAN (PRO) ---

async function cekStatusBayar() {
    // Ambil data status dari tabel profiles
    const { data } = await db
        .from('profiles')
        .select('status_langganan')
        .eq('id', currentUser.id)
        .maybeSingle();

    // Jika statusnya 'expired' atau 'nonaktif' -> KUNCI!
    if (data && (data.status_langganan === 'expired' || data.status_langganan === 'nonaktif')) {
        document.getElementById('paywall-screen').classList.remove('hidden'); // Munculkan Gembok
        document.getElementById('view-app').classList.add('blur-sm'); // Blur aplikasi belakangnya
        return false; // Berhenti, jangan lanjut
    }
    
    // Jika aman (active/trial), sembunyikan gembok (jaga-jaga)
    document.getElementById('paywall-screen').classList.add('hidden');
    document.getElementById('view-app').classList.remove('blur-sm');
    return true; // Lanjut
}

function bayarLangganan() {
    // WAJIB: Nomor WA Asli (Tujuannya biar mereka chat kamu buat kirim bukti transfer)
    const nomorHP = "6288971071138"; 
    
    const emailUser = currentUser.email;
    const pesan = `Halo Admin, akun saya (${emailUser}) mau perpanjang langganan SimpelKas Premium.`;
    
    window.open(`https://wa.me/${nomorHP}?text=${encodeURIComponent(pesan)}`, '_blank');
}


function bukaTab(tabName) {
    const tabKasir = document.getElementById('tab-kasir');
    const tabAkun = document.getElementById('tab-akun');
    const navKasir = document.getElementById('nav-kasir');
    const navAkun = document.getElementById('nav-akun');

    if (tabName === 'kasir') {
        tabKasir.classList.remove('hidden');
        tabAkun.classList.add('hidden');
        // Warna Tombol
        navKasir.classList.remove('text-gray-400'); navKasir.classList.add('text-blue-600');
        navAkun.classList.remove('text-blue-600'); navAkun.classList.add('text-gray-400');
    } else {
        tabKasir.classList.add('hidden');
        tabAkun.classList.remove('hidden');
        // Warna Tombol
        navAkun.classList.remove('text-gray-400'); navAkun.classList.add('text-blue-600');
        navKasir.classList.remove('text-blue-600'); navKasir.classList.add('text-gray-400');
        
        muatProfilToko();
    }
}

function kontakWA() {
    // WAJIB: Ganti ini dengan NOMOR WA ASLI kamu (Format 62...)
    const nomorHP = "6288971071138"; 
    
    // Link Vercel taruh di sini (di dalam pesan) biar klien lihat
    const portfolio = "https://ilham-pradani-cv-porto-phi-pied.vercel.app/";
    
    const pesan = `Halo Mas Ilham, saya lihat portofolio di ${portfolio}.\nSaya tertarik mau buat aplikasi custom.`;
    
    window.open(`https://wa.me/${nomorHP}?text=${encodeURIComponent(pesan)}`, '_blank');
}

// START
cekSesi();