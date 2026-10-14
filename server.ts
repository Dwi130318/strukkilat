import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// In-memory cache for shared files from Android Share Sheet
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

interface SharedFileData {
  buffer: Buffer;
  mimetype: string;
  createdAt: number;
}
const sharedFilesMap = new Map<string, SharedFileData>();

// Periodically clean up items older than 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of sharedFilesMap.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      sharedFilesMap.delete(key);
    }
  }
}, 60 * 1000);

// Support large image payloads (screenshots can be 5-15MB base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Android PWA Web Share Target handler (Triggered when sharing from BRImo / Gallery / M-Banking)
app.post('/api/share-target', upload.any(), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    const file = (files && files.length > 0) ? files[0] : (req.file || null);

    if (!file) {
      console.warn('Share target received without file, body:', req.body);
      return res.redirect(303, '/');
    }

    const id = crypto.randomBytes(12).toString('hex');
    sharedFilesMap.set(id, {
      buffer: file.buffer,
      mimetype: file.mimetype || 'image/jpeg',
      createdAt: Date.now(),
    });

    console.log(`Successfully received shared receipt from Android (ID: ${id}, size: ${file.size} bytes)`);
    // Redirect to root with query param so React picks it up
    return res.redirect(303, `/?shared_id=${id}`);
  } catch (err) {
    console.error('Share target error:', err);
    return res.redirect(303, '/');
  }
});

