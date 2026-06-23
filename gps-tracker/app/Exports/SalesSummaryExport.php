<?php

namespace App\Exports;

use App\Models\User;
use App\Services\Visits\VisitAnalyticsService;
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
        private ?User  $viewer = null,
        private ?int   $teamId = null,
        private ?int   $userId = null,
    ) {}

    public function collection()
    {
        $analytics = app(VisitAnalyticsService::class);
        $users = $analytics->scopeUsers($this->viewer, $this->userId, $this->teamId);
        $logs = $analytics->loadVisits($this->dateFrom, $this->dateTo, $this->viewer, $this->userId, $this->teamId);

        return $analytics->summarizeByUser($users, $logs, $this->dateFrom, $this->dateTo);
    }

    public function headings(): array
    {
        return [
            'Sales',
            'Employee ID',
            'Cabang',
            'Target Kunjungan',
            'Kunjungan Unik',
            'Duplicate',
            '% Completion',
            'Total Dapat Order',
            'Avg Durasi Kunjungan (menit)',
            'Mock GPS Terdeteksi',
            'Check-in Tidak Valid',
            'Warning Audit',
        ];
    }

    public function map($item): array
    {
        $summary = $item['summary'] ?? [];
        $warnings = $item['warnings'] ?? [];

        return [
            $item['name'] ?? '-',
            $item['employee_id'] ?? '-',
            $item['branch'] ?? $item['team'] ?? '-',
            $summary['target_visits'] ?? 0,
            $summary['unique_visits'] ?? 0,
            $summary['duplicate_visits'] ?? 0,
            ($summary['completion_pct'] ?? 0).'%',
            $summary['order_taken'] ?? 0,
            $summary['avg_duration_min'] ?? 0,
            $summary['mock_detected'] ?? 0,
            $summary['invalid_checkins'] ?? 0,
            count($warnings),
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
