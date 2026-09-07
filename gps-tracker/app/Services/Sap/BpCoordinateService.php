<?php

namespace App\Services\Sap;

use Illuminate\Support\Facades\Http;

class BpCoordinateService
{
    public function find(string $dbSap, string $cardcode): array
    {
        $response = $this->request()
            ->get($this->getEndpoint($dbSap, $cardcode));

        if ($response->status() === 404) {
            return [
                'found' => false,
                'latitude' => null,
                'longitude' => null,
                'status' => 404,
                'payload' => $this->responsePayload($response->json()),
            ];
        }

        $this->ensureSuccessful($response->status(), $response->json());
        $row = $this->extractRow($response->json());

        return [
            'found' => $row !== null,
            'latitude' => $this->coordinateValue($row, ['latitude', 'lat', 'Latitude', 'Lat']),
            'longitude' => $this->coordinateValue($row, ['longitude', 'lng', 'long', 'Longitude', 'Long']),
            'status' => $response->status(),
            'payload' => $this->responsePayload($response->json()),
        ];
    }

    public function create(array $payload): array
    {
        return $this->send('post', $payload);
    }

    public function update(array $payload): array
    {
        return $this->send('patch', $payload);
    }

    private function send(string $method, array $payload): array
    {
        $response = $this->request()->{$method}($this->baseUrl(), $payload);
        $this->ensureSuccessful($response->status(), $response->json());

        return [
            'status' => $response->status(),
            'payload' => $this->responsePayload($response->json()),
        ];
    }

    private function request()
    {
        $request = Http::acceptJson()
            ->timeout(max(1, (int) config('sap.bp_coordinate_timeout', 15)))
            ->retry(2, 250);

        $token = trim((string) config('sap.bp_coordinate_token'));
        if ($token !== '') {
            $request = $request->withToken($token);
        }

        $apiKey = trim((string) config('sap.bp_coordinate_api_key'));
        if ($apiKey !== '') {
            $request = $request->withHeaders(['X-API-Key' => $apiKey]);
        }

        return $request;
    }

    private function getEndpoint(string $dbSap, string $cardcode): string
    {
        $template = (string) config('sap.bp_coordinate_get_url_template');

        if ($template === '') {
            $template = '{base}/{db}/{cardcode}';
        }

        return strtr($template, [
            '{base}' => $this->baseUrl(),
            '{db}' => rawurlencode($dbSap),
            '{cardcode}' => rawurlencode($cardcode),
        ]);
    }

    private function baseUrl(): string
    {
        $url = rtrim((string) config('sap.bp_coordinate_base_url'), '/');

        if ($url === '') {
            throw new \RuntimeException('SAP BP coordinate endpoint belum dikonfigurasi.');
        }

        return $url;
    }

    private function ensureSuccessful(int $status, mixed $payload): void
    {
        if ($status < 200 || $status >= 300) {
            throw new \RuntimeException('SAP BP coordinate API returned HTTP '.$status.'.');
        }

        if (is_array($payload)) {
            $success = $payload['success'] ?? null;
            $state = isset($payload['status']) ? strtolower((string) $payload['status']) : null;

            if ($success === false || ($state !== null && ! in_array($state, ['success', 'ok'], true))) {
                throw new \RuntimeException((string) ($payload['message'] ?? 'SAP BP coordinate API mengembalikan error.'));
            }
        }
    }

    private function extractRow(mixed $payload): ?array
    {
        if (! is_array($payload)) {
            return null;
        }

        $data = $payload['data'] ?? $payload;
        if (! is_array($data) || $data === []) {
            return null;
        }

        if (array_is_list($data)) {
            return isset($data[0]) && is_array($data[0]) ? $data[0] : null;
        }

        return $data;
    }

    private function coordinateValue(?array $row, array $keys): ?float
    {
        if ($row === null) {
            return null;
        }

        foreach ($keys as $key) {
            if (! array_key_exists($key, $row) || $row[$key] === null || $row[$key] === '') {
                continue;
            }

            return is_numeric($row[$key]) ? (float) $row[$key] : null;
        }

        return null;
    }

    private function responsePayload(mixed $payload): array
    {
        return is_array($payload) ? $payload : ['raw' => $payload];
    }
}
