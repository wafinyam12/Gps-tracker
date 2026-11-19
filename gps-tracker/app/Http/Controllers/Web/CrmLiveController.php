<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CrmLiveController extends Controller
{
    public function version(): JsonResponse
    {
        $tables = [
            'visit_logs',
            'visit_photos',
            'stores',
            'users',
            'sap_coordinate_syncs',
            'daily_targets',
            'visit_location_samples',
        ];
        $changes = [];

        foreach ($tables as $table) {
            $row = DB::table($table)
                ->selectRaw('MAX(id) as last_id, MAX(updated_at) as last_update, COUNT(*) as total')
                ->first();
            $changes[$table] = [$row->last_id, $row->last_update, $row->total];
        }

        // Ping lokasi hanya ditambahkan; ID terbaru cukup dan menghindari scan tabel besar.
        $changes['location_pings'] = DB::table('location_pings')->max('id');

        return response()->json([
            'version' => hash('sha256', json_encode($changes)),
        ])->header('Cache-Control', 'no-store');
    }
}
