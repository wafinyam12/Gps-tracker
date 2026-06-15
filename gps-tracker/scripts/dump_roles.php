<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Spatie\Permission\Models\Role;

$roles = Role::all();
foreach ($roles as $r) {
    echo "id={$r->id} name={$r->name} guard={$r->guard_name}\n";
}
