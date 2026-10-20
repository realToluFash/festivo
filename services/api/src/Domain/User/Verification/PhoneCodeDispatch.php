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
            $this->text($phone, $issued->challenge, $issued->code, $phone->wantsCodesByText() ? PhoneCodeRoute::SmsPreferred : PhoneCodeRoute::SmsOnly);

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
    public function fallBackIfDue(PhoneNumber $phone): bool
    {
        $live = $this->verificationChallengeRepository->findLiveFor($phone);

        return null !== $live && $this->fallBack($live, failed: false);
    }

    /** "Text it to me instead": the same code once, for as long as it is live, and later codes by text too. */
    public function textInstead(PhoneNumber $phone): void
    {
        $live = $this->verificationChallengeRepository->findLiveFor($phone);
        $sent = null !== $live && $this->underLock($live, function (VerificationChallenge $challenge) use ($phone): bool {
            if (!$challenge->mayBeTexted()) {
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

    /** Meta's report, for the code it names and only while that code is live: never a newer one. */
    public function reported(string $messageId, string $status): void
    {
        $challenge = $this->verificationChallengeRepository->findOneBy(['whatsAppMessageId' => $messageId]);

        if (null === $challenge) {
            return;
        }

        if ('failed' === $status) {
            $this->fallBack($challenge, failed: true);
        } elseif ('delivered' === $status || 'read' === $status) {
            $this->underLock($challenge, static function (VerificationChallenge $locked): bool {
                $locked->deliveredByWhatsApp();

                return true;
            });
        }
    }

    /** @return int how many waiting past the 30 seconds were texted: the backstop when no screen is polling */
    public function fallBackAllDue(): int
    {
        $due = $this->verificationChallengeRepository->findAwaitingWhatsAppSince(new DateTimeImmutable('-' . self::FALLBACK_SECONDS . ' seconds'));
        $texted = 0;

        foreach ($due as $challenge) {
            $texted += $this->fallBack($challenge, failed: false) ? 1 : 0;
        }

        $this->verificationChallengeRepository->forgetLapsedCodes();

        return $texted;
    }

    public function routeOf(PhoneNumber $phone): ?PhoneCodeRoute
    {
        return $this->verificationChallengeRepository->findNewestFor($phone)?->getRoute();
    }

    /** Under the challenge's row lock, so a poll, a report and the backstop text it once between them. */
    private function fallBack(VerificationChallenge $challenge, bool $failed): bool
    {
        $phone = $challenge->getPhoneNumber();
        $silentSince = new DateTimeImmutable('-' . self::FALLBACK_SECONDS . ' seconds');

        return null !== $phone && $this->underLock($challenge, function (VerificationChallenge $locked) use ($phone, $failed, $silentSince): bool {
            if (!$locked->fallbackDue($failed, $silentSince)) {
                return false;
            }

            $this->text($phone, $locked, $this->openCode($locked), PhoneCodeRoute::SmsFallback);

            return true;
        });
    }

    /** @param callable(VerificationChallenge): bool $step */
    private function underLock(VerificationChallenge $challenge, callable $step): bool
    {
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
