/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { acceptedLanguages, negotiateLanguages } from 'fluent-langneg'
import AppConstants from '../app-constants.js'

import { getSubscribersByHashes } from '../db/tables/subscribers.js'
import { getEmailAddressesByHashes } from '../db/tables/email_addresses.js'
import { getEmailTemplate } from '../emails/templates/email-2022.js'
import { breachAlertEmailPartial } from '../emails/partials/email-breach-alert.js'

import { getMessage } from '../utils/fluent.js'
import {
  getAddressesAndLanguageForEmail,
  getBreachByName,
  loadBreachesIntoApp
} from '../utils/hibp.js'
import mozlog from '../utils/log.js'

const log = mozlog('controllers.hibp')

/**
 * Whenever a breach is detected on the HIBP side, HIBP sends a request to this endpoint.
 * This function attempts to retrieve the breach info from the local cache, if not found
 * it retrieves it from the database
 * A breach notification contains the following parameters:
 * - breachName
 * - hashPrefix
 * - hashSuffixes
 * More about how account identities are anonymized: https://blog.mozilla.org/security/2018/06/25/scanning-breached-accounts-k-anonymity/
 */
async function notify (req, res) {
  if (!req.token || req.token !== AppConstants.HIBP_NOTIFY_TOKEN) {
    const errorMessage = 'HIBP notify endpoint requires valid authorization token.'
    throw new Error(errorMessage)
  }
  if (!['breachName', 'hashPrefix', 'hashSuffixes'].every(req.body?.hasOwnProperty, req.body)) {
    throw new Error('HIBP breach notification: requires breachName, hashPrefix, and hashSuffixes.')
  }

  const { breachName, hashPrefix, hashSuffixes } = req.body

  let breachAlert = getBreachByName(req.app.locals.breaches, breachName)

  if (!breachAlert) {
    // If breach isn't found, try to reload breaches from HIBP
    log.debug('notify', 'Breach is not found, reloading breaches...')
    await loadBreachesIntoApp(req.app)
    breachAlert = getBreachByName(req.app.locals.breaches, breachName)
    if (!breachAlert) {
      // If breach *still* isn't found, we have a real error
      throw new Error('Unrecognized breach: ' + breachName)
    }
  }

  const { IsVerified, Domain, IsFabricated, IsSpamList } = breachAlert

  // If any of the following conditions are not satisfied:
  // Do not send the breach alert email! The `logId`s are being used for
  // logging in case we decide to not send the alert.
  const emailDeliveryConditions = [
    {
      logId: 'isNotVerified',
      condition: !IsVerified
    },
    {
      logId: 'domainEmpty',
      condition: Domain === ''
    },
    {
      logId: 'isFabricated',
      condition: IsFabricated
    },
    {
      logId: 'isSpam',
      condition: IsSpamList
    }
  ]

  const unsatisfiedConditions = emailDeliveryConditions.filter(condition => (
    !condition.condition
  ))
  const doNotSendEmail = unsatisfiedConditions?.length > 0

  if (doNotSendEmail) {
    // Get a list of the failed condition `logId`s
    const conditionLogIds = unsatisfiedConditions
      .map(condition => condition.logId)
      .join(', ')

    log.info('Breach alert email was not sent.', {
      name: breachAlert.Name,
      reason: `The following conditions were not satisfied: ${conditionLogIds}.`
    })

    return res.status(200).json({
      info: 'Breach loaded into database. Subscribers not notified.'
    })
  }

  // TODO: Send email notification to affected subscribers after loading new breaches.
  try {
    const reqHashPrefix = hashPrefix.toLowerCase()
    const hashes = hashSuffixes.map(suffix => reqHashPrefix + suffix.toLowerCase())
    const subscribers = await getSubscribersByHashes(hashes)
    const emailAddresses = await getEmailAddressesByHashes(hashes)
    const recipients = subscribers.concat(emailAddresses)

    log.info('notification', {
      // TODO: Should we convert HIBP response keys to lowercase
      breachAlertName: breachAlert.Name,
      length: recipients.length
    })

    const utmCampaignId = 'breach-alert'
    const notifiedRecipients = []

    for (const recipient of recipients) {
      log.info('notify', { recipient })

      // Get subscriber ID from:
      // - `subscriber_id`: if `email_addresses` record
      // - `id`: if `subscribers` record
      const subscriberId = recipient.subscriber_id || recipient.id
      const {
        recipientEmail,
        breachedEmail,
        signupLanguage
      } = getAddressesAndLanguageForEmail(recipient)

      const requestedLanguage = signupLanguage
        ? acceptedLanguages(signupLanguage)
        : ''

      const availableLanguages = req.app.locals.AVAILABLE_LANGUAGES
      const supportedLocales = negotiateLanguages(
        requestedLanguage,
        availableLanguages,
        { defaultLocale: 'en' }
      )

      // TODO: Add localized strings
      if (!notifiedRecipients.includes(breachedEmail)) {
        const data = {
          ctaHref: 'ctaHref',
          heading: getMessage('email-spotted-new-breach'),
          partial: {
            name: 'email-breach-alert'
          },
          recipientEmail,
          subheading: 'subheading',
          subscriberId,
          supportedLocales,
          unsubscribeUrl: 'unsubscribeUrl',
          utmCampaign: utmCampaignId
        }

        const emailPartial = breachAlertEmailPartial(data)
        const emailTemplate = getEmailTemplate(data, emailPartial)
        const subject = getMessage('breach-alert-subject')

        // TODO: Use new email util
        await sendEmail(recipientEmail, subject, emailTemplate)

        notifiedRecipients.push(breachedEmail)
      }
    }

    log.info('notified', { length: notifiedRecipients.length })

    // TODO: Use unified success and error responses
    res.status(200)
    res.json({
      info: 'Notified subscribers of breach.'
    })
  } catch (error) {
    throw new Error(`Notifying subscribers of breach failed: ${error}`)
  }
}

export { notify }
