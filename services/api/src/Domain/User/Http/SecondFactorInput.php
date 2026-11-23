<?php

declare(strict_types=1);

namespace App\Domain\User\Http;

use App\Domain\User\Model\SecondFactorAnswer;
use App\Http\CodeField;
use Psl\Type;

/** The second factor out of a request body: `passkey`, or a code as the step's fields name it. */
final readonly class SecondFactorInput
{
    public function __construct(
        private CodeField $codeField,
    ) {
    }

    /** @return array<string, Type\TypeInterface<mixed>> */
    public static function fields(): array
    {
        return [
            'code' => Type\optional(Type\mixed()),
            'recoveryCode' => Type\optional(Type\mixed()),
            'passkey' => Type\optional(Type\dict(Type\string(), Type\mixed())),
        ];
    }

    /**
     * `code` from the app, or `recoveryCode`, as sign-in and a reset link's code step send them.
     *
     * @param array<string, mixed> $body
     */
    public function separate(array $body): SecondFactorAnswer
    {
        $passkey = $this->passkey($body);
        $code = $this->codeField->optional($body, 'code', CodeField::FROM_APP);
        $recoveryCode = $this->codeField->optional($body, 'recoveryCode', CodeField::RECOVERY);

        // Nothing sent is the app's code missing, the field the screen asks for first.
        if (null === $passkey && null === $code && null === $recoveryCode) {
            $code = $this->codeField->required($body, 'code', CodeField::FROM_APP);
        }

        return new SecondFactorAnswer(code: $code, recoveryCode: $recoveryCode, passkey: $passkey);
    }

    /**
     * `code` taking either kind in one field, as the card's steps send it.
     *
     * @param array<string, mixed> $body
     */
    public function either(array $body): SecondFactorAnswer
    {
        $passkey = $this->passkey($body);

        return null !== $passkey
            ? new SecondFactorAnswer(passkey: $passkey)
            : new SecondFactorAnswer(either: $this->codeField->required($body, 'code', CodeField::FROM_APP_OR_RECOVERY));
    }

    /**
     * `either`, where the step takes the current factor only while two-factor is on: nothing sent is null.
     *
     * @param array<string, mixed> $body
     */
    public function eitherIfSent(array $body): ?SecondFactorAnswer
    {
        return \array_key_exists('code', $body) || \array_key_exists('passkey', $body) ? $this->either($body) : null;
    }

    /**
     * @param array<string, mixed> $body
     *
     * @return array<string, mixed>|null
     */
    private function passkey(array $body): ?array
    {
        $passkey = $body['passkey'] ?? null;

        return \is_array($passkey) ? Type\dict(Type\string(), Type\mixed())->coerce($passkey) : null;
    }
}
