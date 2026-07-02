<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('db_sap')->nullable()->after('area');
        });

        DB::table('teams')
            ->orderBy('id')
            ->get()
            ->each(function ($team) {
                $dbSap = DB::table('users')
                    ->where('team_id', $team->id)
                    ->whereNotNull('db_sap')
                    ->where('db_sap', '!=', '')
                    ->orderBy('id')
                    ->value('db_sap');

                if (filled($dbSap)) {
                    DB::table('teams')
                        ->where('id', $team->id)
                        ->update(['db_sap' => $dbSap]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn('db_sap');
        });
    }
};
