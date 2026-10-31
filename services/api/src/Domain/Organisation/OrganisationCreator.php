<?php

declare(strict_types=1);

namespace App\Domain\Organisation;

use App\Audit\Auditor;
use App\Domain\User\TimeZone\AccountTimeZone;
use App\Entity\Organisation;
use App\Entity\User;
use App\Enum\Actor;
use App\Http\Exception\ApiException;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/** "Create an organisation" in the switcher (sc-390): sign-up's founding step, limited per account and audited. */
final readonly class OrganisationCreator
{
    public const string CREATED = 'organisation.created';

    /** The fields the form shows; a refusal reports no other (sc-485). */
    private const array FORM_FIELDS = ['name', 'countryCode'];

    public function __construct(
        private OrganisationFounder $organisationFounder,
        private RateLimiterFactoryInterface $organisationCreateAccountLimiter,
        private Auditor $auditor,
        private EntityManagerInterface $entityManager,
    ) {
    }

    /** A device timezone nobody recognises gives UTC: the form has no field to put it right in. */
    public function create(User $by, string $name, string $countryCode, string $timezone): Organisation
    {
        $created = $this->entityManager->wrapInTransaction(function () use ($by, $name, $countryCode, $timezone): Organisation|ApiException {
            // Under the account's lock, so creations sent together are counted one after another.
            $this->entityManager->refresh($by, LockMode::PESSIMISTIC_WRITE);
            $limiter = $this->organisationCreateAccountLimiter->create($by->getId()->toRfc4122());
            $peek = $limiter->consume(0);

            if ($peek->getRemainingTokens() <= 0) {
                return ApiException::tooManyAttempts('limits.organisations', $peek->getRetryAfter());
            }

            try {
                $organisation = $this->organisationFounder->found($by, $name, $countryCode, AccountTimeZone::canonical($timezone) ?? 'UTC');
            } catch (ApiException $e) {
                return self::onTheForm($e);
            }

            $this->auditor->record(self::CREATED, 'Organisation', $organisation->getId(), Actor::User, $by->getId(), $by->getName(), [
                'name' => [null, $organisation->getName()],
                'countryCode' => [null, $organisation->getCountryCode()],
                'currency' => [null, $organisation->getCurrency()],
                'timezone' => [null, $organisation->getTimezone()],
                'contactAddress' => [null, $organisation->getContactAddress()],
            ]);
            $this->entityManager->flush();
            $limiter->consume();

            return $organisation;
        });

        return $created instanceof ApiException ? throw $created : $created;
    }

    private static function onTheForm(ApiException $refusal): ApiException
    {
        $shown = Vec\filter($refusal->violations, static fn (array $violation): bool => Iter\contains(self::FORM_FIELDS, $violation['propertyPath']));

        return [] === $shown ? $refusal : ApiException::validation($shown);
    }
}
