<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed. Gunakan metode POST.']);
    exit;
}

// =====================================================================
// PENTING: TEMPELKAN GEMINI API KEY ANDA DI SINI
// Ganti isi kutip di bawah ini dengan API Key Anda dari Google AI Studio:
$MANUAL_API_KEY = ""; 
// Contoh: $MANUAL_API_KEY = "AIzaSyBxxxxxxx";
// =====================================================================

$apiKey = trim($MANUAL_API_KEY);

// Coba baca dari .env jika belum diisi manual
if (!$apiKey) {
    $apiKey = getenv('GEMINI_API_KEY');
}

if (!$apiKey) {
    $envPaths = [
        __DIR__ . '/../.env',
        __DIR__ . '/.env',
        dirname(__DIR__) . '/.env',
        $_SERVER['DOCUMENT_ROOT'] . '/.env',
        $_SERVER['DOCUMENT_ROOT'] . '/../.env'
    ];
    foreach ($envPaths as $envPath) {
        if (file_exists($envPath) && is_readable($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                $trimmed = trim($line);
                if (strpos($trimmed, '#') === 0) continue;
                if (strpos($trimmed, 'GEMINI_API_KEY=') === 0) {
                    $val = trim(substr($trimmed, 15), " \t\n\r\0\x0B\"'");
                    if (!empty($val)) {
                        $apiKey = $val;
                        break 2;
                    }
                }
            }
        }
    }
}

// Jika API key tetap kosong
if (!$apiKey) {
    echo json_encode([
        'success' => false,
        'error' => 'GEMINI_API_KEY belum diisi.',
        'warning' => 'Kunci API Gemini belum diisi. Buka file api/parse-receipt.php di File Manager cPanel, lalu tempel kunci Anda pada baris $MANUAL_API_KEY = "AIzaSy...";'
    ]);
    exit;
}

// 2. Baca payload gambar dari request body
$rawInput = file_get_contents('php://input');
$requestData = json_decode($rawInput, true);

if (!$requestData || empty($requestData['imageBase64'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Data gambar bukti transfer tidak diterima oleh server. Pastikan ukuran gambar tidak melebihi limit hosting.']);
    exit;
}

$imageBase64 = $requestData['imageBase64'];
$mimeType = !empty($requestData['mimeType']) ? $requestData['mimeType'] : 'image/jpeg';
$mode = !empty($requestData['mode']) ? $requestData['mode'] : 'transfer';

// Bersihkan data URL prefix jika ada
$cleanBase64 = preg_replace('#^data:image/[^;]+;base64,#', '', $imageBase64);

// 3. Prompt OCR
if ($mode === 'pln_token') {
    $prompt = "Kamu adalah ahli OCR khusus struk dan bukti pembelian TOKEN LISTRIK PLN PRABAYAR Indonesia. Ekstrak data token listrik PLN secara sangat akurat dalam format JSON murni tanpa markdown:
{
  \"meterNumber\": \"string (11 digit nomor meter)\",
  \"customerId\": \"string (11-12 digit IDPEL)\",
  \"customerName\": \"string (nama pelanggan)\",
  \"tariffPower\": \"string (contoh: R1 / 1300 VA)\",
  \"tokenNumber\": \"string (20 digit token dipisah spasi tiap 4 digit: XXXX XXXX XXXX XXXX XXXX)\",
  \"kwhAmount\": \"string (contoh: 65.8 kWh)\",
  \"amount\": integer nominal beli token murni tanpa titik,
  \"adminFee\": 0,
  \"transactionDate\": \"string (DD/MM/YYYY)\",
  \"transactionTime\": \"string (HH:MM WIB)\",
  \"refNumber\": \"string (no referensi)\"
}";
} else {
    $prompt = "Kamu adalah ahli OCR khusus struk dan bukti transfer m-banking & e-wallet Indonesia (BCA, Mandiri Livin, BRImo BRI, BNI, DANA, GoPay, OVO, ShopeePay, Seabank, Jago, dll). Ekstrak seluruh informasi transfer dari gambar bukti transaksi ini dalam format JSON murni tanpa markdown:
{
  \"bankSource\": \"string (nama bank pengirim, misal: BRImo (Bank BRI), BCA (m-BCA), Mandiri Livin)\",
  \"bankDestination\": \"string (nama bank tujuan, misal: BRI, BCA, BNI, DANA, SHOPEEPAY)\",
  \"recipientName\": \"string (nama lengkap pemilik rekening penerima)\",
  \"recipientAccount\": \"string (nomor rekening atau nomor HP penerima)\",
  \"senderName\": \"string (nama pengirim)\",
  \"senderAccount\": \"string (nomor rekening pengirim)\",
  \"amount\": integer nominal uang transfer murni tanpa titik atau Rp,
  \"bankAdminFee\": integer biaya admin bank jika ada (0 jika gratis),
  \"transactionDate\": \"string (tanggal transaksi DD/MM/YYYY)\",
  \"transactionTime\": \"string (jam transaksi misal 14:25 WIB)\",
  \"refNumber\": \"string (nomor referensi / no bukti)\",
  \"transactionType\": \"string (misal TRANSFER ANTAR BANK)\",
  \"status\": \"SUKSES\",
  \"notes\": \"string\"
}";
}

// 4. Siapkan request ke Gemini API
$payload = [
    'contents' => [
        [
            'parts' => [
                [
                    'inlineData' => [
                        'mimeType' => $mimeType,
                        'data' => $cleanBase64
                    ]
                ],
                [
                    'text' => $prompt
                ]
            ]
        ]
    ],
    'generationConfig' => [
        'responseMimeType' => 'application/json',
        'temperature' => 0.1
    ]
];

// Model-model resmi yang aktif
$models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
$parsedResult = null;
$lastErrorMsg = '';

foreach ($models as $modelName) {
    $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent?key=" . urlencode($apiKey);

    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_TIMEOUT, 35);
    // Hindari gagal SSL di server cPanel yang CA bundle-nya belum update
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($httpCode === 200 && $response) {
        $respJson = json_decode($response, true);
        if (!empty($respJson['candidates'][0]['content']['parts'][0]['text'])) {
            $rawText = $respJson['candidates'][0]['content']['parts'][0]['text'];
            $cleanText = preg_replace('/```json\s*/', '', $rawText);
            $cleanText = preg_replace('/```\s*$/', '', $cleanText);
            $decoded = json_decode(trim($cleanText), true);
            if ($decoded && is_array($decoded)) {
                $parsedResult = $decoded;
                break;
            }
        }
    } else {
        $lastErrorMsg = "Model {$modelName} gagal (HTTP {$httpCode}): " . ($response ? substr($response, 0, 150) : $curlErr);
    }
}

if ($parsedResult) {
    echo json_encode([
        'success' => true,
        'data' => $parsedResult
    ]);
} else {
    echo json_encode([
        'success' => false,
        'error' => 'AI Gemini belum berhasil membaca gambar: ' . $lastErrorMsg,
        'warning' => 'Kendala AI: ' . $lastErrorMsg
    ]);
}
