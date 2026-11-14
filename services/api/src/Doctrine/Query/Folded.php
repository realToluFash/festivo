<?php

declare(strict_types=1);

namespace App\Doctrine\Query;

use Doctrine\ORM\Query\AST\Functions\FunctionNode;
use Doctrine\ORM\Query\AST\Node;
use Doctrine\ORM\Query\Parser;
use Doctrine\ORM\Query\SqlWalker;
use Doctrine\ORM\Query\TokenType;
use Psl\Str;

/** `FOLDED(x)`: x in lower case without its marks, so "Ọlọ́run" reads "olorun"; ø and its kin have no NFD form, so are translated. */
final class Folded extends FunctionNode
{
    private const string UNDECOMPOSED = 'ØøĐđŁłĦħ';

    private const string PLAIN = 'OoDdLlHh';

    public Node $text;

    public function getSql(SqlWalker $sqlWalker): string
    {
        return Str\format(
            "LOWER(REGEXP_REPLACE(NORMALIZE(TRANSLATE(%s, '%s', '%s'), NFD), '[\\u0300-\\u036f]', '', 'g'))",
            $sqlWalker->walkStringPrimary($this->text),
            self::UNDECOMPOSED,
            self::PLAIN,
        );
    }

    public function parse(Parser $parser): void
    {
        $parser->match(TokenType::T_IDENTIFIER);
        $parser->match(TokenType::T_OPEN_PARENTHESIS);
        $this->text = $parser->StringPrimary();
        $parser->match(TokenType::T_CLOSE_PARENTHESIS);
    }
}
