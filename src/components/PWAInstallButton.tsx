import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, Check, X, Sparkles, HelpCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA on mobile homescreen, show active badge or hide
  if (isInstalled) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold">
        <Check className="w-3.5 h-3.5" />
        <span>Terinstal di HP</span>
      </div>
    );
  }

  return (
    <>
      {/* DIRECT ONE-CLICK INSTALL BUTTON (IF BROWSER SUPPORTS PROMPT) */}
      {isInstallable ? (
        <button
          type="button"
          onClick={install}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/30 transition transform active:scale-95 animate-pulse"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install Aplikasi (Android)</span>
        </button>
      ) : (
        /* GUIDED INSTALL BUTTON (ALWAYS ACCESSIBLE SO USER CAN LEARN HOW TO ADD TO HOME SCREEN) */
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-slate-200 transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Install di Android</span>
        </button>
      )}

      {/* ANDROID & IOS STEP-BY-STEP INSTALL GUIDE MODAL */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cara Install di HP Android</h3>
                  <p className="text-[11px] text-slate-400">Jadikan aplikasi di layar utama HP Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-800/80 rounded-xl space-y-2 border border-slate-700/60">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Langkah Mudah (Browser Google Chrome Android):
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1 leading-relaxed">
                  <li>
                    Buka tautan website ini di browser <strong>Google Chrome</strong> di HP Anda.
                  </li>
                  <li>
                    Ketuk ikon <strong>Titik Tiga (⋮)</strong> di pojok kanan atas Chrome.
                  </li>
                  <li>
                    Pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Instal Aplikasi"</strong>.
                  </li>
                  <li>
                    Klik <strong>Instal / Tambahkan</strong>.
                  </li>
                </ol>
              </div>

              <div className="p-3 bg-slate-800/50 rounded-xl space-y-1 border border-slate-700/40">
                <div className="font-semibold text-white">Keunggulan Terinstal di Android:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                  <li>Bisa dibuka langsung dari icon di layar HP (seperti aplikasi APK biasa).</li>
                  <li>Layar penuh (Full Screen) tanpa bilah alamat browser.</li>
                  <li>Bisa langsung cetak ke printer Bluetooth thermal kasir portabel Anda.</li>
                </ul>
              </div>

              {isIOS && (
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-amber-200">
                  <div className="font-semibold mb-1">Untuk Pengguna iPhone / iPad:</div>
                  <p className="text-[11px]">
                    Tekan tombol <strong>Share</strong> (ikon kotak berpanah ke atas) di Safari, lalu pilih <strong>"Add to Home Screen"</strong>.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition"
            >
              Saya Mengerti, Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
