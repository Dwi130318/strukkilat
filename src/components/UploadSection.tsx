import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Clipboard, Sparkles, AlertCircle, FileImage, Check, Zap, Share2 } from 'lucide-react';
import { ReceiptData, PlnTokenData, AppMode } from '../types/receipt';
import { SAMPLE_RECEIPTS } from '../utils/sampleData';

interface UploadSectionProps {
  mode: AppMode;
  onParsed: (receipt: ReceiptData, imageSrc?: string) => void;
  onParsedPln?: (plnData: PlnTokenData, imageSrc?: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  defaultAgentFee: number;
}

export function UploadSection({
  mode,
  onParsed,
  onParsedPln,
  isProcessing,
  setIsProcessing,
  defaultAgentFee,
}: UploadSectionProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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

  // Compress and optimize image to max 1280px to prevent 413 Payload Too Large on cPanel
  const optimizeImageForOcr = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawBase64 = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1600;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width / height > MAX_WIDTH / MAX_HEIGHT) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            } else {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
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
      setPreviewImage(base64Data);

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
          // Jika 404 (misal mod_rewrite cPanel mati), otomatis coba langsung ke .php
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
        } catch {
          // Jika gagal koneksi rute pertama, coba langsung file .php
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
              agentFee: 0, // Hasil pertama scan langsung tanpa biaya jasa
              totalAmount: nominal,
              transactionDate: cleanStr(parsed.transactionDate, new Date().toLocaleDateString('id-ID')),
              transactionTime: cleanStr(parsed.transactionTime, new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'),
              refNumber: cleanStr(parsed.refNumber, 'PLN' + Date.now().toString().slice(-8)),
              sourceScreenshot: base64Data,
              createdAt: new Date().toISOString(),
            };
            onParsedPln(newPln, base64Data);
            return;
          }

          // TRANSFER RECEIPT PARSING
          const nominal = Number(parsed.amount) || 100000;
          const bankFee = Number(parsed.bankAdminFee) || 0;
          const total = nominal + bankFee;

          const newReceipt: ReceiptData = {
            id: 'receipt-' + Date.now(),
            bankSource: cleanStr(parsed.bankSource, 'M-BANKING'),
            bankDestination: cleanStr(parsed.bankDestination, 'BANK TUJUAN'),
            recipientName: cleanStr(parsed.recipientName, 'PENERIMA TRANSFER'),
            recipientAccount: cleanStr(parsed.recipientAccount, '-'),
            senderName: cleanStr(parsed.senderName, ''),
            senderAccount: cleanStr(parsed.senderAccount, ''),
            amount: nominal,
            bankAdminFee: bankFee,
            agentFee: 0,
            totalAmount: total,
            transactionDate: cleanStr(parsed.transactionDate, new Date().toLocaleDateString('id-ID')),
            transactionTime: cleanStr(parsed.transactionTime, new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'),
            refNumber: cleanStr(parsed.refNumber, 'TRX' + Date.now().toString().slice(-8)),
            transactionType: cleanStr(parsed.transactionType, 'TRANSFER ANTAR BANK'),
            status: (cleanStr(parsed.status, 'BERHASIL').toUpperCase().includes('SUKSES') ? 'SUKSES' : 'BERHASIL') as any,
            notes: cleanStr(parsed.notes, ''),
            customerName: '',
            cashierName: 'Kasir',
            sourceScreenshot: base64Data,
            createdAt: new Date().toISOString(),
          };

          onParsed(newReceipt, base64Data);
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
              sourceScreenshot: base64Data,
              createdAt: new Date().toISOString(),
            };
            onParsedPln(fallbackPln, base64Data);
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
              sourceScreenshot: base64Data,
              createdAt: new Date().toISOString(),
            };
            onParsed(fallbackReceipt, base64Data);
          }
          setErrorMessage(
            apiErr.message ||
            'AI sedang sibuk sementara. Form struk otomatis dibuka di bawah agar Anda dapat menyesuaikan nominal & data.'
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
              : 'border-indigo-400 bg-indigo-950/20 scale-[0.99]'
            : 'border-slate-600 bg-slate-900/60 hover:border-slate-500'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              processImageFile(e.target.files[0]);
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              processImageFile(e.target.files[0]);
            }
          }}
        />

        {isProcessing ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <div className="relative">
              <div
                className={`w-12 h-12 border-4 rounded-full animate-spin ${
                  mode === 'pln_token'
                    ? 'border-amber-500/20 border-t-amber-400'
                    : 'border-indigo-500/20 border-t-indigo-400'
                }`}
              />
              <Sparkles
                className={`w-5 h-5 absolute inset-0 m-auto animate-pulse ${
                  mode === 'pln_token' ? 'text-amber-400' : 'text-indigo-400'
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Memproses Bukti Transaksi...</p>
              <p
                className={`text-xs mt-1 transition-all duration-300 font-mono ${
                  mode === 'pln_token' ? 'text-amber-300' : 'text-indigo-300'
                }`}
              >
                {scanStep}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                mode === 'pln_token'
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                  : 'bg-indigo-950/60 text-indigo-400 border border-indigo-500/30'
              }`}
            >
              {mode === 'pln_token' ? <Zap className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-200">
                Tarik & letakkan screenshot bukti {mode === 'pln_token' ? 'token PLN' : 'transfer'} ke sini
              </p>
              <p className="text-xs text-slate-400">
                Atau pilih opsi unggah di bawah ini (Mendukung JPG, PNG, WEBP)
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 ${
                  mode === 'pln_token'
                    ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <FileImage className="w-3.5 h-3.5" />
                Pilih Berkas Foto
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3.5 py-2 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 shadow transition flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Foto Kamera Langsung
              </button>

              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-3.5 py-2 text-xs font-medium bg-slate-700/80 hover:bg-slate-600 text-slate-200 rounded-lg border border-slate-600 shadow transition flex items-center gap-1.5"
                title="Tempel dari Clipboard (Ctrl + V)"
              >
                <Clipboard className="w-3.5 h-3.5" />
                Tempel Screenshot (Ctrl+V)
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
