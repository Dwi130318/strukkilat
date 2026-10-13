import React, { useState } from 'react';
import { VirtualAccountData, StoreProfile, PrintSettings } from '../types/receipt';
import { Store, Sliders, FileText, Sparkles, RotateCcw } from 'lucide-react';

interface VirtualAccountEditorProps {
  vaData: VirtualAccountData;
  store: StoreProfile;
  settings: PrintSettings;
  onChangeVa: (updated: VirtualAccountData) => void;
  onChangeStore: (updated: StoreProfile) => void;
  onChangeSettings: (updated: PrintSettings) => void;
  onReset?: () => void;
  onLoadSample?: () => void;
}

export const VirtualAccountEditor: React.FC<VirtualAccountEditorProps> = ({
  vaData,
  store,
  settings,
  onChangeVa,
  onChangeStore,
  onChangeSettings,
  onReset,
  onLoadSample,
}) => {
  const [activeTab, setActiveTab] = useState<'transaksi' | 'toko' | 'cetak'>('transaksi');

  const updateVaField = <K extends keyof VirtualAccountData>(field: K, value: VirtualAccountData[K]) => {
    const updated = { ...vaData, [field]: value };
    // Recalculate total if amount, adminFee, or agentFee changes
    if (field === 'amount' || field === 'adminFee' || field === 'agentFee') {
      const amt = field === 'amount' ? Number(value) : vaData.amount;
      const admin = field === 'adminFee' ? Number(value) : vaData.adminFee;
      const agent = field === 'agentFee' ? Number(value) : vaData.agentFee;
      updated.totalAmount = (amt || 0) + (admin || 0) + (agent || 0);
    }
    onChangeVa(updated);
  };

  const updateStoreField = <K extends keyof StoreProfile>(field: K, value: StoreProfile[K]) => {
    onChangeStore({ ...store, [field]: value });
  };

  const updateSettingField = <K extends keyof PrintSettings>(field: K, value: PrintSettings[K]) => {
    onChangeSettings({ ...settings, [field]: value });
  };

  const quickAgentFees = [0, 2000, 2500, 3000, 5000];

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
      {/* HEADER TABS */}
      <div className="flex border-b border-slate-800 p-2 gap-1 bg-slate-950/40">
        <button
          type="button"
          onClick={() => setActiveTab('transaksi')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'transaksi'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Data VA</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('toko')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'toko'
              ? 'bg-emerald-600 text-white shadow'
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
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Format Struk</span>
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {/* TAB 1: DATA TRANSAKSI VA */}
        {activeTab === 'transaksi' && (
          <div className="space-y-4">
            {/* ACTION BAR: RESET & LOAD SAMPLE */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
              <span className="text-[11px] text-slate-400">
                {vaData.amount > 0 || vaData.vaNumber ? (
                  <span className="text-emerald-400 font-medium">● Data terisi</span>
                ) : (
                  <span className="text-slate-400 font-medium">○ Form kosong (siap diisi)</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                {onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-700/60 hover:bg-slate-700 rounded-md transition flex items-center gap-1"
                    title="Kosongkan form"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-400" />
                    <span>Kosongkan</span>
                  </button>
                )}
                {onLoadSample && (
                  <button
                    type="button"
                    onClick={onLoadSample}
                    className="px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:text-white bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/30 rounded-md transition flex items-center gap-1"
                    title="Isi contoh Virtual Account"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Isi Contoh</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Institusi / Merchant
                </label>
                <input
                  type="text"
                  value={vaData.billerName}
                  onChange={(e) => updateVaField('billerName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                  placeholder="Misal: SHOPEEPAY, TOKOPEDIA, DANA"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nomor Virtual Account (Tanpa Spasi)
                </label>
                <input
                  type="text"
                  value={vaData.vaNumber}
                  onChange={(e) => updateVaField('vaNumber', e.target.value.replace(/\s+/g, ''))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 tracking-wider"
                  placeholder="Contoh: 1280081298765432"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={vaData.customerName}
                  onChange={(e) => updateVaField('customerName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase font-medium"
                  placeholder="Nama pemilik akun/tagihan"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Bank Penyedia VA
                </label>
                <input
                  type="text"
                  value={vaData.bankSource}
                  onChange={(e) => updateVaField('bankSource', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                  placeholder="Misal: BRI, BCA, MANDIRI, BNI, PERMATA"
                />
              </div>
            </div>

            {/* BIAYA & NOMINAL */}
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Tagihan / Nominal (Rp)
                  </label>
                  <input
                    type="number"
                    value={vaData.amount || ''}
                    onChange={(e) => updateVaField('amount', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                    placeholder="Nominal tagihan"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      Biaya Jasa Agen (Rp)
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {vaData.agentFee > 0 ? (
                        <span className="text-emerald-400 font-semibold">Tampil di Struk</span>
                      ) : (
                        <span className="text-slate-500">Tidak Tampil (Kosong)</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={vaData.agentFee || ''}
                    placeholder="0 (Kosongkan jika tanpa jasa)"
                    onChange={(e) => updateVaField('agentFee', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-amber-500/60 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Quick Preset Buttons for Agent Fee */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400">Pilihan Cepat Jasa:</span>
                {quickAgentFees.map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => updateVaField('agentFee', fee)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition ${
                      vaData.agentFee === fee
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {fee === 0 ? 'Tanpa Jasa (Rp 0)' : `Rp ${fee.toLocaleString('id-ID')}`}
                  </button>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-700/80 text-xs">
                <span className="text-slate-400 font-medium">TOTAL PEMBAYARAN:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  Rp {vaData.totalAmount.toLocaleString('id-ID')}
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
                  value={vaData.transactionDate}
                  onChange={(e) => updateVaField('transactionDate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Waktu / Jam
                </label>
                <input
                  type="text"
                  value={vaData.transactionTime}
                  onChange={(e) => updateVaField('transactionTime', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Referensi / Ref ID
                </label>
                <input
                  type="text"
                  value={vaData.refNumber}
                  onChange={(e) => updateVaField('refNumber', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Catatan / Keterangan Transaksi
              </label>
              <input
                type="text"
                value={vaData.notes || ''}
                onChange={(e) => updateVaField('notes', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                placeholder="Misal: Top Up Saldo, Belanja Online, Pembayaran Tagihan"
              />
            </div>
          </div>
        )}

        {/* TAB 2: PROFIL TOKO */}
        {activeTab === 'toko' && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nama Toko / Outlet
              </label>
              <input
                type="text"
                value={store.storeName}
                onChange={(e) => updateStoreField('storeName', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Alamat Singkat
                </label>
                <input
                  type="text"
                  value={store.address}
                  onChange={(e) => updateStoreField('address', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Call Center / Bantuan
                </label>
                <input
                  type="text"
                  value={store.callCenter || ''}
                  onChange={(e) => updateStoreField('callCenter', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                  placeholder="08001014017 (BEBAS PULSA) TERIMAKASIH"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Pesan Footer Baris 1
                </label>
                <input
                  type="text"
                  value={store.footerMessage}
                  onChange={(e) => updateStoreField('footerMessage', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FORMAT STRUK */}
        {activeTab === 'cetak' && (
          <div className="space-y-4">
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
                    onClick={() => updateSettingField('logoType', item.id as any)}
                    className={`py-2 px-2.5 rounded-lg border text-center transition text-xs font-semibold ${
                      settings.logoType === item.id
                        ? 'border-emerald-500 bg-emerald-950/60 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Judul Header Struk
              </label>
              <input
                type="text"
                value={settings.receiptTitle || ''}
                onChange={(e) => updateSettingField('receiptTitle', e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 uppercase"
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
                      ? 'border-emerald-500 bg-emerald-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">58mm (Standar Portabel)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Printer Bluetooth mini / saku</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettingField('paperWidth', '80mm')}
                  className={`p-3 rounded-lg border text-left transition ${
                    settings.paperWidth === '80mm'
                      ? 'border-emerald-500 bg-emerald-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">80mm (Desktop Kasir)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Printer thermal kasir besar</div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
