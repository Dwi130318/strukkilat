<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$id = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9]/', '', $_GET['id']) : '';
if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'ID tidak valid']);
    exit;
}

$tempDir = sys_get_temp_dir() . '/strukkilat_shares';
$file = $tempDir . '/' . $id;

if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'File tidak ditemukan atau telah kedaluwarsa']);
    exit;
}

$mime = 'image/jpeg';
if (file_exists($file . '.meta')) {
    $mime = trim(file_get_contents($file . '.meta'));
}

$content = file_get_contents($file);
$base64 = 'data:' . $mime . ';base64,' . base64_encode($content);

echo json_encode([
    'success' => true,
    'dataUrl' => $base64,
    'mimeType' => $mime
]);
