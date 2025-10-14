const express = require('express');
const session = require('express-session'); // <-- BARU
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cheerio = require('cheerio');
const admin = require('firebase-admin');

const app = express();
app.use(express.json()); // <-- BARU: Untuk membaca body JSON dari request

// --- INISIALISASI FIREBASE ADMIN ---
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// --- KONFIGURASI SESI --- (INI BAGIAN BARU)
app.use(session({
  secret: 'kucing-lucu-rahasia-bangettrgrggegeggggrgrgrgrgrgrgwaweiref77389bb', // Ganti dengan string acak yang lebih aman
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set 'true' jika Anda menggunakan HTTPS
    httpOnly: true, // Mencegah akses cookie dari JavaScript sisi klien
    maxAge: 24 * 60 * 60 * 1000 // Sesi berlaku selama 24 jam
  }
}));


// Middleware untuk file statis di folder 'public'
app.use(express.static('public'));

// --- ENDPOINT BARU: UNTUK LOGIN & MEMBUAT SESI ---
app.post('/api/login', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token tidak disediakan.' });
  }

  try {
    // Verifikasi token ke Firebase HANYA SEKALI DI SINI
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    // Simpan informasi pengguna di sesi
    req.session.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
    
    console.log(`Sesi dibuat untuk: ${decodedToken.email}`);
    res.status(200).json({ message: 'Login berhasil, sesi dibuat.' });
  } catch (error) {
    console.error('Gagal verifikasi token saat login:', error);
    res.status(401).json({ error: 'Token tidak valid.' });
  }
});

// --- ENDPOINT BARU: UNTUK LOGOUT & MENGHAPUS SESI ---
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Gagal logout.' });
    }
    res.clearCookie('connect.sid'); // Hapus cookie sesi dari browser
    res.status(200).json({ message: 'Logout berhasil.' });
  });
});


// --- Middleware "Penjaga" BARU: Memeriksa Sesi, BUKAN TOKEN ---
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    // Jika ada sesi pengguna, lanjutkan
    next();
  } else {
    // Jika tidak ada sesi, tolak akses
    res.status(401).json({ error: 'Akses ditolak. Sesi tidak ditemukan.' });
  }
}

// ---------- Inaportnet list ----------
app.get('/api/list', isAuthenticated, async (req, res) => {
  try {
    // Mengambil parameter rentang waktu yang baru
    const { port, jenis, start_year, start_month, end_year, end_month, search = '' } = req.query;
    
    // Validasi parameter baru
    if (!port || !jenis || !start_year || !start_month || !end_year || !end_month) {
      // Pesan eror ini sekarang sesuai dengan parameter yang diharapkan
      return res.status(400).json({ error: 'Parameter port, jenis, dan rentang waktu (start/end month/year) wajib diisi' });
    }

    const startDate = new Date(start_year, start_month - 1);
    const endDate = new Date(end_year, end_month - 1);
    let allRows = [];
    let current = new Date(startDate);
    
    const fetchPromises = [];

    // Membuat daftar semua URL yang akan di-fetch berdasarkan rentang waktu
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      
      const listUrl = `https://monitoring-inaportnet.dephub.go.id/monitoring/byPort/list/${encodeURIComponent(port)}/${encodeURIComponent(jenis)}/${year}/${month}`;
      const url = new URL(listUrl);
      url.searchParams.set('draw', '1');
      url.searchParams.set('start', '0');
      url.searchParams.set('length', '5000');
      url.searchParams.set('search[value]', search || '');
      url.searchParams.set('search[regex]', 'false');
      
      fetchPromises.push(fetch(url.toString(), { headers: { 'Accept': 'application/json' } }));
      
      // Lanjut ke bulan berikutnya
      current.setMonth(current.getMonth() + 1);
    }

    // Menjalankan semua permintaan secara paralel untuk efisiensi
    const responses = await Promise.all(fetchPromises);

    for (const r of responses) {
      if (!r.ok) {
        console.warn(`Peringatan: Gagal mengambil data untuk salah satu bulan (HTTP ${r.status})`);
      } else {
        const j = await r.json();
        if (Array.isArray(j?.data)) {
          allRows = allRows.concat(j.data);
        }
      }
    }

    return res.json({ data: allRows, total: allRows.length });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/dashboard.html');
});

