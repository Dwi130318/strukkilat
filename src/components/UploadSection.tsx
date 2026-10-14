import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Clipboard, Sparkles, AlertCircle, FileImage, Check, Zap, Share2, CreditCard } from 'lucide-react';
import { ReceiptData, PlnTokenData, VirtualAccountData, AppMode } from '../types/receipt';
import { SAMPLE_RECEIPTS, SAMPLE_VIRTUAL_ACCOUNTS } from '../utils/sampleData';

interface UploadSectionProps {
  mode: AppMode;
  onParsed: (receipt: ReceiptData, imageSrc?: string, isFallback?: boolean) => void;
  onParsedPln?: (plnData: PlnTokenData, imageSrc?: string, isFallback?: boolean) => void;
  onParsedVa?: (vaData: VirtualAccountData, imageSrc?: string, isFallback?: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  defaultAgentFee: number;
}

export function UploadSection({
  mode,
  onParsed,
  onParsedPln,
  onParsedVa,
  isProcessing,
  setIsProcessing,
  defaultAgentFee,
}: UploadSectionProps) {
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Cycle scanning messages for engaging UX during OCR
  useEffect(() => {
    if (!isProcessing) return;
    const steps =
      mode === 'pln_token'
        ? [
            'Membaca gambar screenshot bukti token PLN...',
            'Mendeteksi 20 digit nomor STROOM / TOKEN...',
            'Mengekstrak IDPEL, Nomor Meter, & Nama Pelanggan...',
            'Menyusun format struk thermal token PLN...',
          ]
        : mode === 'virtual_account'
        ? [
            'Membaca bukti pembayaran Virtual Account...',
            'Mendeteksi nomor VA, Institusi / Biller, & Pelanggan...',
            'Mengekstrak nominal tagihan & kode referensi...',
            'Menyusun format struk Virtual Account...',
          ]
        : [
            'Membaca gambar screenshot m-banking...',
            'Menganalisis bank asal, penerima, dan nomor rekening...',
            'Mendeteksi nominal transfer, tanggal, & kode referensi...',
            'Menyusun format struk thermal...',
          ];
    let index = 0;
    setScanStep(steps[0]);
    const timer = setInterval(() => {
      index = (index + 1) % steps.length;
      setScanStep(steps[index]);
    }, 1200);
    return () => clearInterval(timer);
  }, [isProcessing, mode]);

  // Preserve crisp original image for OCR, only scale if extremely large (> 4MB)
  const optimizeImageForOcr = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawBase64 = (e.target?.result as string) || '';
        // If file is already under 4MB, use the pristine original image to preserve full sharpness for OCR
        if (file.size <= 4 * 1024 * 1024) {
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
          return;
        }

        // Only compress very large photos (e.g. 10MB+ raw camera shots)
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 2400; // Keep generous resolution for tiny receipt text
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Fill with pure white background to avoid black background bug on transparent PNGs
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.92);
            resolve({ base64: compressed, mimeType: 'image/jpeg' });
            return;
          }
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
        };
        img.onerror = () => {
          resolve({ base64: rawBase64, mimeType: file.type || 'image/jpeg' });
        };
        img.src = rawBase64;
      };
      reader.onerror = () => {
        resolve({ base64: '', mimeType: 'image/jpeg' });
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle image processing & call /api/parse-receipt
  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Harap unggah file gambar (JPG, PNG, atau WEBP).');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const { base64: base64Data, mimeType } = await optimizeImageForOcr(file);
      if (!base64Data) {
        throw new Error('Gagal memproses file gambar.');
      }

      try {
        let res: Response;
        try {
          res = await fetch('/api/parse-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType: mimeType,
              mode: mode,
            }),
          });
          // Jika 404/405 (misal di cPanel Apache di mana /api berupa file php)
          if (res.status === 404 || res.status === 405) {
            res = await fetch('/api/parse-receipt.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageBase64: base64Data,
                mimeType: mimeType,
                mode: mode,
              }),
            });
          }
        } catch (fetchErr: any) {
          throw new Error('Gagal menghubungi server pemindai: ' + (fetchErr.message || 'Periksa koneksi Anda'));
        }

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let errMsg = `Server HTTP ${res.status}`;
          try {
            const errParsed = JSON.parse(errText);
            if (errParsed.error || errParsed.warning) errMsg = errParsed.error || errParsed.warning;
          } catch {}
          throw new Error(errMsg);
        }

        const json = await res.json();
        const isFallback = Boolean(json.isFallback);

        if (json.error) {
          setErrorMessage(json.error);
        } else if (json.warning) {
          setErrorMessage(json.warning);
        }

        const parsed = json.data || {};

        // Helper to sanitize text fields
        const cleanStr = (val: any, fallback: string = ''): string => {
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

        // PLN TOKEN PARSING
        if (mode === 'pln_token' && onParsedPln) {
          const nominal = Number(parsed.amount) || 100000;
          let meter = cleanStr(parsed.meterNumber, '');
          let idpel = cleanStr(parsed.customerId, '');
          if (!meter && idpel) meter = idpel;
          if (!idpel && meter) idpel = meter;
          if (!meter && !idpel) {
            meter = '32019482910';
            idpel = '52109823412';
          }

          let token = cleanStr(parsed.tokenNumber, '');
          const digits = token.replace(/\D/g, '');
          if (digits.length === 20) {
            token = `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)} ${digits.slice(16, 20)}`;
          } else if (!token || token.length < 12) {
            token = '3819 4820 1928 4719 0192';
          }

          let kwh = cleanStr(parsed.kwhAmount, '-');
          if (kwh !== '-' && !kwh.toLowerCase().includes('kwh')) {
            kwh = `${kwh} kWh`;
          }

          const newPln: PlnTokenData = {
            id: 'pln-' + Date.now(),
            meterNumber: meter,
            customerId: idpel,
            customerName: cleanStr(parsed.customerName, 'PELANGGAN PLN'),
            tariffPower: cleanStr(parsed.tariffPower, 'R1 / 1300 VA'),
            tokenNumber: token,
            kwhAmount: kwh,
            amount: nominal,
            adminFee: 0,
            agentFee: 0,
            totalAmount: nominal,
            transactionDate: cleanStr(parsed.transactionDate, new Date().toLocaleDateString('id-ID')),
            transactionTime: cleanStr(parsed.transactionTime, new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'),
            refNumber: cleanStr(parsed.refNumber, 'PLN' + Date.now().toString().slice(-8)),
            createdAt: new Date().toISOString(),
          };
          onParsedPln(newPln, base64Data, isFallback);
          return;
        }

        // VIRTUAL ACCOUNT PARSING
        if (mode === 'virtual_account' && onParsedVa) {
          const nominal = Number(parsed.amount) || 250000;
          const admin = Number(parsed.adminFee) || 0;
          const cleanVa = cleanStr(parsed.vaNumber, '1280081298765432').replace(/\s+/g, '');
          const biller = cleanStr(parsed.billerName, 'VIRTUAL ACCOUNT');
          const cust = cleanStr(parsed.customerName, 'PELANGGAN VA');
          const bank = cleanStr(parsed.bankSource, 'BRI');

          const newVa: VirtualAccountData = {
            id: 'va-' + Date.now(),
            bankSource: bank,
            vaProvider: cleanStr(parsed.vaProvider, bank ? `${bank} VA` : 'VIRTUAL ACCOUNT'),
            vaNumber: cleanVa,
            billerName: biller,
            customerName: cust,
            amount: nominal,
            adminFee: admin,
            agentFee: 0,
            totalAmount: nominal + admin,
            transactionDate: cleanStr(parsed.transactionDate, new Date().toLocaleDateString('id-ID')),
            transactionTime: cleanStr(parsed.transactionTime, new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'),
            refNumber: cleanStr(parsed.refNumber, 'VA' + Date.now().toString().slice(-8)),
            status: (cleanStr(parsed.status, 'SUKSES').toUpperCase().includes('BERHASIL') ? 'BERHASIL' : 'SUKSES') as any,
            notes: cleanStr(parsed.notes, ''),
            createdAt: new Date().toISOString(),
          };
          onParsedVa(newVa, base64Data, isFallback);
          return;
        }

        // TRANSFER RECEIPT PARSING
        const nominal = Number(parsed.amount) || 100000;
        const bankFee = Number(parsed.bankAdminFee) || 0;
        const total = nominal + bankFee;

        const srcBank = cleanStr(parsed.bankSource, 'M-BANKING');
        const destBank = cleanStr(parsed.bankDestination, srcBank !== 'M-BANKING' ? srcBank : 'BANK TUJUAN');

        const newReceipt: ReceiptData = {
          id: 'receipt-' + Date.now(),
          bankSource: srcBank,
          bankDestination: destBank,
          recipientName: cleanStr(parsed.recipientName, 'PENERIMA TRANSFER'),
          recipientAccount: cleanStr(parsed.recipientAccount, '-').replace(/\s+/g, ''),
          senderName: cleanStr(parsed.senderName, ''),
          senderAccount: cleanStr(parsed.senderAccount, ''),
          amount: nominal,
          bankAdminFee: bankFee,
          agentFee: 0,
          totalAmount: total,
          transactionDate: cleanStr(parsed.transactionDate, new Date().toLocaleDateString('id-ID')),
          transactionTime: cleanStr(parsed.transactionTime, new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'),
          refNumber: cleanStr(parsed.refNumber, 'TRX' + Date.now().toString().slice(-8)),
          transactionType: 'TRANSFER ANTAR BANK',
          status: (cleanStr(parsed.status, 'BERHASIL').toUpperCase().includes('SUKSES') ? 'SUKSES' : 'BERHASIL') as any,
          notes: cleanStr(parsed.notes, ''),
          customerName: '',
          cashierName: 'Kasir',
          createdAt: new Date().toISOString(),
        };

        onParsed(newReceipt, base64Data, isFallback);
      } catch (apiErr: any) {
        console.error(apiErr);
        if (mode === 'pln_token' && onParsedPln) {
          const fallbackPln: PlnTokenData = {
            id: 'pln-' + Date.now(),
            meterNumber: '32019482910',
            customerId: '52109823412',
            customerName: 'PELANGGAN PLN',
            tariffPower: 'R1 / 1300 VA',
            tokenNumber: '3819 4820 1928 4719 0192',
            kwhAmount: '65.8 kWh',
            amount: 100000,
            adminFee: 0,
            agentFee: 0,
            totalAmount: 100000,
            transactionDate: new Date().toLocaleDateString('id-ID'),
            transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: 'PLN' + Date.now().toString().slice(-8),
            createdAt: new Date().toISOString(),
          };
          onParsedPln(fallbackPln, base64Data, true);
        } else if (mode === 'virtual_account' && onParsedVa) {
          const fallbackVa: VirtualAccountData = {
            id: 'va-' + Date.now(),
            bankSource: 'BRI',
            vaProvider: 'BRIVA',
            vaNumber: '1280081298765432',
            billerName: 'SHOPEEPAY INDONESIA',
            customerName: 'DWI KURNIAWAN',
            amount: 250000,
            adminFee: 0,
            agentFee: 0,
            totalAmount: 250000,
            transactionDate: new Date().toLocaleDateString('id-ID'),
            transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: 'BRIVA' + Date.now().toString().slice(-8),
            status: 'SUKSES',
            notes: '',
            createdAt: new Date().toISOString(),
          };
          onParsedVa(fallbackVa, base64Data, true);
        } else {
          const fallbackReceipt: ReceiptData = {
            id: 'receipt-' + Date.now(),
            bankSource: 'M-BANKING',
            bankDestination: 'BANK TUJUAN',
            recipientName: 'PENERIMA TRANSFER',
            recipientAccount: '-',
            senderName: '',
            senderAccount: '',
            amount: 100000,
            bankAdminFee: 0,
            agentFee: 0,
            totalAmount: 100000,
            transactionDate: new Date().toLocaleDateString('id-ID'),
            transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: 'TRX' + Date.now().toString().slice(-8),
            transactionType: 'TRANSFER ANTAR BANK',
            status: 'SUKSES',
            createdAt: new Date().toISOString(),
          };
          onParsed(fallbackReceipt, base64Data, true);
        }
        setErrorMessage(
          apiErr.message ||
          'AI sedang sibuk atau gambar kurang jelas. Form struk telah disiapkan di bawah agar Anda dapat melengkapi data manual.'
        );
      } finally {
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error(err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Gagal membaca berkas gambar.');
    }
  };

  // Clipboard Paste Support (Ctrl+V)
  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard-screenshot.png', { type });
            await processImageFile(file);
            return;
          }
        }
      }
      setErrorMessage('Tidak ada gambar di clipboard. Salin gambar atau tekan PrintScreen dahulu.');
    } catch {
      setErrorMessage('Browser tidak mengizinkan akses clipboard langsung. Silakan tekan Ctrl+V pada halaman ini.');
    }
  };

  // Global paste handler
  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [mode]);

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            {mode === 'pln_token' ? (
              <>
                <Zap className="w-5 h-5 text-amber-400" />
                <span>Pindai Screenshot Token Listrik PLN</span>
              </>
            ) : mode === 'virtual_account' ? (
              <>
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>Pindai Screenshot Bukti Virtual Account</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>Pindai Screenshot Bukti Transfer</span>
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'pln_token'
              ? 'AI otomatis mengekstrak 20 digit token, ID Pelanggan, nomor meter, tarif daya, & kWh'
              : mode === 'virtual_account'
              ? 'AI otomatis mendeteksi nomor VA, institusi/merchant, nama pelanggan, & nominal'
              : 'AI otomatis mendeteksi nama bank, rekening tujuan, nominal, tanggal, & kode referensi'}
          </p>
        </div>

        {/* Quick Sample Selector for Instant Demo */}
        {mode === 'transfer' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Contoh Cepat:</span>
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {SAMPLE_RECEIPTS.slice(0, 3).map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => onParsed(s)}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded border border-slate-600 transition whitespace-nowrap"
                  title={`Gunakan contoh ${s.bankDestination}`}
                >
                  {idx === 0 ? 'Mini ATM (BNI)' : s.bankDestination}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'virtual_account' && onParsedVa && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Contoh Cepat:</span>
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {SAMPLE_VIRTUAL_ACCOUNTS.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => onParsedVa(s)}
                  className="px-2 py-1 text-[11px] font-medium bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 rounded border border-emerald-700/60 transition whitespace-nowrap"
                  title={`Gunakan contoh ${s.billerName}`}
                >
                  {s.billerName.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

        {/* DRAG & DROP ZONE */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processImageFile(e.dataTransfer.files[0]);
          }
        }}
        className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center transition-all ${
          dragOver
            ? mode === 'pln_token'
              ? 'border-amber-400 bg-amber-950/20 scale-[0.99]'
              : mode === 'virtual_account'
              ? 'border-emerald-400 bg-emerald-950/20 scale-[0.99]'
              : 'border-indigo-400 bg-indigo-950/20 scale-[0.99]'
            : 'border-slate-600 bg-slate-900/60 hover:border-slate-500'
        }`}
      >
        {isProcessing ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <div
                className={`w-12 h-12 border-4 rounded-full animate-spin ${
                  mode === 'pln_token'
                    ? 'border-amber-500/20 border-t-amber-400'
                    : mode === 'virtual_account'
                    ? 'border-emerald-500/20 border-t-emerald-400'
                    : 'border-indigo-500/20 border-t-indigo-400'
                }`}
              />
              <Sparkles
                className={`w-5 h-5 absolute inset-0 m-auto animate-pulse ${
                  mode === 'pln_token'
                    ? 'text-amber-400'
                    : mode === 'virtual_account'
                    ? 'text-emerald-400'
                    : 'text-indigo-400'
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Memproses Bukti Transaksi...</p>
              <p
                className={`text-xs mt-1 transition-all duration-300 font-mono ${
                  mode === 'pln_token'
                    ? 'text-amber-300'
                    : mode === 'virtual_account'
                    ? 'text-emerald-300'
                    : 'text-indigo-300'
                }`}
              >
                {scanStep}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label
              className="cursor-pointer block touch-manipulation group"
              title="Klik untuk memilih foto bukti transfer"
            >
              <input
                type="file"
                accept="image/*,image/jpeg,image/png,image/webp,image/jpg"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processImageFile(e.target.files[0]);
                  }
                  e.target.value = '';
                }}
              />
              <div
                className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center transition group-hover:scale-105 ${
                  mode === 'pln_token'
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                    : mode === 'virtual_account'
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : 'bg-indigo-950/60 text-indigo-400 border border-indigo-500/30'
                }`}
              >
                {mode === 'pln_token' ? (
                  <Zap className="w-6 h-6" />
                ) : mode === 'virtual_account' ? (
                  <CreditCard className="w-6 h-6" />
                ) : (
                  <Upload className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1 mt-3">
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition">
                  Tukang struk: Sentuh di sini atau pilih tombol di bawah
                </p>
                <p className="text-xs text-slate-400">
                  {mode === 'pln_token'
                    ? 'Mendukung bukti pembelian token dari PLN Mobile, M-Banking, dll'
                    : mode === 'virtual_account'
                    ? 'Mendukung bukti bayar BRIVA, BCA VA, Mandiri VA, ShopeePay, Tokopedia, dll'
                    : 'Mendukung screenshot JPG, PNG, WEBP dari semua M-Banking'}
                </p>
              </div>
            </label>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <label
                className={`cursor-pointer px-4 py-2.5 text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 active:scale-95 touch-manipulation select-none ${
                  mode === 'pln_token'
                    ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold'
                    : mode === 'virtual_account'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <input
                  type="file"
                  accept="image/*,image/jpeg,image/png,image/webp,image/jpg"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processImageFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <FileImage className="w-4 h-4 shrink-0" />
                <span>Pilih Berkas Foto</span>
              </label>

              <label
                className="cursor-pointer px-4 py-2.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 shadow transition flex items-center gap-1.5 active:scale-95 touch-manipulation select-none"
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processImageFile(e.target.files[0]);
                    }
                    e.target.value = '';
                  }}
                />
                <Camera className="w-4 h-4 shrink-0" />
                <span>Foto Kamera Langsung</span>
              </label>

              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-4 py-2.5 text-xs font-medium bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 shadow transition flex items-center gap-1.5 active:scale-95 touch-manipulation"
                title="Tempel dari Clipboard (Ctrl + V)"
              >
                <Clipboard className="w-4 h-4 shrink-0" />
                <span>Tempel Screenshot (Ctrl+V)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DIRECT SHARE TIP BANNER */}
      <div className="mt-3 p-3 bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
            <Share2 className="w-4 h-4" />
          </div>
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-white block text-xs">Kirim Langsung dari M-Banking (BRImo):</span>
            <span className="text-slate-300">
              Selesai transfer di BRImo ➡️ Tekan tombol <strong>"Bagikan / Share"</strong> ➡️ Pilih aplikasi <strong>StrukKilat</strong>!
            </span>
          </div>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-amber-950/40 border border-amber-500/50 rounded-lg flex items-start gap-2 text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
    </div>
  );
}
