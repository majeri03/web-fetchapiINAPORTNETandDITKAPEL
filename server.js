const express = require('express');
const cookieSession = require('cookie-session');
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
app.use(cookieSession({
  name: 'session',
  keys: ['kucing-lucu-rahasia-bangettrgrggegeggggrgrgrgrgrgrgwaweiref77389bb'], // <-- Gunakan 'keys' berupa array, bukan 'secret'
  maxAge: 24 * 60 * 60 * 1000 // Sesi berlaku selama 24 jam
}));

// Middleware untuk file statis di folder 'public'
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

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
  req.session = null; // Menghapus sesi untuk cookie-session
  res.status(200).json({ message: 'Logout berhasil.' });
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
// Helper function untuk retry
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${url}:`, error.message);
      
      if (i === maxRetries - 1) {
        throw error; // Throw jika sudah retry maksimal
      }
      
      // Wait dengan exponential backoff
      const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Helper function untuk fetch 1 bulan dengan chunking
async function fetchMonthData(port, jenis, year, month, search = '') {
  const allRows = [];
  const CHUNK_SIZE = 1000; // Kurangi dari 5000 ke 1000
  let currentStart = 0;
  let hasMore = true;

  while (hasMore) {
    const listUrl = `https://monitoring-inaportnet.dephub.go.id/monitoring/byPort/list/${encodeURIComponent(port)}/${encodeURIComponent(jenis)}/${year}/${month}`;
    const url = new URL(listUrl);
    url.searchParams.set('draw', '1');
    url.searchParams.set('start', String(currentStart));
    url.searchParams.set('length', String(CHUNK_SIZE));
    url.searchParams.set('search[value]', search || '');
    url.searchParams.set('search[regex]', 'false');
    
    console.log(`Fetching ${year}/${month}: start=${currentStart}, length=${CHUNK_SIZE}`);
    
    try {
      const response = await fetchWithRetry(url.toString(), {
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Connection': 'keep-alive'
        }
      });

      if (!response.ok) {
        console.warn(`HTTP ${response.status} untuk ${year}/${month}`);
        break; // Skip bulan ini jika error
      }

      const json = await response.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      
      allRows.push(...data);
      
      // Cek apakah masih ada data lagi
      const recordsTotal = json.recordsTotal || 0;
      currentStart += CHUNK_SIZE;
      
      if (currentStart >= recordsTotal || data.length === 0) {
        hasMore = false;
      }

      // Delay kecil antar chunk untuk menghindari rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
    } catch (error) {
      console.error(`Error fetching ${year}/${month}:`, error.message);
      break; // Skip bulan ini jika error
    }
  }

  console.log(`Total data fetched untuk ${year}/${month}: ${allRows.length}`);
  return allRows;
}

