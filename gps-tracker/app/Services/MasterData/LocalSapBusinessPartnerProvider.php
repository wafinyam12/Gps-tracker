<?php

namespace App\Services\MasterData;

use Illuminate\Support\Collection;

class LocalSapBusinessPartnerProvider
{
    public function all(): Collection
    {
        return collect(config('sap_dummy.business_partners', []))
            ->map(function (array $partner): array {
                $partner['external_bp_code'] = $partner['external_bp_code'] ?? $partner['code'] ?? null;
                $partner['branch'] = $partner['branch'] ?? $partner['area'] ?? $partner['city'] ?? null;

                return $partner;
            })
            ->filter(fn (array $partner) => filled($partner['external_bp_code']));
    }

    public function active(): Collection
    {
        return $this->all()->where('status', 'active')->values();
    }
}
