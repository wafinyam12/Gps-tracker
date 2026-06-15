<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$email = 'sales1@gps.test';
$user = User::where('email', $email)->first();
if (! $user) {
    echo "NOT_FOUND\n";
    exit(0);
}
echo "FOUND: " . $user->email . " is_active=" . ($user->is_active ? '1' : '0') . "\n";
echo "roles: " . implode(',', $user->roles->pluck('name')->toArray()) . "\n";
