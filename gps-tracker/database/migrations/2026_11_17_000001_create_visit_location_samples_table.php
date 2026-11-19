<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->unsignedInteger('inside_radius_seconds')->nullable();
            $table->unsignedInteger('outside_radius_seconds')->nullable();
            $table->unsignedInteger('unmeasured_seconds')->nullable();
            $table->string('presence_status', 32)->nullable();
            $table->timestamp('samples_finalized_at')->nullable();
        });

        Schema::create('visit_location_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_log_id')->constrained('visit_logs')->cascadeOnDelete();
            $table->uuid('client_uuid');
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->float('accuracy');
            $table->timestamp('recorded_at');
            $table->string('classification', 16);
            $table->float('distance_meters')->nullable();
            $table->timestamps();
            $table->unique(['visit_log_id', 'client_uuid'], 'visit_sample_uuid_unique');
            $table->index(['visit_log_id', 'recorded_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_location_samples');
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->dropColumn([
                'inside_radius_seconds', 'outside_radius_seconds', 'unmeasured_seconds',
                'presence_status', 'samples_finalized_at',
            ]);
        });
    }
};
