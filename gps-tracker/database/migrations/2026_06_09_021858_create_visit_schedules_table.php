<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->date('visit_date');
            $table->unsignedTinyInteger('sequence')->default(1);
            $table->enum('status', [
                'pending',
                'in_progress',
                'completed',
                'skipped',
                'rescheduled',
            ])->default('pending');
            $table->text('skip_reason')->nullable();
            $table->foreignId('assigned_by')->nullable()
                  ->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'store_id', 'visit_date']);
            $table->index(['user_id', 'visit_date']);
            $table->index(['visit_date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_schedules');
    }
};