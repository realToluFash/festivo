<?php

declare(strict_types=1);

namespace App\AppVersion;

use App\AppVersion\Exception\MinimumAppVersionMalformed;
use Psl\Regex;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/** The oldest app build each platform's store may still serve; null is no minimum. Malformed is a refusal to start, never an unset minimum (sc-22620). */
final readonly class MinimumAppVersions
{
    private const string VERSION = '/^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/';

    public ?string $ios;

    public ?string $android;

    /** @throws MinimumAppVersionMalformed */
    public function __construct(
        #[Autowire('%env(default::MINIMUM_APP_VERSION_IOS)%')]
        ?string $ios,
        #[Autowire('%env(default::MINIMUM_APP_VERSION_ANDROID)%')]
        ?string $android,
    ) {
        $this->ios = self::version('MINIMUM_APP_VERSION_IOS', $ios);
        $this->android = self::version('MINIMUM_APP_VERSION_ANDROID', $android);
    }

    /** @throws MinimumAppVersionMalformed */
    private static function version(string $setting, ?string $value): ?string
    {
        if (null === $value || '' === $value) {
            return null;
        }

        if (!Regex\matches($value, self::VERSION)) {
            throw new MinimumAppVersionMalformed($setting, $value);
        }

        return $value;
    }
}
