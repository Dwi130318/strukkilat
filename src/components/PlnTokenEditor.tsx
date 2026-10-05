import React, { useState } from 'react';
import { PlnTokenData, StoreProfile, PrintSettings } from '../types/receipt';
import { Zap, Store, Sliders, RefreshCw } from 'lucide-react';

interface PlnTokenEditorProps {
  tokenData: PlnTokenData;
  setTokenData: React.Dispatch<React.SetStateAction<PlnTokenData>>;
  store: StoreProfile;
  setStore: React.Dispatch<React.SetStateAction<StoreProfile>>;
  settings: PrintSettings;
  setSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
}

export const PlnTokenEditor: React.FC<PlnTokenEditorProps> = ({
  tokenData,
  setTokenData,
  store,
  setStore,
  settings,
  setSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'toko' | 'cetak'>('token');

  const updateTokenField = (field: keyof PlnTokenData, value: any) => {
    setTokenData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'amount' || field === 'agentFee') {
        const amt = field === 'amount' ? Number(value) || 0 : prev.amount;
        const aFee = field === 'agentFee' ? Number(value) || 0 : prev.agentFee;
        updated.totalAmount = amt + aFee;
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

  const quickNominals = [20000, 50000, 100000, 200000, 500000, 1000000];
  const quickAgentFees = [0, 2000, 2500, 3000, 5000];

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl shadow-lg overflow-hidden backdrop-blur">
      {/* TABS */}
      <div className="flex border-b border-slate-700 bg-slate-900/60 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('token')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
            activeTab === 'token'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          <span>Data Token Listrik</span>
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

      <div className="p-4">
        {/* TAB 1: DATA TOKEN PLN */}
        {activeTab === 'token' && (
          <div className="space-y-4">
            {/* 20 DIGIT TOKEN BOX (MOST IMPORTANT) */}
            <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Nomor Stroom / 20 Digit Token Listrik
                </label>
                <span className="text-[10px] text-amber-400/80 font-mono">
                  {tokenData.tokenNumber.replace(/\D/g, '').length} / 20 Digit
                </span>
              </div>
              <input
                type="text"
                value={tokenData.tokenNumber}
                onChange={(e) => updateTokenField('tokenNumber', e.target.value)}
                placeholder="Contoh: 3819 4820 1928 4719 0192"
                className="w-full bg-slate-900 border border-amber-500 rounded-lg px-3 py-2.5 text-sm sm:text-base font-mono font-bold text-amber-300 tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-[10px] text-amber-200/70">
                Nomor ini akan dicetak tebal dan jelas di tengah struk untuk dimasukkan ke meteran pelanggan.
              </p>
            </div>

            {/* DATA PELANGGAN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nomor Meter PLN
                </label>
                <input
                  type="text"
                  value={tokenData.meterNumber}
                  onChange={(e) => updateTokenField('meterNumber', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: 32019482910"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  ID Pelanggan (IDPEL)
                </label>
                <input
                  type="text"
                  value={tokenData.customerId}
                  onChange={(e) => updateTokenField('customerId', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: 52109823412"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={tokenData.customerName}
                  onChange={(e) => updateTokenField('customerName', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs uppercase text-white font-medium focus:outline-none focus:border-amber-500"
                  placeholder="Nama pemilik meteran listrik"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tarif / Daya
                </label>
                <input
                  type="text"
                  value={tokenData.tariffPower}
                  onChange={(e) => updateTokenField('tariffPower', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs uppercase text-white focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: R1 / 1300 VA atau R1M / 900 VA"
                />
              </div>
            </div>

            {/* JUMLAH KWH */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Jumlah kWh Diperoleh
                </label>
                <input
                  type="text"
                  value={tokenData.kwhAmount}
                  onChange={(e) => updateTokenField('kwhAmount', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: 65.8 kWh"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Referensi / ID Transaksi
                </label>
                <input
                  type="text"
                  value={tokenData.refNumber}
                  onChange={(e) => updateTokenField('refNumber', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: 20260916PLN101000297510"
                />
              </div>
            </div>

            {/* NOMINAL & BIAYA */}
            <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Nominal Token (Rp)
                  </label>
                  <input
                    type="number"
                    value={tokenData.amount}
                    onChange={(e) => updateTokenField('amount', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                      Biaya Jasa Agen (Rp)
                    </label>
                    <span className="text-[10px]">
                      {tokenData.agentFee > 0 ? (
                        <span className="text-emerald-400 font-semibold">Tampil di Struk</span>
                      ) : (
                        <span className="text-slate-500">Tidak Tampil (Kosong)</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={tokenData.agentFee || ''}
                    placeholder="0 (Kosongkan jika tanpa jasa)"
                    onChange={(e) => updateTokenField('agentFee', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full bg-slate-800 border border-amber-500/60 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Quick Nominal Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400">Pilihan Nominal Cepat:</span>
                {quickNominals.map((nom) => (
                  <button
                    key={nom}
                    type="button"
                    onClick={() => updateTokenField('amount', nom)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition ${
                      tokenData.amount === nom
                        ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    Rp {(nom / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {/* Quick Preset Buttons for Agent Fee */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400">Pilihan Biaya Jasa:</span>
                {quickAgentFees.map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => updateTokenField('agentFee', fee)}
                    className={`px-2 py-0.5 text-[10px] font-mono rounded border transition ${
                      tokenData.agentFee === fee
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
                  Rp {tokenData.totalAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* WAKTU TRANSAKSI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Tanggal
                </label>
                <input
                  type="text"
                  value={tokenData.transactionDate}
                  onChange={(e) => updateTokenField('transactionDate', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Waktu / Jam
                </label>
                <input
                  type="text"
                  value={tokenData.transactionTime}
                  onChange={(e) => updateTokenField('transactionTime', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
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
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 uppercase"
                placeholder="Contoh: MITRA FAMILY JUO"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Alamat / Daerah
                </label>
                <input
                  type="text"
                  value={store.address}
                  onChange={(e) => updateStoreField('address', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 uppercase"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  placeholder="Contoh: 28557"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={store.phone}
                  onChange={(e) => updateStoreField('phone', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
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
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="Contoh: PLN 123 / 08001014017 (BEBAS PULSA)"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PENGATURAN CETAK */}
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
                    onClick={() => updateSettingField('logoType', item.id)}
                    className={`py-2 px-2.5 rounded-lg border text-center transition text-xs font-semibold ${
                      settings.logoType === item.id
                        ? 'border-amber-500 bg-amber-950/60 text-white'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
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
                      ? 'border-amber-500 bg-amber-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">58mm (Standar Portabel)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Printer Bluetooth mini / saku
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettingField('paperWidth', '80mm')}
                  className={`p-3 rounded-lg border text-left transition ${
                    settings.paperWidth === '80mm'
                      ? 'border-amber-500 bg-amber-950/60 text-white'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-xs font-bold">80mm (Lebar POS Kasir)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Printer thermal kasir besar
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
