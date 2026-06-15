<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

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
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $sales = Role::firstOrCreate(['name' => 'sales', 'guard_name' => 'web']);
        $sales->syncPermissions([
            'send-location',
            'checkin',
            'checkout',
            'view-own-schedule',
            'view-stores',
            'view-own-reports',
        ]);

        $spv = Role::firstOrCreate(['name' => 'spv', 'guard_name' => 'web']);
        $spv->syncPermissions([
            'view-all-locations',
            'view-all-schedules',
            'manage-schedules',
            'view-stores',
            'view-all-reports',
            'export-reports',
        ]);

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions($permissions);
    }
}