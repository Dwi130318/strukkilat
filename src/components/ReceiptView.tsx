import React, { forwardRef } from 'react';
import { ReceiptData, StoreProfile, PrintSettings } from '../types/receipt';
import { formatRupiah } from '../utils/escpos';

interface ReceiptViewProps {
  receipt: ReceiptData;
  store: StoreProfile;
  settings: PrintSettings;
}

// Logo ATM Bersama (Matching Indonesian Mini ATM slip exactly)
function AtmBersamaLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-3">
      <svg className="w-28 sm:w-32 h-auto" viewBox="0 0 160 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* ATM Stylized geometric shape in blue #0070BA */}
        <g fill="#0066B2">
          {/* Letter A */}
          <path d="M12 33L26 4L34 4L48 33L39 33L35 24L21 24L17 33H12ZM24 18L32 18L28 9.5L24 18Z" />
          {/* Top connecting bar */}
          <path d="M26 4H84V11H26V4Z" />
          {/* Letter T */}
          <path d="M50 11H60V33H50V11Z" />
          {/* Letter M */}
          <path d="M72 4H84L94 19L104 4H116V33H106V15L97 29H91L82 15V33H72V4Z" />
        </g>
        {/* Text "Bersama" in italic blue font */}
        <text
          x="80"
          y="48"
          textAnchor="middle"
          fill="#0066B2"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="700"
          fontStyle="italic"
          fontSize="17"
          letterSpacing="0.2"
        >
          Bersama
        </text>
      </svg>
    </div>
  );
}

// Logo GPN
function GpnLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-2">
      <div className="px-3 py-1 bg-red-650 rounded border border-red-700 flex items-center gap-1.5">
        <span className="text-sm font-black text-red-600 tracking-wider">GPN</span>
        <span className="text-[10px] font-bold text-slate-800">GERBANG PEMBAYARAN NASIONAL</span>
      </div>
    </div>
  );
}

// Logo Link (Himbara)
function LinkLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-2">
      <div className="text-lg font-black italic tracking-wider text-rose-600">
        Link<span className="text-amber-500 font-bold">.</span>
      </div>
    </div>
  );
}

// Logo Prima
function PrimaLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-2">
      <div className="px-3 py-0.5 bg-blue-900 text-white font-black text-xs tracking-widest rounded">
        PRIMA
      </div>
    </div>
  );
}

// Helper to format currency like "RP 1.800.000" (with space and uppercase RP)
function formatMiniAtmRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `RP ${formatted}`;
}

