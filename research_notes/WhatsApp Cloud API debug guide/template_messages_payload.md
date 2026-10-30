# WhatsApp Business API Template Message Requirements for Cold Outreach

## Template Approval Process

### Takeaway
Templates must be submitted to Meta for review and approval before they can be used. Approval is typically fast (minutes) but can take up to 24 hours; templates that violate content policies or are miscategorized are rejected.

### Cited Findings
- Templates must be submitted to Meta for approval before they are available for sending — [AISensy: WhatsApp Template Approval Process](https://m.aisensy.com/blog/whatsapp-template-approval-process/)
- Templates are sorted into categories (marketing, utility, authentication); miscategorization is a common rejection reason — [AISensy](https://m.aisensy.com/blog/whatsapp-template-approval-process/)
- Templates with variables must include example/sample values for the placeholders when submitting — [AISensy](https://m.aisensy.com/blog/whatsapp-template-approval-process/)
- Template approval generally takes 1-5 minutes; pending templates may take up to 24 hours — [AISensy](https://m.aisensy.com/blog/whatsapp-template-approval-process/) (vendor-reported, treat as anecdotal)
- There is a cap of 250 message templates per WhatsApp Business Account, with content field capped at 1024 characters — [360dialog docs](https://docs.360dialog.com/partner/messaging/template-messages)
- Templates must not request sensitive data (passwords, card numbers, etc.) — [YCloud: Common Rejection Reasons](https://www.ycloud.com/blog/common-whatsapp-api-template-message-rejection-reasons-with-fixes.md)
- Meta can review, approve, pause, and reject any template at any time — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)

### Inferences
- Plan for a few minutes of approval latency but build in a 24-hour buffer for new templates before campaigns.
- Keep templates aligned to their declared category (marketing for promos, utility for transactional) to avoid rejection.
- Always provide sample variable values when creating templates with placeholders.

### Gaps
- Meta's official documentation page for the template submission API was not fully accessible; exact field-level requirements for template creation payloads come from third-party sources.


## Required Fields in a Template Message Payload

### Takeaway
The payload requires `messaging_product`, `to`, `type`, and a `template` object containing `name`, `language` (with `code`), and optionally `components` for variable parameters. The endpoint is `POST /{phone_number_id}/messages`.

### Cited Findings
- Endpoint: `POST https://graph.facebook.com/v26.0/<PHONE_NUMBER_ID>/messages` — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- Required base fields: `messaging_product` (set to `"whatsapp"`), `recipient_type` (`"individual"` or `"group"`), `to` (recipient phone number), `type` (message type, here `"template"`) — [Meta Developer Docs: Messages Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)
- If your access token has messaging access to more than one Messaging account on the phone number, you must also include `messaging_account_id` — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- The template object includes `name` (approved template name), `language` with a `code` field (e.g., `"en"`, `"fr"`), and optionally `components` array for header, body, and button parameters — [8x8 Template Components Reference](https://developer.8x8.com/connect/docs/whatsapp/template-components-reference); [Exotel WhatsApp Template Messages](https://developer.exotel.com/docs/whatsapp-support/template-messages)
- Body component holds a `parameters` array; each entry is typed, e.g., `{ "type": "text", "text": "John" }` — [8x8 Template Components Reference](https://developer.8x8.com/connect/docs/whatsapp/template-components-reference)
- The body is the only required component and the only one that supports multiple parameters — [8x8 Template Components Reference](https://developer.8x8.com/connect/docs/whatsapp/template-components-reference)
- Header media uses `{ "type": "image", "image": { "link": "..." } }` — [Exotel WhatsApp Template Messages](https://developer.exotel.com/docs/whatsapp-support/template-messages)
- Language can include `policy: "deterministic"` when passed as an object — [Kapso SDK Docs](https://docs.kapso.ai/docs/whatsapp/typescript-sdk/templates)

### Example Payload (reconstructed from multiple sources)

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "221781234567",
  "type": "template",
  "template": {
    "name": "prospection_intro",
    "language": {
      "code": "fr"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "Moussa"
          },
          {
            "type": "text",
            "text": "votre entreprise"
          }
        ]
      }
    ]
  }
}
```

### Inferences
- The `template.name` and `template.language.code` must match the approved template exactly (case-sensitive).
- If the template has no variables, the `components` array can be omitted entirely.
- Parameters are positional: the first parameter fills `{{1}}`, the second fills `{{2}}`, etc.

### Gaps
- Meta's official reference page for the `TemplateMessage` schema was empty/inaccessible during research; the structure above is reconstructed from third-party BSP docs and is consistent across sources but should be verified against Meta's latest docs.


## Freeform Messages Outside the 24-Hour Window

### Takeaway
If you try to send a freeform (non-template) message to a number that has not messaged you within the last 24 hours, the message will fail with error 131047. Only approved template messages can be sent outside this window.

### Cited Findings
- A 24-hour customer service window opens when a user messages or calls you, and resets if they contact you again before it expires — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- When the window closes, you can only send pre-approved template messages; service/freeform messages are not allowed — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- Error 131047 (Re-engagement message): "More than 24 hours have passed since the recipient last replied." Fix: send a business-initiated message using an approved template — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)

### Inferences
- For cold prospecting, every first message MUST be a template message since there is no prior conversation window.
- After the prospect replies, you have 24 hours to send freeform follow-up messages.
- If 24 hours pass without a reply, you must use a template again for any subsequent outreach.

### Gaps
- None identified for this question.


## Common Payload Format Errors

### Takeaway
The most frequent failures are parameter count mismatches (132000), template not found (132001), parameter format mismatches (132012), and hydrated text too long (132005). These all result in immediate API rejection.

### Cited Findings
- **132000 (Template Param Count Mismatch):** Number of variable values doesn't match the template's variables — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- **132001 (Template does not exist):** Template isn't found in that language or isn't approved. Name and language locale must match exactly (case-sensitive) — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes); [yellow.ai Error Codes](https://docs.yellow.ai/docs/platform_concepts/channelConfiguration/WA-error-codes)
- **132005 (Template Hydrated Text Too Long):** After variable substitution, the text exceeds the length limit — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- **132007 (Template Format Character Policy Violated):** Template content violates a WhatsApp policy — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- **132012 (Template Parameter Format Mismatch):** Variable values don't follow the format defined in the template — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- **132015 (Template parameter invalid):** Parameters invalid or missing; check count, approval status, name and locale — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- **131009 (Parameter value is not valid):** Recipient isn't a valid WhatsApp number, or sender number hasn't been added to the platform — [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes)
- Line breaks should be written as `\n` and special characters must be escaped per JSON standards — [Kapso SDK Docs](https://docs.kapso.ai/docs/whatsapp/typescript-sdk/templates)

### Inferences
- Most template errors stem from mismatches between the payload and the approved template (wrong name, wrong language code, wrong parameter count).
- Always validate the payload against the template definition before sending.
- Template names and language codes are case-sensitive.

### Gaps
- No official Meta documentation for error code descriptions was accessible; all codes come from third-party mirrors of Meta's error reference.


## E.164 Phone Number Format and the + Prefix

### Takeaway
Meta's API accepts phone numbers with or without the `+` prefix but "highly recommends" including it. Numbers should include the country calling code. Without the `+`, Meta prepends the sender's country code, which can cause misdelivery.

### Cited Findings
- Plus signs (`+`), hyphens, parentheses, and spaces are accepted in the `to` field — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- Meta "highly recommends" including the plus sign and country calling code — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- If the `+` is omitted, the business phone number's country calling code is prepended, which can cause misdelivery. Example: `(631) 555-1234` from an Indian business became `+916315551234` — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- Brazil and Mexico numbers may have a prefix modified by the Cloud API (standard behavior) — [Meta Developer Docs: Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)

### Inferences
- Best practice: always send numbers in full E.164 format with the `+` prefix to avoid ambiguity.
- Strip all spaces, hyphens, and parentheses before sending to be safe, even though Meta accepts them.
- The API does NOT require a clean numeric-only format, but sending one eliminates edge cases.

### Gaps
- None; this came directly from Meta's official documentation.


## Senegal (+221) Specific Formatting

### Takeaway
Senegalese phone numbers are 9 digits after the country code (+221). Mobile numbers start with 7, landlines with 3. The full E.164 format is `+221NXXXXXXXX` where N is 3 or 7.

### Cited Findings
- Senegal's country code is +221, assigned by the ITU under E.164 — [Wikipedia: Telephone numbers in Senegal](https://en.wikipedia.org/wiki/Telephone_numbers_in_Senegal)
- Mobile numbers follow the format 7XX XXX XXX (9 digits); landlines follow 3XX XXX XXX — [sent.dm: Senegal Phone Numbers](https://www.sent.dm/resources/sn)
- Validation regex: `/^\+221[37]\d{8}$/` — example: `778 688 219` becomes `+221778688219` — [sent.dm: Senegal Phone Numbers](https://www.sent.dm/resources/sn)
- There is no national trunk prefix to strip (no leading 0 to remove) — [Wikipedia: Telephone numbers in Senegal](https://en.wikipedia.org/wiki/Telephone_numbers_in_Senegal)

### Inferences
- For Senegal, the full number should always be `+221` followed by exactly 9 digits starting with 7 (mobile) or 3 (landline).
- WhatsApp is used primarily on mobile, so expect numbers starting with `+2217`.
- Common operators: Orange (76, 77, 78), Free/Tigo (76, 70), Expresso (70). Validate that the second digit is consistent with known operator ranges.
- Unlike some countries (e.g., Cote d'Ivoire), Senegal has NOT recently had a number-length migration, so formatting should be stable.

### Gaps
- No WhatsApp-specific Senegal formatting issues were found in any source. This suggests no known country-specific quirks beyond standard E.164 compliance.


## Meta Error Codes Reference (Template & Phone Related)

### Takeaway
Key error codes to handle: 131047 (outside 24h window), 132001 (template not found/not approved), 132000 (param count mismatch), 132012 (param format mismatch), 131009 (invalid phone number), and 132007 (policy violation).

### Cited Findings

| Code | Name | Cause | Fix |
|------|------|-------|-----|
| 131047 | Re-engagement message | >24h since recipient last replied | Send approved template message |
| 132000 | Template Param Count Mismatch | Variable count doesn't match template | Include all required variable values |
| 132001 | Template does not exist | Template not found in language or not approved | Verify name, language code (case-sensitive), approval status |
| 132005 | Template Hydrated Text Too Long | Substituted text exceeds length limit | Shorten variable values or template text |
| 132007 | Template Format Character Policy Violated | Content violates WhatsApp policy | Review rejection reasons, revise content |
| 132012 | Template Parameter Format Mismatch | Variable values don't match required format | Format values as template specifies |
| 132015 | Template parameter invalid | Parameters invalid or missing | Check count, approval, name, locale |
| 131009 | Parameter value is not valid | Invalid WhatsApp number or unregistered sender | Verify both numbers |
| 131021 | Recipient cannot be sender | Sender and recipient are the same number | Use a different recipient |
| 131026 | Recipient cannot receive message | Recipient's WhatsApp version too old | Ask recipient to update |
| 133010 | Phone number Not Registered | Number not registered on WA Business Platform | Register number first |

Sources: [Kaleyra Cloud API Error Codes](https://developers.kaleyra.io/docs/cloud-api-error-codes); [yellow.ai Error Codes](https://docs.yellow.ai/docs/platform_concepts/channelConfiguration/WA-error-codes)

### Inferences
- Error 132001 is the most likely culprit when a template message fails: it covers wrong name, wrong language, AND unapproved templates in one code.
- There is no separate error code for "unapproved template" vs. "wrong template name" — both return 132001.
- For phone errors, 131009 is the general "bad number" code; there is no specific "wrong E.164 format" code — the API simply treats it as an invalid parameter.

### Gaps
- Meta's official error reference page was not directly accessible (it redirected to a page about the On-Premises API sunset). All codes come from third-party mirrors.
- No specific error code for "template paused" status was found.


## Legality of Cold Prospecting via WhatsApp Business API

### Takeaway
WhatsApp Business API requires explicit opt-in before sending business-initiated messages. Pure cold outreach (messaging people who have not consented) violates Meta's policy and risks account restrictions or permanent bans. However, the platform CAN be used for outreach if opt-in is obtained first through other channels.

### Cited Findings
- Outside the 24-hour window, a business needs the user's explicit opt-in before starting a conversation — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)
- Consent must be explicit and documented; accepted methods include website checkboxes, IVR prompts, in-store QR codes, forms, and Click-to-WhatsApp ads — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)
- Unsolicited messages can lead to user blocks, spam reports, or account suspensions — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)
- WhatsApp's algorithms detect patterns resembling automation or unsolicited outreach, leading to temporary restrictions or permanent bans — [Prospeo: WhatsApp Cold Outreach](https://prospeo.io/s/whatsapp-cold-outreach)
- Sources recommend using WhatsApp as a second or third touch, after a reply, an introduction, or a booked call — [Rework: WhatsApp for B2B Outreach](https://resources.rework.com/libraries/outbound-prospecting/whatsapp-for-b2b-outreach)
- Every message should include opt-out instructions (e.g., "Reply STOP to unsubscribe"); opt-outs must be honored immediately — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)
- Under GDPR, consent must be freely given, specific, and revocable — [ChakraHQ Compliance Guide](https://chakrahq.com/help/learning-centre/whatsapp-business-api/understanding-compliance-policies-and-consent)

### Inferences
- Technically, the API will deliver a template message to any valid WhatsApp number regardless of prior consent — the enforcement is reactive (spam reports, blocks, quality rating drops) rather than preventive.
- For Senegal/West Africa: GDPR does not directly apply, but Senegal has its own data protection law (Loi n° 2008-12) administered by the CDP (Commission des Données Personnelles). Consent requirements are similar in principle.
- A practical approach: collect opt-in via a landing page, CTWA ad, or web form BEFORE sending WhatsApp messages. This makes the outreach compliant while still being proactive.
- Quality rating matters: if too many recipients report or block your messages, Meta will lower your quality rating, throttle your sending limits, and potentially restrict your number.

### Gaps
- Senegal's specific data protection law (Loi n° 2008-12) and its implications for WhatsApp marketing were not covered by any source found. Consult local legal counsel.
- Meta's official WhatsApp Business Messaging Policy document was not directly fetched; the compliance information comes from a third-party guide.


## Quick-Reference: Debugging Checklist

Before sending a template message, verify:

1. **Template is approved** — check status in WhatsApp Manager (not "pending", "rejected", or "paused")
2. **Template name matches exactly** — case-sensitive, no extra spaces
3. **Language code matches** — use the exact code from approval (e.g., `fr`, `en_US`, not `FR` or `french`)
4. **Parameter count matches** — count `{{1}}`, `{{2}}`, etc. in the template body; supply exactly that many
5. **Parameter types match** — text params for text variables, media params for header media
6. **Phone number is E.164** — `+221781234567` not `07 81 23 45 67`
7. **Phone number is on WhatsApp** — the API doesn't pre-check this; 131009 means the number is invalid
8. **Opt-in obtained** — documented consent from the recipient
9. **Opt-out mechanism included** — every marketing message should offer a way to unsubscribe
10. **JSON is valid** — escape special characters, use `\n` for line breaks, no trailing commas
