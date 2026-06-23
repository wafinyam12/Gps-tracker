<?php

namespace App\Services\Sap;

use App\Models\Store;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class OutstandingReceivableService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';
    private const CACHE_VERSION = 'v3';

    public function forStore(?Store $store, ?User $user): array
    {
        $cardCode = $this->normalizeCardCode($store?->external_bp_code ?: $store?->code);

        return $this->resolve($user, $cardCode);
    }

    public function resolve(?User $user, ?string $requestedCardCode = null): array
    {
        $requestedCardCode = $this->normalizeCardCode($requestedCardCode);
        $dbSap = $this->normalizeText($user?->db_sap);
        $slpCode = $this->normalizeText($user?->slpCode);

        if (! $dbSap || ! $slpCode) {
            return $this->unavailableResponse(
                'Konfigurasi SAP user belum lengkap.',
                $requestedCardCode,
                $dbSap,
                $slpCode
            );
        }

        try {
            $customers = $this->fetchCustomerRows($dbSap, $slpCode);
        } catch (Throwable $throwable) {
            Log::warning('Failed to fetch SAP outstanding receivable', [
                'db_sap' => $dbSap,
                'slp_code' => $slpCode,
                'card_code' => $requestedCardCode,
                'error' => $throwable->getMessage(),
            ]);

            return $this->unavailableResponse(
                'Data piutang SAP sedang tidak tersedia.',
                $requestedCardCode,
                $dbSap,
                $slpCode
            );
        }

        if ($customers->isEmpty()) {
            return $this->notFoundResponse(
                'Tidak ada customer SAP untuk sales ini.',
                $requestedCardCode,
                $dbSap,
                $slpCode
            );
        }

        $matchedCustomer = $requestedCardCode
            ? $customers->first(function (array $customer) use ($requestedCardCode) {
                return $this->matchesCardCode($customer, $requestedCardCode);
            })
            : $customers->first();

        if (! $matchedCustomer) {
            return $this->notFoundResponse(
                'Customer SAP tidak ditemukan untuk toko ini.',
                $requestedCardCode,
                $dbSap,
                $slpCode,
                $customers->count()
            );
        }

        $normalizedCustomer = $this->normalizeCustomer($matchedCustomer);

        return [
            'status' => 'success',
            'message' => 'Data piutang berhasil dimuat.',
            'matched' => true,
            'requested_card_code' => $requestedCardCode,
            ...$normalizedCustomer,
            'source' => [
                'db_sap' => $dbSap,
                'slp_code' => $slpCode,
                'endpoint' => $this->buildEndpoint($dbSap, $slpCode),
                'customers_count' => $customers->count(),
                'fetched_at' => now(self::LOCAL_TIMEZONE)->toISOString(),
            ],
        ];
    }

    public function customers(?User $user): Collection
    {
        $dbSap = $this->normalizeText($user?->db_sap);
        $slpCode = $this->normalizeText($user?->slpCode);

        if (! $dbSap || ! $slpCode) {
            return collect();
        }

        return $this->fetchCustomerRows($dbSap, $slpCode)
            ->map(fn (array $customer) => $this->normalizeCustomer($customer))
            ->values();
    }

    private function fetchCustomerRows(string $dbSap, string $slpCode): Collection
    {
        $cacheKey = 'sap:outstanding-receivable:' . self::CACHE_VERSION . ':' . sha1(
            $this->buildEndpoint($dbSap, $slpCode)
        );
        $ttlMinutes = max(1, (int) config('sap.outstanding_receivable_cache_minutes', 10));
        $timeout = max(1, (int) config('sap.outstanding_receivable_timeout', 15));

        return Cache::remember($cacheKey, now()->addMinutes($ttlMinutes), function () use ($dbSap, $slpCode, $timeout) {
            $response = Http::acceptJson()
                ->timeout($timeout)
                ->retry(2, 250)
                ->get($this->buildEndpoint($dbSap, $slpCode));

            if ($response->failed()) {
                throw new \RuntimeException('SAP API returned HTTP ' . $response->status());
            }

            $payload = $response->json();
            if (! is_array($payload)) {
                throw new \RuntimeException('SAP API returned an invalid payload.');
            }

            $status = $payload['status'] ?? null;
            $success = $payload['success'] ?? null;

            if (($success === false) || (is_string($status) && strtolower($status) !== 'success')) {
                $message = $payload['message'] ?? 'SAP API returned an error response.';
                throw new \RuntimeException($message);
            }

            return $this->normalizeCustomerRows(data_get($payload, 'data', []));
        });
    }

    private function normalizeCustomerRows(mixed $rows): Collection
    {
        if (! is_array($rows) || $rows === []) {
            return collect();
        }

        if (array_is_list($rows)) {
            return collect($rows)
                ->filter(fn ($row) => is_array($row))
                ->values();
        }

        return $this->isCustomerRow($rows)
            ? collect([$rows])
            : collect();
    }

    private function normalizeCustomer(array $customer): array
    {
        $paymentTerms = $this->extractText($customer, ['Payment Terms', 'payment_terms']);
        $invoices = collect($customer['Invoices'] ?? [])
            ->filter(fn ($invoice) => is_array($invoice))
            ->map(fn (array $invoice) => $this->normalizeInvoice($invoice, $paymentTerms))
            ->sortBy('doc_due_date_sort')
            ->values();

        $overdueInvoices = $invoices->filter(fn (array $invoice) => $invoice['is_overdue']);

        $currentBalance = $this->extractFloat($customer, ['TotalBalance', 'Current Balance', 'current_balance']);
        $creditLimit = $this->extractFloat($customer, ['Credit Limit', 'credit_limit']);
        $balanceCreditLimit = $this->extractFloat($customer, ['Balance Credit Limit', 'balance_credit_limit']);
        $totalArOutstanding = $this->extractInt($customer, ['Total AR Invoice Outstanding', 'total_ar_invoice_outstanding']);
        $totalDpOutstanding = $this->extractInt($customer, ['Total DP Invoice Outstanding', 'total_dp_invoice_outstanding']);
        $totalDocumentOutstanding = $this->extractInt($customer, ['Total Document Outstanding', 'total_document_outstanding']);
        $invoiceCount = max(
            $invoices->count(),
            $totalDocumentOutstanding,
            $totalArOutstanding + $totalDpOutstanding
        );

        if (($currentBalance === null || abs($currentBalance) < 0.00001) && $invoices->isNotEmpty()) {
            $balanceSum = $invoices->sum(function (array $invoice) {
                return max(0, (float) ($invoice['balance_due'] ?? 0));
            });

            if ($balanceSum > 0) {
                $currentBalance = round($balanceSum, 2);
            }
        }

        return [
            'card_code' => $this->extractCardCode($customer),
            'customer_code' => $this->extractCardCode($customer),
            'card_name' => $this->extractText($customer, ['CardName', 'Customer Name', 'card_name']) ?? null,
            'customer_name' => $this->extractText($customer, ['CardName', 'Customer Name', 'card_name']) ?? null,
            'address' => $this->extractText($customer, ['Address', 'Customer Address', 'address']) ?: null,
            'customer_address' => $this->extractText($customer, ['Address', 'Customer Address', 'address']) ?: null,
            'payment_terms' => $paymentTerms,
            'credit_limit' => $creditLimit,
            'current_balance' => round($currentBalance ?? 0, 2),
            'balance_credit_limit' => $balanceCreditLimit,
            'total_balance' => round($currentBalance ?? 0, 2),
            'total_ar_invoice_outstanding' => $totalArOutstanding,
            'total_dp_invoice_outstanding' => $totalDpOutstanding,
            'total_document_outstanding' => $invoiceCount,
            'invoice_count' => $invoiceCount,
            'open_invoice_count' => $invoiceCount,
            'overdue_invoice_count' => $overdueInvoices->count(),
            'overdue_balance' => $this->calculateOverdueBalance($overdueInvoices),
            'invoices' => $invoices->map(fn (array $invoice) => Arr::except($invoice, ['doc_due_date_sort']))->all(),
        ];
    }

    private function normalizeInvoice(array $invoice, ?string $paymentTerms = null): array
    {
        $docDate = $this->normalizeDateValue($this->extractValue($invoice, ['DocDate', 'Posting Date', 'posting_date', 'doc_date']));
        $explicitDueDate = $this->normalizeDateValue($this->extractValue($invoice, ['DocDueDate', 'Due Date', 'doc_due_date']));
        $dueDate = $this->parseDateOnly($explicitDueDate) ?? $this->estimateDueDate($docDate, $paymentTerms);
        $docTotal = $this->extractFloat($invoice, ['DocTotal', 'doc_total']);
        $paidToDate = $this->extractFloat($invoice, ['PaidToDate', 'paid_to_date']);
        $balanceDue = $this->extractFloat($invoice, ['BalanceDue', 'balance_due']);

        if ($balanceDue === null && $docTotal !== null && $paidToDate !== null) {
            $balanceDue = round(max(0, $docTotal - $paidToDate), 2);
        }

        $amountAvailable = $balanceDue !== null || $docTotal !== null || $paidToDate !== null;

        return [
            'doc_entry' => $this->extractText($invoice, ['DocEntry', 'doc_entry']) ?: null,
            'doc_num' => $this->extractText($invoice, ['DocNum', 'Invoice No', 'invoice_no']) ?: null,
            'invoice_no' => $this->extractText($invoice, ['DocNum', 'Invoice No', 'invoice_no']) ?: null,
            'document_type' => $this->extractText($invoice, ['Document Type', 'document_type']) ?: null,
            'doc_date' => $docDate,
            'posting_date' => $docDate,
            'doc_due_date' => $dueDate?->toDateString(),
            'estimated_due_date' => $dueDate?->toDateString(),
            'doc_total' => $docTotal,
            'paid_to_date' => $paidToDate,
            'balance_due' => $balanceDue,
            'amount_available' => $amountAvailable,
            'is_overdue' => $dueDate ? $dueDate->lt(now(self::LOCAL_TIMEZONE)->startOfDay()) && ($balanceDue === null || $balanceDue > 0) : false,
            'doc_due_date_sort' => $dueDate?->timestamp ?? PHP_INT_MAX,
        ];
    }

    private function unavailableResponse(
        string $message,
        ?string $requestedCardCode,
        ?string $dbSap,
        ?string $slpCode
    ): array {
        return [
            'status' => 'unavailable',
            'message' => $message,
            'matched' => false,
            'requested_card_code' => $requestedCardCode,
            'card_code' => $requestedCardCode,
            'customer_code' => $requestedCardCode,
            'card_name' => null,
            'customer_name' => null,
            'address' => null,
            'customer_address' => null,
            'payment_terms' => null,
            'credit_limit' => 0,
            'current_balance' => 0,
            'balance_credit_limit' => 0,
            'total_balance' => 0,
            'total_ar_invoice_outstanding' => 0,
            'total_dp_invoice_outstanding' => 0,
            'total_document_outstanding' => 0,
            'invoice_count' => 0,
            'open_invoice_count' => 0,
            'overdue_invoice_count' => 0,
            'overdue_balance' => null,
            'invoices' => [],
            'source' => [
                'db_sap' => $dbSap,
                'slp_code' => $slpCode,
                'endpoint' => $dbSap && $slpCode ? $this->buildEndpoint($dbSap, $slpCode) : null,
                'fetched_at' => now(self::LOCAL_TIMEZONE)->toISOString(),
            ],
        ];
    }

    private function notFoundResponse(
        string $message,
        ?string $requestedCardCode,
        ?string $dbSap,
        ?string $slpCode,
        int $customersCount = 0
    ): array {
        return [
            'status' => 'not_found',
            'message' => $message,
            'matched' => false,
            'requested_card_code' => $requestedCardCode,
            'card_code' => $requestedCardCode,
            'customer_code' => $requestedCardCode,
            'card_name' => null,
            'customer_name' => null,
            'address' => null,
            'customer_address' => null,
            'payment_terms' => null,
            'credit_limit' => 0,
            'current_balance' => 0,
            'balance_credit_limit' => 0,
            'total_balance' => 0,
            'total_ar_invoice_outstanding' => 0,
            'total_dp_invoice_outstanding' => 0,
            'total_document_outstanding' => 0,
            'invoice_count' => 0,
            'open_invoice_count' => 0,
            'overdue_invoice_count' => 0,
            'overdue_balance' => null,
            'invoices' => [],
            'source' => [
                'db_sap' => $dbSap,
                'slp_code' => $slpCode,
                'endpoint' => $dbSap && $slpCode ? $this->buildEndpoint($dbSap, $slpCode) : null,
                'customers_count' => $customersCount,
                'fetched_at' => now(self::LOCAL_TIMEZONE)->toISOString(),
            ],
        ];
    }

    private function buildEndpoint(string $dbSap, string $slpCode): string
    {
        $baseUrl = rtrim((string) config('sap.outstanding_receivable_base_url'), '/');

        return $baseUrl.'/'.rawurlencode($dbSap).'/'.rawurlencode($slpCode);
    }

    private function parseDateOnly(mixed $value): ?Carbon
    {
        $normalized = $this->normalizeDateValue($value);

        if (! $normalized) {
            return null;
        }

        try {
            return Carbon::parse($normalized, self::LOCAL_TIMEZONE)->startOfDay();
        } catch (Throwable) {
            return null;
        }
    }

    private function estimateDueDate(?string $postingDate, ?string $paymentTerms): ?Carbon
    {
        $postingDate = $this->normalizeDateValue($postingDate);
        $days = $this->parsePaymentTermDays($paymentTerms);

        if (! $postingDate || $days === null) {
            return null;
        }

        try {
            $date = Carbon::parse($postingDate, self::LOCAL_TIMEZONE)->startOfDay();

            return $days === 0 ? $date : $date->copy()->addDays($days);
        } catch (Throwable) {
            return null;
        }
    }

    private function parsePaymentTermDays(?string $paymentTerms): ?int
    {
        $paymentTerms = $this->normalizeText($paymentTerms);

        if ($paymentTerms === '') {
            return null;
        }

        $upper = strtoupper($paymentTerms);

        if (in_array($upper, ['CASH', 'COD', 'CBD'], true)) {
            return 0;
        }

        if (preg_match('/(\d+)/', $upper, $matches) === 1) {
            return (int) $matches[1];
        }

        return null;
    }

    private function normalizeDateValue(mixed $value): ?string
    {
        $text = $this->normalizeText($value);

        return $text !== '' ? $text : null;
    }

    private function extractCardCode(array $customer): ?string
    {
        return $this->normalizeCardCode(
            $this->extractText($customer, ['CardCode', 'Customer Code', 'card_code'])
        );
    }

    private function extractValue(array $payload, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (! array_key_exists($key, $payload)) {
                continue;
            }

            $value = $payload[$key];

            if ($value === null) {
                continue;
            }

            if (is_string($value) && trim($value) === '') {
                continue;
            }

            return $value;
        }

        return null;
    }

    private function extractText(array $payload, array $keys): ?string
    {
        $value = $this->extractValue($payload, $keys);

        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }

    private function extractFloat(array $payload, array $keys): ?float
    {
        $value = $this->extractValue($payload, $keys);

        if ($value === null) {
            return null;
        }

        $normalized = str_replace(',', '', (string) $value);

        if ($normalized === '' || ! is_numeric($normalized)) {
            return null;
        }

        return (float) $normalized;
    }

    private function extractInt(array $payload, array $keys): int
    {
        $value = $this->extractValue($payload, $keys);

        if ($value === null) {
            return 0;
        }

        $normalized = str_replace(',', '', (string) $value);

        if ($normalized === '' || ! is_numeric($normalized)) {
            return 0;
        }

        return max(0, (int) round((float) $normalized));
    }

    private function matchesCardCode(array $customer, string $requestedCardCode): bool
    {
        return $this->extractCardCode($customer) === $requestedCardCode;
    }

    private function isCustomerRow(array $customer): bool
    {
        return $this->extractCardCode($customer) !== null;
    }

    private function calculateOverdueBalance(Collection $invoices): ?float
    {
        $hasBalanceDetails = $invoices->contains(fn (array $invoice) => $invoice['balance_due'] !== null);

        if (! $hasBalanceDetails) {
            return null;
        }

        return round($invoices->sum(function (array $invoice) {
            return max(0, (float) ($invoice['balance_due'] ?? 0));
        }), 2);
    }

    private function normalizeCardCode(mixed $value): ?string
    {
        $text = strtoupper(trim((string) $value));

        return $text !== '' ? $text : null;
    }

    private function normalizeText(mixed $value): string
    {
        return trim((string) $value);
    }
}
