<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->string('external_bp_code')->nullable()->after('code');
            $table->string('branch')->nullable()->after('city');
            $table->string('master_source')->default('sap_dummy')->after('tags');
            $table->json('master_payload')->nullable()->after('master_source');
            $table->timestamp('last_synced_at')->nullable()->after('master_payload');
        });

        $database = DB::getDatabaseName();
        $spatialIndex = DB::table('information_schema.STATISTICS')
            ->where('TABLE_SCHEMA', $database)
            ->where('TABLE_NAME', 'stores')
            ->where('COLUMN_NAME', 'location')
            ->where('INDEX_TYPE', 'SPATIAL')
            ->value('INDEX_NAME');

        if ($spatialIndex) {
            $safeIndexName = str_replace('`', '``', $spatialIndex);
            DB::statement("ALTER TABLE stores DROP INDEX `{$safeIndexName}`");
        }

        DB::statement('ALTER TABLE stores MODIFY location POINT NULL');

        DB::table('stores')
            ->whereNull('external_bp_code')
            ->update([
                'external_bp_code' => DB::raw('code'),
                'branch'           => DB::raw('COALESCE(branch, area, city)'),
                'master_source'    => 'legacy',
                'last_synced_at'   => DB::raw('updated_at'),
            ]);

        Schema::table('stores', function (Blueprint $table) {
            $table->unique('external_bp_code');
            $table->index(['status', 'branch']);
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropUnique(['external_bp_code']);
            $table->dropIndex(['status', 'branch']);
            $table->dropColumn([
                'external_bp_code',
                'branch',
                'master_source',
                'master_payload',
                'last_synced_at',
            ]);
        });

        DB::statement("UPDATE stores SET location = ST_GeomFromText('POINT(0 0)') WHERE location IS NULL");
        DB::statement('ALTER TABLE stores MODIFY location POINT NOT NULL');
    }
};
