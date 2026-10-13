import React, { forwardRef } from 'react';
import { VirtualAccountData, StoreProfile, PrintSettings } from '../types/receipt';

interface VirtualAccountViewProps {
  vaData: VirtualAccountData;
  store: StoreProfile;
  settings: PrintSettings;
}

// Logo ATM Bersama (Matching Mini ATM design)
function AtmBersamaLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-3">
      <svg className="w-28 sm:w-32 h-auto" viewBox="0 0 160 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g fill="#0066B2">
          <path d="M12 33L26 4L34 4L48 33L39 33L35 24L21 24L17 33H12ZM24 18L32 18L28 9.5L24 18Z" />
          <path d="M26 4H84V11H26V4Z" />
          <path d="M50 11H60V33H50V11Z" />
          <path d="M72 4H84L94 19L104 4H116V33H106V15L97 29H91L82 15V33H72V4Z" />
        </g>
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

// Logo Link
function LinkLogo() {
  return (
    <div className="flex flex-col items-center justify-center pt-2 pb-2">
      <div className="text-lg font-black italic tracking-wider text-rose-600">
        Link<span className="text-amber-500 font-bold">.</span>
      </div>
    </div>
  );
}

// Helper to format currency like "RP 250.000"
function formatMiniAtmRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `RP ${formatted}`;
}

export const VirtualAccountView = forwardRef<HTMLDivElement, VirtualAccountViewProps>(
  ({ vaData, store, settings }, ref) => {
    const is80mm = settings.paperWidth === '80mm';
    const widthClass = is80mm ? 'w-[340px] print-only-receipt-80mm' : 'w-[290px] print-only-receipt';

    const safeText = (val: any, fallback: string = '-'): string => {
      if (val === null || val === undefined) return fallback;
      const s = String(val).trim();
      if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'none') {
        return fallback;
      }
      return s;
    };

    // Format long refNumber
    const formatRefNumber = (refNum: string) => {
      const clean = safeText(refNum, '-').replace(/\s+/g, '');
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

    const cleanVa = safeText(vaData.vaNumber, '-').replace(/\s+/g, '');

    return (
      <div className="flex justify-center p-2 sm:p-4">
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
              {vaData.transactionDate} {vaData.transactionTime}
            </p>
          </div>

          {/* 3. SECTION TITLE: STRUK PEMBAYARAN VIRTUAL ACCOUNT */}
          <div className="text-center my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-black">
              STRUK
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-black mt-0.5">
              PEMBAYARAN VIRTUAL ACCOUNT
            </div>
          </div>

          {/* 4. DETAILS WITH VERTICALLY ALIGNED COLONS */}
          <div className="space-y-1 text-[11px] text-slate-900 my-3">
            {/* INSTITUSI / BILLER */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">INSTITUSI</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeText(vaData.billerName, 'VIRTUAL ACCOUNT')}</span>
            </div>

            {/* NO. VA (RAPAT TANPA SPASI) */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO. VA</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-bold tracking-tight">{cleanVa}</span>
            </div>

            {/* NAMA PELANGGAN */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NAMA</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeText(vaData.customerName, '-')}</span>
            </div>

            {/* BANK PENYEDIA */}
            {vaData.bankSource && (
              <div className="flex items-start">
                <span className="w-[110px] shrink-0 uppercase">BANK</span>
                <span className="mr-2">:</span>
                <span className="font-semibold uppercase">{safeText(vaData.bankSource, '-')}</span>
              </div>
            )}

            {/* NO REFF */}
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO REFF</span>
              <span className="mr-2">:</span>
              <div className="font-mono tracking-tight leading-snug">
                {formatRefNumber(vaData.refNumber)}
              </div>
            </div>

            {/* STATUS */}
            <div className="flex items-start pt-0.5">
              <span className="w-[110px] shrink-0 uppercase">STATUS</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{safeText(vaData.status, 'SUKSES')}</span>
            </div>
          </div>

          {/* 5. RINCIAN BIAYA & TOTAL */}
          <div className="space-y-1 text-[11px] text-slate-900 my-3">
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">TAGIHAN / NOMINAL</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-medium">{formatMiniAtmRupiah(vaData.amount)}</span>
            </div>

            {/* BIAYA ADMIN BANK (JIKA ADA) */}
            {vaData.adminFee > 0 && settings.showBankFee && (
              <div className="flex items-start">
                <span className="w-[110px] shrink-0 uppercase">BIAYA ADMIN</span>
                <span className="mr-2">:</span>
                <span className="font-mono">{formatMiniAtmRupiah(vaData.adminFee)}</span>
              </div>
            )}

            {/* BIAYA JASA (HANYA MUNCUL JIKA > 0) */}
            {vaData.agentFee > 0 && (
              <div className="flex items-start">
                <span className="w-[110px] shrink-0 uppercase">BIAYA JASA</span>
                <span className="mr-2">:</span>
                <span className="font-mono">{formatMiniAtmRupiah(vaData.agentFee)}</span>
              </div>
            )}

            {/* TOTAL BAYAR (MUNCUL JIKA ADA BIAYA JASA ATAU BIAYA ADMIN) */}
            {(vaData.agentFee > 0 || (vaData.adminFee > 0 && settings.showBankFee)) && (
              <div className="flex items-center text-xs font-bold text-black pt-1">
                <span className="w-[110px] shrink-0 uppercase">TOTAL BAYAR</span>
                <span className="mr-2">:</span>
                <span className="font-mono text-[12.5px]">
                  {formatMiniAtmRupiah(vaData.totalAmount)}
                </span>
              </div>
            )}
          </div>

          {/* 6. FOOTER */}
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
