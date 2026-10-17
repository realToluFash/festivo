<?php

declare(strict_types=1);

namespace App\Domain\User\Verification;

use App\Domain\User\Interfaces\WhatsAppSenderInterface;
use App\Domain\User\Mail\AccountLanguage;
use App\Domain\User\Model\IssuedVerificationCode;
use App\Domain\User\TwoFactor\SecretBox;
use App\Entity\PhoneCodeDelivery;
use App\Entity\PhoneNumber;
use App\Entity\VerificationChallenge;
use App\Enum\ErrorCode;
use App\Enum\PhoneCodeRoute;
use App\Http\Exception\ApiException;
use App\Repository\VerificationChallengeRepository;
use DateTimeImmutable;
use Doctrine\DBAL\LockMode;
use Doctrine\ORM\EntityManagerInterface;
use libphonenumber\PhoneNumberUtil;
use Psl\Type;
use Psr\Log\LoggerInterface;
use SensitiveParameter;
use Throwable;

/** Where a phone code goes (sc-750): WhatsApp first by country, else SMS; the same code texted if WhatsApp fails. */
final readonly class PhoneCodeDispatch
{
    public const int FALLBACK_SECONDS = 30;

    public function __construct(
        private WhatsAppSenderInterface $whatsAppSender,
        private VerificationCodeTexter $verificationCodeTexter,
        private PhoneCodeChannels $phoneCodeChannels,
        private SecretBox $secretBox,
        private AccountLanguage $accountLanguage,
        private VerificationChallengeRepository $verificationChallengeRepository,
        private EntityManagerInterface $entityManager,
        private LoggerInterface $logger,
    ) {
    }

    public function send(PhoneNumber $phone, IssuedVerificationCode $issued): void
    {
        $country = self::countryOf($phone);

        if ($phone->wantsCodesByText() || !$this->phoneCodeChannels->whatsAppFirst($country)) {
            $this->text($phone, $issued->challenge, $issued->code, $phone->wantsCodesByText() ? PhoneCodeRoute::SmsChosen : PhoneCodeRoute::SmsOnly);

            return;
        }

        try {
            $messageId = $this->whatsAppSender->sendCode(Type\non_empty_string()->assert($phone->getNumber()), $issued->code, $this->accountLanguage->of($phone->getUser()));
        } catch (Throwable $e) {
            // Refused outright (no WhatsApp account, a bad template): the text goes now, not in 30 seconds.
            $this->logger->warning('WhatsApp refused a phone code; texting it instead.', ['exception' => $e]);
            $this->record($country, PhoneCodeRoute::WhatsApp);
            $this->text($phone, $issued->challenge, $issued->code, PhoneCodeRoute::SmsFallback);

            return;
        }

        $issued->challenge->sentByWhatsApp($messageId, $this->secretBox->seal($issued->code));
        $this->record($country, PhoneCodeRoute::WhatsApp);
        $this->entityManager->flush();
    }

    /** @return bool whether the text went now: WhatsApp failed, or 30 seconds passed with no word it arrived */
    public function fallBackIfDue(PhoneNumber $phone, bool $failed = false): bool
    {
        return $this->underLock($phone, function (VerificationChallenge $challenge) use ($phone, $failed): bool {
            $due = $challenge->getCreatedAt() <= new DateTimeImmutable('-' . self::FALLBACK_SECONDS . ' seconds');

            if (!$challenge->awaitsWhatsApp() || (!$failed && !$due)) {
                return false;
            }

            $this->text($phone, $challenge, $this->openCode($challenge), PhoneCodeRoute::SmsFallback);

            return true;
        });
    }

    /** "Text it to me instead": the same code once, and every later code for this number by text. */
    public function textInstead(PhoneNumber $phone): void
    {
        $sent = $this->underLock($phone, function (VerificationChallenge $challenge) use ($phone): bool {
            if (!$challenge->awaitsWhatsApp() || $challenge->isExpired() || $challenge->isExhausted()) {
                return false;
            }

            $phone->chooseCodesByText();
            $this->text($phone, $challenge, $this->openCode($challenge), PhoneCodeRoute::SmsChosen);

            return true;
        });

        if (!$sent) {
            throw new ApiException(ErrorCode::Conflict, 'This code is not on WhatsApp now. Send a new code.');
        }
    }

    public function reported(string $messageId, string $status): void
    {
        $challenge = $this->verificationChallengeRepository->findOneBy(['whatsAppMessageId' => $messageId]);
        $phone = $challenge?->getPhoneNumber();

        if (null === $challenge || null === $phone || !$challenge->awaitsWhatsApp()) {
            return;
        }

        if ('failed' === $status) {
            $this->fallBackIfDue($phone, failed: true);
        } elseif ('delivered' === $status || 'read' === $status) {
            $challenge->deliveredByWhatsApp();
            $this->entityManager->flush();
        }
    }

    /** @return int how many waiting past the 30 seconds were texted: the backstop when no screen is polling */
    public function fallBackAllDue(): int
    {
        $due = $this->verificationChallengeRepository->findAwaitingWhatsAppSince(new DateTimeImmutable('-' . self::FALLBACK_SECONDS . ' seconds'));
        $texted = 0;

        foreach ($due as $challenge) {
            $phone = $challenge->getPhoneNumber();

            if (null !== $phone && $this->fallBackIfDue($phone)) {
                ++$texted;
            }
        }

        return $texted;
    }

    public function routeOf(PhoneNumber $phone): ?PhoneCodeRoute
    {
        return $this->verificationChallengeRepository->findNewestFor($phone)?->getRoute();
    }

    /** @param callable(VerificationChallenge): bool $step under the challenge's row lock, so a poll and a report text once */
    private function underLock(PhoneNumber $phone, callable $step): bool
    {
        $challenge = $this->verificationChallengeRepository->findNewestFor($phone);

        if (null === $challenge) {
            return false;
        }

        $connection = $this->entityManager->getConnection();
        $connection->beginTransaction();

        try {
            $this->entityManager->refresh($challenge, LockMode::PESSIMISTIC_WRITE);
            $done = $step($challenge);
            $this->entityManager->flush();
            $connection->commit();

            return $done;
        } catch (Throwable $e) {
            $connection->rollBack();

            throw $e;
        }
    }

    private function text(PhoneNumber $phone, VerificationChallenge $challenge, #[SensitiveParameter] string $code, PhoneCodeRoute $route): void
    {
        $this->verificationCodeTexter->send($phone, $code);
        $challenge->texted($route);
        $this->record(self::countryOf($phone), $route);
        $this->entityManager->flush();
    }

    private function openCode(VerificationChallenge $challenge): string
    {
        return $this->secretBox->open((string) $challenge->getSealedCode());
    }

    private function record(?string $country, PhoneCodeRoute $route): void
    {
        $this->entityManager->persist(new PhoneCodeDelivery($country, $route, new DateTimeImmutable()));
    }

    private static function countryOf(PhoneNumber $phone): ?string
    {
        if (null !== $phone->getCountryCode()) {
            return $phone->getCountryCode();
        }

        try {
            $util = PhoneNumberUtil::getInstance();

            return $util->getRegionCodeForNumber($util->parse($phone->getNumber()));
        } catch (Throwable) {
            return null;
        }
    }
}
