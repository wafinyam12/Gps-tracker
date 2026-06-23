<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->after('name')->unique();
        });

        $users = DB::table('users')
            ->select(['id', 'username', 'email', 'name'])
            ->orderBy('id')
            ->get();

        $usedUsernames = $users
            ->pluck('username')
            ->filter()
            ->map(fn ($username) => Str::lower((string) $username))
            ->values()
            ->all();

        foreach ($users as $user) {
            if (filled($user->username)) {
                continue;
            }

            $username = $this->generateUsername($user->email, $user->name, (int) $user->id, $usedUsernames);

            DB::table('users')
                ->where('id', $user->id)
                ->update(['username' => $username]);

            $usedUsernames[] = Str::lower($username);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropColumn('username');
        });
    }

    private function generateUsername(?string $email, ?string $name, int $id, array $usedUsernames): string
    {
        $base = filled($email) && str_contains($email, '@')
            ? Str::before($email, '@')
            : (filled($name) ? $name : 'user-'.$id);

        $base = Str::slug(Str::lower(trim((string) $base)), '-');
        $base = $base !== '' ? $base : 'user-'.$id;

        return $this->makeUniqueUsername($base, $usedUsernames);
    }

    private function makeUniqueUsername(string $base, array $usedUsernames): string
    {
        $base = Str::lower($base);
        $base = substr($base, 0, 50) ?: 'user';

        $candidate = $base;
        $suffix = 2;

        while (in_array($candidate, $usedUsernames, true)) {
            $suffixText = '-'.$suffix;
            $candidate = substr($base, 0, max(1, 50 - strlen($suffixText))).$suffixText;
            $suffix++;
        }

        return $candidate;
    }
};