// ---------- Inaportnet detail: parse Perusahaan + Asal/Tujuan ----------
// Regex yang lebih "sadar" akan batas kata untuk mencegah kesalahan parsing
const LABEL_BREAKERS = "(?:Asal|Tujuan|Waktu|Bendera|Call\\s*Sign|IMO|Jenis\\s*Trayek|Trayek|Nama\\s*Kapal|GT|LOA|Nakhoda|Nomor\\s*PKK|SPB|ETA|ETD|Pelabuhan|Lokasi|DWT|MMSI|No\\.?\\s*SSM|Single\\s*Billing|STATUS|KETERANGAN|Layanan)";
function clean(s){ return (s||'').replace(/\s+/g,' ').trim() }
function parseCompany(text){
  let m = new RegExp("Nama\\s*Perusahaan\\s*:?\\s*(.+?)(?=\\s*(?:" + LABEL_BREAKERS + "))","i").exec(text)
  if(m) return clean(m[1])
  m = new RegExp("\\bPerusahaan\\b\\s*:?\\s*(.+?)\\s*(?="+LABEL_BREAKERS+"\\s*:|$)","i").exec(text)
  return m ? clean(m[1]) : ""
}
function parseAsalTujuan(text){
  const asalMatch   = new RegExp("\\bAsal\\s*:\\s*(.+?)(?=\\s*(?:" + LABEL_BREAKERS + "))", "i").exec(text)
const tujuanMatch = new RegExp("\\bTujuan\\s*:\\s*(.+?)(?=\\s*(?:" + LABEL_BREAKERS + "))", "i").exec(text)
const asal   = asalMatch   ? clean(asalMatch[1]) : ""
const tujuan = tujuanMatch ? clean(tujuanMatch[1]) : ""
  return { asal: clean(asal), tujuan: clean(tujuan) }
}


app.get('/api/detail', isAuthenticated, async (req,res)=>{
  try{
    const { nomor_pkk } = req.query;
    if(!nomor_pkk) return res.status(400).json({error:'param wajib: nomor_pkk'});

    const detailUrl = `https://monitoring-inaportnet.dephub.go.id/monitoring/detail?nomor_pkk=${encodeURIComponent(nomor_pkk)}`;
    const r = await fetch(detailUrl, { headers:{ 'Accept':'text/html,*/*;q=0.8' }});
    if(!r.ok) throw new Error('HTTP '+r.status);

    const html = await r.text();
    // Menggunakan cheerio hanya untuk mengekstrak teks bersih dari body
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const textContent = $('body').text();

    // Memanggil fungsi-fungsi yang Anda berikan
    const perusahaan = parseCompany(textContent);
    const { asal, tujuan } = parseAsalTujuan(textContent);

    // Mengirimkan hasil parsing
    res.json({ perusahaan, asal, tujuan });

  } catch(e) {
    console.error(`Error di /api/detail untuk PKK ${req.query.nomor_pkk}:`, e);
    res.status(500).json({error:e.message});
  }
});


// ---------- Ditkapel search ----------
app.get('/api/kapal',isAuthenticated, async (req,res)=>{
  try{
    const { nama } = req.query
    if(!nama) return res.status(400).json({error:'param wajib: nama'})
    const url = 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/api-kapal.php'
    const body = new URLSearchParams({
      draw:'1', start:'0', length:'200', 'search[value]':'', 'search[regex]':'false', nama_kapal: nama
    })
    const r = await fetch(url, {
      method:'POST',
      headers:{
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With':'XMLHttpRequest',
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/',
        'Origin': 'https://kapal.dephub.go.id'
        
      },
      body
    })
    if(!r.ok) {
        throw new Error(`Server Ditkapel merespons dengan status: ${r.status}`);
    }

    const j = await r.json()
    const data = Array.isArray(j?.data)? j.data : []

    const fields = [
      ["NamaKapal","Nama Kapal"],["EksNamaKapal","Eks Nama Kapal"],["HurufPengenal","Call Sign"],
      ["JenisDetailKet","Jenis Kapal"],["NamaPemilik","Nama Pemilik"],["TandaPendaftaran","No. Tanda Pendaftaran"],
      ["Panjang","Panjang"],["Lebar","Lebar"],["Dalam","Dalam"],["LengthOfAll","LOA"],
      ["IsiKotor","GT"],["IsiBersih","Isi Bersih"],["NomorIMO","Nomor IMO"],["TahunPembuatan","Tahun Pembuatan"]
    ]
    const headers = fields.map(([,h])=>h)
    const rows = data.map(d=>{
      const o={}; fields.forEach(([k,h])=> o[h] = (d?.[k] ?? '').toString().trim()); return o
    })
    res.json({ headers, data: rows })
  }catch(e){
    res.status(500).json({error:e.message})
  }
})

