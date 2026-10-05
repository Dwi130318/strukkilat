import React, { useState, useEffect } from 'react';
import {
  X,
  Bluetooth,
  Printer,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Power,
  Share2,
  ExternalLink,
} from 'lucide-react';
import {
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  getActiveBluetoothDevice,
  isBluetoothAvailable,
  isInsideIframe,
  printToBluetoothThermal,
  EscPosBuilder,
} from '../utils/escpos';

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceConnected?: (name: string) => void;
}

export function BluetoothPrinterModal({
  isOpen,
  onClose,
  onDeviceConnected,
}: BluetoothPrinterModalProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [inIframe, setInIframe] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  useEffect(() => {
    setIsSupported(isBluetoothAvailable());
    setInIframe(isInsideIframe());
    const current = getActiveBluetoothDevice();
    if (current && current.gatt?.connected) {
      setConnectedDevice(current);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    setTestSuccess(false);

    try {
      const conn = await connectBluetoothPrinter();
      setConnectedDevice(conn.device);
      if (onDeviceConnected && conn.device.name) {
        onDeviceConnected(conn.device.name);
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotFoundError') {
        // User cancelled picker
        setErrorMessage('Pemilihan perangkat Bluetooth dibatalkan.');
      } else {
        setErrorMessage(
          err.message || 'Gagal menghubungkan ke printer Bluetooth. Pastikan printer dalam keadaan hidup.'
        );
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBluetoothPrinter();
      setConnectedDevice(null);
      setTestSuccess(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestPrint = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    setTestSuccess(false);

    try {
      const builder = new EscPosBuilder('58mm');
      builder.alignCenter();
      builder.bold(true);
      builder.doubleSize(true);
      builder.textLine('TES PRINTER OK!');
      builder.doubleSize(false);
      builder.bold(false);
      builder.textLine('StrukKilat Bluetooth Thermal');
      builder.textLine('--------------------------------');
      builder.alignLeft();
      builder.twoColumns('Status', 'TERHUBUNG');
      builder.twoColumns('Tanggal', new Date().toLocaleDateString('id-ID'));
      builder.twoColumns('Waktu', new Date().toLocaleTimeString('id-ID'));
      builder.alignCenter();
      builder.textLine('================================');
      builder.textLine('Printer Siap Mencetak Struk!');
      builder.cut();

      await printToBluetoothThermal(builder.getBytes());
      setTestSuccess(true);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal mencetak struk tes ke printer Bluetooth.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hubungkan Printer Bluetooth</h3>
              <p className="text-xs text-slate-400">Printer Thermal POS 58mm / 80mm</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {!isSupported ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Web Bluetooth Tidak Didukung di Browser Ini</span>
              </div>
              <p>
                Browser Anda belum mendukung Web Bluetooth secara langsung.
              </p>
              <div className="pt-2 font-medium">
                Solusi alternatif yang tetap 100% bisa cetak:
                <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-300">
                  <li>Gunakan tombol <strong>Cetak Struk (Browser Print)</strong> - kompatibel dengan semua printer USB/Bluetooth.</li>
                  <li>Gunakan tombol <strong>Simpan Gambar (PNG)</strong> untuk mengirim struk ke WhatsApp pelanggan.</li>
                  <li>Gunakan Google Chrome / Microsoft Edge di Android atau PC untuk Web Bluetooth.</li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              {/* IFRAME HELPER BANNER */}
              {inIframe && (
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-indigo-300">
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                    <span>Mode Pratinjau Terdeteksi (iFrame)</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Browser membatasi pencarian Bluetooth di dalam frame pratinjau. Untuk menghubungkan printer Bluetooth thermal langsung, buka di tab baru browser:
                  </p>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 transition text-xs shadow no-underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Aplikasi di Tab Baru (Layar Penuh)</span>
                  </a>
                  <p className="text-[11px] text-slate-400">
                    Atau gunakan <strong>Cetak Langsung (Browser Print)</strong> yang langsung berfungsi di mana saja.
                  </p>
                </div>
              )}

              {/* STATUS CARD */}
              <div
                className={`p-4 rounded-xl border transition ${
                  connectedDevice
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-slate-900/90 border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        connectedDevice
                          ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          : 'bg-slate-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Status Perangkat
                      </div>
                      <div className="text-sm font-bold text-white">
                        {connectedDevice
                          ? connectedDevice.name || 'Printer Bluetooth Terhubung'
                          : 'Belum Terhubung'}
                      </div>
                    </div>
                  </div>

                  {connectedDevice && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="px-2.5 py-1 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg transition"
                    >
                      Putuskan
                    </button>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="space-y-2">
                {!connectedDevice ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mencari Printer Bluetooth...</span>
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-4 h-4" />
                        <span>Cari & Sambungkan Printer</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    disabled={isTesting}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mencetak Struk Tes...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4" />
                        <span>Cetak Struk Uji Coba (Test Print)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* TEST SUCCESS BADGE */}
              {testSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Struk tes berhasil dikirim ke printer thermal!</span>
                </div>
              )}

              {/* ERROR ALERT */}
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <p className="font-semibold">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* GUIDE ACCORDION / TIPS */}
              <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-xl space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                  <span>Panduan Koneksi Printer Thermal Bluetooth:</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 text-slate-400">
                  <li>Nyalakan printer thermal bluetooth (POS-58, GOOJPRT, Panda, Eppos, dll).</li>
                  <li>Di HP/Laptop: Aktifkan <strong>Bluetooth</strong> dan <strong>Lokasi/GPS</strong> (khusus Android Chrome).</li>
                  <li>Jika printer belum dipasangkan sebelumnya, pair dulu melalui menu Pengaturan Bluetooth HP (PIN default biasanya <code className="text-indigo-300 font-mono">0000</code> atau <code className="text-indigo-300 font-mono">1234</code>).</li>
                  <li>Klik tombol <strong>Cari & Sambungkan Printer</strong> di atas dan pilih nama printer Anda.</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
