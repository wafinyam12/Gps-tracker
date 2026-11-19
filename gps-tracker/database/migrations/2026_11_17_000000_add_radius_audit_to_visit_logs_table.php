<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->geometry('geofence_center', subtype: 'point')->nullable();
            $table->unsignedSmallInteger('geofence_radius_meters')->nullable();
            $table->string('geofence_reference_source', 32)->nullable();
            $table->string('checkin_radius_status', 32)->nullable();
            $table->float('checkout_accuracy')->nullable();
            $table->float('checkout_distance')->nullable();
            $table->string('checkout_radius_status', 32)->nullable();
            $table->string('duration_verification_status', 32)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->dropColumn([
                'geofence_center', 'geofence_radius_meters', 'geofence_reference_source',
                'checkin_radius_status', 'checkout_accuracy', 'checkout_distance',
                'checkout_radius_status', 'duration_verification_status',
            ]);
        });
    }
};
