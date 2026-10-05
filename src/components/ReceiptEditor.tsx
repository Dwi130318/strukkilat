import React, { useState } from 'react';
import {
  ReceiptData,
  StoreProfile,
  PrintSettings,
  PaperWidth,
} from '../types/receipt';
import {
  Store,
  Sliders,
  DollarSign,
  Calendar,
  Building2,
  User,
  Hash,
  FileText,
  Percent,
} from 'lucide-react';

interface ReceiptEditorProps {
  receipt: ReceiptData;
  setReceipt: React.Dispatch<React.SetStateAction<ReceiptData>>;
  store: StoreProfile;
  setStore: React.Dispatch<React.SetStateAction<StoreProfile>>;
  settings: PrintSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
}

export function ReceiptEditor({
  receipt,
  setReceipt,
  store,
  setStore,
  settings,
  setSettings,
}: ReceiptEditorProps) {
  const [activeTab, setActiveTab] = useState<'transaksi' | 'toko' | 'cetak'>('transaksi');

  const updateReceiptField = (field: keyof ReceiptData, value: any) => {
    setReceipt((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'amount' || field === 'bankAdminFee' || field === 'agentFee') {
        const amt = field === 'amount' ? Number(value) || 0 : prev.amount;
        const bFee = field === 'bankAdminFee' ? Number(value) || 0 : prev.bankAdminFee;
        const aFee = field === 'agentFee' ? Number(value) || 0 : prev.agentFee;
        updated.totalAmount = amt + bFee + aFee;
      }
      return updated;
    });
  };

  const updateStoreField = (field: keyof StoreProfile, value: any) => {
    setStore((prev) => ({ ...prev, [field]: value }));
  };

  const updateSettingField = (field: keyof PrintSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const quickAgentFees = [0, 2000, 2500, 3000, 5000, 10000];

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl shadow-lg overflow-hidden backdrop-blur">
      {/* TABS */}
      <div className="flex border-b border-slate-700 bg-slate-900/60 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('transaksi')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'transaksi'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Data Transfer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('toko')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'toko'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Profil Toko</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cetak')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'cetak'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Format Struk</span>
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {/* TAB 1: DATA TRANSAKSI */}
        {activeTab === 'transaksi' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Bank / Aplikasi Asal
                </label>
                <input
                  type="text"
                  value={receipt.bankSource}
                  onChange={(e) => updateReceiptField('bankSource', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Contoh: BCA (m-BCA), BRImo, Mandiri Livin'"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Bank / E-Wallet Tujuan
                </label>
                <input
                  type="text"
                  value={receipt.bankDestination}
                  onChange={(e) => updateReceiptField('bankDestination', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                  placeholder="Contoh: BRI, BCA, DANA, SHOPEEPAY"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Penerima
                </label>
                <input
                  type="text"
                  value={receipt.recipientName}
                  onChange={(e) => updateReceiptField('recipientName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                  placeholder="Nama pemilik rekening penerima"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Rekening / No. HP Tujuan
                </label>
                <input
                  type="text"
                  value={receipt.recipientAccount}
                  onChange={(e) => updateReceiptField('recipientAccount', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="Contoh: 001901058291503"
                />
              </div>
            </div>

            {/* NOMINAL & BIAYA JASA AGEN */}
            <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nominal Transfer (Rp)
                  </label>
                  <input
                    type="number"
                    value={receipt.amount || ''}
                    onChange={(e) => updateReceiptField('amount', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Admin Bank Asli (Rp)
                  </label>
                  <input
                    type="number"
                    value={receipt.bankAdminFee}
                    onChange={(e) => updateReceiptField('bankAdminFee', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      Biaya Jasa Agen (Rp)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {receipt.agentFee > 0 ? (
                        <span className="text-emerald-400 font-semibold">Tampil di Struk</span>
                      ) : (
                        <span className="text-slate-500">Tidak Tampil (Kosong)</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={receipt.agentFee || ''}
                    placeholder="0 (Kosongkan jika tanpa biaya jasa)"
                    onChange={(e) => updateReceiptField('agentFee', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-amber-500/60 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons for Agent Fee */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400">Pilihan Cepat:</span>
                {quickAgentFees.map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => updateReceiptField('agentFee', fee)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition ${
                      receipt.agentFee === fee
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {fee === 0 ? 'Tanpa Jasa (Rp 0)' : `Rp ${fee.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-700/80 text-xs">
                <span className="text-slate-400 font-medium">TOTAL TRANSAKSI DIBAYAR:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  Rp {receipt.totalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* DETAIL WAKTU & METADATA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tanggal
                </label>
                <input
                  type="text"
                  value={receipt.transactionDate}
                  onChange={(e) => updateReceiptField('transactionDate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Waktu / Jam
                </label>
                <input
                  type="text"
                  value={receipt.transactionTime}
                  onChange={(e) => updateReceiptField('transactionTime', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Referensi / Ref ID
                </label>
                <input
                  type="text"
                  value={receipt.refNumber}
                  onChange={(e) => updateReceiptField('refNumber', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* OPTIONAL EXTRAS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  value={receipt.customerName || ''}
                  onChange={(e) => updateReceiptField('customerName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Misal: Pak Budi"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Kasir / Petugas
                </label>
                <input
                  type="text"
                  value={receipt.cashierName || ''}
                  onChange={(e) => updateReceiptField('cashierName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Misal: Dwi"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Status Struk
                </label>
                <select
                  value={receipt.status}
                  onChange={(e) => updateReceiptField('status', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="BERHASIL">BERHASIL</option>
                  <option value="SUKSES">SUKSES</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Berita / Catatan Transaksi
              </label>
              <input
                type="text"
                value={receipt.notes || ''}
                onChange={(e) => updateReceiptField('notes', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="Misal: Pembayaran Belanja, DP Servis, dll."
              />
            </div>
          </div>
        )}

        {/* TAB 2: PROFIL TOKO */}
        {activeTab === 'toko' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nama Toko / Kios / Agen
              </label>
              <input
                type="text"
                value={store.storeName}
                onChange={(e) => updateStoreField('storeName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="Contoh: AGEN TRANSFER BERKAH"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Slogan / Deskripsi Singkat
              </label>
              <input
                type="text"
                value={store.slogan}
                onChange={(e) => updateStoreField('slogan', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="Contoh: Melayani Transfer Semua Bank & E-Wallet"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Alamat Lengkap / Daerah
                </label>
                <input
                  type="text"
                  value={store.address}
                  onChange={(e) => updateStoreField('address', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                  placeholder="Contoh: TANJUNG BELIT"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Kode Pos / ID Outlet
                </label>
                <input
                  type="text"
                  value={store.postalCode || ''}
                  onChange={(e) => updateStoreField('postalCode', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Contoh: 28557"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nomor WhatsApp / HP Toko
                </label>
                <input
                  type="text"
                  value={store.phone}
                  onChange={(e) => updateStoreField('phone', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Contoh: 0812-9876-5432"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Call Center / Bantuan
                </label>
                <input
                  type="text"
                  value={store.callCenter || ''}
                  onChange={(e) => updateStoreField('callCenter', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Contoh: 08001014017 (BEBAS PULSA) TERIMAKASIH"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Pesan Footer Baris 1
              </label>
              <input
                type="text"
                value={store.footerMessage}
                onChange={(e) => updateStoreField('footerMessage', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="INFORMASI LEBIH LANJUT, HUBUNGI"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Pesan Disclaimer Penutup (Baris 2)
              </label>
              <textarea
                rows={2}
                value={store.footerDisclaimer || ''}
                onChange={(e) => updateStoreField('footerDisclaimer', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="SILAHKAN SIMPAN RESI INI SEBAGAI BUKTI PEMBAYARAN YANG SAH"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Default Biaya Jasa Agen (Rp)
              </label>
              <input
                type="number"
                value={store.defaultAgentFee}
                onChange={(e) => updateStoreField('defaultAgentFee', Number(e.target.value))}
                className="w-full sm:w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Biaya ini akan otomatis terisi setiap kali Anda memindai screenshot bukti transfer baru.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: FORMAT & PENGATURAN CETAK */}
        {activeTab === 'cetak' && (
          <div className="space-y-4">
            {/* LOGO SELECTION */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Pilihan Logo Header
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'atm_bersama', label: 'ATM Bersama (Default)' },
                  { id: 'gpn', label: 'GPN Nasional' },
                  { id: 'link', label: 'Link Himbara' },
                  { id: 'none', label: 'Tanpa Logo' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => updateSettingField('logoType', item.id)}
                    className={`py-2 px-2.5 rounded-lg border text-center transition text-xs font-semibold ${
                      settings.logoType === item.id
                        ? 'border-indigo-500 bg-indigo-950/60 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* RECEIPT TITLE */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Judul Header Struk
              </label>
              <input
                type="text"
                value={settings.receiptTitle || ''}
                onChange={(e) => updateSettingField('receiptTitle', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="BUKTI TRANSAKSI MINI ATM"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Lebar Kertas Printer Thermal
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateSettingField('paperWidth', '58mm')}
                  className={`p-3 rounded-lg border text-left transition ${
                    settings.paperWidth === '58mm'
                      ? 'border-indigo-500 bg-indigo-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">58mm (Standar Portabel)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Printer Bluetooth mini / saku (32 karakter per baris)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettingField('paperWidth', '80mm')}
                  className={`p-3 rounded-lg border text-left transition ${
                    settings.paperWidth === '80mm'
                      ? 'border-indigo-500 bg-indigo-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">80mm (Lebar POS Kasir)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Printer thermal kasir besar (48 karakter per baris)
                  </div>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-3 space-y-3">
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Elemen Tampilan Struk
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showBarcode}
                    onChange={(e) => updateSettingField('showBarcode', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan Barcode No. Referensi</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showQrCode}
                    onChange={(e) => updateSettingField('showQrCode', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan QR Code Verifikasi</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showAgentFee}
                    onChange={(e) => updateSettingField('showAgentFee', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan Baris Biaya Jasa Agen</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showBankFee}
                    onChange={(e) => updateSettingField('showBankFee', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan Baris Admin Bank Asli</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showStatusBadge}
                    onChange={(e) => updateSettingField('showStatusBadge', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan Badge Status (BERHASIL)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCustomerName}
                    onChange={(e) => updateSettingField('showCustomerName', e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Tampilkan Nama Pelanggan</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
