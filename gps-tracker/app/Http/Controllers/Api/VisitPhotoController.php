<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VisitPhotoRequest;
use App\Models\User;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use App\Services\Visits\VisitPhotoExifService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\ImageManager;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPhotoController extends Controller
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    public function __construct(
        private readonly VisitPhotoExifService $exifService,
    ) {
    }

    /**
     * Upload foto kunjungan
     * Role: sales
     */
    public function upload(VisitPhotoRequest $request)
    {
        $user     = $request->user();
        $visitLog = VisitLog::where('id', $request->visit_log_id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        $latitude = $request->filled('latitude') ? (float) $request->latitude : null;
        $longitude = $request->filled('longitude') ? (float) $request->longitude : null;
        $takenAt = $request->filled('taken_at')
            ? Carbon::parse($request->taken_at)->setTimezone(self::LOCAL_TIMEZONE)
            : now(self::LOCAL_TIMEZONE);

        // Pastikan visit log masih aktif (belum checkout) atau baru selesai
        // Foto bisa diupload saat checkin maupun checkout
        $uploaded = [];

        foreach ($request->file('photos') as $photo) {
            $path = $this->processAndStore($photo, $visitLog->id, $latitude, $longitude, $takenAt);

            $visitPhoto = VisitPhoto::create([
                'visit_log_id' => $visitLog->id,
                'path'         => $path,
                'type'         => $request->type ?? 'checkin',
                'location'     => ($latitude !== null && $longitude !== null)
                                    ? new Point(
                                          latitude: $latitude,
                                          longitude: $longitude,
                                      )
                                    : null,
                'taken_at'     => $takenAt,
            ]);

            $uploaded[] = [
                'id'       => $visitPhoto->id,
                'url'      => $this->photoUrl($path),
                'type'     => $visitPhoto->type,
                'taken_at' => $visitPhoto->taken_at->toISOString(),
                'uploaded_by' => [
                    'user_id'  => $user->id,
                    'username' => $user->name,
                ],
            ];
        }

        return response()->success([
            'photos'  => $uploaded,
        ], count($uploaded).' foto berhasil diupload.', 201);
    }

    /**
     * List foto untuk 1 visit log
     * Role: sales (own), spv, admin
     */
    public function index(Request $request, VisitLog $visitLog)
    {
        $user = $request->user();
        $visitLog->loadMissing('user');

        if (! $this->canAccessVisitLog($user, $visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        $photos = $visitLog->photos()
            ->orderBy('taken_at')
            ->get()
            ->map(fn($photo) => [
                'id'       => $photo->id,
                'url'      => $this->photoUrl($photo->path),
                'type'     => $photo->type,
                'location' => $photo->location ? [
                    'latitude'  => $photo->location->latitude,
                    'longitude' => $photo->location->longitude,
                ] : null,
                'taken_at' => $photo->taken_at?->toISOString(),
            ]);

        return response()->success([
            'visit_log_id' => $visitLog->id,
            'total'        => $photos->count(),
            'photos'       => $photos,
        ]);
    }

    /**
     * Hapus foto
     * Role: sales (own, hanya sebelum checkout), admin
     */
    public function destroy(Request $request, VisitPhoto $photo)
    {
        $user = $request->user();

        if (! $this->canAccessVisitLog($user, $photo->visitLog)) {
            return response()->error('Unauthorized.', 403);
        }

        if (! $user->hasRole('superadmin') && $photo->visitLog->checkout_at !== null) {
            return response()->error('Foto tidak bisa dihapus setelah checkout.', 422);
        }

        // Hapus file dari storage
        Storage::disk('visit_photos')->delete($photo->path);

        $photo->delete();

        return response()->success(null, 'Foto berhasil dihapus.');
    }

    /**
     * Process foto — resize + compress + simpan
     */
    private function processAndStore($file, int $visitLogId, ?float $latitude = null, ?float $longitude = null, ?Carbon $takenAt = null): string
    {
        $filename  = Str::uuid().'.'.'jpg'; // selalu convert ke jpg
        $directory = ($takenAt ?? now(self::LOCAL_TIMEZONE))->format('Y/m/d').'/'.$visitLogId;
        $fullPath  = $directory.'/'.$filename;

        $manager = new ImageManager(new GdDriver());

        // Resize & compress pakai Intervention Image
        $image = $manager->decodePath($file->getRealPath())
            ->scaleDown(width: 1280); // max width 1280px, maintain ratio

        $encoded = $image->encode(new JpegEncoder(quality: 80)); // compress ke 80% quality
        $binary = $encoded->toString();

        if ($latitude !== null && $longitude !== null) {
            $binary = $this->exifService->embedGps($binary, $latitude, $longitude, $takenAt);
        }

        $stored = Storage::disk('visit_photos')->put($fullPath, $binary);

        if (! $stored) {
            throw new \RuntimeException('Gagal menyimpan foto kunjungan ke storage.');
        }

        return $fullPath;
    }

    private function photoUrl(string $path): string
    {
        return Storage::disk('visit_photos')->url($path);
    }

    private function canAccessVisitLog(User $viewer, VisitLog $visitLog): bool
    {
        if ($viewer->canAccessAllBranches()) {
            return true;
        }

        if ($viewer->isBranchAdmin()) {
            return $viewer->team_id !== null
                && (int) $viewer->team_id === (int) $visitLog->user?->team_id
                && $visitLog->user?->hasRole('sales');
        }

        if ($viewer->hasRole('spv')) {
            return $viewer->team_id !== null && (int) $viewer->team_id === (int) $visitLog->user?->team_id;
        }

        return $visitLog->user_id === $viewer->id;
    }
}
