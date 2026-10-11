<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * The assistant's record of what it was asked and what it answered.
 *
 * A new table, so there are no rows predating it and nothing to backfill.
 *
 * Append-only by convention rather than by grant: the application has no
 * update or delete path, and the question these rows answer — why did the
 * assistant say that, and what did it cost — is one an editable table cannot
 * be trusted with.
 *
 * Reversible: down() drops the table, which discards the history. Fine while
 * this is unreleased; once there is a deployment with rows in it, reverting is
 * a decision about losing them rather than a schema change.
 */
final class Version20261011215815 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Records each turn asked of the assistant: prompt, provider, outcome and tokens.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE assistant_interaction (id UUID NOT NULL, occurred_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, actor_type VARCHAR(20) NOT NULL, actor_id UUID DEFAULT NULL, actor_label VARCHAR(180) DEFAULT NULL, session_id VARCHAR(64) DEFAULT NULL, context VARCHAR(40) NOT NULL, usage_feature VARCHAR(60) NOT NULL, provider VARCHAR(40) NOT NULL, model VARCHAR(80) NOT NULL, locale VARCHAR(8) NOT NULL, outcome VARCHAR(20) NOT NULL, system_prompt TEXT NOT NULL, user_prompt TEXT DEFAULT NULL, resource_context TEXT DEFAULT NULL, tools_offered JSON NOT NULL, tool_called VARCHAR(80) DEFAULT NULL, response TEXT DEFAULT NULL, input_tokens INT NOT NULL, output_tokens INT NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX idx_assistant_occurred ON assistant_interaction (occurred_at)');
        $this->addSql('CREATE INDEX idx_assistant_actor ON assistant_interaction (actor_type, actor_id)');
        $this->addSql('CREATE INDEX idx_assistant_session ON assistant_interaction (session_id)');
        $this->addSql('CREATE INDEX idx_assistant_feature ON assistant_interaction (usage_feature, occurred_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE assistant_interaction');
    }
}
