<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\User;
use App\Models\VisitLog;
use App\Services\MasterData\StoreCatalogSyncService;
use App\Services\UdPortal\UdPortalCashPaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class CashPaymentController extends Controller
{
    public function __construct(
        private readonly UdPortalCashPaymentService $cashPaymentService,
        private readonly StoreCatalogSyncService $catalog,
    ) {
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'visit_log_id' => ['nullable', 'integer', 'exists:visit_logs,id'],
            'store_id' => ['nullable', 'integer', 'exists:stores,id'],
            'sales_name' => ['nullable', 'string', 'max:255'],
            'admin_name' => ['nullable', 'string', 'max:255'],
            'store_name' => ['nullable', 'string', 'max:255'],
            'owner_name' => ['nullable', 'string', 'max:100'],
            'telpon' => ['nullable', 'string', 'max:30'],
            'telp' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'invoice' => ['nullable', 'string', 'max:255'],
            'sales_order_number' => ['nullable', 'string', 'max:255'],
            'payment_type' => ['nullable', Rule::in(['Tunai', 'Transfer', 'BG / Giro'])],
            'remarks' => ['nullable', 'string', 'max:1000'],
            'sender_name' => ['nullable', 'string', 'max:100'],
            'amount' => ['required'],
            'photo' => ['required', 'image', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['required', 'numeric', 'min:0'],
        ]);

        if ($validator->fails()) {
            return response()->error('Data yang dikirim tidak valid.', 422, $validator->errors()->toArray());
        }

        $user = $request->user()->loadMissing('team');
        $visitLog = $this->resolveVisitLog($request, $user);

        if ($request->filled('visit_log_id') && ! $visitLog) {
            return response()->error('Data kunjungan tidak ditemukan.', 404);
        }

        $store = $visitLog?->store ?: $this->resolveStore($request, $user);
        $amount = $this->normalizeAmount($request->input('amount'));
        $phone = $this->normalizePhoneDigits(
            $this->firstFilled($request, ['telpon', 'telp', 'phone']) ?: $store?->pic_phone
        );
        $storeName = $this->trimString($request->input('store_name')) ?: $store?->name;
        $ownerName = $this->trimString($request->input('owner_name')) ?: $store?->pic_name;

        $errors = [];

        if ($storeName === null || $storeName === '') {
            $errors['store_name'] = ['Nama toko wajib diisi.'];
        }

        if ($ownerName === null || $ownerName === '') {
            $errors['owner_name'] = ['Nama customer/PIC wajib diisi.'];
        }

        if ($phone === null) {
            $errors['telpon'] = ['No WhatsApp customer wajib 10-15 digit.'];
        }

        if ($amount === null) {
            $errors['amount'] = ['Nominal pembayaran wajib lebih dari 0.'];
        }

        if ($errors !== []) {
            return response()->error('Data yang dikirim tidak valid.', 422, $errors);
        }

        $payload = $this->withoutBlankValues([
            'sales_name' => $this->salesFullName($user),
            'admin_name' => $this->trimString($request->input('admin_name')),
            'store_name' => $storeName,
            'owner_name' => $ownerName,
            'telpon' => $phone,
            'invoice' => $this->trimString($request->input('invoice')),
            'sales_order_number' => $this->trimString($request->input('sales_order_number')),
            'payment_type' => $this->trimString($request->input('payment_type')) ?: 'Tunai',
            'remarks' => $this->trimString($request->input('remarks')),
            'sender_name' => $this->salesFullName($user),
            'amount' => $amount,
            'latitude' => $request->input('latitude'),
            'longitude' => $request->input('longitude'),
            'accuracy' => $request->input('accuracy'),
        ]);

        try {
            $response = $this->cashPaymentService->create($payload, $request->file('photo'), $user->team);
        } catch (RuntimeException $exception) {
            Log::warning('Cash payment UD Portal configuration/request failed.', [
                'user_id' => $user->id,
                'visit_log_id' => $request->input('visit_log_id'),
                'error' => $exception->getMessage(),
            ]);

            return response()->error($exception->getMessage(), 503);
        } catch (Throwable $exception) {
            Log::warning('Cash payment UD Portal request failed.', [
                'user_id' => $user->id,
                'visit_log_id' => $request->input('visit_log_id'),
                'error' => $exception->getMessage(),
            ]);

            return response()->error('Gagal menghubungi UD Portal.', 502);
        }

        $body = $response->json();

        if (! is_array($body)) {
            return response()->error('Respons UD Portal tidak valid.', 502, [
                'status' => [$response->status()],
            ]);
        }

        if ($response->failed()) {
            Log::warning('Cash payment rejected by UD Portal.', [
                'user_id' => $user->id,
                'visit_log_id' => $request->input('visit_log_id'),
                'status' => $response->status(),
                'message' => $body['message'] ?? null,
            ]);
        }

        return response()->json($body, $response->status());
    }

    private function resolveVisitLog(Request $request, User $user): ?VisitLog
    {
        if (! $request->filled('visit_log_id')) {
            return null;
        }

        return VisitLog::with('store')
            ->where('id', $request->integer('visit_log_id'))
            ->where('user_id', $user->id)
            ->first();
    }

    private function resolveStore(Request $request, User $user): ?Store
    {
        if (! $request->filled('store_id')) {
            return null;
        }

        return $this->catalog->findById($request->integer('store_id'), $user);
    }

    private function firstFilled(Request $request, array $keys): ?string
    {
        foreach ($keys as $key) {
            if ($request->filled($key)) {
                return (string) $request->input($key);
            }
        }

        return null;
    }

    private function normalizePhoneDigits(mixed $value): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $value);

        if (! is_string($digits)) {
            return null;
        }

        $length = strlen($digits);

        return $length >= 10 && $length <= 15 ? $digits : null;
    }

    private function normalizeAmount(mixed $amount): ?string
    {
        if ($amount === null) {
            return null;
        }

        $value = trim((string) $amount);
        $value = str_ireplace('Rp', '', $value);
        $value = preg_replace('/\s+/', '', $value);
        $value = preg_replace('/[^\d,.-]/', '', $value);

        if (! is_string($value) || $value === '') {
            return null;
        }

        if (str_contains($value, ',')) {
            if (str_contains($value, '.')) {
                $value = str_replace('.', '', $value);
            }

            $value = substr_count($value, ',') > 1
                ? str_replace(',', '', $value)
                : str_replace(',', '.', $value);
        } elseif (str_contains($value, '.')) {
            if (substr_count($value, '.') > 1) {
                $value = str_replace('.', '', $value);
            } else {
                [$beforeDot, $afterDot] = explode('.', $value, 2);

                if (strlen($afterDot) === 3 && strlen($beforeDot) <= 3) {
                    $value = str_replace('.', '', $value);
                }
            }
        }

        if (! is_numeric($value) || (float) $value < 1) {
            return null;
        }

        return $value;
    }

    private function trimString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }

    private function withoutBlankValues(array $payload): array
    {
        return array_filter($payload, fn ($value) => $value !== null && $value !== '');
    }

    private function salesFullName(User $user): string
    {
        return trim((string) $user->name);
    }
}
