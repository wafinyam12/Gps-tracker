<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sap_coordinate_syncs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('coordinate_observation_id')->nullable()
                ->constrained('customer_coordinate_observations')->nullOnDelete();
            $table->string('db_sap');
            $table->string('cardcode', 100);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->string('source', 40)->default('visit_observation');
            $table->string('status', 40)->default('pending');
            $table->string('sync_method', 10)->nullable();
            $table->decimal('remote_latitude', 10, 7)->nullable();
            $table->decimal('remote_longitude', 10, 7)->nullable();
            $table->decimal('distance_meters', 12, 2)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('last_http_status')->nullable();
            $table->text('last_error')->nullable();
            $table->json('last_response')->nullable();
            $table->timestamp('next_attempt_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'next_attempt_at'], 'sap_coordinate_syncs_pending_index');
            $table->index(['team_id', 'cardcode'], 'sap_coordinate_syncs_team_cardcode_index');
            $table->index(['store_id', 'status'], 'sap_coordinate_syncs_store_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sap_coordinate_syncs');
    }
};
