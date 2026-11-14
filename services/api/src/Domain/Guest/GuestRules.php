<?php

declare(strict_types=1);

namespace App\Domain\Guest;

use App\Domain\Guest\Model\CompanionChoice;
use App\Domain\Guest\Model\GuestNeeds;
use App\Domain\Guest\Model\NewGuest;
use App\Domain\Guest\Model\PageReply;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Entity\Guest;
use App\Enum\ErrorCode;
use App\Enum\NeedKind;
use App\Http\Exception\ApiException;
use App\Locale\NameNormaliser;
use App\Locale\SupportedLocales;
use Psl\Iter;
use Psl\Str;
use Psl\Vec;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * What a guest added to a list may be (sc-1468). The web form checks the same before sending; this is the one that holds, every problem at once.
 *
 * @phpstan-type NeedsInput array{allergies?: list<string>, diet?: list<string>, access?: list<string>, otherAllergy?: ?string, otherDiet?: ?string, otherAccess?: ?string, note?: ?string}
 */
final readonly class GuestRules
{
    /** Each Other's words, counted after trimming (sc-3777, PM #5004): longer detail belongs in the note. */
    public const int OTHER_MAXIMUM = 100;

    public const int NOTE_MAXIMUM = 500;

    public function __construct(
        private TranslatorInterface $translator,
        private PhoneNumberParser $phoneNumberParser,
    ) {
    }

    /**
     * @param ?array{countryCode: string, number: string} $mobile
     * @param list<?string>                               $companions     each companion's name as typed, blank for none
     * @param ?string                                     $language       the host's Language, null for Not set
     * @param ?NeedsInput                                 $needs          null leaves them as they are
     * @param list<?NeedsInput>                           $companionNeeds beside `$companions`
     */
    public function guest(string $fullName, ?string $email, ?array $mobile, array $companions, ?string $language = null, ?array $needs = null, array $companionNeeds = []): NewGuest
    {
        $violations = [];
        $name = Str\trim($fullName);

        if ('' === $name) {
            $violations[] = $this->violation('fullName', 'validation.guest_name_required');
        } elseif (Str\length($name) > Guest::NAME_MAXIMUM) {
            $violations[] = $this->violation('fullName', 'validation.guest_name_too_long');
        }

        $email = null === $email ? '' : Str\trim($email);

        if ('' !== $email && !\filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            $violations[] = $this->violation('email', 'validation.email_invalid');
        }

        $e164 = null;

        if (null !== $mobile && '' !== Str\trim($mobile['number'])) {
            try {
                $e164 = $this->phoneNumberParser->parse($mobile['number'], $mobile['countryCode'], 'mobile')->number;
            } catch (ApiException $refused) {
                $violations = [...$violations, ...$refused->violations];
            }
        }

        if (Iter\count($companions) > Guest::COMPANIONS_MAXIMUM) {
            $violations[] = $this->violation('companions', 'validation.guest_companions_too_many');
        }

        $named = [];

        foreach ($companions as $index => $typed) {
            $companion = null === $typed ? '' : Str\trim($typed);

            if (Str\length($companion) > Guest::NAME_MAXIMUM) {
                $violations[] = $this->violation("companions[{$index}].fullName", 'validation.guest_name_too_long');
            }

            $named[] = '' === $companion ? null : $companion;
        }

        if (null !== $language && !Iter\contains(SupportedLocales::ALL, $language)) {
            $violations[] = $this->violation('language', 'validation.guest_language_unknown');
        }

        $hostNeeds = null === $needs ? null : $this->needs($needs, 'needs', $violations);
        $theirNeeds = [];

        foreach ($companions as $index => $_) {
            $typed = $companionNeeds[$index] ?? null;
            $theirNeeds[] = null === $typed ? null : $this->needs($typed, "companions[{$index}].needs", $violations);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new NewGuest($name, NameNormaliser::key($name), '' === $email ? null : $email, $e164, $named, $language, $hostNeeds, $theirNeeds);
    }

    /**
     * @param NeedsInput                                                                                           $typed
     * @param list<array{propertyPath: string, message: string, code: string, parameters?: array<string, string>}> $violations
     */
    private function needs(array $typed, string $path, array &$violations): GuestNeeds
    {
        $codes = [];
        $others = [];

        foreach (NeedKind::cases() as $kind) {
            [$picked, $typedWords] = match ($kind) {
                NeedKind::Allergen => [$typed['allergies'] ?? [], $typed['otherAllergy'] ?? null],
                NeedKind::Diet => [$typed['diet'] ?? [], $typed['otherDiet'] ?? null],
                NeedKind::Access => [$typed['access'] ?? [], $typed['otherAccess'] ?? null],
            };
            $known = $kind->codes();

            if (!Iter\all($picked, static fn (string $code): bool => Iter\contains($known, $code))) {
                $violations[] = $this->violation("{$path}.{$kind->field()}", 'validation.guest_need_unknown');
            }

            $codes[$kind->value] = Vec\filter($known, static fn (string $code): bool => Iter\contains($picked, $code));
            $words = Str\trim($typedWords ?? '');
            $ticked = Iter\contains($picked, NeedKind::OTHER);

            if ($ticked && '' === $words) {
                $violations[] = $this->violation("{$path}.{$kind->otherField()}", 'validation.guest_need_other_required');
            } elseif ($ticked && Str\length($words) > self::OTHER_MAXIMUM) {
                $violations[] = $this->violation("{$path}.{$kind->otherField()}", 'validation.guest_need_other_too_long');
            }

            $others[$kind->value] = $ticked ? $words : null;
        }

        $note = Str\trim($typed['note'] ?? '');

        if (Str\length($note) > self::NOTE_MAXIMUM) {
            $violations[] = $this->violation("{$path}.note", 'validation.guest_need_note_too_long');
        }

        return new GuestNeeds($codes, $others, '' === $note ? null : $note);
    }

    /**
     * What a guest sends with Coming from their own page: the names they gave on Who's coming with you? (sc-3779), a blank name never added, so it is refused rather than left unnamed, and each person's needs (sc-3778) by sc-3777's rules, every problem at once.
     *
     * @param list<array{id?: ?string, fullName: string, coming: bool, needs?: ?NeedsInput}> $companions
     * @param ?NeedsInput                                                                    $needs      the guest's own; null leaves them as they are
     */
    public function pageReply(array $companions, ?array $needs): PageReply
    {
        $violations = [];
        $choices = [];

        if (Iter\count($companions) > Guest::COMPANIONS_MAXIMUM) {
            $violations[] = $this->violation('companions', 'validation.guest_places_full');
        }

        $own = null === $needs ? null : $this->needs($needs, 'needs', $violations);

        foreach ($companions as $index => $companion) {
            $name = Str\trim($companion['fullName']);
            $typed = $companion['needs'] ?? null;
            $theirs = null === $typed ? null : $this->needs($typed, "companions[{$index}].needs", $violations);

            if ('' === $name) {
                $violations[] = $this->violation("companions[{$index}].fullName", 'validation.guest_name_required');
                continue;
            }

            if (Str\length($name) > Guest::NAME_MAXIMUM) {
                $violations[] = $this->violation("companions[{$index}].fullName", 'validation.guest_name_too_long');
                continue;
            }

            $choices[] = new CompanionChoice($companion['id'] ?? null, $name, NameNormaliser::key($name), $companion['coming'], $theirs);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new PageReply($choices, $own);
    }

    /** @return array{propertyPath: string, message: string, code: string} */
    public function violation(string $path, string $key): array
    {
        return [
            'propertyPath' => $path,
            'message' => $this->translator->trans($key, [
                '{count}' => (string) Guest::COMPANIONS_MAXIMUM,
                '{max}' => (string) Guest::NAME_MAXIMUM,
                '{otherMax}' => (string) self::OTHER_MAXIMUM,
                '{noteMax}' => (string) self::NOTE_MAXIMUM,
            ]),
            'code' => ErrorCode::ValidationFailed->value,
        ];
    }
}
