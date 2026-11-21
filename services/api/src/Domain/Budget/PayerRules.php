<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use App\Domain\Budget\Model\PayerDetails;
use App\Entity\Event;
use App\Entity\Payer;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Locale\VisibleText;
use App\Repository\PayerRepository;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * A payer's name and note (sc-91), refused as the form refuses them.
 *
 * @phpstan-type SentPayer array{name?: ?string, note?: ?string}
 * @phpstan-type Violation array{propertyPath: string, message: string, code: string}
 */
final readonly class PayerRules
{
    public function __construct(
        private TranslatorInterface $translator,
        private PayerRepository $payerRepository,
    ) {
    }

    /** @return Type\TypeInterface<SentPayer> */
    public static function sentPayer(): Type\TypeInterface
    {
        return Type\shape([
            'name' => Type\optional(Type\nullable(Type\string())),
            'note' => Type\optional(Type\nullable(Type\string())),
        ]);
    }

    /** @param SentPayer $sent */
    public function details(Event $event, array $sent, ?Payer $besides): PayerDetails
    {
        $violations = [];
        $name = Str\trim($sent['name'] ?? '');
        $note = Str\trim($sent['note'] ?? '');

        if ('' === $name) {
            $violations[] = $this->violation('name', 'validation.payer_name_required');
        } elseif (VisibleText::tooLong($name, Payer::NAME_MAXIMUM)) {
            $violations[] = $this->violation('name', 'validation.payer_name_too_long', ['{max}' => (string) Payer::NAME_MAXIMUM]);
        } else {
            $taken = $this->nameTaken($event, $name, $besides);

            if (null !== $taken) {
                $violations[] = $taken;
            }
        }

        if (VisibleText::tooLong($note, Payer::NOTE_MAXIMUM)) {
            $violations[] = $this->violation('note', 'validation.payer_note_too_long', ['{max}' => (string) Payer::NOTE_MAXIMUM]);
        }

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        return new PayerDetails($name, '' === $note ? null : $note);
    }

    /** @return ?Violation */
    public function nameTaken(Event $event, string $name, ?Payer $besides): ?array
    {
        $key = Str\lowercase(Str\trim($name));
        $same = Iter\search($this->payerRepository->findOnEvent($event), static fn (Payer $payer): bool => $payer !== $besides && Str\lowercase(Str\trim($payer->getName())) === $key);

        return null === $same ? null : $this->violation('name', 'validation.payer_name_taken', ['{name}' => $same->getName()]);
    }

    /**
     * @param array<string, string> $parameters
     *
     * @return Violation
     */
    private function violation(string $path, string $key, array $parameters = []): array
    {
        return ['propertyPath' => $path, 'message' => $this->translator->trans($key, $parameters), 'code' => ErrorCode::ValidationFailed->value];
    }
}
