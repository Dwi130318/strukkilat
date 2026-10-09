import { ReceiptData, StoreProfile, PrintSettings, PlnTokenData } from '../types/receipt';

// Helper format Rupiah
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount).replace('IDR', 'Rp');
}

// Text padding helper for ESC/POS fixed column widths (32 chars for 58mm, 48 chars for 80mm)
export function formatTwoColumns(left: string, right: string, width: number): string {
  const leftStr = String(left || '');
  const rightStr = String(right || '');

  if (leftStr.length + rightStr.length >= width) {
    const maxLeft = Math.max(10, width - rightStr.length - 1);
    const truncatedLeft = leftStr.substring(0, maxLeft);
    const spaces = Math.max(1, width - truncatedLeft.length - rightStr.length);
    return truncatedLeft + ' '.repeat(spaces) + rightStr;
  }
  const spaces = width - leftStr.length - rightStr.length;
  return leftStr + ' '.repeat(spaces) + rightStr;
}

export function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const leftPadding = Math.floor((width - text.length) / 2);
  const rightPadding = width - text.length - leftPadding;
  return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private width: number;

  constructor(paperWidth: '58mm' | '80mm' = '58mm') {
    this.width = paperWidth === '80mm' ? 48 : 32;
    this.init();
  }

  init() {
    this.buffer.push(0x1b, 0x40); // ESC @ Initialize
    this.buffer.push(0x1b, 0x74, 0x00); // Select standard code page (PC437)
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  alignCenter() {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  bold(enable: boolean = true) {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleSize(enable: boolean = true) {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  lineFeed(lines: number = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  text(str: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  textLine(str: string) {
    this.text(str);
    this.lineFeed();
    return this;
  }

  centeredLine(str: string) {
    this.alignCenter();
    this.textLine(str);
    this.alignLeft();
    return this;
  }

  divider(char: string = '-') {
    this.textLine(char.repeat(this.width));
    return this;
  }

  doubleDivider() {
    this.textLine('='.repeat(this.width));
    return this;
  }

  twoColumns(left: string, right: string) {
    this.textLine(formatTwoColumns(left, right, this.width));
    return this;
  }

  cut() {
    this.lineFeed(3);
    this.buffer.push(0x1d, 0x56, 0x42, 0x00); // GS V partial cut
    return this;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// Helper format Rupiah for Mini ATM
export function formatMiniAtmRupiah(amount: number): string {
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(amount);
  return `RP ${formatted}`;
}

// Generate ESC/POS commands from Receipt & Settings
export function generateReceiptEscPos(
  receipt: ReceiptData,
  store: StoreProfile,
  settings: PrintSettings
): Uint8Array {
  const builder = new EscPosBuilder(settings.paperWidth);
  const width = settings.paperWidth === '80mm' ? 48 : 32;

  // MINI ATM TEMPLATE (Persis seperti bukti transaksi Mini ATM EDC / ATM Bersama)
  if (settings.template === 'mini_atm') {
    builder.alignCenter();

    // 1. Logo Text
    if (settings.logoType === 'atm_bersama') {
      builder.bold(true);
      builder.doubleSize(true);
      builder.textLine('ATM Bersama');
      builder.doubleSize(false);
      builder.bold(false);
      builder.lineFeed();
    } else if (settings.logoType === 'gpn') {
      builder.bold(true);
      builder.textLine('[ GPN ]');
      builder.bold(false);
    } else if (settings.logoType === 'link') {
      builder.bold(true);
      builder.textLine('[ LINK ]');
      builder.bold(false);
    }

    // 2. Header
    builder.bold(true);
    builder.textLine(settings.receiptTitle || 'BUKTI TRANSAKSI MINI ATM');
    builder.bold(false);
    builder.textLine(store.storeName || 'MITRA FAMILY JUO');
    if (store.address) builder.textLine(store.address);
    if (store.postalCode) builder.textLine(store.postalCode);
    builder.textLine(`${receipt.transactionDate} ${receipt.transactionTime}`);
    builder.lineFeed();

    // 3. Struk Title (Permanent Mini ATM style)
    builder.bold(true);
    builder.textLine('STRUK');
    builder.textLine('TRANSFER ANTAR BANK');
    builder.bold(false);
    builder.lineFeed();

    // 4. Details with aligned colon
    builder.alignLeft();
    const printRow = (label: string, value: string) => {
      const paddedLabel = (label + '              ').slice(0, 15);
      builder.textLine(`${paddedLabel}: ${value}`);
    };

    printRow('BANK TUJUAN', receipt.bankDestination.toUpperCase());
    printRow('NO. REKENING', (receipt.recipientAccount || '').replace(/\s+/g, ''));
    printRow('NAMA PENERIMA', receipt.recipientName.toUpperCase());

    // Wrap long Ref Number onto 2 lines
    const cleanRef = receipt.refNumber.replace(/\s+/g, '');
    if (cleanRef.length > 16) {
      printRow('NO REFF', cleanRef.slice(0, 16));
      builder.textLine(`                 ${cleanRef.slice(16)}`);
    } else {
      printRow('NO REFF', cleanRef);
    }

    printRow('STATUS', receipt.status || 'SUKSES');
    builder.lineFeed();

    // 5. Amount
    builder.alignCenter();
    builder.bold(true);
    builder.textLine('JUMLAH TRANSFER');
    builder.textLine(formatMiniAtmRupiah(receipt.amount));
    builder.bold(false);
    builder.lineFeed();

    builder.alignLeft();
    if (settings.showBankFee && receipt.bankAdminFee > 0) {
      printRow('BIAYA ADMIN', formatMiniAtmRupiah(receipt.bankAdminFee));
    }
    if (settings.showAgentFee && receipt.agentFee > 0) {
      printRow('BIAYA JASA', formatMiniAtmRupiah(receipt.agentFee));
    }

    // Total Bayar (Bold)
    builder.bold(true);
    printRow('TOTAL BAYAR', formatMiniAtmRupiah(receipt.totalAmount));
    builder.bold(false);
    builder.lineFeed();

    // 6. Footer Notes
    builder.alignCenter();
    builder.textLine(store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI');
    if (store.callCenter) {
      builder.textLine(store.callCenter);
    }
    builder.lineFeed();
    if (store.footerDisclaimer) {
      builder.textLine(store.footerDisclaimer);
    }

    builder.cut();
    return builder.getBytes();
  }

  // DEFAULT / MODERN / OTHER TEMPLATES
  builder.alignCenter();
  builder.bold(true);
  builder.doubleSize(true);
  builder.textLine(store.storeName);
  builder.doubleSize(false);
  builder.bold(false);

  if (store.slogan) {
    builder.textLine(store.slogan);
  }
  if (store.address) {
    builder.textLine(store.address);
  }
  if (store.phone) {
    builder.textLine(store.phone);
  }

  builder.alignLeft();
  builder.doubleDivider();

  // 2. Judul Struk & Status
  builder.alignCenter();
  builder.bold(true);
  builder.textLine(settings.receiptTitle || 'BUKTI TRANSFER DANA');
  builder.bold(false);
  builder.textLine(`[ ${receipt.status} ]`);
  builder.alignLeft();
  builder.divider();

  // 3. Waktu & Referensi
  builder.twoColumns('Tanggal', receipt.transactionDate);
  builder.twoColumns('Waktu', receipt.transactionTime);
  builder.twoColumns('No. Ref', receipt.refNumber.length > 18 ? receipt.refNumber.slice(0, 18) : receipt.refNumber);
  
  if (settings.showCustomerName && receipt.customerName) {
    builder.twoColumns('Pelanggan', receipt.customerName);
  }
  if (receipt.cashierName) {
    builder.twoColumns('Kasir', receipt.cashierName);
  }

  builder.divider();

  // 4. Data Transfer
  builder.twoColumns('Sumber', receipt.bankSource);
  builder.twoColumns('Bank Tujuan', receipt.bankDestination);
  builder.twoColumns('No Rekening', (receipt.recipientAccount || '').replace(/\s+/g, ''));
  builder.twoColumns('Penerima', receipt.recipientName);
  
  if (receipt.transactionType) {
    builder.twoColumns('Metode', receipt.transactionType);
  }
  if (settings.showNotes && receipt.notes) {
    builder.twoColumns('Berita', receipt.notes);
  }

  builder.doubleDivider();

  // 5. Rincian Biaya & Total
  builder.twoColumns('Jumlah Transfer', formatRupiah(receipt.amount));
  
  if (settings.showBankFee && receipt.bankAdminFee > 0) {
    builder.twoColumns('Biaya Admin Bank', formatRupiah(receipt.bankAdminFee));
  }
  
  if (settings.showAgentFee && receipt.agentFee > 0) {
    builder.twoColumns('Biaya Jasa Agen', formatRupiah(receipt.agentFee));
  }

  builder.divider();
  builder.bold(true);
  builder.twoColumns('TOTAL DIBAYAR', formatRupiah(receipt.totalAmount));
  builder.bold(false);
  builder.doubleDivider();

  // 6. Footer Pesan
  builder.alignCenter();
  if (store.footerMessage) {
    builder.textLine(store.footerMessage);
  }
  if (store.callCenter) {
    builder.textLine(store.callCenter);
  }

  builder.lineFeed();
  builder.cut();

  return builder.getBytes();
}

// Generate ESC/POS commands for PLN Token Receipt
export function generatePlnTokenEscPos(
  tokenData: PlnTokenData,
  store: StoreProfile,
  settings: PrintSettings
): Uint8Array {
  const builder = new EscPosBuilder(settings.paperWidth);

  builder.alignCenter();

  // 1. Logo Text
  if (settings.logoType === 'atm_bersama') {
    builder.bold(true);
    builder.doubleSize(true);
    builder.textLine('ATM Bersama');
    builder.doubleSize(false);
    builder.bold(false);
    builder.lineFeed();
  }

  // 2. Header
  builder.bold(true);
  builder.textLine('STRUK TOKEN LISTRIK PRABAYAR');
  builder.bold(false);
  builder.textLine(store.storeName || 'MITRA FAMILY JUO');
  if (store.address) builder.textLine(store.address);
  if (store.postalCode) builder.textLine(store.postalCode);
  builder.textLine(`${tokenData.transactionDate} ${tokenData.transactionTime}`);
  builder.lineFeed();

  // 3. Struk Title
  builder.bold(true);
  builder.textLine('STRUK');
  builder.textLine('PEMBELIAN TOKEN PLN');
  builder.bold(false);
  builder.lineFeed();

  // 4. Details with aligned colon
  builder.alignLeft();
  const printRow = (label: string, value: string) => {
    const paddedLabel = (label + '              ').slice(0, 15);
    builder.textLine(`${paddedLabel}: ${value}`);
  };

  printRow('NO METER', tokenData.meterNumber || '-');
  printRow('ID PELANGGAN', tokenData.customerId || '-');
  printRow('NAMA', tokenData.customerName.toUpperCase());
  printRow('TARIF / DAYA', tokenData.tariffPower.toUpperCase());

  const cleanRef = tokenData.refNumber.replace(/\s+/g, '');
  if (cleanRef.length > 16) {
    printRow('NO REFF', cleanRef.slice(0, 16));
    builder.textLine(`                 ${cleanRef.slice(16)}`);
  } else {
    printRow('NO REFF', cleanRef);
  }
  builder.lineFeed();

  // 5. STROOM / TOKEN (PROMINENT HIGHLIGHT)
  builder.alignCenter();
  builder.bold(true);
  builder.textLine('--------------------------------');
  builder.textLine('STROOM / TOKEN :');
  builder.doubleSize(true);
  const digits = tokenData.tokenNumber.replace(/\D/g, '');
  if (digits.length === 20) {
    // 2 lines of 10 digits or 4-digit blocks
    builder.textLine(`${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`);
    builder.textLine(`${digits.slice(12, 16)} ${digits.slice(16, 20)}`);
  } else {
    builder.textLine(tokenData.tokenNumber);
  }
  builder.doubleSize(false);
  builder.bold(false);

  if (tokenData.kwhAmount && tokenData.kwhAmount !== '-') {
    builder.textLine(`JML KWH : ${tokenData.kwhAmount}`);
  }
  builder.textLine('--------------------------------');
  builder.lineFeed();

  // 6. Rincian Biaya
  builder.alignLeft();
  printRow('NOMINAL TOKEN', formatMiniAtmRupiah(tokenData.amount));
  if (tokenData.agentFee > 0) {
    printRow('BIAYA JASA', formatMiniAtmRupiah(tokenData.agentFee));
  }

  // Total Bayar (Bold)
  builder.bold(true);
  printRow('TOTAL BAYAR', formatMiniAtmRupiah(tokenData.totalAmount));
  builder.bold(false);
  builder.lineFeed();

  // 7. Footer
  builder.alignCenter();
  builder.textLine(store.footerMessage || 'INFORMASI LEBIH LANJUT, HUBUNGI');
  if (store.callCenter) {
    builder.textLine(store.callCenter);
  }
  builder.lineFeed();
  if (store.footerDisclaimer) {
    builder.textLine(store.footerDisclaimer);
  }

  builder.cut();
  return builder.getBytes();
}

// Web Bluetooth BLE Printer Service UUIDs
const KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common chinese POS printers
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / VSC / Panda / Eppos
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent Serial
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Pos58 printer
];

export interface BluetoothPrinterConnection {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

let activeConnection: BluetoothPrinterConnection | null = null;

export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function isInsideIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function getActiveBluetoothDevice(): BluetoothDevice | null {
  return activeConnection?.device || null;
}

export async function disconnectBluetoothPrinter(): Promise<void> {
  if (activeConnection?.device?.gatt?.connected) {
    activeConnection.device.gatt.disconnect();
  }
  activeConnection = null;
}

export async function connectBluetoothPrinter(): Promise<BluetoothPrinterConnection> {
  if (!isBluetoothAvailable()) {
    throw new Error('Web Bluetooth tidak didukung di browser ini. Gunakan Google Chrome atau Edge.');
  }

  try {
    // Request device
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES,
    });

    if (!device.gatt) {
      throw new Error('GATT Server tidak ditemukan pada perangkat Bluetooth ini.');
    }

    const server = await device.gatt.connect();

    // Find a writable characteristic across available services
    let targetChar: BluetoothRemoteGATTCharacteristic | null = null;

    for (const serviceUuid of KNOWN_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const ch of chars) {
          if (ch.properties.write || ch.properties.writeWithoutResponse) {
            targetChar = ch;
            break;
          }
        }
        if (targetChar) break;
      } catch {
        // Continue to next service
      }
    }

    if (!targetChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const s of services) {
          try {
            const chars = await s.getCharacteristics();
            for (const ch of chars) {
              if (ch.properties.write || ch.properties.writeWithoutResponse) {
                targetChar = ch;
                break;
              }
            }
            if (targetChar) break;
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    if (!targetChar) {
      throw new Error('Karakteristik cetak printer tidak ditemukan. Pastikan printer Bluetooth thermal dalam mode pairing.');
    }

    activeConnection = {
      device,
      characteristic: targetChar,
    };

    return activeConnection;
  } catch (err: any) {
    if (
      err.name === 'SecurityError' ||
      err.message?.includes('permissions policy') ||
      err.message?.includes('disallowed by permissions policy')
    ) {
      throw new Error(
        'Browser membatasi Bluetooth di dalam jendela pratinjau (iFrame). Buka aplikasi di Tab Baru (layar penuh) untuk mengaktifkan Bluetooth langsung, atau gunakan tombol Cetak Langsung.'
      );
    }
    throw err;
  }
}

export async function printToBluetoothThermal(data: Uint8Array): Promise<void> {
  if (!activeConnection || !activeConnection.device.gatt?.connected) {
    // Attempt to connect if not connected
    await connectBluetoothPrinter();
  }

  if (!activeConnection) {
    throw new Error('Printer Bluetooth belum terhubung.');
  }

  const char = activeConnection.characteristic;
  // Send in chunks of 50 bytes with small delay to avoid buffer overflow on BLE POS printers
  const CHUNK_SIZE = 50;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(chunk);
    } else {
      await char.writeValue(chunk);
    }
    // Small sleep between chunks for stable transmission
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// Convert ESC/POS bytes to RawBT intent string for Android
export function getRawBtUrl(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  const base64 = btoa(binary);
  return `rawbt:base64,${base64}`;
}
