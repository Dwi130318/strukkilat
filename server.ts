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

// Models to try in order of speed and current availability
const VISION_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

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
          success: true,
          data: fallbackPln,
          warning:
            'Kunci GEMINI_API_KEY belum terpasang di hosting Anda. Tambahkan GEMINI_API_KEY di file .env atau menu Environment Variables hosting agar fitur OCR AI dapat membaca otomatis.',
        });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
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
          parsedPln = JSON.parse(cleanedText);
          if (parsedPln && (parsedPln.tokenNumber || parsedPln.customerName)) {
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
        success: true,
        data: fallbackPln,
        warning: 'AI sedang sibuk, draf token listrik telah dimuat untuk diedit.',
      });
    }

    // Default fallback draft in case AI is busy or image is difficult to read
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
      transactionType: 'TRANSFER ONLINE',
      status: 'BERHASIL',
      notes: 'Transfer Dana',
    };

    if (!ai) {
      return res.json({
        success: true,
        data: fallbackDraft,
        warning:
          'Kunci GEMINI_API_KEY belum terpasang di hosting Anda. Tambahkan GEMINI_API_KEY di file .env atau menu Environment Variables hosting agar fitur OCR AI dapat membaca otomatis.',
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const promptText = `
Kamu adalah ahli OCR khusus struk dan bukti transfer uang untuk SEMUA BANK & E-WALLET Indonesia:
- BCA (m-BCA, myBCA, KlikBCA)
- Bank Mandiri (Livin' by Mandiri)
- Bank BRI (BRImo)
- Bank BNI (BNI Mobile, wondr by BNI)
- Bank Syariah Indonesia (BSI Mobile)
- Bank Jago, SeaBank, Allo Bank, Permata, Danamon, CIMB Niaga, BJB, Bank Daerah (Bank Nagari, Bank Jateng, Bank Jatim, Bank Sumut, dll)
- DANA, GoPay, OVO, ShopeePay, LinkAja, Flip

Tolong periksa dan ekstrak data transfer dari gambar ini secara sangat cerdas dan fleksibel:

1. bankSource: Nama bank / e-wallet pengirim.
   - Perhatikan logo di pojok atas/bawah bukti transfer.
   - Biru BCA / tulisan m-BCA / myBCA / m-Transfer -> "BCA"
   - Emas / kuning / pita Livin' -> "MANDIRI (LIVIN')"
   - Orange / toska BNI / wondr -> "BNI"
   - Biru BRI / BRImo -> "BRI"
   - Hijau toska BSI -> "BSI"
   - Biru DANA -> "DANA", Hijau GoPay -> "GOPAY", Ungu OVO -> "OVO", Orange ShopeePay -> "SHOPEEPAY", Orange SeaBank -> "SEABANK".

2. bankDestination: Nama bank atau e-wallet tujuan transfer (misal: "BRI", "BCA", "MANDIRI", "BNI", "DANA", "SHOPEEPAY", dll).
   - Jika transfer ke SESAMA BANK (misal sesama BCA, sesama Mandiri), isi bankDestination sama dengan bankSource (misal: "BCA" atau "MANDIRI").

3. recipientName: Nama lengkap pemilik rekening penerima transfer.

4. recipientAccount: Nomor rekening atau nomor HP/Virtual Account penerima (ambil digit angkanya, rapat tanpa spasi).

5. senderName: Nama pengirim uang (jika ada pada struk).

6. senderAccount: Nomor rekening pengirim (jika ada pada struk).

7. amount: Nominal uang transfer utama (harus berupa angka integer murni tanpa Rp/titik/koma, contoh: 150000).

8. bankAdminFee: Biaya admin transaksi jika tertera (misal: 0, 2500, atau 6500). Jika gratis atau tidak tertera biaya admin, tulis 0.

9. transactionDate: Tanggal transaksi (format DD/MM/YYYY, misal "09/10/2026").

10. transactionTime: Waktu/jam transaksi jika tertera (misal "14:25:08 WIB" atau "14:25").

11. refNumber: Nomor referensi transaksi, No Jurnal, No Bukti, atau Transaction ID.

12. transactionType: Selalu tulis "TRANSFER ANTAR BANK".

13. status: Status transaksi, utamakan "BERHASIL" atau "SUKSES".

14. notes: Berita transfer, catatan, atau keterangan jika ada.
`;

    let lastError: any = null;
    let parsedData: any = null;

    // Helper to safely parse numbers
    const cleanNumber = (val: any, fallback: number = 100000): number => {
      if (typeof val === 'number') return Math.round(val);
      if (!val) return fallback;
      const str = String(val).replace(/[^0-9]/g, '');
      const parsed = parseInt(str, 10);
      return isNaN(parsed) || parsed <= 0 ? fallback : parsed;
    };

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
              'Kamu adalah asisten OCR spesialis bukti transfer perbankan dan dompet digital Indonesia. Berikan output terstruktur JSON dengan data seakurat mungkin dari gambar. Bersikaplah fleksibel dalam mendeteksi tata letak bukti transfer dari semua bank di Indonesia.',
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
            },
          },
        });

        const rawText = response.text || '{}';
        // Clean markdown blocks if any
        const cleanedText = rawText.replace(/```json\s*|```/g, '').trim();
        parsedData = JSON.parse(cleanedText);
        if (parsedData) {
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

    // If all models failed or were busy, return graceful draft so user can still edit & print!
    console.error('All AI models failed, using fallback draft:', lastError);
    return res.json({
      success: true,
      data: fallbackDraft,
      warning: 'Layanan AI sedang sibuk sementara. Data draf otomatis telah dimuat, silakan sesuaikan nominal dan penerima.',
    });
  } catch (error: any) {
    console.error('Fatal error in parse-receipt endpoint:', error);
    return res.json({
      success: true,
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
        transactionType: 'TRANSFER ONLINE',
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
