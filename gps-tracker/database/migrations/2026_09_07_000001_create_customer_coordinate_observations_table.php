<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_coordinate_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('visit_log_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->geometry('location', subtype: 'point');
            $table->decimal('accuracy_meters', 8, 2)->nullable();
            $table->timestamp('observed_at');
            $table->boolean('is_eligible')->default(false);
            $table->boolean('requires_verification')->default(false);
            $table->timestamps();

            $table->index(['store_id', 'is_eligible', 'observed_at'], 'coord_observations_store_eligible_index');
            $table->index(['team_id', 'observed_at'], 'coord_observations_team_observed_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_coordinate_observations');
    }
};
