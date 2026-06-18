<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('location_pings', function (Blueprint $table) {
            $table->boolean('is_mock_location')->default(false)->after('is_moving');
        });
    }

    public function down(): void
    {
        Schema::table('location_pings', function (Blueprint $table) {
            $table->dropColumn('is_mock_location');
        });
    }
};