// Main endpoint
app.get('/api/list', isAuthenticated, async (req, res) => {
  try {
    const { port, jenis, start_year, start_month, end_year, end_month, search = '' } = req.query;
    
    // Validasi parameter
    if (!port || !jenis || !start_year || !start_month || !end_year || !end_month) {
      return res.status(400).json({ 
        error: 'Parameter port, jenis, dan rentang waktu (start/end month/year) wajib diisi' 
      });
    }

    const startDate = new Date(start_year, start_month - 1);
    const endDate = new Date(end_year, end_month - 1);
    let allRows = [];
    let current = new Date(startDate);
    
    // Fetch data untuk setiap bulan dalam rentang
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      
      try {
        const monthData = await fetchMonthData(port, jenis, year, month, search);
        allRows = allRows.concat(monthData);
      } catch (error) {
        console.error(`Gagal fetch data untuk ${year}/${month}:`, error.message);
        // Lanjut ke bulan berikutnya meskipun ada error
      }
      
      // Delay antar bulan untuk menghindari overload
      current.setMonth(current.getMonth() + 1);
      if (current <= endDate) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Total data fetched untuk semua bulan: ${allRows.length}`);
    return res.json({ data: allRows, total: allRows.length });

  } catch (e) {
    console.error('Error di /api/list:', e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
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


app.get('/api/detail', isAuthenticated, async (req, res) => {
  try {
    const { nomor_pkk } = req.query;
    if (!nomor_pkk) return res.status(400).json({ error: 'param wajib: nomor_pkk' });

    const detailUrl = `https://monitoring-inaportnet.dephub.go.id/monitoring/detail?nomor_pkk=${encodeURIComponent(nomor_pkk)}`;
    const r = await fetch(detailUrl, { 
      headers: { 
        'Accept': 'text/html,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const html = await r.text();
    const $ = cheerio.load(html);
    
    // Ambil text dari card-title yang mengandung nomor PKK dan nama kapal
    const cardTitle = $('.card-title b').first().text().trim();
    
    // Parse jenis kapal dari dalam kurung
    // Format: "PKK.DN.IDMAK.2602.000163 - NGGAPULU (PASSENGER)"
    let jenisKapal = '';
    const jenisMatch = cardTitle.match(/\(([^)]+)\)/);
    if (jenisMatch) {
      jenisKapal = jenisMatch[1].trim(); // "PASSENGER"
    }
    
    // Ambil nama kapal dari card-title
    // Format: "PKK.DN.IDMAK.2602.000163 - NGGAPULU (PASSENGER)"
    let namaKapal = '';
    const namaMatch = cardTitle.match(/- ([^(]+)/);
    if (namaMatch) {
      namaKapal = namaMatch[1].trim(); // "NGGAPULU"
    }
    
    // Parse data lainnya (perusahaan, asal, tujuan)
    const bodyText = $('body').text();
    const perusahaan = parseCompany(bodyText);
    const { asal, tujuan } = parseAsalTujuan(bodyText);

    // Kirim response dengan data lengkap
    res.json({ 
      nomor_pkk,
      nama_kapal: namaKapal,
      jenis_kapal: jenisKapal,
      perusahaan, 
      asal, 
      tujuan 
    });

  } catch (e) {
    console.error(`Error di /api/detail untuk PKK ${req.query.nomor_pkk}:`, e);
    res.status(500).json({ error: e.message });
  }
});


// ---------- Ditkapel search ----------
// Helper function untuk retry dengan exponential backoff
async function fetchWithRetryDitkapel(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Jika berhasil, return response
      if (response.ok) {
        return response;
      }
      
      // Jika HTTP error (bukan network error), throw
      if (response.status >= 400) {
        console.error(`HTTP ${response.status} dari Ditkapel`);
        throw new Error(`Server Ditkapel merespons dengan status: ${response.status}`);
      }
      
      return response;
      
    } catch (error) {
      console.error(`Attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      // Jika sudah retry maksimal, throw error
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Wait dengan exponential backoff: 2s, 4s, 8s
      const waitTime = Math.pow(2, i + 1) * 1000;
      console.log(`Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// ---------- Ditkapel search ----------
app.get('/api/kapal', isAuthenticated, async (req, res) => {
  try {
    const { nama } = req.query
    if (!nama) return res.status(400).json({ error: 'param wajib: nama' })
    
    const url = 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/api-kapal.php'
    const body = new URLSearchParams({
      draw: '1', 
      start: '0', 
      length: '200', 
      'search[value]': '', 
      'search[regex]': 'false', 
      nama_kapal: nama
    })
    
    // GUNAKAN fetchWithRetryDitkapel (dengan retry logic)
    const r = await fetchWithRetryDitkapel(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/',
        'Origin': 'https://kapal.dephub.go.id',
        'Connection': 'keep-alive' // TAMBAHKAN ini
      },
      body
    })

    const j = await r.json()
    
    // Validasi response
    if (!j) {
      throw new Error('Response dari Ditkapel API kosong')
    }
    
    const data = Array.isArray(j?.data) ? j.data : []
    
    // Field mapping yang LENGKAP sesuai dengan struktur API terbaru
    const fields = [
      ["NamaKapal", "Nama Kapal"],
      ["EksNamaKapal", "Eks Nama Kapal"],
      ["HurufPengenal", "Call Sign"],
      ["JenisDetailKet", "Jenis Kapal"],
      ["NamaPemilik", "Nama Pemilik"],
      ["KotaPemilik", "Kota Pemilik"],
      ["AlamatPemilik", "Alamat Pemilik"],
      ["TandaPendaftaran", "No. Tanda Pendaftaran"],
      ["PelabuhanPendaftaran", "Pelabuhan Pendaftaran"],
      ["TempatPendaftaran", "Tempat Pendaftaran"],
      ["TanggalDaftar", "Tanggal Daftar"],
      ["Panjang", "Panjang"],
      ["Lebar", "Lebar"],
      ["Dalam", "Dalam"],
      ["LengthOfAll", "LOA"],
      ["IsiKotor", "GT"],
      ["IsiBersih", "Isi Bersih"],
      ["NomorIMO", "Nomor IMO"],
      ["TahunPembuatan", "Tahun Pembuatan"],
      ["TempatPembuatan", "Tempat Pembuatan"],
      ["BahanUtamaKapal", "Bahan Utama"],
      ["Mesin", "Mesin"],
      ["Daya", "Daya"],
      ["PenggerakUtama", "Penggerak Utama"],
      ["SuratUkurNo", "Surat Ukur No"],
      ["SuratTanggalUkur", "Tanggal Ukur"],
      ["TandaSelar", "Tanda Selar"],
      ["NomorAkta", "Nomor Akta"],
      ["NPWP", "NPWP"],
      ["BenderaAsal", "Bendera Asal"],
    ]
    
    const headers = fields.map(([, h]) => h)
    const rows = data.map(d => {
      const o = {}
      fields.forEach(([k, h]) => {
        o[h] = (d?.[k] ?? '').toString().trim()
      })
      return o
    })
    
    res.json({ headers, data: rows })
  } catch (e) {
    console.error('Error di /api/kapal:', e.message, e.stack)
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/kapal/batch', isAuthenticated, async (req, res) => {
  try {
    const { names, checkpoint = 0 } = req.body;
    
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'Daftar nama kapal (names) harus berupa array.' })
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

    // GUNAKAN fetchWithRetryDitkapel di sini juga
    const fetchKapalData = async (nama) => {
      const url = 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/api-kapal.php'
      const body = new URLSearchParams({
        draw: '1', start: '0', length: '20', 
        'search[value]': '', 'search[regex]': 'false', 
        nama_kapal: nama
      })
      
      try {
        // GUNAKAN retry helper
        const response = await fetchWithRetryDitkapel(url, {
          method: 'POST',
          headers: { 
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://kapal.dephub.go.id/ditkapel_service/data_kapal/',
            'Origin': 'https://kapal.dephub.go.id',
            'Connection': 'keep-alive' // TAMBAHKAN ini
          },
          body
        })
        
        const json = await response.json()
        return Array.isArray(json.data) ? json.data : []
        
      } catch (err) {
        console.error(`Error fetching ${nama} after retries:`, err.message)
        return [] // Return empty jika gagal setelah retry
      }
    }

    // MULAI DARI CHECKPOINT
    const namesToFetch = names.slice(checkpoint);
    console.log(`Fetching ${namesToFetch.length} kapal (starting from checkpoint ${checkpoint})`);

    let allRows = []
    const BATCH_SIZE = 3; // KURANGI dari 5 ke 3 untuk lebih aman
    
    for (let i = 0; i < namesToFetch.length; i += BATCH_SIZE) {
      const batch = namesToFetch.slice(i, i + BATCH_SIZE);
      
      // Fetch semua kapal dalam batch secara paralel
      const batchPromises = batch.map(nama => fetchKapalData(nama));
      const batchResults = await Promise.all(batchPromises);
      
      // Gabungkan hasil
      batchResults.forEach(result => {
        if (result.length > 0) {
          allRows.push(...result);
        }
      });
      
      // Delay antar batch - PERPANJANG delay untuk lebih aman
      if (i + BATCH_SIZE < namesToFetch.length) {
        await sleep(1000); // 1 detik delay antar batch
      }
      
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, namesToFetch.length)}/${namesToFetch.length}`);
    }

    // ... rest of code sama seperti sebelumnya ...
    const fields = [
      ["NamaKapal", "Nama Kapal"],
      ["EksNamaKapal", "Eks Nama Kapal"],
      ["HurufPengenal", "Call Sign"],
      ["JenisDetailKet", "Jenis Kapal"],
      ["NamaPemilik", "Nama Pemilik"],
      ["KotaPemilik", "Kota Pemilik"],
      ["AlamatPemilik", "Alamat Pemilik"],
      ["TandaPendaftaran", "No. Tanda Pendaftaran"],
      ["PelabuhanPendaftaran", "Pelabuhan Pendaftaran"],
      ["TempatPendaftaran", "Tempat Pendaftaran"],
      ["TanggalDaftar", "Tanggal Daftar"],
      ["Panjang", "Panjang"],
      ["Lebar", "Lebar"],
      ["Dalam", "Dalam"],
      ["LengthOfAll", "LOA"],
      ["IsiKotor", "GT"],
      ["IsiBersih", "Isi Bersih"],
      ["NomorIMO", "Nomor IMO"],
      ["TahunPembuatan", "Tahun Pembuatan"],
      ["TempatPembuatan", "Tempat Pembuatan"],
      ["BahanUtamaKapal", "Bahan Utama"],
      ["Mesin", "Mesin"],
      ["Daya", "Daya"],
      ["PenggerakUtama", "Penggerak Utama"],
      ["SuratUkurNo", "Surat Ukur No"],
      ["SuratTanggalUkur", "Tanggal Ukur"],
      ["TandaSelar", "Tanda Selar"],
      ["NomorAkta", "Nomor Akta"],
      ["NPWP", "NPWP"],
      ["BenderaAsal", "Bendera Asal"],
    ]
    
    const headers = fields.map(([, h]) => h)
    const formattedRows = allRows.map(d => {
      const o = {}
      fields.forEach(([k, h]) => o[h] = (d?.[k] ?? '').toString().trim())
      return o
    })

    res.json({ headers, data: formattedRows })

  } catch (e) {
    console.error("Error di /api/kapal/batch:", e)
    res.status(500).json({ error: e.message })
  }
})
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

const PORT = process.env.PORT || 3000;

// Hanya jalankan app.listen jika di lokal (bukan Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log('Server jalan di http://localhost:' + PORT));
}

// Export app untuk Vercel
module.exports = app;