<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class SalesSummaryExport implements
    FromCollection,
    WithHeadings,
    WithMapping,
    WithStyles,
    ShouldAutoSize,
    WithTitle
{
    public function __construct(
        private string $dateFrom,
        private string $dateTo,
        private ?int   $teamId = null,
    ) {}

    public function collection()
    {
        return User::with(['team', 'schedules' => function ($q) {
                $q->whereBetween('visit_date', [$this->dateFrom, $this->dateTo])
                  ->with('visitLog');
            }])
            ->whereHas('roles', fn($q) => $q->whereIn('name', ['sales', 'spv']))
            ->where('is_active', true)
            ->when($this->teamId, fn($q) => $q->where('team_id', $this->teamId))
            ->orderBy('name')
            ->get();
    }

    public function headings(): array
    {
        return [
            'Sales',
            'Employee ID',
            'Team',
            'Total Jadwal',
            'Selesai',
            'Dilewati',
            'Belum Dikunjungi',
            '% Completion',
            'Total Dapat Order',
            'Total Toko Tutup',
            'Avg Durasi Kunjungan (menit)',
            'Mock GPS Terdeteksi',
            'Check-in Tidak Valid',
        ];
    }

    public function map($user): array
    {
        $schedules  = $user->schedules;
        $total      = $schedules->count();
        $completed  = $schedules->where('status', 'completed')->count();
        $skipped    = $schedules->where('status', 'skipped')->count();
        $pending    = $schedules->whereIn('status', ['pending', 'rescheduled'])->count();
        $logs       = $schedules->pluck('visitLog')->filter();

        $orderTaken   = $logs->where('visit_result', 'order_taken')->count();
        $closed       = $logs->where('visit_result', 'closed')->count();
        $avgDuration  = $logs->avg('duration_minutes');
        $mockGps      = $logs->where('is_mock_location', true)->count();
        $invalidCheckin = $logs->where('checkin_valid', false)->count();

        return [
            $user->name,
            $user->employee_id ?? '-',
            $user->team?->name ?? '-',
            $total,
            $completed,
            $skipped,
            $pending,
            $total > 0 ? round(($completed / $total) * 100, 1).'%' : '0%',
            $orderTaken,
            $closed,
            $avgDuration ? round($avgDuration, 1) : '-',
            $mockGps,
            $invalidCheckin,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType'   => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '065F46'],
                ],
            ],
        ];
    }

    public function title(): string
    {
        return 'Summary per Sales';
    }
}
