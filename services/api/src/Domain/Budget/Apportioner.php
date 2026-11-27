<?php

declare(strict_types=1);

namespace App\Domain\Budget;

use BcMath\Number;
use Psl\Dict;
use Psl\Iter;
use Psl\Type;
use Psl\Vec;

/** The largest remainder (Hamilton) method (sc-91, "Decided, 8 Nov"): each part rounded down to the minor unit, then one unit each to the parts that lost most, the earlier between equal remainders. The parts add up to the amount exactly. */
final readonly class Apportioner
{
    /**
     * @param list<Number> $weights in the order that settles a tie, the payer added first first
     *
     * @return list<Number> nothing to anyone when the weights come to 0
     */
    public static function apportion(Number $amount, array $weights): array
    {
        $whole = Iter\reduce($weights, static fn (Number $all, Number $one): Number => $all->add($one), new Number(0));

        if ($whole->compare(0) <= 0) {
            return Vec\map($weights, static fn (): Number => new Number(0));
        }

        $divided = Vec\map($weights, static fn (Number $weight): array => $amount->mul($weight)->divmod($whole, 0));
        $parts = Vec\map($divided, static fn (array $one): Number => $one[0]);
        $left = (int) (string) Iter\reduce($parts, static fn (Number $all, Number $one): Number => $all->sub($one), $amount);
        $order = Vec\keys(Dict\sort($divided, static fn (array $a, array $b): int => $b[1]->compare($a[1])));

        foreach (Vec\slice($order, 0, Type\uint()->assert($left)) as $index) {
            $parts[$index] = $parts[$index]->add(1);
        }

        return $parts;
    }
}
