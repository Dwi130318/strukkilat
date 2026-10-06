<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Periksa apakah ada manual API key di parse-receipt.php
$parseReceiptContent = @file_get_contents(__DIR__ . '/parse-receipt.php');
$manualKeyFound = false;
$apiKey = getenv('GEMINI_API_KEY');

if ($parseReceiptContent && preg_match('/\$MANUAL_API_KEY\s*=\s*["\']([^"\']+)["\']/', $parseReceiptContent, $matches)) {
    if (!empty($matches[1]) && trim($matches[1]) !== '') {
        $apiKey = trim($matches[1]);
        $manualKeyFound = true;
    }
}

// Cek .env jika belum ditemukan
if (!$apiKey) {
    $envPaths = [
        __DIR__ . '/../.env',
        __DIR__ . '/.env',
        dirname(__DIR__) . '/.env',
        $_SERVER['DOCUMENT_ROOT'] . '/.env'
    ];
    foreach ($envPaths as $p) {
        if (file_exists($p)) {
            $lines = file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), 'GEMINI_API_KEY=') === 0) {
                    $val = trim(substr(trim($line), 15), " \t\n\r\0\x0B\"'");
                    if (!empty($val)) {
                        $apiKey = $val;
                        break 2;
                    }
                }
            }
        }
    }
}

echo json_encode([
    'status' => 'ok',
    'server' => 'php',
    'php_version' => PHP_VERSION,
    'curl_aktif' => function_exists('curl_init'),
    'has_gemini_key' => !empty($apiKey),
    'key_source' => $manualKeyFound ? 'manual_parse_receipt.php' : (!empty($apiKey) ? '.env_file' : 'tidak_ditemukan'),
    'key_preview' => !empty($apiKey) ? (substr($apiKey, 0, 7) . '...' . substr($apiKey, -4)) : 'BELUM_DIISI',
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'pesan' => !empty($apiKey)
        ? 'Selamat! Server PHP dan Kunci API Gemini Anda sudah terdeteksi aktif.'
        : 'Perhatian: Kunci GEMINI_API_KEY belum terdeteksi. Silakan isi di file api/parse-receipt.php.'
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
