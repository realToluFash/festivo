<?php

declare(strict_types=1);

namespace App\Domain\Event\DoorCode;

use App\Domain\User\AccountName;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\IssuedChallenge;
use App\Domain\User\Model\IssuedTokens;
use App\Domain\User\Phone\PhoneNumberParser;
use App\Domain\User\PhoneSignIn\PhoneSignIns;
use App\Domain\User\TwoFactor\SecondFactors;
use App\Domain\User\TwoFactor\SignInGate;
use App\Entity\EventPerson;
use App\Entity\PhoneSignIn;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\PhoneSignInRepository;
use Psl\Iter;
use Psl\Str;
use SensitiveParameter;
use Symfony\Component\Clock\ClockInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

/** Redeeming a door code signed out (sc-4235): the use cap counts people, so an account already in signs back in at a full code and takes no use. */
final readonly class DoorCodeSignIn
{
    private const int SENDS_PER_USE_AN_HOUR = 2;

    public function __construct(
        private DoorCodeRedeemer $doorCodeRedeemer,
        private PhoneSignIns $phoneSignIns,
        private PhoneSignInRepository $phoneSignInRepository,
        private PhoneNumberParser $phoneNumberParser,
        private AccountName $accountName,
        private SecondFactors $secondFactors,
        private SignInGate $signInGate,
        private ClockInterface $clock,
        private RateLimiterFactoryInterface $doorCodeSendLimiter,
    ) {
    }

    /** @return string the handle the code step answers with; the same answer whether or not the number has an account */
    public function send(string $typed, string $name, string $number, string $countryCode, Request $request): string
    {
        $doorCode = $this->doorCodeRedeemer->open($typed, null, $request);
        $given = Str\trim($name);
        $violations = $this->accountName->violations($given);

        if ([] !== $violations) {
            throw ApiException::validation($violations);
        }

        $phone = $this->phoneNumberParser->parse($number, $countryCode);
        $bySource = $this->doorCodeSendLimiter->create($request->getClientIp() ?? 'unknown')->consume();

        if (!$bySource->isAccepted()) {
            throw $this->doorCodeRedeemer->tooMany($bySource->getRetryAfter());
        }

        $sent = $this->phoneSignInRepository->sentForDoorCodeSince($doorCode, $this->clock->now()->modify('-1 hour'));
        $over = Iter\count($sent) - self::SENDS_PER_USE_AN_HOUR * $doorCode->getUseCap();

        if ($over >= 0) {
            throw $this->doorCodeRedeemer->tooMany($sent[$over]->modify('+1 hour'));
        }

        $handle = PhoneSignIns::newHandle();
        $this->phoneSignIns->send(PhoneSignIn::throughDoorCode(PhoneSignIns::hash($handle), $doorCode, $phone->number, $phone->countryCode, $given, AccountLanguage::fromRequest(AccountLanguage::askedIn($request)), $this->clock->now()));

        return $handle;
    }

    /**
     * With two-factor on, nothing is granted until it is passed: the signed-in redeem then takes the use.
     *
     * @return array{user: User, admission: IssuedTokens|IssuedChallenge, person: ?EventPerson, again: bool}
     */
    public function signIn(string $typed, #[SensitiveParameter] string $handle, #[SensitiveParameter] string $code, Request $request, bool $inBrowser): array
    {
        $doorCode = $this->doorCodeRedeemer->open($typed, null, $request);
        $signIn = $this->phoneSignIns->find($handle);

        if (true !== $signIn->getDoorCode()?->getId()->equals($doorCode->getId())) {
            throw new ApiException(ErrorCode::VerificationCodeExpired, 'code.expired');
        }

        $user = $this->phoneSignIns->prove($signIn, $code, $signIn->getTypedName() ?? '', $request, function (?User $account) use ($doorCode, $request): void {
            if (null !== $account) {
                $this->doorCodeRedeemer->refuseAMember($doorCode, $account);
            }

            if (null === $account || null === $this->doorCodeRedeemer->heldBy($doorCode, $account)) {
                $this->doorCodeRedeemer->refuseUnlessLive($doorCode, $request);
            }
        })['user'];
        $held = $this->doorCodeRedeemer->heldBy($doorCode, $user);
        $person = $held ?? ($this->secondFactors->isOn($user) ? null : $this->doorCodeRedeemer->admit($doorCode, $user, $request, false));

        return [
            'user' => $user,
            'admission' => $this->signInGate->admit($user, $request, null, $signIn, $inBrowser),
            'person' => $person,
            'again' => null !== $held,
        ];
    }
}
