<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('visit_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('visit_log_id')->constrained()->cascadeOnDelete();
            $table->string('path');
            $table->enum('type', ['checkin', 'checkout', 'product', 'other'])->default('checkin');
            $table->geometry('location', subtype: 'point')->nullable(); // geotag foto
            $table->timestamp('taken_at')->nullable();
            $table->timestamps();

            $table->index('visit_log_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('visit_photos');
    }
};