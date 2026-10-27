<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Channel;

use App\Domain\Messaging\Exception\Unreachable;
use App\Domain\Messaging\Interfaces\ChannelSenderInterface;
use App\Domain\Messaging\Model\Recipient;
use App\Domain\Messaging\Model\RenderedNotification;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Uid\Uuid;

/** SMTP takes no idempotency key, so the delivery id is the Message-ID: a second send of one delivery is the same message to the receiving end. */
final readonly class EmailSender implements ChannelSenderInterface
{
    public function __construct(
        private MailerInterface $mailer,
        private string $mailFrom,
    ) {
    }

    public function channel(): NotificationChannel
    {
        return NotificationChannel::Email;
    }

    public function send(Uuid $deliveryId, Recipient $recipient, NotificationCategory $category, RenderedNotification $notification): ?string
    {
        $address = $recipient->emailAddress ?? throw new Unreachable('No email address.');
        $messageId = $deliveryId->toRfc4122() . '@notifications.soirely';
        $email = new Email()
            ->from(Address::create($this->mailFrom))
            ->to($address)
            ->subject($notification->subject)
            ->text($notification->body);
        $email->getHeaders()->addIdHeader('Message-ID', $messageId);

        $this->mailer->send($email);

        return $messageId;
    }
}
