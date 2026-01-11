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
let namaTokoAktif = "Toko Saya";
let infoBank = "";
let infoRekening = "";
let infoFooter = "Terima kasih!";
let keranjang = [];

const viewLogin = document.getElementById('view-login');
const viewApp = document.getElementById('view-app');
const listProduk = document.getElementById('list-produk');

// ==========================================
// 3. SISTEM AUTH (AUTO-LOGIN FIX)
// ==========================================

// Panggil fungsi cekSesi otomatis saat web dibuka
window.onload = cekSesi;

async function cekSesi() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        currentUser = session.user;
        bukaAplikasi();
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    Swal.fire({ title: 'Menyambungkan...', didOpen: () => Swal.showLoading() });

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
        // Jika belum ada akun, daftarkan
        const { data: up, error: upError } = await db.auth.signUp({ email, password });
        if (upError) return Swal.fire('Error', upError.message, 'error');
        Swal.fire('Akun Dibuat', 'Silakan klik Masuk sekali lagi', 'success');
    } else {
        currentUser = data.user;
        bukaAplikasi();
        Swal.close();
    }
}

async function logout() {
    await db.auth.signOut();
    location.reload(); 
}

async function bukaAplikasi() {
    viewLogin.style.display = 'none';
    viewApp.classList.remove('hidden');
    await muatProfilToko();
    ambilData();
    hitungOmzet();
}

// ==========================================
// 4. MANAJEMEN PRODUK
// ==========================================

async function ambilData() {
    const { data, error } = await db.from('products')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    if (data) renderList(data);
}

function renderList(products) {
    if (products.length === 0) {
        listProduk.innerHTML = `<p class="text-center text-gray-400 py-10">Belum ada barang</p>`;
        return;
    }
    listProduk.innerHTML = products.map(item => `
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center mb-3">
            <div class="flex-1">
                <div class="flex justify-between">
                    <h4 class="font-bold text-gray-800 text-sm">${item.nama_produk}</h4>
                    <button onclick="hapusProduk('${item.id}', '${item.nama_produk}')" class="text-gray-300">✕</button>
                </div>
                <p class="font-bold text-blue-600 text-sm">Rp ${Number(item.harga).toLocaleString('id-ID')}</p>
            </div>
            <button onclick="tambahKeKeranjang('${item.nama_produk}', ${item.harga})" class="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center ml-4 active:scale-90 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            </button>
        </div>
    `).join('');
}

async function tambahProduk() {
    const { value: formValues } = await Swal.fire({
        title: 'Tambah Produk',
        html:
            '<input id="swal-nama" class="swal2-input" placeholder="Nama Barang">' +
            '<input id="swal-harga" type="number" class="swal2-input" placeholder="Harga Jual">',
        focusConfirm: false,
        showCancelButton: true,
        preConfirm: () => {
            return [
                document.getElementById('swal-nama').value,
                document.getElementById('swal-harga').value
            ]
        }
    });

    if (formValues && formValues[0] && formValues[1]) {
        const { error } = await db.from('products').insert([
            { nama_produk: formValues[0], harga: Number(formValues[1]), user_id: currentUser.id }
        ]);
        if (error) Swal.fire('Gagal', error.message, 'error');
        else ambilData();
    }
}

