<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->string('coordinate_source', 32)->nullable()->after('location');
        });

        Schema::create('store_coordinate_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->foreignId('photo_id')->nullable()->constrained('visit_photos')->nullOnDelete();
            $table->string('source', 32);
            $table->text('reason')->nullable();
            $table->decimal('old_latitude', 10, 7)->nullable();
            $table->decimal('old_longitude', 11, 7)->nullable();
            $table->decimal('new_latitude', 10, 7);
            $table->decimal('new_longitude', 11, 7);
            $table->unsignedSmallInteger('old_radius')->nullable();
            $table->unsignedSmallInteger('new_radius');
            $table->timestamps();

            $table->index(['store_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_coordinate_changes');
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('coordinate_source');
        });
    }
};
