export type TransactionStatus = 'BERHASIL' | 'SUKSES' | 'PENDING' | 'GAGAL';

export interface ReceiptData {
  id: string;
  bankSource: string;
  bankDestination: string;
  recipientName: string;
  recipientAccount: string;
  senderName: string;
  senderAccount: string;
  amount: number;
  bankAdminFee: number;
  agentFee: number;
  totalAmount: number;
  transactionDate: string;
  transactionTime: string;
  refNumber: string;
  transactionType: string;
  status: TransactionStatus;
  notes?: string;
  customerName?: string;
  cashierName?: string;
  sourceScreenshot?: string;
  createdAt: string;
}

export type AppMode = 'transfer' | 'pln_token' | 'virtual_account';

export interface VirtualAccountData {
  id: string;
  bankSource: string; // misal: BRI / BRIVA, BCA, MANDIRI, BNI, PERMATA
  vaProvider: string; // misal: BRIVA, BCA Virtual Account, Mandiri VA
  vaNumber: string; // nomor VA rapat tanpa spasi
  billerName: string; // Merchant / Institusi / Biller (misal: SHOPEEPAY, TOKOPEDIA, DANA TOP UP)
  customerName: string; // Nama Pelanggan
  amount: number; // Tagihan / Nominal
  adminFee: number; // Admin Bank jika ada
  agentFee: number; // Biaya Jasa Agen
  totalAmount: number; // Total Bayar
  transactionDate: string;
  transactionTime: string;
  refNumber: string;
  status: TransactionStatus;
  notes?: string;
  sourceScreenshot?: string;
  createdAt: string;
}

export interface PlnTokenData {
  id: string;
  meterNumber: string;
  customerId: string;
  customerName: string;
  tariffPower: string;
  tokenNumber: string;
  kwhAmount: string;
  amount: number;
  adminFee: number;
  agentFee: number;
  totalAmount: number;
  transactionDate: string;
  transactionTime: string;
  refNumber: string;
  sourceScreenshot?: string;
  createdAt: string;
}

export interface StoreProfile {
  storeName: string;
  slogan: string;
  address: string;
  postalCode?: string;
  phone: string;
  callCenter?: string;
  footerMessage: string;
  footerDisclaimer?: string;
  defaultAgentFee: number;
}

export type PaperWidth = '58mm' | '80mm';
export type ReceiptTemplate = 'mini_atm' | 'modern' | 'classic' | 'official';
export type LogoType = 'atm_bersama' | 'link' | 'gpn' | 'prima' | 'none';

export interface PrintSettings {
  paperWidth: PaperWidth;
  template: ReceiptTemplate;
  logoType: LogoType;
  receiptTitle: string;
  showBarcode: boolean;
  showQrCode: boolean;
  showAgentFee: boolean;
  showBankFee: boolean;
  showStatusBadge: boolean;
  showCustomerName: boolean;
  showNotes: boolean;
}

export interface BluetoothDeviceInfo {
  name?: string;
  id: string;
  connected: boolean;
}
