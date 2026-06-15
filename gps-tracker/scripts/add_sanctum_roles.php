<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

$permissions = [
    'send-location',
    'view-all-locations',
    'checkin',
    'checkout',
    'view-own-schedule',
    'view-all-schedules',
    'manage-schedules',
    'view-stores',
    'manage-stores',
    'view-own-reports',
    'view-all-reports',
    'export-reports',
    'manage-users',
];

foreach ($permissions as $perm) {
    Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
}

$sales = Role::firstOrCreate(['name' => 'sales', 'guard_name' => 'sanctum']);
$sales->syncPermissions([
    'send-location',
    'checkin',
    'checkout',
    'view-own-schedule',
    'view-stores',
    'view-own-reports',
]);

$spv = Role::firstOrCreate(['name' => 'spv', 'guard_name' => 'sanctum']);
$spv->syncPermissions([
    'view-all-locations',
    'view-all-schedules',
    'manage-schedules',
    'view-stores',
    'view-all-reports',
    'export-reports',
]);

$admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'sanctum']);
$admin->syncPermissions($permissions);

echo "sanctum roles/permissions created\n";