export const ReceiptView = forwardRef<HTMLDivElement, ReceiptViewProps>(
  ({ receipt, store, settings }, ref) => {
    const is80mm = settings.paperWidth === '80mm';
    const widthClass = is80mm ? 'w-[340px] print-only-receipt-80mm' : 'w-[290px] print-only-receipt';

    // Helper to prevent literal "null" from showing
    const safeStr = (val: any, fallback: string = '-') => {
      if (!val) return fallback;
      const s = String(val).trim();
      if (s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'none') {
        return fallback;
      }
      return s;
    };

    // Break long refNumber into two lines if > 16 chars (exact match to user's photo!)
    const formatRefNumber = (refNum: string) => {
      const clean = safeStr(refNum, '-').replace(/\s+/g, '');
      if (clean.length > 16) {
        return (
          <>
            <div>{clean.slice(0, 16)}</div>
            <div>{clean.slice(16)}</div>
          </>
        );
      }
      return clean;
    };

    return (
      <div className="flex justify-center p-2 sm:p-4">
        {/* Clean Paper Slip (Exact Mini ATM style from user image) */}
        <div
          ref={ref}
          id="printable-thermal-receipt"
          className={`${widthClass} relative bg-white text-black shadow-2xl rounded-sm px-5 py-6 font-sans text-[11.5px] leading-relaxed transition-all duration-200 print-only-receipt select-text`}
          style={{
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            color: '#1a1a1a',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* 1. LOGO */}
          {settings.logoType === 'atm_bersama' && <AtmBersamaLogo />}
          {settings.logoType === 'gpn' && <GpnLogo />}
          {settings.logoType === 'link' && <LinkLogo />}
          {settings.logoType === 'prima' && <PrimaLogo />}

          {/* 2. HEADER TRANSAKSI MINI ATM */}
          <div className="text-center space-y-0.5">
            <h1 className="text-xs sm:text-[13px] font-bold text-black uppercase tracking-wide">
              {settings.receiptTitle || 'BUKTI TRANSAKSI MINI ATM'}
            </h1>
            <p className="text-[11.5px] text-slate-800 uppercase font-medium">
              {store.storeName || 'MITRA FAMILY JUO'}
            </p>
            {store.address && (
              <p className="text-[11px] text-slate-700 uppercase">
                {store.address}
              </p>
            )}
            {store.postalCode && (
              <p className="text-[11px] text-slate-700 font-mono">
                {store.postalCode}
              </p>
            )}
            <p className="text-[11px] text-slate-800 font-mono pt-0.5">
              {receipt.transactionDate} {receipt.transactionTime}
            </p>
          </div>

          {/* 3. SECTION TITLE: STRUK TRANSFER (PERMANENT) */}
          <div className="text-center my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-black">
              STRUK
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-black mt-0.5">
              TRANSFER ANTAR BANK
            </div>
          </div>

          {/* 4. DETAILS WITH VERTICALLY ALIGNED COLON */}
          <div className="space-y-1 text-[11px] text-slate-900 my-3">
            {/* BANK TUJUAN */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">BANK TUJUAN</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeStr(receipt.bankDestination, '-')}</span>
            </div>

            {/* NO. REKENING (TANPA SPASI) */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO. REKENING</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-semibold">{safeStr(receipt.recipientAccount, '-').replace(/\s+/g, '')}</span>
            </div>

            {/* NAMA PENERIMA */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NAMA PENERIMA</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeStr(receipt.recipientName, '-')}</span>
            </div>

            {/* NO REFF */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO REFF</span>
              <span className="mr-2">:</span>
              <div className="font-mono tracking-tight leading-snug">
                {formatRefNumber(receipt.refNumber)}
              </div>
            </div>

            {/* STATUS */}
            <div className="flex items-start pt-0.5">
              <span className="w-[110px] shrink-0 uppercase">STATUS</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeStr(receipt.status, 'SUKSES')}</span>
            </div>
          </div>

          {/* 5. JUMLAH TRANSFER */}
          <div className="text-center my-4 space-y-0.5">
            <div className="text-xs font-bold uppercase text-black">
              JUMLAH TRANSFER
            </div>
            <div className="text-xs sm:text-[13px] font-bold text-black font-mono">
              {formatMiniAtmRupiah(receipt.amount)}
            </div>
          </div>

          {/* OPTIONAL FEES */}
          {receipt.bankAdminFee > 0 && settings.showBankFee && (
            <div className="flex items-center text-[11px] mb-1">
              <span className="w-[110px] shrink-0 uppercase">BIAYA ADMIN</span>
              <span className="mr-2">:</span>
              <span className="font-mono">{formatMiniAtmRupiah(receipt.bankAdminFee)}</span>
            </div>
          )}

          {receipt.agentFee > 0 && (
            <div className="flex items-center text-[11px] mb-1">
              <span className="w-[110px] shrink-0 uppercase">BIAYA JASA</span>
              <span className="mr-2">:</span>
              <span className="font-mono">{formatMiniAtmRupiah(receipt.agentFee)}</span>
            </div>
          )}

          {/* 6. TOTAL BAYAR */}
          <div className="flex items-center text-xs font-bold text-black my-3">
            <span className="w-[110px] shrink-0 uppercase">TOTAL BAYAR</span>
            <span className="mr-2">:</span>
            <span className="font-mono text-[12.5px]">
              {formatMiniAtmRupiah(receipt.totalAmount)}
            </span>
          </div>

          {/* 7. FOOTER NOTES */}
          <div className="text-center space-y-3 pt-3 text-[10.5px] text-slate-800 uppercase leading-relaxed">
            <div className="space-y-0.5">
              <p>{store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI'}</p>
              <p className="font-mono text-[10px]">
                {store.callCenter || '08001014017 (BEBAS PULSA) TERIMAKASIH'}
              </p>
            </div>

            <p className="px-2 text-[10px] leading-tight">
              {store.footerDisclaimer || 'SILAHKAN SIMPAN RESI INI SEBAGAI BUKTI PEMBAYARAN YANG SAH'}
            </p>
          </div>
        </div>
      </div>
    );
  }
);
