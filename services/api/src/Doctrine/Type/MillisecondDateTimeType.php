<?php

declare(strict_types=1);

namespace App\Doctrine\Type;

use DateTimeImmutable;
use Doctrine\DBAL\Platforms\AbstractPlatform;
use Doctrine\DBAL\Types\DateTimeImmutableType;

/** A UTC moment kept to the millisecond, for what is ordered by when it happened (sc-3895). */
final class MillisecondDateTimeType extends DateTimeImmutableType
{
    public const string NAME = 'datetime_ms_immutable';

    public function getSQLDeclaration(array $column, AbstractPlatform $platform): string
    {
        return 'TIMESTAMP(3) WITHOUT TIME ZONE';
    }

    public function convertToDatabaseValue(mixed $value, AbstractPlatform $platform): ?string
    {
        return $value instanceof DateTimeImmutable ? $value->format('Y-m-d H:i:s.v') : parent::convertToDatabaseValue($value, $platform);
    }
}
