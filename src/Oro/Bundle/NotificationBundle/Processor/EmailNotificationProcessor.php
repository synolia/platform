<?php

namespace Oro\Bundle\NotificationBundle\Processor;

use Doctrine\ORM\EntityManager;

use JMS\JobQueueBundle\Entity\Job;

use Psr\Log\LoggerInterface;

use Oro\Bundle\EmailBundle\Entity\EmailTemplate;
use Oro\Bundle\EmailBundle\Provider\EmailRenderer;

use Oro\Bundle\ConfigBundle\Config\ConfigManager;
use Oro\Bundle\NotificationBundle\Doctrine\EntityPool;

class EmailNotificationProcessor extends AbstractNotificationProcessor
{
    const SEND_COMMAND = 'swiftmailer:spool:send';

    /** @var EmailRenderer */
    protected $renderer;

    /** @var \Swift_Mailer */
    protected $mailer;

    /** @var string */
    protected $messageLimit = 100;

    /** @var ConfigManager */
    protected $cm;

    /** @var string */
    protected $env = 'prod';

    /**
     * Constructor
     *
     * @param LoggerInterface   $logger
     * @param EntityManager     $em
     * @param EntityPool        $entityPool
     * @param EmailRenderer     $emailRenderer
     * @param \Swift_Mailer     $mailer
     * @param ConfigManager     $cm
     */
    public function __construct(
        LoggerInterface $logger,
        EntityManager $em,
        EntityPool $entityPool,
        EmailRenderer $emailRenderer,
        \Swift_Mailer $mailer,
        ConfigManager $cm
    ) {
        parent::__construct($logger, $em, $entityPool);
        $this->renderer          = $emailRenderer;
        $this->mailer            = $mailer;
        $this->cm                = $cm;
    }

    /**
     * Set message limit
     *
     * @param int $messageLimit
     */
    public function setMessageLimit($messageLimit)
    {
        $this->messageLimit = $messageLimit;
    }

    /**
     * Set environment
     *
     * @param string $env
     */
    public function setEnv($env)
    {
        $this->env = $env;
    }

    /**
     * Applies the given notifications to the given object
     *
     * @param mixed                        $object
     * @param EmailNotificationInterface[] $notifications
     * @param LoggerInterface              $logger Override for default logger. If this parameter is specified
     *                                             this logger will be used instead of a logger specified
     *                                             in the constructor
     */
    public function process($object, $notifications, LoggerInterface $logger = null)
    {
        if (!$logger) {
            $logger = $this->logger;
        }

        foreach ($notifications as $notification) {
            /** @var EmailTemplate $emailTemplate */
            $emailTemplate = $notification->getTemplate();

            try {
                list ($subjectRendered, $templateRendered) = $this->renderer->compileMessage(
                    $emailTemplate,
                    array('entity' => $object)
                );
            } catch (\Twig_Error $e) {
                $logger->error(
                    sprintf(
                        'Rendering of email template "%s"%s failed. %s',
                        $emailTemplate->getSubject(),
                        method_exists($emailTemplate, 'getId') ? sprintf(' (id: %d)', $emailTemplate->getId()) : '',
                        $e->getMessage()
                    ),
                    array('exception' => $e)
                );

                continue;
            }

            $senderEmail = $this->cm->get('oro_notification.email_notification_sender_email');
            $senderName  = $this->cm->get('oro_notification.email_notification_sender_name');
            $type        = $emailTemplate->getType() == 'txt' ? 'text/plain' : 'text/html';
            $recipients  = $notification->getRecipientEmails();
            foreach ((array)$recipients as $email) {
                $message = \Swift_Message::newInstance()
                    ->setSubject($subjectRendered)
                    ->setFrom($senderEmail, $senderName)
                    ->setTo($email)
                    ->setBody($templateRendered, $type);
                $this->mailer->send($message);
            }

            $this->addJob(self::SEND_COMMAND);
        }
    }

    /**
     * Add swift mailer spool send task to job queue if it has not been added earlier
     *
     * @param string $command
     * @param array  $commandArgs
     *
     * @return Job
     */
    protected function createJob($command, $commandArgs = [])
    {
        $commandArgs = array_merge(
            [
                '--message-limit=' . $this->messageLimit,
                '--env=' . $this->env,
                '--mailer=db_spool_mailer',
            ],
            $commandArgs
        );

        return parent::createJob($command, $commandArgs);
    }
}