async function hapusProduk(id, nama) {
    const res = await Swal.fire({ title: 'Hapus?', text: nama, icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        await db.from('products').delete().eq('id', id);
        ambilData();
    }
}

// ==========================================
// 5. SISTEM KERANJANG
// ==========================================

function tambahKeKeranjang(nama, harga) {
    const itemAda = keranjang.find(i => i.nama === nama);
    if (itemAda) { itemAda.jumlah += 1; } 
    else { keranjang.push({ nama, harga, jumlah: 1 }); }
    updateTampilanKeranjang();
}

function updateTampilanKeranjang() {
    const preview = document.getElementById('cart-preview');
    const list = document.getElementById('list-item-keranjang');
    const totalDisplay = document.getElementById('total-tagihan-keranjang');
    if (keranjang.length === 0) { preview.classList.add('hidden'); return; }
    preview.classList.remove('hidden');
    let total = 0;
    list.innerHTML = keranjang.map((item, idx) => {
        total += (item.harga * item.jumlah);
        return `<div class="flex justify-between text-xs mb-1"><span>${item.jumlah}x ${item.nama}</span><b>Rp ${(item.harga * item.jumlah).toLocaleString()}</b></div>`;
    }).join('');
    totalDisplay.innerText = `Rp ${total.toLocaleString()}`;
}

function kosongkanKeranjang() {
    keranjang = [];
    updateTampilanKeranjang();
}

async function prosesCheckout() {
    const total = keranjang.reduce((acc, i) => acc + (i.harga * i.jumlah), 0);
    const teksProduk = keranjang.map(i => `${i.jumlah}x ${i.nama}`).join(', ');
    
    const { error } = await db.from('invoices').insert([{ nama_produk: teksProduk, harga_terjual: total, user_id: currentUser.id }]);
    
    let pesan = `*STRUK - ${namaTokoAktif}*\n----------\n`;
    keranjang.forEach(i => pesan += `📦 ${i.nama} (${i.jumlah}x)\n`);
    pesan += `----------\n*TOTAL: Rp ${total.toLocaleString()}*\n\n${infoFooter}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
    kosongkanKeranjang();
    hitungOmzet();
}

// ==========================================
// 6. PENGATURAN & OMZET
// ==========================================

async function muatProfilToko() {
    const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    if (data) {
        namaTokoAktif = data.nama_toko || "Toko Saya";
        infoBank = data.bank || "";
        infoRekening = data.rekening || "";
        infoFooter = data.footer || "Terima kasih!";
        document.getElementById('nama-toko-display').innerText = namaTokoAktif;
        document.getElementById('input-toko').value = namaTokoAktif;
        document.getElementById('input-bank').value = infoBank;
        document.getElementById('input-norek').value = infoRekening;
        document.getElementById('input-footer').value = infoFooter;
    }
}

async function simpanPengaturan() {
    const dataUpdate = {
        id: currentUser.id,
        nama_toko: document.getElementById('input-toko').value,
        bank: document.getElementById('input-bank').value,
        rekening: document.getElementById('input-norek').value,
        footer: document.getElementById('input-footer').value
    };
    await db.from('profiles').upsert(dataUpdate);
    namaTokoAktif = dataUpdate.nama_toko;
    document.getElementById('nama-toko-display').innerText = namaTokoAktif;
    Swal.fire('Tersimpan', '', 'success');
}

async function hitungOmzet() {
    const { data } = await db.from('invoices').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
    if (data) {
        const total = data.reduce((acc, i) => acc + i.harga_terjual, 0);
        document.getElementById('total-omzet').innerText = 'Rp ' + total.toLocaleString();
        document.getElementById('total-trx').innerText = data.length;
        
        const listR = document.getElementById('list-riwayat');
        listR.innerHTML = data.slice(0, 10).map(i => `
            <div class="flex justify-between text-[10px] border-b pb-1 mb-1">
                <span>${i.nama_produk}</span>
                <b class="text-green-600">Rp ${i.harga_terjual.toLocaleString()}</b>
            </div>
        `).join('');
    }
}

async function resetOmzet() {
    const res = await Swal.fire({ title: 'Reset?', text: 'Hapus semua riwayat jualan?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        await db.from('invoices').delete().eq('user_id', currentUser.id);
        hitungOmzet();
    }
}

function bukaTab(tabName) {
    const k = document.getElementById('tab-kasir');
    const a = document.getElementById('tab-akun');
    const nk = document.getElementById('nav-kasir');
    const na = document.getElementById('nav-akun');
    if (tabName === 'kasir') {
        k.classList.remove('hidden'); a.classList.add('hidden');
        nk.classList.add('text-blue-600'); nk.classList.remove('text-gray-400');
        na.classList.add('text-gray-400'); na.classList.remove('text-blue-600');
    } else {
        a.classList.remove('hidden'); k.classList.add('hidden');
        na.classList.add('text-blue-600'); na.classList.remove('text-gray-400');
        nk.classList.add('text-gray-400'); nk.classList.remove('text-blue-600');
        muatProfilToko();
    }
}

function kontakWA() {
    window.open(`https://wa.me/6288971071138?text=Halo%20Admin%20SimpelKas`, '_blank');
}