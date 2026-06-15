<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->foreignId('store_id')->constrained();

            // Check-in
            $table->timestamp('checkin_at')->nullable();
            $table->geometry('checkin_location', subtype: 'point')->nullable(); // nullable — NO spatialIndex
            $table->float('checkin_accuracy')->nullable();
            $table->boolean('checkin_valid')->default(false);
            $table->float('checkin_distance')->nullable();
            $table->boolean('is_mock_location')->default(false);

            // Check-out
            $table->timestamp('checkout_at')->nullable();
            $table->geometry('checkout_location', subtype: 'point')->nullable(); // nullable — NO spatialIndex
            $table->unsignedInteger('duration_minutes')->nullable();

            // Visit report
            $table->text('notes')->nullable();
            $table->json('form_data')->nullable();
            $table->enum('visit_result', [
                'order_taken',
                'no_order',
                'closed',
                'not_found',
                'postponed',
            ])->nullable();

            $table->timestamps();

            // Regular index saja — tidak butuh spatialIndex
            $table->index(['user_id', 'visit_schedule_id']);
            $table->index(['store_id', 'checkin_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_logs');
    }
};