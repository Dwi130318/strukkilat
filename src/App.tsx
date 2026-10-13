import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  Bluetooth,
  Download,
  Copy,
  Share2,
  History,
  Sparkles,
  Store,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sliders,
  RefreshCw,
  Zap,
  ArrowRightLeft,
  CreditCard,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng, toBlob } from 'html-to-image';

import { ReceiptData, StoreProfile, PrintSettings, AppMode, PlnTokenData, VirtualAccountData } from './types/receipt';
import {
  DEFAULT_STORE_PROFILE,
  DEFAULT_PRINT_SETTINGS,
  SAMPLE_RECEIPTS,
  DEFAULT_PLN_TOKEN,
  EMPTY_RECEIPT,
  EMPTY_PLN_TOKEN,
  EMPTY_VIRTUAL_ACCOUNT,
  DEFAULT_VIRTUAL_ACCOUNT,
} from './utils/sampleData';
import {
  generateReceiptEscPos,
  generatePlnTokenEscPos,
  generateVirtualAccountEscPos,
  printToBluetoothThermal,
  getActiveBluetoothDevice,
  getRawBtUrl,
  formatRupiah,
} from './utils/escpos';

import { ReceiptView } from './components/ReceiptView';
import { PlnTokenView } from './components/PlnTokenView';
import { VirtualAccountView } from './components/VirtualAccountView';
import { UploadSection } from './components/UploadSection';
import { ReceiptEditor } from './components/ReceiptEditor';
import { PlnTokenEditor } from './components/PlnTokenEditor';
import { VirtualAccountEditor } from './components/VirtualAccountEditor';
import { BluetoothPrinterModal } from './components/BluetoothPrinterModal';
import { HistoryModal } from './components/HistoryModal';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  // Mode State: 'transfer' | 'pln_token' | 'virtual_account'
  const [mode, setMode] = useState<AppMode>('transfer');

  // Store & Settings State
  const [store, setStore] = useState<StoreProfile>(() => {
    const saved = localStorage.getItem('strukkilat_store');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_STORE_PROFILE, ...parsed, defaultAgentFee: 0 };
      } catch {}
    }
    return DEFAULT_STORE_PROFILE;
  });

  const [settings, setSettings] = useState<PrintSettings>(() => {
    const saved = localStorage.getItem('strukkilat_settings');
    return saved ? JSON.parse(saved) : DEFAULT_PRINT_SETTINGS;
  });

  // Transfer Receipt State (Mulai KOSONG saat buka aplikasi sesuai permintaan pengguna)
  const [receipt, setReceipt] = useState<ReceiptData>(EMPTY_RECEIPT);

  // PLN Token State (Mulai KOSONG saat buka aplikasi sesuai permintaan pengguna)
  const [plnToken, setPlnToken] = useState<PlnTokenData>(EMPTY_PLN_TOKEN);

  // Virtual Account State (Mulai KOSONG saat buka aplikasi)
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccountData>(() => {
    const saved = localStorage.getItem('strukkilat_va');
    return saved ? JSON.parse(saved) : EMPTY_VIRTUAL_ACCOUNT;
  });

  const [isProcessingOcr, setIsProcessingOcr] = useState(false);

  // Auto-process file shared directly from BRImo / Android Share Sheet
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('shared_id');
    if (!sharedId) return;

    // Clean URL query without page reload
    window.history.replaceState({}, '', '/');

    const fetchAndProcessShared = async () => {
      setIsProcessingOcr(true);
      showToast('Menerima bukti transaksi dari BRImo / Android...', 'info');

      try {
        const res = await fetch(`/api/shared-file/${sharedId}`);
        const json = await res.json();
        if (!json.success || !json.dataUrl) {
          showToast('Gagal memuat gambar bukti transfer yang dibagikan.', 'error');
          return;
        }

        const ocrRes = await fetch('/api/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: json.dataUrl,
            mimeType: json.mimeType || 'image/jpeg',
            mode: mode,
          }),
        });

        const ocrJson = await ocrRes.json();
        const parsed = ocrJson.data || {};

        if (mode === 'pln_token') {
          const nominal = Number(parsed.amount) || 100000;
          const cleanPln: PlnTokenData = {
            id: 'pln-' + Date.now(),
            meterNumber: parsed.meterNumber || '-',
            customerId: parsed.customerId || '-',
            customerName: parsed.customerName || 'PELANGGAN PLN',
            tariffPower: parsed.tariffPower || 'R1 / 1300 VA',
            tokenNumber: parsed.tokenNumber || '3819 4820 1928 4719 0192',
            kwhAmount: parsed.kwhAmount || '-',
            amount: nominal,
            adminFee: 0,
            agentFee: 0,
            totalAmount: nominal,
            transactionDate: parsed.transactionDate || new Date().toLocaleDateString('id-ID'),
            transactionTime: parsed.transactionTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: parsed.refNumber || 'PLN' + Date.now().toString().slice(-8),
            sourceScreenshot: json.dataUrl,
            createdAt: new Date().toISOString(),
          };
          setPlnToken(cleanPln);
          showToast('Bukti transaksi PLN siap dicetak!', 'success');
        } else if (mode === 'virtual_account') {
          const nominal = Number(parsed.amount) || 250000;
          const admin = Number(parsed.adminFee) || 0;
          const cleanVa: VirtualAccountData = {
            id: 'va-' + Date.now(),
            bankSource: parsed.bankSource || 'BRI',
            vaProvider: parsed.vaProvider || 'BRIVA',
            vaNumber: (parsed.vaNumber || '1280081298765432').replace(/\s+/g, ''),
            billerName: parsed.billerName || 'SHOPEEPAY',
            customerName: parsed.customerName || 'PELANGGAN VA',
            amount: nominal,
            adminFee: admin,
            agentFee: 0,
            totalAmount: nominal + admin,
            transactionDate: parsed.transactionDate || new Date().toLocaleDateString('id-ID'),
            transactionTime: parsed.transactionTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: parsed.refNumber || 'VA' + Date.now().toString().slice(-8),
            status: (parsed.status?.toUpperCase().includes('SUKSES') ? 'SUKSES' : 'BERHASIL') as any,
            notes: parsed.notes || '',
            sourceScreenshot: json.dataUrl,
            createdAt: new Date().toISOString(),
          };
          setVirtualAccount(cleanVa);
          showToast('Bukti transaksi Virtual Account siap dicetak!', 'success');
        } else {
          const nominal = Number(parsed.amount) || 100000;
          const bankFee = Number(parsed.bankAdminFee) || 0;
          const cleanReceipt: ReceiptData = {
            id: 'receipt-' + Date.now(),
            bankSource: parsed.bankSource || 'M-BANKING BRImo',
            bankDestination: parsed.bankDestination || 'BANK TUJUAN',
            recipientName: parsed.recipientName || 'PENERIMA TRANSFER',
            recipientAccount: (parsed.recipientAccount || '-').replace(/\s+/g, ''),
            senderName: parsed.senderName || '',
            senderAccount: parsed.senderAccount || '',
            amount: nominal,
            bankAdminFee: bankFee,
            agentFee: 0,
            totalAmount: nominal + bankFee,
            transactionDate: parsed.transactionDate || new Date().toLocaleDateString('id-ID'),
            transactionTime: parsed.transactionTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
            refNumber: parsed.refNumber || 'TRX' + Date.now().toString().slice(-8),
            transactionType: 'TRANSFER ANTAR BANK',
            status: (parsed.status?.toUpperCase().includes('SUKSES') ? 'SUKSES' : 'BERHASIL') as any,
            notes: parsed.notes || '',
            customerName: '',
            cashierName: 'Kasir',
            sourceScreenshot: json.dataUrl,
            createdAt: new Date().toISOString(),
          };
          setReceipt(cleanReceipt);
          setHistory((prev) => [cleanReceipt, ...prev.filter((i) => i.id !== cleanReceipt.id)].slice(0, 50));
          showToast('Bukti transfer BRImo berhasil dibaca & siap dicetak!', 'success');
        }
      } catch (err: any) {
        console.error('Error processing shared file:', err);
        showToast('Gagal memproses struk yang dibagikan.', 'error');
      } finally {
        setIsProcessingOcr(false);
      }
    };

    fetchAndProcessShared();
  }, [mode]);
  const [history, setHistory] = useState<ReceiptData[]>(() => {
    const saved = localStorage.getItem('strukkilat_history');
    return saved ? JSON.parse(saved) : SAMPLE_RECEIPTS;
  });

  // Modals & UI States
  const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [isPrintingBt, setIsPrintingBt] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('strukkilat_store', JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    localStorage.setItem('strukkilat_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('strukkilat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('strukkilat_va', JSON.stringify(virtualAccount));
  }, [virtualAccount]);

  // Check active bluetooth device on mount
  useEffect(() => {
    const active = getActiveBluetoothDevice();
    if (active?.name) {
      setConnectedPrinterName(active.name);
    }
  }, []);

  // Toast notification helper
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Triggered when OCR finishes successfully for Transfer
  const handleOcrParsed = (newReceipt: ReceiptData) => {
    const cleanReceipt: ReceiptData = {
      ...newReceipt,
      agentFee: 0,
      totalAmount: (Number(newReceipt.amount) || 0) + (Number(newReceipt.bankAdminFee) || 0),
    };
    setReceipt(cleanReceipt);
    setHistory((prev) => [cleanReceipt, ...prev.filter((item) => item.id !== cleanReceipt.id)].slice(0, 50));
    showToast('OCR Bukti Transfer Berhasil!', 'success');
  };

  // Triggered when OCR finishes successfully for PLN Token
  const handleOcrParsedPln = (newPln: PlnTokenData) => {
    const cleanPln: PlnTokenData = {
      ...newPln,
      adminFee: 0,
      agentFee: 0,
      totalAmount: Number(newPln.amount) || 0,
    };
    setPlnToken(cleanPln);
    showToast('OCR Bukti Token PLN Berhasil!', 'success');
  };

  // Triggered when OCR finishes successfully for Virtual Account
  const handleOcrParsedVa = (newVa: VirtualAccountData) => {
    const cleanVa: VirtualAccountData = {
      ...newVa,
      agentFee: 0,
      totalAmount: (Number(newVa.amount) || 0) + (Number(newVa.adminFee) || 0),
    };
    setVirtualAccount(cleanVa);
    showToast('OCR Bukti Virtual Account Berhasil!', 'success');
  };

  // Reset & Sample Handlers
  const handleResetReceipt = () => {
    setReceipt(EMPTY_RECEIPT);
    showToast('Form data transfer telah dikosongkan.', 'info');
  };

  const handleLoadSampleReceipt = () => {
    const sample = SAMPLE_RECEIPTS[0];
    setReceipt({
      ...sample,
      agentFee: 0,
      totalAmount: sample.amount,
      transactionDate: new Date().toLocaleDateString('id-ID'),
      transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      refNumber: 'TRX' + Date.now().toString().slice(-8),
    });
    showToast('Contoh transaksi transfer berhasil dimuat.', 'success');
  };

  const handleResetPln = () => {
    setPlnToken(EMPTY_PLN_TOKEN);
    showToast('Form token listrik telah dikosongkan.', 'info');
  };

  const handleLoadSamplePln = () => {
    setPlnToken({
      ...DEFAULT_PLN_TOKEN,
      transactionDate: new Date().toLocaleDateString('id-ID'),
      transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      refNumber: 'PLN' + Date.now().toString().slice(-8),
    });
    showToast('Contoh token listrik berhasil dimuat.', 'success');
  };

  const handleResetVa = () => {
    setVirtualAccount(EMPTY_VIRTUAL_ACCOUNT);
    showToast('Form Virtual Account telah dikosongkan.', 'info');
  };

  const handleLoadSampleVa = () => {
    setVirtualAccount({
      ...DEFAULT_VIRTUAL_ACCOUNT,
      transactionDate: new Date().toLocaleDateString('id-ID'),
      transactionTime: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      refNumber: 'BRIVA' + Date.now().toString().slice(-8),
    });
    showToast('Contoh transaksi Virtual Account berhasil dimuat.', 'success');
  };

  // Direct Print via Web Bluetooth (ESC/POS)
  const handlePrintBluetooth = async () => {
    setIsPrintingBt(true);
    try {
      const escPosBytes =
        mode === 'pln_token'
          ? generatePlnTokenEscPos(plnToken, store, settings)
          : mode === 'virtual_account'
          ? generateVirtualAccountEscPos(virtualAccount, store, settings)
          : generateReceiptEscPos(receipt, store, settings);

      await printToBluetoothThermal(escPosBytes);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
      showToast('Struk berhasil dicetak ke printer Bluetooth!', 'success');
    } catch (err: any) {
      console.warn('Bluetooth print fallback:', err);
      if (
        err.name === 'SecurityError' ||
        err.message?.includes('jendela pratinjau') ||
        err.message?.includes('permissions policy') ||
        err.message?.includes('iFrame')
      ) {
        showToast('Bluetooth dibatasi di jendela pratinjau. Mengalihkan ke Cetak Sistem...', 'info');
        handleBrowserPrint();
      } else {
        showToast(err.message || 'Gagal mencetak ke printer Bluetooth.', 'error');
      }
    } finally {
      setIsPrintingBt(false);
    }
  };

  // Browser Standard Print (Ctrl + P)
  const handleBrowserPrint = () => {
    window.print();
  };

  // Generate clean filename helper
  const getReceiptFilename = () => {
    if (mode === 'pln_token') {
      const cleanName = (plnToken.customerName || 'pelanggan').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      return `struk-token-pln-${cleanName || 'token'}.png`;
    }
    if (mode === 'virtual_account') {
      const cleanBiller = (virtualAccount.billerName || 'va').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanVa = (virtualAccount.vaNumber || 'trx').replace(/\s+/g, '');
      return `struk-va-${cleanBiller}-${cleanVa}.png`;
    }
    const cleanRecipient = (receipt.recipientName || 'transfer').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanRef = (receipt.refNumber || '000000').slice(-6);
    return `struk-transfer-${cleanRecipient}-${cleanRef}.png`;
  };

  // Helper to generate image blob
  const generateReceiptBlob = async (): Promise<Blob> => {
    if (!receiptRef.current) throw new Error('Elemen struk belum dimuat.');

    try {
      const blob = await toBlob(receiptRef.current, {
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
      if (blob) return blob;
    } catch (e) {
      console.warn('toBlob fallback to toPng:', e);
    }

    const dataUrl = await toPng(receiptRef.current, {
      pixelRatio: 2.5,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  // Download High-Res PNG Image (Fix anchor tag and Blob URL for reliable download)
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    setIsExportingImage(true);
    try {
      const filename = getReceiptFilename();
      const blob = await generateReceiptBlob();

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }, 2000);

      showToast(`Struk "${filename}" berhasil diunduh ke folder Download!`, 'success');
    } catch (err: any) {
      console.error('Download error:', err);
      showToast('Gagal mengunduh gambar struk.', 'error');
    } finally {
      setIsExportingImage(false);
    }
  };

  // Share Image directly to WhatsApp / Gallery (Android & iOS native share sheet)
  const handleShareImage = async () => {
    if (!receiptRef.current) return;
    setIsExportingImage(true);
    try {
      const filename = getReceiptFilename();
      const blob = await generateReceiptBlob();
      const file = new File([blob], filename, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Struk Bukti Transaksi',
          text: 'Berikut gambar bukti pembayaran struk resmi:',
        });
        showToast('Gambar struk berhasil dibagikan!', 'success');
      } else {
        // Fallback ke download jika perangkat/browser tidak support Web Share files
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          try {
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
          } catch {}
        }, 2000);
        showToast('Gambar struk diunduh (perangkat tidak mendukung bagikan langsung).', 'info');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        showToast('Gagal membagikan gambar struk.', 'error');
      }
    } finally {
      setIsExportingImage(false);
    }
  };

  // Copy Monospace Text Receipt for WhatsApp
  const handleCopyText = async () => {
    if (mode === 'pln_token') {
      const digits = plnToken.tokenNumber.replace(/\D/g, '');
      const tokenFormatted =
        digits.length === 20
          ? `${digits.slice(0, 4)} - ${digits.slice(4, 8)} - ${digits.slice(8, 12)} - ${digits.slice(12, 16)} - ${digits.slice(16, 20)}`
          : plnToken.tokenNumber;

      const formattedAmount = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(plnToken.amount)}`;
      const formattedTotal = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(plnToken.totalAmount)}`;

      const textReceipt = `
ATM Bersama
STRUK TOKEN LISTRIK PRABAYAR
${store.storeName || 'MITRA FAMILY JUO'}
${store.address ? store.address + '\n' : ''}${store.postalCode ? store.postalCode + '\n' : ''}${plnToken.transactionDate} ${plnToken.transactionTime}

STRUK
PEMBELIAN TOKEN PLN

NO METER       : ${plnToken.meterNumber}
ID PELANGGAN   : ${plnToken.customerId}
NAMA           : ${plnToken.customerName.toUpperCase()}
TARIF / DAYA   : ${plnToken.tariffPower.toUpperCase()}
NO REFF        : ${plnToken.refNumber}

--------------------------------
STROOM / TOKEN :
${tokenFormatted}
${plnToken.kwhAmount && plnToken.kwhAmount !== '-' ? `JML KWH : ${plnToken.kwhAmount}\n` : ''}--------------------------------

NOMINAL TOKEN  : ${formattedAmount}
${plnToken.agentFee > 0 ? `BIAYA JASA     : RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(plnToken.agentFee)}\nTOTAL BAYAR    : ${formattedTotal}\n` : ''}

${store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI'}
${store.callCenter || 'PLN 123 / 08001014017 (BEBAS PULSA)'}

${store.footerDisclaimer || 'SILAHKAN SIMPAN RESI INI SEBAGAI BUKTI PEMBAYARAN YANG SAH'}
      `.trim();

      try {
        await navigator.clipboard.writeText(textReceipt);
        showToast('Teks struk Token PLN disalin ke clipboard!', 'success');
      } catch {
        showToast('Gagal menyalin teks.', 'error');
      }
      return;
    }

    if (mode === 'virtual_account') {
      const cleanVa = (virtualAccount.vaNumber || '').replace(/\s+/g, '');
      const cleanRef = (virtualAccount.refNumber || '').replace(/\s+/g, '');
      const refFormatted = cleanRef.length > 16 ? `${cleanRef.slice(0, 16)}\n                 ${cleanRef.slice(16)}` : cleanRef;
      const formattedAmount = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(virtualAccount.amount)}`;
      const formattedTotal = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(virtualAccount.totalAmount)}`;

      const textReceipt = `
ATM Bersama
${settings.receiptTitle || 'BUKTI TRANSAKSI MINI ATM'}
${store.storeName || 'MITRA FAMILY JUO'}
${store.address ? store.address + '\n' : ''}${store.postalCode ? store.postalCode + '\n' : ''}${virtualAccount.transactionDate} ${virtualAccount.transactionTime}

STRUK
PEMBAYARAN VIRTUAL ACCOUNT

INSTITUSI      : ${(virtualAccount.billerName || 'VIRTUAL ACCOUNT').toUpperCase()}
NO. VA         : ${cleanVa}
NAMA           : ${(virtualAccount.customerName || '-').toUpperCase()}
${virtualAccount.bankSource ? `BANK           : ${virtualAccount.bankSource.toUpperCase()}\n` : ''}NO REFF        : ${refFormatted}
STATUS         : ${virtualAccount.status || 'SUKSES'}

TAGIHAN / NOMINAL : ${formattedAmount}
${virtualAccount.adminFee > 0 && settings.showBankFee ? `BIAYA ADMIN    : RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(virtualAccount.adminFee)}\n` : ''}${virtualAccount.agentFee > 0 ? `BIAYA JASA     : RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(virtualAccount.agentFee)}\n` : ''}${(virtualAccount.agentFee > 0 || (virtualAccount.adminFee > 0 && settings.showBankFee)) ? `TOTAL BAYAR    : ${formattedTotal}\n` : ''}
${store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI'}
${store.callCenter || '08001014017 (BEBAS PULSA) TERIMAKASIH'}

${store.footerDisclaimer || 'SILAHKAN SIMPAN RESI INI SEBAGAI BUKTI PEMBAYARAN YANG SAH'}
      `.trim();

      try {
        await navigator.clipboard.writeText(textReceipt);
        showToast('Teks struk Virtual Account disalin ke clipboard!', 'success');
      } catch {
        showToast('Gagal menyalin teks.', 'error');
      }
      return;
    }

    // MODE TRANSFER TEXT
    const cleanRef = receipt.refNumber.replace(/\s+/g, '');
    const refFormatted =
      cleanRef.length > 16 ? `${cleanRef.slice(0, 16)}\n                 ${cleanRef.slice(16)}` : cleanRef;

    const formattedAmount = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(receipt.amount)}`;
    const formattedTotal = `RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(receipt.totalAmount)}`;

    const textReceipt = `
