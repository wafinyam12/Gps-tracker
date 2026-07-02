<?php

namespace Database\Seeders;

use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $branch = Team::create([
            'name' => 'Cabang Surabaya',
            'code' => 'SBY-01',
            'area' => 'Surabaya',
            'db_sap' => 'SIMULASI_UDMW',
        ]);

        $superadmin = User::create([
            'name'     => 'Super Admin GPS',
            'username' => 'superadmin-gps',
            'email'    => 'superadmin@gps.test',
            'password' => Hash::make('password'),
        ]);
        $superadmin->assignRole('superadmin');

        $admin = User::create([
            'name'     => 'Admin Cabang Surabaya',
            'username' => 'admin-cabang-surabaya',
            'email'    => 'admin-cabang@gps.test',
            'password' => Hash::make('password'),
            'team_id'  => $branch->id,
        ]);
        $admin->assignRole('admin');

        $spv = User::create([
            'name'     => 'Area Manager Surabaya',
            'username' => 'spv-surabaya',
            'email'    => 'spv@gps.test',
            'password' => Hash::make('password'),
            'phone'    => '081234567890',
            'team_id'  => $branch->id,
        ]);
        $spv->assignRole('spv');

        $sales = User::create([
            'name'        => 'Sales Satu',
            'username'    => 'sales-satu',
            'email'       => 'sales1@gps.test',
            'password'    => Hash::make('password'),
            'phone'       => '081234567891',
            'employee_id' => 'EMP-001',
            'team_id'     => $branch->id,
            'slpCode'     => '48',
        ]);
        $sales->assignRole('sales');
    }
}
