<?php

namespace App\Services\UdPortal;

use App\Models\Team;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class UdPortalCashPaymentService
{
    public function create(array $payload, UploadedFile $photo, ?Team $team = null): Response
    {
        $credentials = $this->resolveCredentials($team);
        $response = $this->sendCashPayment($this->resolveToken($credentials), $payload, $photo);

        if ($response->status() === 401 && $credentials['username'] !== '' && $credentials['password'] !== '') {
            Cache::forget($this->tokenCacheKey($credentials));
            $response = $this->sendCashPayment($this->freshLoginToken($credentials), $payload, $photo);
        }

        return $response;
    }

    private function sendCashPayment(string $token, array $payload, UploadedFile $photo): Response
    {
        $photoContents = file_get_contents($photo->getRealPath());

        if ($photoContents === false) {
            throw new RuntimeException('Bukti pembayaran tidak bisa dibaca.');
        }

        $filename = $photo->getClientOriginalName() ?: 'cash-payment.jpg';
        $mimeType = $photo->getMimeType() ?: 'image/jpeg';

        return Http::acceptJson()
            ->withToken($token)
            ->timeout($this->timeout())
            ->attach('photo', $photoContents, $filename, ['Content-Type' => $mimeType])
            ->post($this->endpoint('cash-payments'), $payload);
    }

    private function resolveCredentials(?Team $team): array
    {
        $teamUsername = $this->normalizeString($team?->udportal_username);
        $teamPassword = $this->normalizeString($team?->udportal_password);

        if ($teamUsername !== '' || $teamPassword !== '') {
            if ($teamUsername === '' || $teamPassword === '') {
                throw new RuntimeException('Konfigurasi akun UD Portal cabang belum lengkap.');
            }

            return [
                'base_url' => $this->baseUrl(),
                'token' => '',
                'username' => $teamUsername,
                'password' => $teamPassword,
            ];
        }

        return [
            'base_url' => $this->baseUrl(),
            'token' => $this->stringConfig('udportal.api_token'),
            'username' => $this->stringConfig('udportal.api_username'),
            'password' => $this->stringConfig('udportal.api_password'),
        ];
    }

    private function resolveToken(array $credentials): string
    {
        $configuredToken = $credentials['token'];

        if ($configuredToken !== '') {
            return $configuredToken;
        }

        if ($credentials['username'] !== '' && $credentials['password'] !== '') {
            return Cache::remember(
                $this->tokenCacheKey($credentials),
                now()->addMinutes($this->tokenCacheMinutes()),
                fn () => $this->freshLoginToken($credentials)
            );
        }

        throw new RuntimeException('Konfigurasi akun UD Portal cabang belum lengkap.');
    }

    private function freshLoginToken(array $credentials): string
    {
        $response = Http::acceptJson()
            ->timeout($this->timeout())
            ->post($this->endpoint('auth/login', $credentials['base_url']), [
                'username' => $credentials['username'],
                'password' => $credentials['password'],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Login UD Portal gagal dengan status HTTP '.$response->status().'.');
        }

        $token = data_get($response->json(), 'data.access_token');

        if (! is_string($token) || trim($token) === '') {
            throw new RuntimeException('Login UD Portal tidak mengembalikan token API.');
        }

        return $token;
    }

    private function tokenCacheKey(array $credentials): string
    {
        return 'udportal:api-token:'.sha1(implode('|', [
            $credentials['base_url'],
            $credentials['username'],
            $credentials['password'],
        ]));
    }

    private function endpoint(string $path, ?string $baseUrl = null): string
    {
        return ($baseUrl ?: $this->baseUrl()).'/'.ltrim($path, '/');
    }

    private function baseUrl(): string
    {
        $baseUrl = rtrim($this->stringConfig('udportal.api_base_url'), '/');

        if ($baseUrl === '') {
            throw new RuntimeException('Base URL UD Portal belum dikonfigurasi.');
        }

        if (str_ends_with($baseUrl, '/api/v1')) {
            return $baseUrl;
        }

        if (str_ends_with($baseUrl, '/api')) {
            return $baseUrl.'/v1';
        }

        return $baseUrl.'/api/v1';
    }

    private function timeout(): int
    {
        return max(1, (int) config('udportal.api_timeout', 15));
    }

    private function tokenCacheMinutes(): int
    {
        return max(1, (int) config('udportal.api_token_cache_minutes', 60));
    }

    private function stringConfig(string $key): string
    {
        $value = config($key);

        return $this->normalizeString($value);
    }

    private function normalizeString(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }
}
