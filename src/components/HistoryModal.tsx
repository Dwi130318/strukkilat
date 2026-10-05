import React, { useState } from 'react';
import { X, History, Trash2, ArrowUpRight, Search, FileText } from 'lucide-react';
import { ReceiptData } from '../types/receipt';
import { formatRupiah } from '../utils/escpos';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: ReceiptData[];
  onSelectReceipt: (receipt: ReceiptData) => void;
  onClearHistory: () => void;
  onDeleteSingle: (id: string) => void;
}

export function HistoryModal({
  isOpen,
  onClose,
  history,
  onSelectReceipt,
  onClearHistory,
  onDeleteSingle,
}: HistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.recipientName.toLowerCase().includes(q) ||
      item.refNumber.toLowerCase().includes(q) ||
      item.bankSource.toLowerCase().includes(q) ||
      item.bankDestination.toLowerCase().includes(q) ||
      (item.customerName && item.customerName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Riwayat Cetak Struk</h3>
              <p className="text-xs text-slate-400">
                {history.length} transaksi tersimpan di memori perangkat
              </p>
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

        {/* Search & Bulk Action */}
        <div className="p-4 border-b border-slate-700 bg-slate-850 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari penerima, no. ref, bank..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition flex items-center gap-1.5 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">Belum ada riwayat transaksi</p>
              <p className="text-xs text-slate-500 mt-1">
                Struk yang dipindai atau dicetak akan otomatis tercatat di sini.
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-900/80 hover:bg-slate-900 border border-slate-700/80 hover:border-indigo-500/50 rounded-xl transition flex items-center justify-between gap-3 group"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectReceipt(item);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase group-hover:text-indigo-300">
                      {item.recipientName}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                      {item.bankDestination}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-emerald-400 mt-1">
                    {formatRupiah(item.totalAmount)}
                    <span className="text-[10px] text-slate-400 font-normal ml-2">
                      (Transfer: {formatRupiah(item.amount)} + Jasa: {formatRupiah(item.agentFee)})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2 font-mono">
                    <span>{item.transactionDate} {item.transactionTime}</span>
                    <span>•</span>
                    <span className="truncate max-w-[120px]">{item.refNumber}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectReceipt(item);
                      onClose();
                    }}
                    className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white transition"
                    title="Buka & Cetak Ulang"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSingle(item.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition"
                    title="Hapus dari riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
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