// Endpoint to retrieve shared file by client
app.get('/api/shared-file/:id', (req, res) => {
  const { id } = req.params;
  const item = sharedFilesMap.get(id);
  if (!item) {
    return res.status(404).json({ error: 'File tidak ditemukan atau telah kedaluwarsa.' });
  }
  // Return as base64 JSON payload
  const base64 = `data:${item.mimetype};base64,${item.buffer.toString('base64')}`;
  return res.json({
    success: true,
    dataUrl: base64,
    mimeType: item.mimetype,
  });
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Models to try in order of current availability, vision capability, and speed
const VISION_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
];

// Helper to reliably strip base64 data URL headers
const extractCleanBase64 = (raw: string): string => {
  if (!raw) return '';
  const idx = raw.indexOf('base64,');
  return idx !== -1 ? raw.substring(idx + 7).trim() : raw.trim();
};

// API: OCR Proof of Transfer Image
app.post('/api/parse-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', mode = 'transfer' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Data gambar bukti transfer wajib disertakan.' });
    }

    const now = new Date();

    // Helper to sanitize fields so no "null", "undefined", or empty values leak to client
    const cleanField = (val: any, fallback: string = ''): string => {
      if (val === null || val === undefined) return fallback;
      const s = String(val).trim();
      if (
        !s ||
        s.toLowerCase() === 'null' ||
        s.toLowerCase() === 'undefined' ||
        s.toLowerCase() === 'none' ||
        s.toLowerCase() === 'n/a'
      ) {
        return fallback;
      }
      return s;
    };

    // Helper to safely parse numbers
    const cleanNumber = (val: any, fallback: number = 0): number => {
      if (typeof val === 'number') return Math.round(val);
      if (!val) return fallback;
      const str = String(val).replace(/[^0-9]/g, '');
      const parsed = parseInt(str, 10);
      return isNaN(parsed) || parsed < 0 ? fallback : parsed;
    };

    // Strict validator to ensure real extraction before breaking model loop
    const isValidPlnParse = (data: any): boolean => {
      if (!data || typeof data !== 'object') return false;
      const tokenDigits = String(data.tokenNumber || '').replace(/\D/g, '');
      const hasToken = tokenDigits.length >= 16;
      const hasMeter = String(data.meterNumber || '').replace(/\D/g, '').length >= 10;
      const hasCustId = String(data.customerId || '').replace(/\D/g, '').length >= 10;
      const hasCustName =
        typeof data.customerName === 'string' &&
        data.customerName.trim().length > 2 &&
        !['null', 'undefined', 'pelanggan pln'].includes(data.customerName.trim().toLowerCase());
      return hasToken || (hasMeter && (hasCustName || hasCustId));
    };

    // MODE PLN TOKEN LISTRIK
    if (mode === 'pln_token') {
      const fallbackPln = {
        meterNumber: '32019482910',
        customerId: '52109823412',
        customerName: 'PELANGGAN PLN',
        tariffPower: 'R1 / 1300 VA',
        tokenNumber: '3819 4820 1928 4719 0192',
        kwhAmount: '65.8 kWh',
        amount: 100000,
        adminFee: 0,
        transactionDate: now.toLocaleDateString('id-ID'),
        transactionTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        refNumber: 'PLN' + Date.now().toString().slice(-8),
      };

      if (!ai) {
        return res.json({
          success: false,
          isFallback: true,
          data: fallbackPln,
          warning:
            'Kunci GEMINI_API_KEY belum terpasang di hosting Anda. Tambahkan GEMINI_API_KEY di file .env atau menu Environment Variables hosting agar fitur OCR AI dapat membaca otomatis.',
        });
      }

      const cleanBase64 = extractCleanBase64(imageBase64);
      const promptPln = `
Kamu adalah ahli OCR khusus struk dan bukti pembelian TOKEN LISTRIK PLN PRABAYAR Indonesia (dari PLN Mobile, BCA m-BCA, BRImo, Mandiri Livin', BNI Mobile, DANA, OVO, Shopee, Tokopedia, Indomaret, dll).
Tolong periksa dan ekstrak data token listrik PLN dari gambar ini secara sangat akurat:

PENTING:
- DILARANG menggunakan kata "null" atau "undefined". Jika data tidak ada atau tidak jelas, berikan perkiraan terbaik.
- meterNumber: Nomor Meter PLN (biasanya 11 digit angka, misal "32019482910"). Jika di struk hanya tertera satu nomor IDPEL/No Meter, isi nomor tersebut ke meterNumber dan customerId.
- customerId: ID Pelanggan / IDPEL PLN (11-12 digit angka, misal "52109823412").
- customerName: Nama lengkap pelanggan PLN yang tertera.
- tariffPower: Tarif dan Daya listrik (misal "R1 / 1300 VA", "R1M / 900 VA", "R1 / 450 VA"). Jika tidak ada, isi "R1 / 1300 VA".
- tokenNumber: 20 digit nomor STROOM / TOKEN PLN. Formatkan dengan spasi tiap 4 digit, misal: "3819 4820 1928 4719 0192".
- kwhAmount: Jumlah kWh yang diperoleh jika tertera (misal "65.8 kWh"). Jika tidak tertera, isi "-".
- amount: Nominal pembelian token (integer murni tanpa Rp/titik, misal 20000, 50000, 100000, 200000).
- transactionDate: Tanggal transaksi pembelian (misal "16/09/2026").
- transactionTime: Waktu/jam transaksi jika tertera (misal "19:30 WIB").
- refNumber: Nomor referensi atau no transaksi unik.
`;

      let parsedPln: any = null;
      let rawPlnText: string = '';
      for (const modelName of VISION_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || 'image/jpeg',
                  },
                },
                { text: promptPln },
              ],
            },
            config: {
              systemInstruction:
                'Kamu adalah asisten OCR spesialis bukti pembelian token listrik PLN Prabayar. Berikan output terstruktur JSON dengan data seakurat mungkin. Jangan pernah mengisi nilai null atau string "null".',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  meterNumber: { type: Type.STRING },
                  customerId: { type: Type.STRING },
                  customerName: { type: Type.STRING },
                  tariffPower: { type: Type.STRING },
                  tokenNumber: { type: Type.STRING },
                  kwhAmount: { type: Type.STRING },
                  amount: { type: Type.INTEGER },
                  adminFee: { type: Type.INTEGER },
                  transactionDate: { type: Type.STRING },
                  transactionTime: { type: Type.STRING },
                  refNumber: { type: Type.STRING },
                },
                required: ['tokenNumber', 'amount', 'customerName'],
              },
            },
          });

          rawPlnText = response.text || '{}';
          const cleanedText = rawPlnText.replace(/```json\s*|```/g, '').trim();
          const candidate = JSON.parse(cleanedText);
          if (isValidPlnParse(candidate)) {
            parsedPln = candidate;
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} PLN failed, trying next...`, err.message || err);
        }
      }

      if (parsedPln) {
        let meterNum = cleanField(parsedPln.meterNumber, '');
        let custId = cleanField(parsedPln.customerId, '');
        if (!meterNum && custId) meterNum = custId;
        if (!custId && meterNum) custId = meterNum;
        if (!meterNum && !custId) {
          meterNum = fallbackPln.meterNumber;
          custId = fallbackPln.customerId;
        }

        let tokenNum = cleanField(parsedPln.tokenNumber, '');
        const tokenDigits = tokenNum.replace(/\D/g, '');
        if (tokenDigits.length === 20) {
          tokenNum = `${tokenDigits.slice(0, 4)} ${tokenDigits.slice(4, 8)} ${tokenDigits.slice(8, 12)} ${tokenDigits.slice(12, 16)} ${tokenDigits.slice(16, 20)}`;
        } else {
          const rawMatch = rawPlnText.match(/\b(\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4})\b/);
          if (rawMatch) {
            const rawDigits = rawMatch[1].replace(/\D/g, '');
            tokenNum = `${rawDigits.slice(0, 4)} ${rawDigits.slice(4, 8)} ${rawDigits.slice(8, 12)} ${rawDigits.slice(12, 16)} ${rawDigits.slice(16, 20)}`;
          } else if (!tokenNum || tokenNum.length < 12) {
            tokenNum = fallbackPln.tokenNumber;
          }
        }

        const custName = cleanField(parsedPln.customerName, fallbackPln.customerName);
        const tariff = cleanField(parsedPln.tariffPower, fallbackPln.tariffPower);
        let kwh = cleanField(parsedPln.kwhAmount, '-');
        if (kwh !== '-' && !kwh.toLowerCase().includes('kwh')) {
          kwh = `${kwh} kWh`;
        }

        return res.json({
          success: true,
          isFallback: false,
          data: {
            meterNumber: meterNum,
            customerId: custId,
            customerName: custName,
            tariffPower: tariff,
            tokenNumber: tokenNum,
            kwhAmount: kwh,
            amount: Number(parsedPln.amount) || fallbackPln.amount,
            adminFee: 0,
            transactionDate: cleanField(parsedPln.transactionDate, fallbackPln.transactionDate),
            transactionTime: cleanField(parsedPln.transactionTime, fallbackPln.transactionTime),
            refNumber: cleanField(parsedPln.refNumber, fallbackPln.refNumber),
          },
        });
      }

      return res.json({
        success: false,
        isFallback: true,
        data: fallbackPln,
        warning: 'AI tidak berhasil membaca nomor token dari gambar ini. Draf formulir token listrik telah dimuat agar Anda dapat menyesuaikan secara manual.',
      });
    }

    // =========================================================================
    // MODE 3: VIRTUAL ACCOUNT PARSING
    // =========================================================================
    if (mode === 'virtual_account') {
      const fallbackVa = {
        bankSource: 'BRI',
        vaProvider: 'BRIVA',
        vaNumber: '1280081298765432',
        billerName: 'SHOPEEPAY INDONESIA',
        customerName: 'DWI KURNIAWAN',
        amount: 250000,
        adminFee: 0,
        transactionDate: now.toLocaleDateString('id-ID'),
        transactionTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        refNumber: 'BRIVA' + Date.now().toString().slice(-8),
        status: 'SUKSES',
        notes: '',
      };

      if (!ai) {
        return res.json({
          success: false,
          isFallback: true,
          data: fallbackVa,
          warning: 'Kunci GEMINI_API_KEY belum terpasang di hosting Anda.',
        });
      }

      const isValidVaParse = (data: any): boolean => {
        if (!data || typeof data !== 'object') return false;
        const vaDigits = String(data.vaNumber || '').replace(/\D/g, '');
        const hasVa = vaDigits.length >= 8 && vaDigits !== '1280081298765432';
        const hasAmount = Number(data.amount) > 0;
        const hasBiller =
          typeof data.billerName === 'string' &&
          data.billerName.trim().length > 2 &&
          !['null', 'undefined', 'virtual account'].includes(data.billerName.trim().toLowerCase());
        const hasCust =
          typeof data.customerName === 'string' &&
          data.customerName.trim().length > 2 &&
          !['null', 'undefined', 'dwi kurniawan', 'pelanggan va'].includes(data.customerName.trim().toLowerCase());
        return hasVa || (hasAmount && (hasBiller || hasCust));
      };

      const promptVa = `
