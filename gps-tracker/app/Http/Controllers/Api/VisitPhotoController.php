<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VisitPhotoRequest;
use App\Models\VisitLog;
use App\Models\VisitPhoto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;
use MatanYadaev\EloquentSpatial\Objects\Point;

class VisitPhotoController extends Controller
{
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

        // Pastikan visit log masih aktif (belum checkout) atau baru selesai
        // Foto bisa diupload saat checkin maupun checkout
        $uploaded = [];

        foreach ($request->file('photos') as $photo) {
            $path = $this->processAndStore($photo, $visitLog->id);

            $visitPhoto = VisitPhoto::create([
                'visit_log_id' => $visitLog->id,
                'path'         => $path,
                'type'         => $request->type ?? 'checkin',
                'location'     => ($request->filled('latitude') && $request->filled('longitude'))
                                    ? new Point(
                                          latitude: $request->latitude,
                                          longitude: $request->longitude,
                                      )
                                    : null,
                'taken_at'     => $request->taken_at ?? now(),
            ]);

            $uploaded[] = [
                'id'       => $visitPhoto->id,
                'url'      => Storage::disk('visit_photos')->url($path),
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

        // Sales hanya bisa lihat foto miliknya sendiri
        if ($user->hasRole('sales') && $visitLog->user_id !== $user->id) {
            return response()->error('Unauthorized.', 403);
        }

        $photos = $visitLog->photos()
            ->orderBy('taken_at')
            ->get()
            ->map(fn($photo) => [
                'id'       => $photo->id,
                'url'      => Storage::disk('visit_photos')->url($photo->path),
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

        // Sales/SPV hanya bisa hapus foto miliknya sendiri; admin bisa hapus semua.
        if (! $user->hasRole('admin')) {
            if ($photo->visitLog->user_id !== $user->id) {
                return response()->error('Unauthorized.', 403);
            }

            // Foto tidak bisa dihapus setelah checkout oleh user lapangan.
            if ($photo->visitLog->checkout_at !== null) {
                return response()->error('Foto tidak bisa dihapus setelah checkout.', 422);
            }
        }

        // Hapus file dari storage
        Storage::disk('visit_photos')->delete($photo->path);

        $photo->delete();

        return response()->success(null, 'Foto berhasil dihapus.');
    }

    /**
     * Process foto — resize + compress + simpan
     */
    private function processAndStore($file, int $visitLogId): string
    {
        $filename  = Str::uuid().'.'.'jpg'; // selalu convert ke jpg
        $directory = date('Y/m/d').'/'.$visitLogId;
        $fullPath  = $directory.'/'.$filename;

        // Resize & compress pakai Intervention Image
        $image = Image::read($file->getRealPath())
            ->scaleDown(width: 1280) // max width 1280px, maintain ratio
            ->toJpeg(quality: 80);   // compress ke 80% quality

        Storage::disk('visit_photos')->put($fullPath, $image);

        return $fullPath;
    }
}
