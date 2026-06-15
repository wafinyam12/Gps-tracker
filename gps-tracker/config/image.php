<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Image Driver
    |--------------------------------------------------------------------------
    | Supported: "gd", "imagick"
    | GD sudah built-in di PHP, pakai ini kalau tidak ada Imagick
    */

    'driver' => \Intervention\Image\Drivers\Gd\Driver::class,

];