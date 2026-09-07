<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('address')->nullable();
            $table->string('area')->nullable();
            $table->string('city')->nullable();
            $table->geometry('location', subtype: 'point'); // NOT NULL — wajib ada koordinat
            $table->unsignedInteger('geofence_radius')->default(50);
            $table->string('pic_name')->nullable();
            $table->string('pic_phone')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->boolean('is_priority')->default(false);
            $table->json('tags')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->spatialIndex('location'); // OK karena NOT NULL
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};
