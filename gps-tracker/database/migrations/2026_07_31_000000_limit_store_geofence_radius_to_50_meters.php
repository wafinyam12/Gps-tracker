<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('stores')
            ->where('geofence_radius', '>', 50)
            ->update(['geofence_radius' => 50]);

        DB::statement('ALTER TABLE stores MODIFY geofence_radius INT UNSIGNED NOT NULL DEFAULT 50');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE stores MODIFY geofence_radius INT UNSIGNED NOT NULL DEFAULT 100');
    }
};
