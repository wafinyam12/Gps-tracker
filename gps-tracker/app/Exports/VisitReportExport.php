<?php

namespace App\Exports;

use App\Models\VisitLog;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class VisitReportExport implements
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
        private ?int   $userId = null,
        private ?int   $teamId = null,
    ) {
    }

    public function collection()
    {
        return VisitLog::with(['user.team', 'store'])
            ->whereBetween('visit_date', [$this->dateFrom, $this->dateTo])
            ->when($this->userId, fn ($query) => $query->where('user_id', $this->userId))
            ->when($this->teamId, fn ($query) => $query->whereHas('user', function ($query) {
                $query->where('team_id', $this->teamId);
            }))
            ->orderBy('visit_date')
            ->orderBy('checkin_at')
            ->get();
    }

    public function headings(): array
    {
        return [
            'Tanggal',
            'Sales',
            'Employee ID',
            'Team',
            'Toko',
            'Kode Toko',
            'BP Code',
            'Cabang',
            'Check-in',
            'Check-out',
            'Durasi (menit)',
            'Jarak Check-in (m)',
            'Lokasi Valid',
            'Mock GPS',
            'Duplicate',
            'Dihitung Target',
            'Hasil Kunjungan',
            'Catatan',
        ];
    }

    public function map($visitLog): array
    {
        return [
            $visitLog->visit_date?->format('d/m/Y') ?? '-',
            $visitLog->user?->name ?? '-',
            $visitLog->user?->employee_id ?? '-',
            $visitLog->user?->team?->name ?? '-',
            $visitLog->store?->name ?? '-',
            $visitLog->store?->code ?? '-',
            $visitLog->store?->external_bp_code ?? '-',
            $visitLog->store?->branch ?? $visitLog->store?->area ?? '-',
            $visitLog->checkin_at?->format('H:i:s') ?? '-',
            $visitLog->checkout_at?->format('H:i:s') ?? '-',
            $visitLog->duration_minutes ?? '-',
            $visitLog->checkin_distance ? round($visitLog->checkin_distance, 1) : '-',
            $visitLog->checkin_valid ? 'Ya' : 'Tidak',
            $visitLog->is_mock_location ? 'Terdeteksi' : 'Normal',
            $visitLog->is_duplicate ? 'Ya' : 'Tidak',
            $visitLog->counted_as_target ? 'Ya' : 'Tidak',
            $this->translateResult($visitLog->visit_result),
            $visitLog->notes ?? '-',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType'   => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1E40AF'],
                ],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ],
        ];
    }

    public function title(): string
    {
        return 'Laporan Kunjungan';
    }

    private function translateResult(?string $result): string
    {
        return match ($result) {
            'order_taken' => 'Dapat Order',
            'no_order'    => 'Tidak Ada Order',
            'closed'      => 'Toko Tutup',
            'not_found'   => 'Toko Tidak Ditemukan',
            'postponed'   => 'Ditunda',
            default       => '-',
        };
    }
}
