<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_pings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->geometry('location', subtype: 'point'); // NOT NULL — wajib
            $table->float('accuracy')->nullable();
            $table->float('speed')->nullable();
            $table->float('bearing')->nullable();
            $table->unsignedTinyInteger('battery')->nullable();
            $table->boolean('is_moving')->default(false);
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->spatialIndex('location'); // OK karena NOT NULL
            $table->index(['user_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_pings');
    }
};