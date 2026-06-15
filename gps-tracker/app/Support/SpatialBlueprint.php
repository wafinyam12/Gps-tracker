<?php

namespace App\Support;

use MatanYadaev\EloquentSpatial\Objects\Geometry;

class SpatialBlueprint
{
    public static function registerMacros(): void
    {
        // Register your custom spatial macros here.
        // Example: Geometry::macro('myCustomSpatialMethod', function () {
        //     /** @var \MatanYadaev\EloquentSpatial\Objects\Geometry $this */
        //     return $this->toWkt();
        // });
    }
}