app.post('/api/kapal/batch', isAuthenticated, async (req, res) => {
    try {
        const { names } = req.body;
        if (!Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ error: 'Daftar nama kapal (names) harus berupa array.' });
        }

        // Fungsi helper untuk mengambil data satu kapal
        const fetchKapalData = async (nama) => {
            const url = 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/api-kapal.php';
            const body = new URLSearchParams({
                draw: '1', start: '0', length: '20', 'search[value]': '', 'search[regex]': 'false', nama_kapal: nama
            });
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                body
            });
            if (response.ok) {
                const json = await response.json();
                return Array.isArray(json.data) ? json.data : [];
            }
            return []; // Kembalikan array kosong jika fetch gagal
        };

        // Mengambil semua data kapal secara paralel
        const promises = names.map(nama => fetchKapalData(nama));
        const results = await Promise.all(promises);

        let allRows = results.flat(); // Menggabungkan semua hasil menjadi satu array

        // Format data seperti endpoint /api/kapal tunggal
        const fields = [
            ["NamaKapal","Nama Kapal"],["EksNamaKapal","Eks Nama Kapal"],["HurufPengenal","Call Sign"],
            ["JenisDetailKet","Jenis Kapal"],["NamaPemilik","Nama Pemilik"],["TandaPendaftaran","No. Tanda Pendaftaran"],
            ["Panjang","Panjang"],["Lebar","Lebar"],["Dalam","Dalam"],["LengthOfAll","LOA"],
            ["IsiKotor","GT"],["IsiBersih","Isi Bersih"],["NomorIMO","Nomor IMO"],["TahunPembuatan","Tahun Pembuatan"]
        ];
        const headers = fields.map(([,h]) => h);
        const formattedRows = allRows.map(d => {
            const o = {};
            fields.forEach(([k, h]) => o[h] = (d?.[k] ?? '').toString().trim());
            return o;
        });

        res.json({ headers, data: formattedRows });

    } catch (e) {
        console.error("Error di /api/kapal/batch:", e);
        res.status(500).json({ error: e.message });
    }
});
const fs = require('fs');

app.get('/api/pelabuhan', isAuthenticated, (req, res) => {
  fs.readFile(__dirname + '/pelabuhan.json', 'utf8', (err, data) => {
    if (err) {
      console.error("Error reading port data file:", err);
      return res.status(500).json({ error: 'Gagal membaca data pelabuhan.' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });
});

app.get('/api/ranks/global', isAuthenticated, async (req, res) => {
    console.log('Menerima permintaan untuk peringkat global...');
    try {
        // 1. Baca daftar semua pelabuhan dari file JSON
        const portFile = fs.readFileSync(__dirname + '/pelabuhan.json', 'utf8');
        const allPorts = JSON.parse(portFile);
        const portCodes = allPorts.map(p => p.code);

        // 2. Tentukan periode: bulan dan tahun saat ini
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        console.log(`Menghitung peringkat untuk periode: ${month}/${year}`);

        // 3. Fungsi untuk mengambil data untuk satu pelabuhan
        const fetchPortData = async (portCode) => {
            // Kita hanya butuh jumlah data, jadi kita set 'length' ke 1 untuk request cepat
            const url = `https://monitoring-inaportnet.dephub.go.id/monitoring/byPort/list/${portCode}/dn/${year}/${month}?draw=1&start=0&length=1`;
            try {
                const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
                if (!response.ok) return { code: portCode, count: 0 }; // Jika gagal, anggap 0
                const json = await response.json();
                // 'recordsTotal' adalah jumlah total kapal yang sandar (DN)
                return { code: portCode, count: json.recordsTotal || 0 };
            } catch (error) {
                return { code: portCode, count: 0 }; // Jika error, anggap 0
            }
        };

        // 4. Jalankan semua permintaan secara paralel untuk efisiensi
        const promises = portCodes.map(code => fetchPortData(code));
        const results = await Promise.all(promises);

        // 5. Gabungkan hasil dengan nama pelabuhan, filter yang tidak ada aktivitas, dan urutkan
        const rankedResults = results
            .map(result => {
                const portInfo = allPorts.find(p => p.code === result.code);
                return {
                    code: result.code,
                    name: portInfo ? portInfo.name : 'Tidak Dikenal',
                    shipCount: result.count
                };
            })
            .filter(port => port.shipCount > 0)
            .sort((a, b) => b.shipCount - a.shipCount);
        
        console.log(`Berhasil menghitung peringkat, ditemukan ${rankedResults.length} pelabuhan aktif.`);
        res.json(rankedResults);

    } catch (e) {
        console.error("Error di /api/ranks/global:", e);
        res.status(500).json({ error: 'Gagal memproses peringkat global: ' + e.message });
    }
});

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=> console.log('Server jalan di http://localhost:'+PORT))


