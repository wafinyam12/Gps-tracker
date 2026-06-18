<?php

namespace App\Services\Visits;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;

class VisitPhotoExifService
{
    private const LOCAL_TIMEZONE = 'Asia/Jakarta';

    private const EXIF_HEADER = "Exif\0\0";

    private const TIFF_MAGIC = 42;

    private const TAG_GPS_IFD_POINTER = 0x8825;
    private const TAG_GPS_VERSION_ID = 0x0000;
    private const TAG_GPS_LATITUDE_REF = 0x0001;
    private const TAG_GPS_LATITUDE = 0x0002;
    private const TAG_GPS_LONGITUDE_REF = 0x0003;
    private const TAG_GPS_LONGITUDE = 0x0004;
    private const TAG_GPS_TIMESTAMP = 0x0007;
    private const TAG_GPS_DATESTAMP = 0x001D;

    private const TYPE_BYTE = 1;
    private const TYPE_ASCII = 2;
    private const TYPE_LONG = 4;
    private const TYPE_RATIONAL = 5;

    public function embedGps(string $jpegBinary, float $latitude, float $longitude, ?DateTimeInterface $takenAt = null): string
    {
        if (substr($jpegBinary, 0, 2) !== "\xFF\xD8") {
            return $jpegBinary;
        }

        $takenAt = $this->normalizeTakenAt($takenAt);
        $payload = self::EXIF_HEADER . $this->buildTiffPayload($latitude, $longitude, $takenAt);
        $segmentLength = strlen($payload) + 2;

        return substr($jpegBinary, 0, 2)
            . "\xFF\xE1"
            . pack('n', $segmentLength)
            . $payload
            . substr($jpegBinary, 2);
    }

    private function normalizeTakenAt(?DateTimeInterface $takenAt): DateTimeInterface
    {
        return $takenAt ?: new DateTimeImmutable('now', new DateTimeZone(self::LOCAL_TIMEZONE));
    }

    private function buildTiffPayload(float $latitude, float $longitude, DateTimeInterface $takenAt): string
    {
        $ifd0Size = $this->ifdSize(1);
        $gpsIfdOffset = 8 + $ifd0Size;

        $gpsIfd = $this->buildGpsIfd($latitude, $longitude, $takenAt, $gpsIfdOffset);

        $tiffHeader = 'II'
            . pack('v', self::TIFF_MAGIC)
            . pack('V', 8);

        $ifd0 = $this->buildIfd([
            $this->makeEntry(
                tag: self::TAG_GPS_IFD_POINTER,
                type: self::TYPE_LONG,
                count: 1,
                valueField: pack('V', $gpsIfdOffset)
            ),
        ]);

        return $tiffHeader . $ifd0 . $gpsIfd;
    }

    /**
     * @param array<int, array{tag:int,type:int,count:int,valueField:string}> $entries
     */
    private function buildIfd(array $entries, string $data = ''): string
    {
        return pack('v', count($entries))
            . implode('', array_map(
                fn (array $entry) => $this->packIfdEntry(
                    $entry['tag'],
                    $entry['type'],
                    $entry['count'],
                    $entry['valueField']
                ),
                $entries
            ))
            . pack('V', 0)
            . $data;
    }

