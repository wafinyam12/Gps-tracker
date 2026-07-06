<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'CRM Audit') - GPS Tracker</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #080b0d;
            --bg-elevated: #0e1316;
            --surface: #12181b;
            --surface-2: #171f23;
            --surface-3: #1c2529;
            --line: #2a353a;
            --line-strong: #3a484e;
            --text: #eef2f3;
            --text-soft: #c7d0d3;
            --muted: #929da2;
            --primary: #5cc9bd;
            --primary-strong: #2f8f86;
            --primary-soft: rgba(92, 201, 189, 0.12);
            --info: #aab5bb;
            --info-soft: rgba(170, 181, 187, 0.12);
            --warning: #d6a642;
            --warning-soft: rgba(214, 166, 66, 0.12);
            --danger: #d77a86;
            --danger-soft: rgba(215, 122, 134, 0.12);
            --success: #8fb9a0;
            --success-soft: rgba(143, 185, 160, 0.12);
            --shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
        }

        * { box-sizing: border-box; }

        html { min-height: 100%; }

        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 14px;
            background: var(--bg);
            color: var(--text);
            letter-spacing: 0;
        }

        a { color: inherit; text-decoration: none; }
        button, input, select { font: inherit; letter-spacing: 0; }
        button { cursor: pointer; }
        strong { color: var(--text); }

        .shell { min-height: 100vh; }

        .topbar {
            position: sticky;
            top: 0;
            z-index: 30;
            background: rgba(7, 11, 10, 0.92);
            border-bottom: 1px solid var(--line);
            backdrop-filter: blur(16px);
        }

        .topbar-inner {
            max-width: 1500px;
            margin: 0 auto;
            min-height: 68px;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 220px;
        }

        .brand-mark {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            background: var(--surface-3);
            border: 1px solid var(--line-strong);
            color: var(--text);
            font-weight: 700;
        }

        .brand-title {
            font-size: 15px;
            font-weight: 700;
            line-height: 1.1;
            color: var(--text);
        }

        .brand-subtitle {
            color: var(--muted);
            font-size: 12px;
            margin-top: 2px;
        }

        .userbar {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 12px;
            color: var(--muted);
            font-size: 13px;
        }

        .logout-btn,
        .btn {
            min-height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            border-radius: 8px;
            border: 1px solid var(--line);
            background: var(--surface-2);
            color: var(--text);
            padding: 9px 13px;
            font-weight: 650;
            white-space: nowrap;
        }

        .logout-btn:hover,
        .btn:hover {
            border-color: var(--line-strong);
            background: var(--surface-3);
        }

        .btn-primary {
            background: var(--primary-strong);
            border-color: var(--primary-strong);
            color: var(--text);
        }

        .btn-primary:hover {
            background: var(--primary-strong);
            border-color: var(--primary);
        }

        .btn-ghost { background: transparent; }

        .page {
            max-width: 1500px;
            margin: 0 auto;
            padding: 24px;
        }

        .panel {
            background: rgba(16, 24, 23, 0.94);
            border: 1px solid var(--line);
            border-radius: 8px;
            box-shadow: var(--shadow);
        }

        .muted { color: var(--muted); }

        .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 650;
            background: var(--surface-3);
            color: var(--text-soft);
            white-space: nowrap;
        }

        .badge-high { background: var(--surface-3); color: var(--text-soft); border: 1px solid var(--line-strong); }
        .badge-medium { background: var(--surface-3); color: var(--text-soft); border: 1px solid var(--line-strong); }
        .badge-good { background: var(--surface-3); color: var(--text-soft); border: 1px solid var(--line-strong); }
        .badge-info { background: var(--surface-3); color: var(--text-soft); border: 1px solid var(--line-strong); }

        .table-wrap { overflow-x: auto; }

        table {
            width: 100%;
            border-collapse: collapse;
            min-width: 760px;
        }

        th,
        td {
            padding: 13px 14px;
            border-bottom: 1px solid var(--line);
            text-align: left;
            vertical-align: top;
            font-size: 13px;
        }

        th {
            color: var(--muted);
            font-size: 12px;
            letter-spacing: 0;
            text-transform: uppercase;
            background: rgba(20, 32, 30, 0.86);
        }

        tr:last-child td { border-bottom: 0; }

        input,
        select {
            color-scheme: dark;
        }

        @media (max-width: 780px) {
            .topbar-inner,
            .page {
                padding-left: 14px;
                padding-right: 14px;
            }

            .topbar-inner {
                align-items: flex-start;
                flex-direction: column;
            }

            .userbar {
                width: 100%;
                justify-content: space-between;
            }
        }
    </style>
    @stack('styles')
</head>
<body>
    <div class="shell">
        <header class="topbar">
            <div class="topbar-inner">
                <a class="brand" href="{{ route('crm.dashboard') }}">
                    <div class="brand-mark">CRM</div>
                    <div>
                        <div class="brand-title">CRM Audit</div>
                        <div class="brand-subtitle">GPS Tracker Reporting</div>
                    </div>
                </a>
                @auth
                    <div class="userbar">
                        <span>{{ auth()->user()->name }} - {{ auth()->user()->roles->first()?->name ?? 'user' }}</span>
                        <form method="POST" action="{{ route('crm.logout') }}">
                            @csrf
                            <button class="logout-btn" type="submit">Logout</button>
                        </form>
                    </div>
                @endauth
            </div>
        </header>
        @yield('content')
    </div>
</body>
</html>
