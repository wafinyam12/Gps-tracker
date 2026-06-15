<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

$rows = DB::table('model_has_roles')->get();
foreach ($rows as $r) {
    $oldRole = Role::find($r->role_id);
    if (! $oldRole) continue;
    // find role with same name and guard 'sanctum'
    $newRole = Role::where('name', $oldRole->name)->where('guard_name', 'sanctum')->first();
    if (! $newRole) continue;

    // check if new mapping exists
    $exists = DB::table('model_has_roles')
        ->where('role_id', $newRole->id)
        ->where('model_type', $r->model_type)
        ->where('model_id', $r->model_id)
        ->exists();
    if (! $exists) {
        DB::table('model_has_roles')->insert([
            'role_id' => $newRole->id,
            'model_type' => $r->model_type,
            'model_id' => $r->model_id,
        ]);
        echo "Inserted sanctum role mapping for model_id={$r->model_id} role={$newRole->name}\n";
    }
}

echo "Done\n";