    private function buildGpsIfd(float $latitude, float $longitude, DateTimeInterface $takenAt, int $gpsIfdOffset): string
    {
        $latitudeRef = $latitude < 0 ? 'S' : 'N';
        $longitudeRef = $longitude < 0 ? 'W' : 'E';

        $latitudeData = $this->packRationals($this->decimalToDmsRationals($latitude));
        $longitudeData = $this->packRationals($this->decimalToDmsRationals($longitude));
        $dateStampData = $this->packAsciiString($takenAt->format('Y:m:d') . "\0");
        $timeData = $this->packRationals($this->timeToRationals($takenAt));

        $entries = [
            [
                'tag'        => self::TAG_GPS_VERSION_ID,
                'type'       => self::TYPE_BYTE,
                'count'      => 4,
                'kind'       => 'inline',
                'valueField' => $this->packInlineBytes([2, 3, 0, 0]),
            ],
            [
                'tag'        => self::TAG_GPS_LATITUDE_REF,
                'type'       => self::TYPE_ASCII,
                'count'      => 2,
                'kind'       => 'inline',
                'valueField' => $this->packInlineBytes([$latitudeRef, "\0"]),
            ],
            [
                'tag'        => self::TAG_GPS_LATITUDE,
                'type'       => self::TYPE_RATIONAL,
                'count'      => 3,
                'kind'       => 'data',
                'data'       => $latitudeData,
            ],
            [
                'tag'        => self::TAG_GPS_LONGITUDE_REF,
                'type'       => self::TYPE_ASCII,
                'count'      => 2,
                'kind'       => 'inline',
                'valueField' => $this->packInlineBytes([$longitudeRef, "\0"]),
            ],
            [
                'tag'        => self::TAG_GPS_LONGITUDE,
                'type'       => self::TYPE_RATIONAL,
                'count'      => 3,
                'kind'       => 'data',
                'data'       => $longitudeData,
            ],
            [
                'tag'        => self::TAG_GPS_DATESTAMP,
                'type'       => self::TYPE_ASCII,
                'count'      => 11,
                'kind'       => 'data',
                'data'       => $dateStampData,
            ],
            [
                'tag'        => self::TAG_GPS_TIMESTAMP,
                'type'       => self::TYPE_RATIONAL,
                'count'      => 3,
                'kind'       => 'data',
                'data'       => $timeData,
            ],
        ];

        $headerSize = $this->ifdSize(count($entries));
        $cursor = $gpsIfdOffset + $headerSize;
        $data = '';
        $packedEntries = [];

        foreach ($entries as $entry) {
            if (($entry['kind'] ?? null) === 'data') {
                $valueField = pack('V', $cursor);
                $chunk = $entry['data'];
                $data .= $chunk;
                $cursor += strlen($chunk);
            } else {
                $valueField = $entry['valueField'];
            }

            $packedEntries[] = $this->packIfdEntry(
                $entry['tag'],
                $entry['type'],
                $entry['count'],
                $valueField
            );
        }

        return pack('v', count($entries))
            . implode('', $packedEntries)
            . pack('V', 0)
            . $data;
    }

    /**
     * @param array<int, int|string> $bytes
     */
    private function packInlineBytes(array $bytes): string
    {
        $result = '';

        foreach ($bytes as $byte) {
            $result .= is_int($byte) ? chr($byte) : (string) $byte;
        }

        return substr($result . "\0\0\0\0", 0, 4);
    }

    private function packAsciiString(string $value): string
    {
        return $value;
    }

    /**
     * @param array<int, array{0:int,1:int}> $rationals
     */
    private function packRationals(array $rationals): string
    {
        $binary = '';

        foreach ($rationals as [$numerator, $denominator]) {
            $binary .= pack('V2', $numerator, $denominator);
        }

        return $binary;
    }

    /**
     * @return array<int, array{0:int,1:int}>
     */
    private function decimalToDmsRationals(float $coordinate): array
    {
        $absolute = abs($coordinate);
        $degrees = (int) floor($absolute);
        $minutesFloat = ($absolute - $degrees) * 60;
        $minutes = (int) floor($minutesFloat);
        $seconds = ($minutesFloat - $minutes) * 60;

        $secondsNumerator = (int) round($seconds * 1000000);
        $secondsDenominator = 1000000;

        if ($secondsNumerator >= $secondsDenominator * 60) {
            $secondsNumerator = 0;
            $minutes++;
        }

        if ($minutes >= 60) {
            $minutes = 0;
            $degrees++;
        }

        return [
            [$degrees, 1],
            [$minutes, 1],
            [$secondsNumerator, $secondsDenominator],
        ];
    }

    /**
     * @return array<int, array{0:int,1:int}>
     */
    private function timeToRationals(DateTimeInterface $takenAt): array
    {
        $hours = (int) $takenAt->format('G');
        $minutes = (int) $takenAt->format('i');
        $seconds = ((int) $takenAt->format('s')) + ((int) $takenAt->format('u') / 1000000);
        $secondsNumerator = (int) round($seconds * 1000000);
        $secondsDenominator = 1000000;

        if ($secondsNumerator >= $secondsDenominator * 60) {
            $secondsNumerator = 0;
            $minutes++;
        }

        if ($minutes >= 60) {
            $minutes = 0;
            $hours++;
        }

        return [
            [$hours, 1],
            [$minutes, 1],
            [$secondsNumerator, $secondsDenominator],
        ];
    }

    private function packIfdEntry(int $tag, int $type, int $count, string $valueField): string
    {
        return pack('v', $tag)
            . pack('v', $type)
            . pack('V', $count)
            . substr($valueField . "\0\0\0\0", 0, 4);
    }

    private function ifdSize(int $entryCount): int
    {
        return 2 + ($entryCount * 12) + 4;
    }

    /**
     * @param array{tag:int,type:int,count:int,valueField:string} $entry
     */
    private function makeEntry(int $tag, int $type, int $count, string $valueField): array
    {
        return [
            'tag'        => $tag,
            'type'       => $type,
            'count'      => $count,
            'valueField' => $valueField,
        ];
    }
}
