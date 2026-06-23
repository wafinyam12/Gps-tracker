<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone')->nullable()->after('email');
            $table->string('photo')->nullable()->after('phone');
            $table->string('employee_id')->nullable()->unique()->after('photo');
            $table->string('slpCode')->nullable()->after('employee_id');
            $table->string('db_sap')->nullable()->after('slpCode');
            $table->foreignId('team_id')->nullable()->after('employee_id')
                  ->constrained('teams')->nullOnDelete();
            $table->boolean('is_active')->default(true)->after('team_id');
            $table->timestamp('last_seen_at')->nullable()->after('is_active');
            $table->geometry('last_location', subtype: 'point')->nullable()->after('last_seen_at');
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone', 'photo', 'employee_id', 'team_id',
                'is_active', 'last_seen_at', 'last_location',
            ]);
            $table->dropSoftDeletes();
        });
    }
};