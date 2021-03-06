<?php

namespace Oro\Bundle\EmailBundle\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

/**
 * This is the class that validates and merges configuration from your app/config files
 *
 * To learn more see
 * {@link http://symfony.com/doc/current/cookbook/bundles/extension.html#cookbook-bundles-extension-config-class}
 */
class Configuration implements ConfigurationInterface
{
    /**
     * {@inheritDoc}
     */
    public function getConfigTreeBuilder()
    {
        $treeBuilder = new TreeBuilder();
        $rootNode    = $treeBuilder->root('oro_email');

        $rootNode
            ->children()
                ->arrayNode('email_sync_exclusions')
                    ->info('Determines which email address owners should be excluded during synchronization.')
                    ->example(['Oro\Bundle\UserBundle\Entity\User'])
                    ->treatNullLike([])
                    ->prototype('scalar')->end()
                ->end()
            ->end()
        ->end();

        return $treeBuilder;
    }
}
