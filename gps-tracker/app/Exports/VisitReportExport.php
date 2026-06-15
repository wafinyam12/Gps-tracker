<?php

namespace App\Exports;

use App\Models\VisitSchedule;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

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
    ) {}

    public function collection()
    {
        return VisitSchedule::with(['user.team', 'store', 'visitLog'])
            ->whereBetween('visit_date', [$this->dateFrom, $this->dateTo])
            ->when($this->userId, fn($q) => $q->where('user_id', $this->userId))
            ->when($this->teamId, fn($q) => $q->whereHas('user', function ($q) {
                $q->where('team_id', $this->teamId);
            }))
            ->orderBy('visit_date')
            ->orderBy('user_id')
            ->orderBy('sequence')
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
            'Area',
            'Kota',
            'Urutan',
            'Status',
            'Check-in',
            'Check-out',
            'Durasi (menit)',
            'Jarak Check-in (m)',
            'Lokasi Valid',
            'Mock GPS',
            'Hasil Kunjungan',
            'Catatan',
        ];
    }

    public function map($schedule): array
    {
        $log = $schedule->visitLog;

        return [
            $schedule->visit_date->format('d/m/Y'),
            $schedule->user->name,
            $schedule->user->employee_id ?? '-',
            $schedule->user->team?->name ?? '-',
            $schedule->store->name,
            $schedule->store->code,
            $schedule->store->area ?? '-',
            $schedule->store->city ?? '-',
            $schedule->sequence,
            $this->translateStatus($schedule->status),
            $log?->checkin_at?->format('H:i:s') ?? '-',
            $log?->checkout_at?->format('H:i:s') ?? '-',
            $log?->duration_minutes ?? '-',
            $log?->checkin_distance ? round($log->checkin_distance, 1) : '-',
            $log ? ($log->checkin_valid ? 'Ya' : 'Tidak') : '-',
            $log ? ($log->is_mock_location ? 'Terdeteksi' : 'Normal') : '-',
            $log?->visit_result ? $this->translateResult($log->visit_result) : '-',
            $log?->notes ?? '-',
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

    private function translateStatus(string $status): string
    {
        return match ($status) {
            'pending'     => 'Belum Dikunjungi',
            'in_progress' => 'Sedang Berjalan',
            'completed'   => 'Selesai',
            'skipped'     => 'Dilewati',
            'rescheduled' => 'Dijadwal Ulang',
            default       => $status,
        };
    }

    private function translateResult(string $result): string
    {
        return match ($result) {
            'order_taken' => 'Dapat Order',
            'no_order'    => 'Tidak Ada Order',
            'closed'      => 'Toko Tutup',
            'not_found'   => 'Toko Tidak Ditemukan',
            'postponed'   => 'Ditunda',
            default       => $result,
        };
    }
}