Kamu adalah ahli OCR khusus struk dan bukti pembayaran VIRTUAL ACCOUNT di Indonesia (BRIVA BRI, BCA Virtual Account, Mandiri VA Livin', BNI VA, Permata VA, ShopeePay VA, Tokopedia VA, DANA VA, dll).
Tolong periksa dan ekstrak data pembayaran Virtual Account dari gambar ini secara sangat akurat:
1. vaNumber: Nomor Virtual Account / Kode Bayar (ambil semua digit angkanya, rapat tanpa spasi).
2. billerName: Nama Merchant / Perusahaan / Institusi yang dibayar (contoh: SHOPEEPAY, TOKOPEDIA, DANA, TIKET.COM, RUANGGURU, INDOMARET, dll).
3. customerName: Nama Pelanggan / Pemilik Tagihan.
4. bankSource: Bank penyedia atau aplikasi yang digunakan (misal: BRI / BRIVA, BCA, MANDIRI, BNI, PERMATA).
5. amount: Nominal tagihan / jumlah bayar murni (integer tanpa titik/koma/Rp).
6. adminFee: Biaya admin transaksi jika ada (integer, 0 jika gratis).
7. transactionDate: Tanggal transaksi (format DD/MM/YYYY).
8. transactionTime: Waktu/jam transaksi jika tertera.
9. refNumber: Nomor referensi transaksi atau ID transaksi unik.
10. status: Status transaksi (SUKSES/BERHASIL).
11. notes: Catatan jika ada.

DILARANG menggunakan kata "null" atau "undefined". Kosongkan jika tidak ada.
`;

      const cleanBase64 = extractCleanBase64(imageBase64);
      let parsedVa: any = null;

      for (const modelName of VISION_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType || 'image/jpeg',
                  },
                },
                { text: promptVa },
              ],
            },
            config: {
              systemInstruction:
                'Kamu adalah asisten OCR spesialis bukti pembayaran Virtual Account Indonesia. Berikan output terstruktur JSON dengan data seakurat mungkin.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  vaNumber: { type: Type.STRING, description: 'Nomor Virtual Account' },
                  billerName: { type: Type.STRING, description: 'Nama Institusi / Merchant' },
                  customerName: { type: Type.STRING, description: 'Nama Pelanggan' },
                  bankSource: { type: Type.STRING, description: 'Bank Penyedia VA' },
                  amount: { type: Type.INTEGER, description: 'Nominal tagihan' },
                  adminFee: { type: Type.INTEGER, description: 'Biaya admin' },
                  transactionDate: { type: Type.STRING, description: 'Tanggal transaksi' },
                  transactionTime: { type: Type.STRING, description: 'Waktu transaksi' },
                  refNumber: { type: Type.STRING, description: 'Nomor referensi' },
                  status: { type: Type.STRING, description: 'Status transaksi' },
                  notes: { type: Type.STRING, description: 'Catatan' },
                },
              },
            },
          });

          const rawText = response.text || '{}';
          const cleanedText = rawText.replace(/```json\s*|```/g, '').trim();
          const candidate = JSON.parse(cleanedText);
          if (isValidVaParse(candidate)) {
            parsedVa = candidate;
            break;
          }
        } catch (err: any) {
          console.warn(`Model ${modelName} failed on VA:`, err.message || err);
        }
      }

      if (parsedVa) {
        const cleanVaNo = cleanField(parsedVa.vaNumber, fallbackVa.vaNumber).replace(/\s+/g, '');
        return res.json({
          success: true,
          isFallback: false,
          data: {
            bankSource: cleanField(parsedVa.bankSource, fallbackVa.bankSource),
            vaProvider: cleanField(parsedVa.bankSource ? `${parsedVa.bankSource} VA` : 'VIRTUAL ACCOUNT', 'BRIVA'),
            vaNumber: cleanVaNo,
            billerName: cleanField(parsedVa.billerName, fallbackVa.billerName),
            customerName: cleanField(parsedVa.customerName, fallbackVa.customerName),
            amount: cleanNumber(parsedVa.amount, fallbackVa.amount),
            adminFee: cleanNumber(parsedVa.adminFee, 0),
            transactionDate: cleanField(parsedVa.transactionDate, fallbackVa.transactionDate),
            transactionTime: cleanField(parsedVa.transactionTime, fallbackVa.transactionTime),
            refNumber: cleanField(parsedVa.refNumber, fallbackVa.refNumber),
            status: cleanField(parsedVa.status, 'SUKSES'),
            notes: cleanField(parsedVa.notes, ''),
          },
        });
      }

      return res.json({
        success: false,
        isFallback: true,
        data: fallbackVa,
        warning: 'AI tidak berhasil membaca nomor Virtual Account dari gambar ini. Draf formulir telah dimuat untuk disesuaikan secara manual.',
      });
    }

    // =========================================================================
    // MODE 1: TRANSFER ANTAR BANK PARSING
    // =========================================================================
    const fallbackDraft = {
      bankSource: 'M-BANKING',
      bankDestination: 'BANK PENERIMA',
      recipientName: 'PENERIMA TRANSFER',
      recipientAccount: '1234567890',
      senderName: '',
      senderAccount: '',
      amount: 100000,
      bankAdminFee: 0,
      transactionDate: now.toLocaleDateString('id-ID'),
      transactionTime: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      refNumber: 'TRX' + Date.now().toString().slice(-8),
      transactionType: 'TRANSFER ANTAR BANK',
      status: 'BERHASIL',
      notes: 'Transfer Dana',
    };

    if (!ai) {
      return res.json({
        success: false,
        isFallback: true,
        data: fallbackDraft,
        warning:
          'Kunci GEMINI_API_KEY belum terpasang di hosting Anda. Tambahkan GEMINI_API_KEY di file .env atau menu Environment Variables hosting agar fitur OCR AI dapat membaca otomatis.',
      });
    }

    const cleanBase64 = extractCleanBase64(imageBase64);

    const promptText = `
Kamu adalah ahli OCR khusus struk dan bukti transfer uang untuk SEMUA BANK & E-WALLET Indonesia:
- BCA (m-BCA, myBCA, KlikBCA)
- Bank Mandiri (Livin' by Mandiri)
- Bank BRI (BRImo)
- Bank BNI (BNI Mobile, wondr by BNI)
- Bank Syariah Indonesia (BSI Mobile)
- Bank Jago, SeaBank, Allo Bank, Permata, Danamon, CIMB Niaga, BJB, Bank Daerah (Bank Nagari, Bank Jateng, Bank Jatim, Bank Sumut, dll)
- DANA, GoPay, OVO, ShopeePay, LinkAja, Flip

Tolong periksa dan ekstrak data transfer dari gambar bukti transaksi ini secara sangat cerdas dan teliti:

1. bankSource: Nama bank / e-wallet pengirim.
   - Perhatikan logo atau header di gambar.
   - Tulisan m-BCA / myBCA / BCA -> "BCA"
   - Livin' / Mandiri -> "MANDIRI (LIVIN')"
   - BNI / wondr -> "BNI"
   - BRI / BRImo -> "BRI"
   - BSI -> "BSI"
   - DANA -> "DANA", GoPay -> "GOPAY", OVO -> "OVO", ShopeePay -> "SHOPEEPAY", SeaBank -> "SEABANK".

2. bankDestination: Nama bank atau e-wallet tujuan transfer (misal: "BRI", "BCA", "MANDIRI", "BNI", "DANA", "SHOPEEPAY", dll).
   - Jika transfer ke SESAMA BANK (misal sesama BCA atau sesama BRI), isi bankDestination sama dengan bankSource.

3. recipientName: Nama lengkap pemilik rekening penerima transfer yang tertera pada bukti transfer.

4. recipientAccount: Nomor rekening atau nomor HP penerima (ambil semua digit angkanya, rapat tanpa spasi).

5. senderName: Nama pengirim uang (jika ada pada struk).

6. senderAccount: Nomor rekening pengirim (jika ada pada struk).

7. amount: Nominal uang transfer utama (harus berupa angka integer murni tanpa Rp/titik/koma, contoh: 150000, 500000, 1000000).

8. bankAdminFee: Biaya admin transaksi jika tertera (misal: 0, 2500, atau 6500). Jika tidak tertera atau gratis, tulis 0.

9. transactionDate: Tanggal transaksi (format DD/MM/YYYY, misal "13/10/2026").

10. transactionTime: Waktu/jam transaksi jika tertera (misal "14:25:08 WIB" atau "14:25 WIB").

11. refNumber: Nomor referensi transaksi, No Jurnal, No Bukti, atau Transaction ID.

12. transactionType: Selalu tulis "TRANSFER ANTAR BANK".

13. status: Status transaksi, utamakan "BERHASIL" atau "SUKSES".

14. notes: Berita transfer, catatan, atau keterangan jika ada.

PENTING: DILARANG mengisi kata "null" atau "undefined". Kosongkan ("") jika data tidak tertera.
`;

    const isValidTransferParse = (data: any): boolean => {
      if (!data || typeof data !== 'object') return false;
      const hasAmount = Number(data.amount) > 0;
      const hasRecipient =
        typeof data.recipientName === 'string' &&
        data.recipientName.trim().length > 1 &&
        !['null', 'undefined', 'penerima transfer'].includes(data.recipientName.trim().toLowerCase());
      const hasAccount =
        typeof data.recipientAccount === 'string' &&
        data.recipientAccount.trim().length > 3 &&
        !['null', 'undefined', '-', '1234567890'].includes(data.recipientAccount.trim().toLowerCase());
      const hasBank =
        typeof data.bankSource === 'string' &&
        data.bankSource.trim().length > 1 &&
        !['null', 'undefined', 'm-banking', 'bank asal'].includes(data.bankSource.trim().toLowerCase());
      const hasRef =
        typeof data.refNumber === 'string' &&
        data.refNumber.trim().length > 4 &&
        !['null', 'undefined'].includes(data.refNumber.trim().toLowerCase());
      return (
        (hasAmount && (hasRecipient || hasAccount || hasBank)) ||
        (hasRecipient && (hasAccount || hasBank)) ||
        (hasAccount && hasRef)
      );
    };

    let lastError: any = null;
    let parsedData: any = null;

    // Try models with fallback
    for (const modelName of VISION_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType || 'image/jpeg',
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            systemInstruction:
              'Kamu adalah asisten OCR spesialis bukti transfer perbankan dan dompet digital Indonesia. Berikan output terstruktur JSON dengan data seakurat mungkin dari gambar. Ekstrak nama bank, nama penerima, nomor rekening, dan nominal transfer secara tepat.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                bankSource: { type: Type.STRING, description: 'Bank / E-Wallet asal pengirim' },
                bankDestination: { type: Type.STRING, description: 'Bank / E-Wallet tujuan transfer' },
                recipientName: { type: Type.STRING, description: 'Nama penerima transfer' },
                recipientAccount: { type: Type.STRING, description: 'Nomor rekening penerima' },
                senderName: { type: Type.STRING, description: 'Nama pengirim jika ada' },
                senderAccount: { type: Type.STRING, description: 'Nomor rekening pengirim jika ada' },
                amount: { type: Type.INTEGER, description: 'Nominal transfer utama' },
                bankAdminFee: { type: Type.INTEGER, description: 'Biaya admin bank' },
                transactionDate: { type: Type.STRING, description: 'Tanggal transaksi' },
                transactionTime: { type: Type.STRING, description: 'Waktu transaksi' },
                refNumber: { type: Type.STRING, description: 'Nomor referensi / ID transaksi' },
                transactionType: { type: Type.STRING, description: 'TRANSFER ANTAR BANK' },
                status: { type: Type.STRING, description: 'Status transaksi' },
                notes: { type: Type.STRING, description: 'Berita atau catatan transaksi' },
              },
              required: ['recipientName', 'amount'],
            },
          },
        });

        const rawText = response.text || '{}';
        const cleanedText = rawText.replace(/```json\s*|```/g, '').trim();
        const candidate = JSON.parse(cleanedText);
        if (isValidTransferParse(candidate)) {
          parsedData = candidate;
          break; // successfully parsed!
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed or busy, trying next model...`, err.message || err);
      }
    }

    if (parsedData) {
      const source = cleanField(parsedData.bankSource, fallbackDraft.bankSource);
      const destination = cleanField(parsedData.bankDestination, source || fallbackDraft.bankDestination);
      const recipient = cleanField(parsedData.recipientName, fallbackDraft.recipientName);
      const account = cleanField(parsedData.recipientAccount, fallbackDraft.recipientAccount).replace(/\s+/g, '');

      return res.json({
        success: true,
        isFallback: false,
        data: {
          bankSource: source,
          bankDestination: destination,
          recipientName: recipient,
          recipientAccount: account,
          senderName: cleanField(parsedData.senderName, ''),
          senderAccount: cleanField(parsedData.senderAccount, ''),
          amount: cleanNumber(parsedData.amount, fallbackDraft.amount),
          bankAdminFee: cleanNumber(parsedData.bankAdminFee, 0),
          transactionDate: cleanField(parsedData.transactionDate, fallbackDraft.transactionDate),
          transactionTime: cleanField(parsedData.transactionTime, fallbackDraft.transactionTime),
          refNumber: cleanField(parsedData.refNumber, fallbackDraft.refNumber),
          transactionType: 'TRANSFER ANTAR BANK',
          status: cleanField(parsedData.status, 'BERHASIL'),
          notes: cleanField(parsedData.notes, ''),
        },
      });
    }

    // If all models failed or image was not readable
    console.error('All AI models failed, using fallback draft:', lastError);
    return res.json({
      success: false,
      isFallback: true,
      data: fallbackDraft,
      warning:
        'AI tidak berhasil mendeteksi data transfer dari gambar ini. Pastikan foto struk jelas dan tidak terpotong, atau Anda dapat menyesuaikan data pada formulir di bawah.',
    });
  } catch (error: any) {
    console.error('Fatal error in parse-receipt endpoint:', error);
    return res.json({
      success: false,
      isFallback: true,
      data: {
        bankSource: 'M-BANKING',
        bankDestination: 'BANK PENERIMA',
        recipientName: 'PENERIMA TRANSFER',
        recipientAccount: '-',
        amount: 100000,
        bankAdminFee: 0,
        transactionDate: new Date().toLocaleDateString('id-ID'),
        transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        refNumber: 'TRX' + Date.now().toString().slice(-8),
        transactionType: 'TRANSFER ANTAR BANK',
        status: 'BERHASIL',
      },
      warning: 'Gagal memproses gambar otomatis. Data draf telah disiapkan untuk Anda edit.',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Setup Vite dev server or static production files
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server StrukKilat running on port ${PORT} (isProduction=${isProduction})`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
