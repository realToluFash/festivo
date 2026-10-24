<?php

declare(strict_types=1);

namespace App\Domain\User\Onboarding;

use App\Domain\Organisation\DomainJoining\JoinRequester;
use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Domain\User\Phone\PrimaryPhoneSetter;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\OrganisationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The details screen's save: the person's name and optional mobile, and for an account in none, the organisation it founds or asks to join (sc-561). */
final readonly class DetailsSaver
{
    /** The organisation fields "A few details" shows; a refusal reports no other. */
    private const array SCREEN_FIELDS = ['organisationName', 'countryCode'];

    public function __construct(
        private AccountCompleteness $accountCompleteness,
        private OrganisationFounder $organisationFounder,
        private PhoneNumberParser $phoneNumberParser,
        private PrimaryPhoneSetter $primaryPhoneSetter,
        private JoinRequester $joinRequester,
        private OrganisationRepository $organisationRepository,
        private EntityManagerInterface $entityManager,
        private TranslatorInterface $translator,
    ) {
    }

    /** Every refusal at once; the organisation's fields are reported under their own names on this screen. */
    public function save(
        User $user,
        string $name,
        ?string $organisationName,
        ?string $countryCode,
        ?string $timezone,
        ?string $phoneCountryCode = null,
        ?string $phoneNumber = null,
        ?string $askToJoin = null,
    ): ?PhoneNumber {
        $violations = [];
        $trimmed = Str\trim($name);
        $phone = null;

        if ('' === $trimmed) {
            $violations[] = [
                'propertyPath' => 'name',
                'message' => $this->translator->trans('validation.name_required'),
                'code' => ErrorCode::ValidationFailed->value,
            ];
        }

        $needsOrganisation = $this->accountCompleteness->needsOrganisation($user);
        $asking = $needsOrganisation ? $askToJoin : null;

        if ($needsOrganisation && null === $asking) {
            try {
                $this->organisationFounder->found($user, $organisationName ?? '', $countryCode ?? '', $timezone ?? '');
            } catch (ApiException $e) {
                // Only the fields this screen has: currency and timezone are derived, so nobody could fix them here.
                $shown = Vec\filter(Vec\map($e->violations, self::onThisScreen(...)), static fn (array $v): bool => Iter\contains(self::SCREEN_FIELDS, $v['propertyPath']));

                $violations = [] === $shown ? throw $e : [...$violations, ...$shown];
            }
        }

        if ('' !== Str\trim($phoneNumber ?? '')) {
            try {
                $phone = $this->phoneNumberParser->parse($phoneNumber ?? '', $phoneCountryCode ?? '', 'phoneNumber');
            } catch (ApiException $e) {
                $violations = [...$violations, ...Vec\map($e->violations, self::phoneOnThisScreen(...))];
            }
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        // Asking runs the same checks as Save, and is refused before anything is written.
        if (null !== $asking) {
            $organisation = Uuid::isValid($asking) ? $this->organisationRepository->find($asking) : null;

            $this->joinRequester->ask($user, $organisation ?? throw new ApiException(ErrorCode::JoinOfferUnavailable, $this->translator->trans('domain_joining.unavailable')));
        }

        $texted = $this->primaryPhoneSetter->set($user, $phone);
        $user->setName($trimmed);
        $user->markDetailsSaved();
        $this->entityManager->flush();

        return $texted;
    }

    /**
     * @param array{propertyPath: string, message: string, code: string} $violation
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private static function phoneOnThisScreen(array $violation): array
    {
        $violation['propertyPath'] = 'countryCode' === $violation['propertyPath'] ? 'phoneCountryCode' : $violation['propertyPath'];

        return $violation;
    }

    /**
     * @param array{propertyPath: string, message: string, code: string} $violation
     *
     * @return array{propertyPath: string, message: string, code: string}
     */
    private static function onThisScreen(array $violation): array
    {
        $violation['propertyPath'] = 'name' === $violation['propertyPath'] ? 'organisationName' : $violation['propertyPath'];

        return $violation;
    }
}
