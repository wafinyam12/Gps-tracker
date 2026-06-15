<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$users = User::with('roles','latestPing','team')->get();
foreach ($users as $u) {
    echo "id={$u->id} email={$u->email} role=" . implode(',', $u->roles->pluck('name')->toArray()) . " is_active=" . ($u->is_active?1:0) . " team_id={$u->team_id}\n";
    $lp = $u->latestPing;
    if ($lp) {
        echo "  latest ping: id={$lp->id} lat=" . $lp->location->latitude . " lng=" . $lp->location->longitude . " recorded_at=" . $lp->recorded_at . "\n";
    } else {
        echo "  latest ping: NONE\n";
    }
}
