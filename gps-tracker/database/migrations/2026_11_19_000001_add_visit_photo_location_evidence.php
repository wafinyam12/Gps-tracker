<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_photos', function (Blueprint $table) {
            $table->float('location_accuracy')->nullable();
            $table->timestamp('location_recorded_at')->nullable();
            $table->boolean('location_is_mock')->nullable();
            $table->string('location_source', 32)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('visit_photos', function (Blueprint $table) {
            $table->dropColumn([
                'location_accuracy', 'location_recorded_at', 'location_is_mock', 'location_source',
            ]);
        });
    }
};
