<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One payment a reminder named. The payment is not a foreign key: a payment removed since still reads "No longer on the schedule", by its vendor, what it was for and its amount then. */
#[ORM\Entity]
#[ORM\Table(name: 'payment_reminder_send_rows')]
#[ORM\Index(name: 'idx_payment_reminder_send_row_event', columns: ['event_id'])]
class PaymentReminderSendRow
{
    #[ORM\Id]
    #[ORM\ManyToOne(targetEntity: PaymentReminderSend::class)]
    #[ORM\JoinColumn(name: 'send_id', nullable: false, onDelete: 'CASCADE')]
    private PaymentReminderSend $send;

    #[ORM\Id]
    #[ORM\Column(type: Types::INTEGER)]
    private int $position;

    #[ORM\Column(type: 'uuid')]
    private Uuid $paymentId;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 400)]
    private string $vendorName;

    #[ORM\Column(type: Types::STRING, length: 400)]
    private string $description;

    #[ORM\Column(type: Types::BIGINT)]
    private string $amountMinor;

    public function __construct(PaymentReminderSend $send, int $position, Uuid $paymentId, Event $event, string $vendorName, string $description, int $amountMinor)
    {
        $this->send = $send;
        $this->position = $position;
        $this->paymentId = $paymentId;
        $this->event = $event;
        $this->vendorName = $vendorName;
        $this->description = $description;
        $this->amountMinor = (string) $amountMinor;
    }

    public function getSend(): PaymentReminderSend
    {
        return $this->send;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function getPaymentId(): Uuid
    {
        return $this->paymentId;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getVendorName(): string
    {
        return $this->vendorName;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getAmountMinor(): int
    {
        return (int) $this->amountMinor;
    }
}
