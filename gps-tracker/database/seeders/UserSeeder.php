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
        $team = Team::create([
            'name' => 'Tim Surabaya',
            'code' => 'SBY-01',
            'area' => 'Surabaya',
        ]);

        $admin = User::create([
            'name'     => 'Admin GPS',
            'username' => 'admin-gps',
            'email'    => 'admin@gps.test',
            'password' => Hash::make('password'),
            'team_id'  => $team->id,
        ]);
        $admin->assignRole('admin');

        $spv = User::create([
            'name'     => 'SPV Surabaya',
            'username' => 'spv-surabaya',
            'email'    => 'spv@gps.test',
            'password' => Hash::make('password'),
            'phone'    => '081234567890',
            'team_id'  => $team->id,
        ]);
        $spv->assignRole('spv');

        $sales = User::create([
            'name'        => 'Sales Satu',
            'username'    => 'sales-satu',
            'email'       => 'sales1@gps.test',
            'password'    => Hash::make('password'),
            'phone'       => '081234567891',
            'employee_id' => 'EMP-001',
            'team_id'     => $team->id,
            'slpCode'     => '48',
            'db_sap'      => 'SIMULASI_UDMW',
        ]);
        $sales->assignRole('sales');
    }
}
