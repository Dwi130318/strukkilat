import React, { forwardRef } from 'react';
import { PlnTokenData, StoreProfile, PrintSettings } from '../types/receipt';

interface PlnTokenViewProps {
  tokenData: PlnTokenData;
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

// Helper to format currency like "RP 100.000"
function formatMiniAtmRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `RP ${formatted}`;
}

export const PlnTokenView = forwardRef<HTMLDivElement, PlnTokenViewProps>(
  ({ tokenData, store, settings }, ref) => {
    const is80mm = settings.paperWidth === '80mm';
    const widthClass = is80mm ? 'w-[340px] print-only-receipt-80mm' : 'w-[290px] print-only-receipt';

    // Helper to prevent literal "null" or "undefined" from rendering on receipt
    const safeText = (val: any, fallback: string = '-'): string => {
      if (val === null || val === undefined) return fallback;
      const s = String(val).trim();
      if (
        !s ||
        s.toLowerCase() === 'null' ||
        s.toLowerCase() === 'undefined' ||
        s.toLowerCase() === 'none'
      ) {
        return fallback;
      }
      return s;
    };

    // Format 20 digit token into clean blocks "XXXX - XXXX - XXXX - XXXX - XXXX"
    const formatTokenDisplay = (raw: string) => {
      const clean = safeText(raw, '');
      const digits = clean.replace(/\D/g, '');
      if (digits.length === 20) {
        return `${digits.slice(0, 4)} - ${digits.slice(4, 8)} - ${digits.slice(8, 12)} - ${digits.slice(12, 16)} - ${digits.slice(16, 20)}`;
      }
      if (digits.length > 0) {
        return clean;
      }
      return '- - - -   - - - -   - - - -   - - - -   - - - -';
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

    const meterDisplay = safeText(tokenData.meterNumber, '-');
    const idpelDisplay = safeText(tokenData.customerId, '-');
    const nameDisplay = safeText(tokenData.customerName, '-');
    const tariffDisplay = safeText(tokenData.tariffPower, '-');
    const kwhClean = safeText(tokenData.kwhAmount, '-');

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
          {settings.logoType !== 'none' && <AtmBersamaLogo />}

          {/* 2. HEADER */}
          <div className="text-center space-y-0.5">
            <h1 className="text-xs sm:text-[13px] font-bold text-black uppercase tracking-wide">
              STRUK TOKEN LISTRIK PRABAYAR
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
              {tokenData.transactionDate} {tokenData.transactionTime}
            </p>
          </div>

          {/* 3. SECTION TITLE */}
          <div className="text-center my-3">
            <div className="text-xs font-bold uppercase tracking-wider text-black">
              STRUK
            </div>
            <div className="text-xs font-bold uppercase tracking-wide text-black mt-0.5">
              PEMBELIAN TOKEN PLN
            </div>
          </div>

          {/* 4. DETAILS WITH VERTICALLY ALIGNED COLONS */}
          <div className="space-y-1 text-[11px] text-slate-900 my-3">
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO METER</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-semibold">{meterDisplay}</span>
            </div>

            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">ID PELANGGAN</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-semibold">{idpelDisplay}</span>
            </div>

            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NAMA</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{nameDisplay}</span>
            </div>

            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">TARIF / DAYA</span>
              <span className="mr-2">:</span>
              <span className="font-semibold uppercase">{tariffDisplay}</span>
            </div>

            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NO REFF</span>
              <span className="mr-2">:</span>
              <div className="font-mono tracking-tight leading-snug">
                {formatRefNumber(tokenData.refNumber)}
              </div>
            </div>
          </div>

          {/* 5. STROOM / TOKEN BOX (PROMINENT HIGHLIGHT) */}
          <div className="my-4 border-2 border-black/80 rounded-sm p-2.5 bg-slate-50 text-center">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-700 mb-1">
              STROOM / TOKEN
            </div>
            <div className="text-[13px] sm:text-[14px] font-black font-mono tracking-wider text-black py-0.5 select-all">
              {formatTokenDisplay(tokenData.tokenNumber)}
            </div>
            {kwhClean && kwhClean !== '-' && !kwhClean.toLowerCase().includes('null') && (
              <div className="text-[11px] font-semibold text-slate-800 font-mono mt-1 pt-1 border-t border-dashed border-slate-300">
                JML KWH : {kwhClean}
              </div>
            )}
          </div>

          {/* 6. RINCIAN BIAYA & TOTAL */}
          <div className="space-y-1 text-[11px] text-slate-900 my-3">
            <div className="flex items-start">
              <span className="w-[110px] shrink-0 uppercase">NOMINAL TOKEN</span>
              <span className="mr-2">:</span>
              <span className="font-mono font-medium">{formatMiniAtmRupiah(tokenData.amount)}</span>
            </div>

            {/* BIAYA JASA (HANYA MUNCUL JIKA > 0) */}
            {tokenData.agentFee > 0 && (
              <div className="flex items-start">
                <span className="w-[110px] shrink-0 uppercase">BIAYA JASA</span>
                <span className="mr-2">:</span>
                <span className="font-mono">{formatMiniAtmRupiah(tokenData.agentFee)}</span>
              </div>
            )}

            {/* TOTAL BAYAR */}
            <div className="flex items-center text-xs font-bold text-black pt-1">
              <span className="w-[110px] shrink-0 uppercase">TOTAL BAYAR</span>
              <span className="mr-2">:</span>
              <span className="font-mono text-[12.5px]">
                {formatMiniAtmRupiah(tokenData.totalAmount)}
              </span>
            </div>
          </div>

          {/* 7. FOOTER */}
          <div className="text-center space-y-3 pt-3 text-[10.5px] text-slate-800 uppercase leading-relaxed">
            <div className="space-y-0.5">
              <p>{store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI'}</p>
              <p className="font-mono text-[10px]">
                {store.callCenter || 'PLN 123 / 08001014017 (BEBAS PULSA)'}
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