ATM Bersama
${settings.receiptTitle || 'BUKTI TRANSAKSI MINI ATM'}
${store.storeName || 'MITRA FAMILY JUO'}
${store.address ? store.address + '\n' : ''}${store.postalCode ? store.postalCode + '\n' : ''}${receipt.transactionDate} ${receipt.transactionTime}

STRUK
TRANSFER ANTAR BANK

BANK TUJUAN    : ${receipt.bankDestination.toUpperCase()}
NO. REKENING   : ${(receipt.recipientAccount || '').replace(/\s+/g, '')}
NAMA PENERIMA  : ${receipt.recipientName.toUpperCase()}
NO REFF        : ${refFormatted}
STATUS         : ${receipt.status || 'SUKSES'}

JUMLAH TRANSFER
${formattedAmount}
${receipt.agentFee > 0 ? `\nBIAYA JASA     : RP ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(receipt.agentFee)}` : ''}
TOTAL BAYAR    : ${formattedTotal}

${store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI'}
${store.callCenter || '08001014017 (BEBAS PULSA) TERIMAKASIH'}

${store.footerDisclaimer || 'SILAHKAN SIMPAN RESI INI SEBAGAI BUKTI PEMBAYARAN YANG SAH'}
    `.trim();

    try {
      await navigator.clipboard.writeText(textReceipt);
      showToast('Teks struk Mini ATM disalin ke clipboard!', 'success');
    } catch {
      showToast('Gagal menyalin teks.', 'error');
    }
  };

  // Android RawBT Intent
  const handleOpenRawBt = () => {
    const bytes =
      mode === 'pln_token'
        ? generatePlnTokenEscPos(plnToken, store, settings)
        : mode === 'virtual_account'
        ? generateVirtualAccountEscPos(virtualAccount, store, settings)
        : generateReceiptEscPos(receipt, store, settings);
    const rawBtUrl = getRawBtUrl(bytes);
    window.location.href = rawBtUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-indigo-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* NAVBAR */}
      <header className="no-print sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white font-mono">
                  StrukKilat<span className="text-amber-400">.POS</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-md">
                  Multi-Struk Agen
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {store.storeName}
              </p>
            </div>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-2">
            {/* Install PWA Button */}
            <PWAInstallButton />

            {/* Bluetooth Indicator Button */}
            <button
              type="button"
              onClick={() => setIsBluetoothModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                connectedPrinterName
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-500'
              }`}
            >
              <Bluetooth
                className={`w-3.5 h-3.5 ${
                  connectedPrinterName ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
                }`}
              />
              <span className="hidden sm:inline">
                {connectedPrinterName ? connectedPrinterName : 'Sambung Bluetooth'}
              </span>
            </button>

            {/* History Button */}
            {mode === 'transfer' && (
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 transition"
                title="Riwayat Cetak"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Riwayat</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* MODE SWITCHER: 1. STRUK TRANSFER | 2. STRUK TOKEN LISTRIK | 3. VIRTUAL ACCOUNT */}
        <div className="no-print max-w-2xl mx-auto mb-6">
          <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMode('transfer')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                mode === 'transfer'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>1. Struk Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('pln_token')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                mode === 'pln_token'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>2. Token PLN</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('virtual_account')}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                mode === 'virtual_account'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <CreditCard className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>3. Virtual Account</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: OCR SCANNER & FORM EDITOR */}
          <div className="no-print lg:col-span-7 space-y-6">
            {/* 1. OCR Image Uploader */}
            <UploadSection
              mode={mode}
              onParsed={handleOcrParsed}
              onParsedPln={handleOcrParsedPln}
              onParsedVa={handleOcrParsedVa}
              isProcessing={isProcessingOcr}
              setIsProcessing={setIsProcessingOcr}
              defaultAgentFee={store.defaultAgentFee}
            />

            {/* 2. Interactive Form Editor */}
            {mode === 'transfer' ? (
              <ReceiptEditor
                receipt={receipt}
                setReceipt={setReceipt}
                store={store}
                setStore={setStore}
                settings={settings}
                setSettings={setSettings}
                onReset={handleResetReceipt}
                onLoadSample={handleLoadSampleReceipt}
              />
            ) : mode === 'pln_token' ? (
              <PlnTokenEditor
                tokenData={plnToken}
                setTokenData={setPlnToken}
                store={store}
                setStore={setStore}
                settings={settings}
                setSettings={setSettings}
                onReset={handleResetPln}
                onLoadSample={handleLoadSamplePln}
              />
            ) : (
              <VirtualAccountEditor
                vaData={virtualAccount}
                onChangeVa={setVirtualAccount}
                store={store}
                onChangeStore={setStore}
                settings={settings}
                onChangeSettings={setSettings}
                onReset={handleResetVa}
                onLoadSample={handleLoadSampleVa}
              />
            )}
          </div>

          {/* RIGHT COLUMN: THERMAL RECEIPT PREVIEW & ACTIONS */}
          <div className="lg:col-span-5 space-y-4">
            <div className="no-print bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      (mode === 'transfer' && receipt.amount > 0) ||
                      (mode === 'pln_token' && plnToken.amount > 0) ||
                      (mode === 'virtual_account' && virtualAccount.amount > 0)
                        ? mode === 'pln_token'
                          ? 'bg-amber-400 animate-ping'
                          : 'bg-emerald-400 animate-ping'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {mode === 'pln_token'
                      ? 'Pratinjau Struk Token PLN'
                      : mode === 'virtual_account'
                      ? 'Pratinjau Struk Virtual Account'
                      : 'Pratinjau Struk Mini ATM'}
                  </span>
                  {((mode === 'transfer' && !receipt.amount && !receipt.recipientName) ||
                    (mode === 'pln_token' && !plnToken.amount && !plnToken.tokenNumber) ||
                    (mode === 'virtual_account' && !virtualAccount.amount && !virtualAccount.vaNumber)) && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/60 font-medium">
                      Kosong
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {settings.paperWidth}
                </span>
              </div>

              {/* ACTION BUTTONS GRID */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handlePrintBluetooth}
                  disabled={isPrintingBt}
                  className={`col-span-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition flex items-center justify-center gap-2 ${
                    mode === 'pln_token'
                      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-600/25 active:scale-[0.98]'
                      : mode === 'virtual_account'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 active:scale-[0.98]'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25 active:scale-[0.98]'
                  }`}
                >
                  <Bluetooth className={`w-4 h-4 ${isPrintingBt ? 'animate-spin' : ''}`} />
                  <span>
                    {isPrintingBt
                      ? 'Sedang Mencetak...'
                      : connectedPrinterName
                      ? `Cetak ke ${connectedPrinterName}`
                      : 'Cetak ke Printer Bluetooth (ESC/POS)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleBrowserPrint}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Browser (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isExportingImage}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  title="Simpan file gambar PNG langsung ke folder Download"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isExportingImage ? 'Menyimpan...' : 'Unduh Gambar (PNG)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareImage}
                  disabled={isExportingImage}
                  className="py-2 px-3 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                  title="Bagikan gambar struk langsung ke WhatsApp / Galeri HP"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kirim Gambar (WA)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyText}
                  className="py-2 px-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Salin Teks WhatsApp</span>
                </button>
              </div>

              {/* RawBT Android helper */}
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleOpenRawBt}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Gunakan RawBT Thermal Print (Android)
                </button>
              </div>
            </div>

            {/* THE VISUAL THERMAL RECEIPT SLIP */}
            {mode === 'transfer' ? (
              <ReceiptView ref={receiptRef} receipt={receipt} store={store} settings={settings} />
            ) : mode === 'pln_token' ? (
              <PlnTokenView ref={receiptRef} tokenData={plnToken} store={store} settings={settings} />
            ) : (
              <VirtualAccountView ref={receiptRef} vaData={virtualAccount} store={store} settings={settings} />
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="no-print mt-auto py-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
        <p>
          StrukKilat.POS &bull; Solusi Cetak Struk Mini ATM, Token Listrik PLN, &amp; Virtual Account untuk Agen &amp; Konter Pulsa
        </p>
      </footer>

      {/* MODALS */}
      <BluetoothPrinterModal
        isOpen={isBluetoothModalOpen}
        onClose={() => setIsBluetoothModalOpen(false)}
        onDeviceConnected={(deviceName) => {
          setConnectedPrinterName(deviceName || 'Printer Bluetooth');
          showToast(`Terhubung dengan ${deviceName || 'Printer'}`, 'success');
        }}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onSelectReceipt={(selected) => {
          setReceipt(selected);
          setIsHistoryModalOpen(false);
          showToast('Data dari riwayat berhasil dimuat.', 'info');
        }}
        onClearHistory={() => {
          setHistory([]);
          localStorage.removeItem('strukkilat_history');
          showToast('Riwayat berhasil dibersihkan.', 'info');
        }}
        onDeleteSingle={(id) => {
          setHistory((prev) => prev.filter((item) => item.id !== id));
          showToast('1 data riwayat dihapus.', 'info');
        }}
      />
    </div>
  );
}
