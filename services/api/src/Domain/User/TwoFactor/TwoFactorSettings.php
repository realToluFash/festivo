<?php

declare(strict_types=1);

namespace App\Domain\User\TwoFactor;

use App\Entity\TwoFactorFactor;
use App\Entity\User;
use App\Enum\ErrorCode;
use App\Http\Exception\ApiException;
use App\Repository\RecoveryCodeRepository;
use App\Repository\TwoFactorFactorRepository;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Clock\ClockInterface;
use SensitiveParameter;

final readonly class TwoFactorSettings
{
    private const int QR_SIZE = 240;

    public function __construct(
        private TwoFactorFactorRepository $twoFactorFactorRepository,
        private RecoveryCodeRepository $recoveryCodeRepository,
        private RecoveryCodes $recoveryCodes,
        private SecondFactorCheck $secondFactorCheck,
        private AuthenticatorCodes $authenticatorCodes,
        private SecretBox $secretBox,
        private TwoFactorMailer $twoFactorMailer,
        private EntityManagerInterface $entityManager,
        private ClockInterface $clock,
    ) {
    }

    /** @return array{on: bool, recoveryCodesLeft: int} */
    public function status(User $user): array
    {
        $on = null !== $this->twoFactorFactorRepository->findActiveFor($user);

        return ['on' => $on, 'recoveryCodesLeft' => $on ? $this->recoveryCodeRepository->countUnusedFor($user) : 0];
    }

    /**
     * A new secret, off until a code from it matches. Asking again starts over with another.
     *
     * @return array{secret: string, otpauthUri: string, qrSvg: string}
     */
    public function enrol(User $user): array
    {
        $existing = $this->twoFactorFactorRepository->findOneFor($user);

        if (null !== $existing && $existing->isActive()) {
            throw new ApiException(ErrorCode::TwoFactorAlreadyOn, 'Two-factor is already on.');
        }

        if (null !== $existing) {
            $this->entityManager->remove($existing);
            $this->entityManager->flush();
        }

        $secret = $this->authenticatorCodes->newSecret();
        $this->entityManager->persist(new TwoFactorFactor($user, $this->secretBox->seal($secret)));
        $this->entityManager->flush();

        $uri = $this->authenticatorCodes->provisioningUri($secret, $user->getPrimaryEmailAddress()?->getAddress() ?? $user->getName());
        $qr = new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE, 1), new SvgImageBackEnd()))->writeString($uri);

        return ['secret' => $secret, 'otpauthUri' => $uri, 'qrSvg' => $qr];
    }

    /** @return list<string> the recovery codes, shown this once */
    public function activate(User $user, #[SensitiveParameter] string $code): array
    {
        $factor = $this->twoFactorFactorRepository->findOneFor($user);

        if (null === $factor || $factor->isActive()) {
            throw new ApiException(ErrorCode::TwoFactorNotEnrolled, 'Start setting up two-factor first.');
        }

        $this->secondFactorCheck->passCode($factor, $code);
        $factor->activate($this->clock->now());
        $user->setTwoFactorSetupPrompt(false);
        $codes = $this->recoveryCodes->issueFor($user);
        $this->entityManager->flush();

        return $codes;
    }

    /**
     * Changing a factor takes the current one, or a stolen session could mint codes past it.
     *
     * @return list<string>
     */
    public function newRecoveryCodes(User $user, #[SensitiveParameter] string $typed): array
    {
        $this->secondFactorCheck->passEither($this->active($user), $typed);
        $codes = $this->recoveryCodes->issueFor($user);
        $this->entityManager->flush();

        return $codes;
    }

    public function turnOff(User $user, #[SensitiveParameter] string $typed): void
    {
        $factor = $this->active($user);
        $this->secondFactorCheck->passEither($factor, $typed);

        $this->recoveryCodeRepository->deleteAllFor($user);
        $this->entityManager->remove($factor);
        $this->entityManager->flush();

        $this->twoFactorMailer->sendTurnedOff($user, $this->clock->now());
    }

    private function active(User $user): TwoFactorFactor
    {
        return $this->twoFactorFactorRepository->findActiveFor($user)
            ?? throw new ApiException(ErrorCode::TwoFactorOff, 'Two-factor is not on.');
    }
}
