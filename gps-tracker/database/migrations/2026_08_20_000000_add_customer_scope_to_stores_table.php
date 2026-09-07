<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->foreignId('team_id')
                ->nullable()
                ->after('id')
                ->constrained('teams')
                ->nullOnDelete();
            $table->string('sap_slp_code')->nullable()->after('external_bp_code');
            $table->timestamp('assignment_synced_at')->nullable()->after('last_synced_at');

            // CardCode is unique only within its SAP branch/team. It must not be
            // globally unique because another SAP database can use the same code.
            $table->dropUnique('stores_code_unique');
            $table->dropUnique('stores_external_bp_code_unique');
            $table->unique(['team_id', 'external_bp_code'], 'stores_team_external_bp_unique');
            $table->index(['team_id', 'sap_slp_code', 'status'], 'stores_team_sales_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropIndex('stores_team_sales_status_index');
            $table->dropUnique('stores_team_external_bp_unique');
            $table->unique('code');
            $table->unique('external_bp_code');
            $table->dropConstrainedForeignId('team_id');
            $table->dropColumn(['sap_slp_code', 'assignment_synced_at']);
        });
    }
};
