<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->uuid('client_uuid')->nullable()->unique()->after('id');
            $table->uuid('checkout_client_uuid')->nullable()->unique()->after('client_uuid');
            $table->boolean('is_offline_sync')->default(false)->after('is_mock_location');
            $table->timestamp('offline_received_at')->nullable()->after('is_offline_sync');
        });
    }

    public function down(): void
    {
        Schema::table('visit_logs', function (Blueprint $table) {
            $table->dropUnique(['client_uuid']);
            $table->dropUnique(['checkout_client_uuid']);
            $table->dropColumn([
                'client_uuid',
                'checkout_client_uuid',
                'is_offline_sync',
                'offline_received_at',
            ]);
        });
    }
};
