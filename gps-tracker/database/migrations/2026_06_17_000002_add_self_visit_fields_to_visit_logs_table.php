<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->date('visit_date')->nullable()->after('store_id');
            $table->boolean('is_duplicate')->default(false)->after('is_mock_location');
            $table->boolean('counted_as_target')->default(true)->after('is_duplicate');
            $table->string('duplicate_reason')->nullable()->after('counted_as_target');
        });

        DB::statement('ALTER TABLE visit_logs MODIFY visit_schedule_id BIGINT UNSIGNED NULL');

        DB::table('visit_logs')
            ->whereNull('visit_date')
            ->update([
                'visit_date'       => DB::raw('DATE(CONVERT_TZ(checkin_at, "+00:00", "+07:00"))'),
                'counted_as_target' => 1,
            ]);

        Schema::table('visit_logs', function (Blueprint $table) {
            $table->index(['user_id', 'visit_date']);
            $table->index(['store_id', 'visit_date']);
            $table->index(['user_id', 'store_id', 'visit_date'], 'visit_logs_user_store_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'visit_date']);
            $table->dropIndex(['store_id', 'visit_date']);
            $table->dropIndex('visit_logs_user_store_date_index');
            $table->dropColumn([
                'visit_date',
                'is_duplicate',
                'counted_as_target',
                'duplicate_reason',
            ]);
        });

        DB::statement('ALTER TABLE visit_logs MODIFY visit_schedule_id BIGINT UNSIGNED NOT NULL');
    }
};
