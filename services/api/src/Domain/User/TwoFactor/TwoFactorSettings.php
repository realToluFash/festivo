<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Domain\Organisation\SignInRules\SignInRules;
use App\Domain\User\Model\SecondFactorAnswer;
use App\Domain\User\TwoFactor\Passkey\PasskeyProviders;
use App\Domain\User\TwoFactor\Passkey\Passkeys;
use App\Entity\Passkey;
use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Enum\PasskeyStep;
use App\Http\Exception\ApiException;
use App\Repository\PasskeyRepository;
use App\Repository\RecoveryCodeRepository;
use App\Repository\TwoFactorFactorRepository;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use LogicException;
use Psl\Vec;
use Psr\Clock\ClockInterface;
use SensitiveParameter;
use Symfony\Component\Uid\Uuid;

final readonly class TwoFactorSettings
{
    private const int QR_SIZE = 240;

    public function __construct(
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private PasskeyRepository $passkeyRepository,
        private RecoveryCodeRepository $recoveryCodeRepository,
        private RecoveryCodes $recoveryCodes,
        private SecondFactorCheck $secondFactorCheck,
        private SecondFactors $secondFactors,
        private Passkeys $passkeys,
        private PasskeyProviders $passkeyProviders,
        private AuthenticatorCodes $authenticatorCodes,
        private SecretBox $secretBox,
        private TwoFactorMailer $twoFactorMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
        private SignInRules $signInRules,
    ) {
    }

    /** @return array{on: bool, recoveryCodesLeft: int, passkeysOffered: bool, mostPasskeys: int, factors: list<array<string, mixed>>} */
    public function status(User $user): array
    {
        $app = $this->secondFactors->app($user);
        $passkeys = $this->secondFactors->passkeys($user);
        $factors = [
            ...Vec\map($passkeys, fn (Passkey $passkey): array => [
                'kind' => 'passkey',
                'id' => $passkey->getId()->toRfc4122(),
                'provider' => $this->passkeyProviders->nameOf($passkey->getAaguid()),
                'synced' => $passkey->isBackedUp(),
                'addedAt' => $passkey->getCreatedAt()->format(\DATE_ATOM),
            ]),
            ...(null === $app ? [] : [['kind' => 'app', 'addedAt' => ($app->getActivatedAt() ?? $app->getCreatedAt())->format(\DATE_ATOM)]]),
        ];
        $factors = Vec\sort($factors, static fn (array $a, array $b): int => $b['addedAt'] <=> $a['addedAt']);
        $on = null !== $app || [] !== $passkeys;

        return [
            'on' => $on,
            'recoveryCodesLeft' => $on ? $this->recoveryCodeRepository->countUnusedFor($user) : 0,
            'passkeysOffered' => $this->passkeys->offered(),
            'mostPasskeys' => Passkeys::MOST,
            'factors' => $factors,
        ];
    }

    /** @return array{secret: string, otpauthUri: string, qrSvg: string} */
    public function enrol(User $user, ?SecondFactorAnswer $answer = null): array
    {
        if (null !== $this->secondFactors->app($user)) {
            throw new ApiException(ErrorCode::TwoFactorAlreadyOn, 'two_factor.already_on');
        }

        if ($this->secondFactors->isOn($user)) {
            $this->secondFactorCheck->pass($user, $answer ?? new SecondFactorAnswer(), PasskeyStep::AddApp);
        }

        $existing = $this->twoFactorFactorRepository->findOneFor($user);

        if (null !== $existing) {
            $this->entityManager->remove($existing);
            $this->entityManager->flush();
        }

        $secret = $this->authenticatorCodes->newSecret();
        $this->entityManager->persist(new TwoFactorFactor($user, $this->secretBox->seal($secret)));
        $this->entityManager->flush();

        $uri = $this->authenticatorCodes->provisioningUri($secret, self::label($user));
        $qr = new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE, 1), new SvgImageBackEnd()))->writeString($uri);

        return ['secret' => $secret, 'otpauthUri' => $uri, 'qrSvg' => $qr];
    }

    /** With no email, the verified primary number in E.164, which the two-factor step names masked (sc-4235). */
    private static function label(User $user): string
    {
        $phone = $user->getPrimaryPhoneNumber();

        return $user->getPrimaryEmailAddress()?->getAddress()
            ?? (true === $phone?->isVerified() ? $phone->getNumber() : null)
            ?? $user->getName();
    }

    /** @return list<string> the recovery codes, shown this once; none when passkeys had it on already */
    public function activate(User $user, #[SensitiveParameter] string $code, ?string $asked = null, ?string $userAgent = null): array
    {
        $factor = $this->twoFactorFactorRepository->findOneFor($user);

        if (null === $factor || $factor->isActive()) {
            throw new ApiException(ErrorCode::TwoFactorNotEnrolled, 'two_factor.not_enrolled');
        }

        $wasOn = $this->secondFactors->isOn($user);
        $this->secondFactorCheck->passCode($factor, $code);

        return $this->entityManager->wrapInTransaction(function () use ($user, $factor, $asked, $userAgent, $wasOn): array {
            $now = $this->clock->now();
            $factor->activate($now);

            if ($wasOn) {
                $this->entityManager->flush();
                $this->twoFactorMailer->sendAdded($user, null, $now, $userAgent, $asked);

                return [];
            }

            return $this->turnedOn($user, $now, $asked, passkey: false);
        });
    }

    /** @return array<string, mixed> */
    public function passkeyCreationOptions(User $user, ?SecondFactorAnswer $answer = null): array
    {
        if (!$this->secondFactors->isOn($user)) {
            return $this->passkeys->creationOptions($user, PasskeyStep::TurnOn);
        }

        $this->secondFactorCheck->pass($user, $answer ?? new SecondFactorAnswer(), PasskeyStep::Add);

        return $this->passkeys->creationOptions($user, PasskeyStep::Register);
    }

    /**
     * @param array<string, mixed> $credential
     *
     * @return list<string> the recovery codes when this passkey turned two-factor on, none when it was added
     */
    public function addPasskey(User $user, array $credential, ?string $asked = null, ?string $userAgent = null): array
    {
        // Outside the transaction, so a refused registration still spends its challenge.
        [$passkey, $step] = $this->passkeys->register($user, $credential, [PasskeyStep::TurnOn, PasskeyStep::Register]);

        return $this->entityManager->wrapInTransaction(function () use ($user, $passkey, $step, $asked, $userAgent): array {
            $wasOn = $this->secondFactors->isOn($user);

            if ($wasOn !== (PasskeyStep::Register === $step)) {
                throw $wasOn
                    ? new ApiException(ErrorCode::TwoFactorAlreadyOn, 'two_factor.already_on')
                    : new ApiException(ErrorCode::TwoFactorOff, 'two_factor.off');
            }

            $now = $this->clock->now();

            if ($wasOn) {
                $this->entityManager->flush();
                $this->twoFactorMailer->sendAdded($user, $passkey, $now, $userAgent, $asked);

                return [];
            }

            return $this->turnedOn($user, $now, $asked, passkey: true);
        });
    }

    /** @return array<string, mixed> */
    public function passkeyRequestOptions(User $user, PasskeyStep $step): array
    {
        return $this->passkeys->requestOptions($user, $step);
    }

    /**
     * Changing a factor takes the current one, or a stolen session could mint codes past it.
     *
     * @return list<string>
     */
    public function newRecoveryCodes(User $user, SecondFactorAnswer $answer): array
    {
        $this->on($user);
        $this->secondFactorCheck->pass($user, $answer, PasskeyStep::NewCodes);
        $codes = $this->recoveryCodes->issueFor($user);
        $this->entityManager->flush();

        return $codes;
    }

    public function remove(User $user, string $which, SecondFactorAnswer $answer, ?string $userAgent = null): void
    {
        $this->on($user);
        $passkey = 'app' === $which ? null : $this->passkeyOf($user, $which);
        $app = 'app' === $which ? ($this->secondFactors->app($user) ?? throw new ApiException(ErrorCode::NotFound, 'two_factor.no_app')) : null;
        $held = $this->passkeyRepository->countFor($user) + (null === $this->secondFactors->app($user) ? 0 : 1);

        if ($held <= 1) {
            throw new ApiException(ErrorCode::TwoFactorLastFactor, 'two_factor.last_factor');
        }

        $this->secondFactorCheck->pass($user, $answer, PasskeyStep::Remove);

        $this->entityManager->wrapInTransaction(function () use ($user, $passkey, $app, $userAgent): void {
            $this->entityManager->remove($passkey ?? $app ?? throw new LogicException('no factor to remove'));
            $this->entityManager->flush();
            $this->twoFactorMailer->sendRemoved($user, $passkey, $this->clock->now(), $userAgent);
        });
    }

    public function turnOff(User $user, SecondFactorAnswer $answer): void
    {
        $this->on($user);
        $requiring = $this->signInRules->requiringTwoFactor($user);

        if (null !== $requiring) {
            throw new ApiException(
                ErrorCode::TwoFactorKeptByRule,
                'two_factor.required_by_organisation',
                [],
                null,
                [],
                ['organisation' => $requiring->getName()],
            );
        }

        $this->secondFactorCheck->pass($user, $answer, PasskeyStep::TurnOff);

        $this->entityManager->wrapInTransaction(function () use ($user): void {
            $this->removeEveryFactor($user);
            $this->twoFactorMailer->sendTurnedOff($user, $this->clock->now());
        });
    }

    /** Not flushed. */
    public function removeEveryFactor(User $user): void
    {
        $this->recoveryCodeRepository->deleteAllFor($user);

        foreach ([$this->twoFactorFactorRepository->findOneFor($user), ...$this->passkeyRepository->findFor($user)] as $factor) {
            if (null !== $factor) {
                $this->entityManager->remove($factor);
            }
        }

        $this->entityManager->flush();
    }

    /** @return list<string> */
    private function turnedOn(User $user, DateTimeImmutable $now, ?string $asked, bool $passkey): array
    {
        $user->setTwoFactorSetupPrompt(false);
        $codes = $this->recoveryCodes->issueFor($user);
        $this->entityManager->flush();
        $this->twoFactorMailer->sendTurnedOn($user, $now, $asked, $passkey);

        return $codes;
    }

    private function passkeyOf(User $user, string $id): Passkey
    {
        return (Uuid::isValid($id) ? $this->passkeyRepository->findOneById($user, Uuid::fromString($id)) : null)
            ?? throw ApiException::notFound('two_factor.no_passkey');
    }

    private function on(User $user): void
    {
        if (!$this->secondFactors->isOn($user)) {
            throw new ApiException(ErrorCode::TwoFactorOff, 'two_factor.off');
        }
    }
}
