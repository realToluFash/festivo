<?php

declare(strict_types=1);

namespace App\Tests\Traits;

use App\Domain\Messaging\NotificationWorker;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Vec;
use Symfony\Component\Mime\RawMessage;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Typed access to the test container.
 *
 * `ContainerInterface::get()` answers `?object`, so every service a test pulls
 * out arrives as something the analyser cannot check and a wrong id surfaces as
 * a TypeError several lines later. These narrow it at the point of the fetch and
 * fail with the id that was asked for.
 *
 * @phpstan-require-extends \Symfony\Bundle\FrameworkBundle\Test\KernelTestCase
 */
trait ServiceAccessTrait
{
    /**
     * @template T of object
     *
     * @param class-string<T> $id
     *
     * @return T
     */
    protected static function service(string $id): object
    {
        $service = self::getContainer()->get($id);

        self::assertInstanceOf($id, $service, \sprintf('Service "%s" is not available to the test container.', $id));

        return $service;
    }

    /**
     * For a service whose id is not a class name, such as a named rate limiter.
     * The expected class is passed separately so the call site still ends up
     * with the type it asked for.
     *
     * @template T of object
     *
     * @param class-string<T> $type
     *
     * @return T
     */
    protected static function serviceById(string $id, string $type): object
    {
        $service = self::getContainer()->get($id);

        self::assertInstanceOf($type, $service, \sprintf('Service "%s" is not a %s.', $id, $type));

        return $service;
    }

    protected static function em(): EntityManagerInterface
    {
        return self::service(EntityManagerInterface::class);
    }

    /** A refusal caught in the process carries its key; this is the English the response would say. */
    protected static function worded(ApiException $refusal): string
    {
        return self::service(TranslatorInterface::class)->trans($refusal->getMessage(), $refusal->parameters, null, 'en');
    }

    /**
     * Every email is queued (sc-4332): the worker sends what is due before the test reads what went.
     *
     * @return list<RawMessage>
     */
    public static function getMailerMessages(?string $transport = null): array
    {
        self::drainNotifications();

        return Vec\values(parent::getMailerMessages($transport));
    }

    public static function getMailerMessage(int $index = 0, ?string $transport = null): ?RawMessage
    {
        return self::getMailerMessages($transport)[$index] ?? null;
    }

    protected static function drainNotifications(int $atMost = 500): void
    {
        $worker = self::service(NotificationWorker::class);
        $steps = 0;

        while ($steps < $atMost && $worker->step()) {
            ++$steps;
        }
    }
}
