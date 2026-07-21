<?php

namespace App\Services\Visits;

use App\Models\VisitPhoto;
use Illuminate\Support\Facades\URL;

class VisitPhotoUrlService
{
    public function temporaryPreviewUrl(VisitPhoto $photo): string
    {
        $path = URL::temporarySignedRoute(
            'api.visit-photos.preview',
            now()->addMinutes($this->previewTtlMinutes()),
            ['photo' => $photo->getKey()],
            absolute: false,
        );

        return url($path);
    }

    private function previewTtlMinutes(): int
    {
        return max((int) config('filesystems.visit_photo_preview_url_ttl', 120), 1);
    }
}
