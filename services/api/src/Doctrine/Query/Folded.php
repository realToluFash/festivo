<?php

declare(strict_types=1);

namespace App\Doctrine\Query;

use Doctrine\ORM\Query\AST\Functions\FunctionNode;
use Doctrine\ORM\Query\AST\Node;
use Doctrine\ORM\Query\Parser;
use Doctrine\ORM\Query\SqlWalker;
use Doctrine\ORM\Query\TokenType;
use Psl\Str;

/** `FOLDED(x)`: x in lower case without its accents, so "Lucía" and "LUCIA" both read "lucia" (sc-30302). Needs no extension. */
final class Folded extends FunctionNode
{
    private const string ACCENTED = 'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿ';

    private const string PLAIN = 'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYyy';

    public Node $text;

    public function getSql(SqlWalker $sqlWalker): string
    {
        return Str\format("LOWER(TRANSLATE(%s, '%s', '%s'))", $sqlWalker->walkStringPrimary($this->text), self::ACCENTED, self::PLAIN);
    }

    public function parse(Parser $parser): void
    {
        $parser->match(TokenType::T_IDENTIFIER);
        $parser->match(TokenType::T_OPEN_PARENTHESIS);
        $this->text = $parser->StringPrimary();
        $parser->match(TokenType::T_CLOSE_PARENTHESIS);
    }
}
