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

export type AppMode = 'transfer' | 'pln_token';

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
