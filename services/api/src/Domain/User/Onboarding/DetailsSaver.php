<?php

declare(strict_types=1);

namespace App\Domain\User\Onboarding;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Domain\User\Phone\PrimaryPhoneSetter;
use App\Entity\PhoneNumber;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/** The details screen's save: the person's name and optional mobile, and for an account that founds its own, the organisation. */
final readonly class DetailsSaver
{
    /** The organisation fields "A few details" shows; a refusal reports no other. */
    private const array SCREEN_FIELDS = ['organisationName', 'countryCode'];

    public function __construct(
        private AccountCompleteness $accountCompleteness,
        private OrganisationFounder $organisationFounder,
        private PhoneNumberParser $phoneNumberParser,
        private PrimaryPhoneSetter $primaryPhoneSetter,
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

        if ($this->accountCompleteness->needsOrganisation($user)) {
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
