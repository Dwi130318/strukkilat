<?php
// Handle Android PWA Share Target on standard PHP hosting (Rumahweb)
$tempDir = sys_get_temp_dir() . '/strukkilat_shares';
if (!is_dir($tempDir)) {
    @mkdir($tempDir, 0777, true);
}

// Bersihkan file yang lebih dari 15 menit
$files = glob($tempDir . '/*');
$now = time();
if ($files) {
    foreach ($files as $f) {
        if ($now - filemtime($f) > 900) {
            @unlink($f);
        }
    }
}

$uploadedFile = null;
if (!empty($_FILES)) {
    foreach ($_FILES as $f) {
        if (!empty($f['tmp_name']) && is_uploaded_file($f['tmp_name'])) {
            $uploadedFile = $f;
            break;
        }
    }
}

if (!$uploadedFile) {
    header('Location: /', true, 303);
    exit;
}

$id = bin2hex(random_bytes(12));
$dest = $tempDir . '/' . $id;
if (move_uploaded_file($uploadedFile['tmp_name'], $dest)) {
    $mime = !empty($uploadedFile['type']) ? $uploadedFile['type'] : 'image/jpeg';
    file_put_contents($dest . '.meta', $mime);
    header("Location: /?shared_id={$id}", true, 303);
    exit;
}

header('Location: /', true, 303);
exit;
