<?php
$config = require '/etc/dev.crucio.cz/oauth2-token-proxy.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    exit;
}

$raw = file_get_contents('php://input');
parse_str($raw, $params);
$params['client_secret'] = $config['client_secret'];
$body = http_build_query($params, '', '&', PHP_QUERY_RFC3986);

$headers = [
    'Content-Type: application/x-www-form-urlencoded',
    'Accept: application/json',
];

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $body,
        'ignore_errors' => true,
        'timeout' => 15,
    ],
]);

$response = file_get_contents($config['upstream'], false, $context);
$status = 502;
$contentType = 'application/json';

foreach (($http_response_header ?? []) as $header) {
    if (preg_match('~^HTTP/\S+\s+(\d+)~i', $header, $m)) {
        $status = (int) $m[1];
        continue;
    }

    if (stripos($header, 'Content-Type:') === 0) {
        $contentType = trim(substr($header, strlen('Content-Type:')));
    }
}

http_response_code($status);
header('Content-Type: ' . $contentType);
header_remove('WWW-Authenticate');
echo $response === false ? json_encode(['error' => 'proxy_failed']) : $response;
