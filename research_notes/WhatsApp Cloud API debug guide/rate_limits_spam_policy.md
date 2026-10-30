# WhatsApp Cloud API Rate Limits, Messaging Limits, and Anti-Spam Policies for Cold Prospecting

## What are the messaging rate limits for WhatsApp Business API? (messages per second, per day)

### Takeaway
WhatsApp Cloud API enforces two distinct rate limits: a per-second throughput cap (default 80 mps per phone number, upgradable to 1,000 mps) and a per-day messaging limit on unique users contacted (set at the business portfolio level, starting at 250 unique users per rolling 24-hour period).

### Cited Findings
- Each registered business phone number gets up to 80 messages per second (mps) by default, and up to 1,000 mps via automatic upgrade or request. This throughput is inclusive of inbound and outbound messages and all message types. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- Messaging limits cap the number of unique WhatsApp user phone numbers your business can message outside a customer service window within a "moving 24-hour period." Limits are set per business portfolio and shared by all business phone numbers within a portfolio. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Standard API endpoints have a rate limit of 200 requests per hour per app per Messaging account. Active accounts with at least one registered phone number get 5,000 requests per hour. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- A phone number can send one message every 6 seconds to the same user (about 10 per minute or 600 per hour). Bursts of up to 45 messages in a 6-second window are allowed but borrow from future quota. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)

### Inferences
- The 80 mps throughput is the hard engineering cap; the daily unique-user limit is the compliance/quality cap. For cold prospecting, you will hit the daily unique-user limit long before the per-second throughput limit.
- The pair rate limit (1 message per 6 seconds to the same user) is irrelevant for cold outreach since you would typically send one or two messages per prospect.

### Gaps
- Meta does not publish the exact mechanism for automatic throughput upgrades from 80 to 1,000 mps beyond saying it is based on quality ratings.


## What are the messaging tier levels and how do you move between tiers?

### Takeaway
New business portfolios start at 250 unique users per day, progressing through 2,000, 10,000, 100,000, and Unlimited tiers. Moving from 250 to 2,000 requires completing a "scaling path" (business verification, partner verification, or sending 2,000 quality messages in 30 days). Tiers above 2,000 auto-upgrade within 6 hours when you use at least half your current tier with high-quality messages over 7 days.

### Cited Findings
- Tier levels: 250 (default for new portfolios), 2,000, 10,000, 100,000, and Unlimited. The API returns tiers as values like `TIER_250`. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Scaling paths to 2,000: (a) verify your business, (b) have your partner verify your business, or (c) send 2,000 delivered messages outside customer service windows to unique numbers within a 30-day moving period, using high-quality templates. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- After completing a path, Meta analyzes message quality. If approved, the limit rises to 2,000 immediately. If denied, the limit stays at its current level. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Automatic scaling (above 2,000): the limit goes up one level within 6 hours if both conditions are met: (1) you send high-quality messages across all numbers and templates, and (2) in the last 7 days, you used at least half your current limit. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Limit changes trigger a `business_capability_update` webhook. The field is `max_daily_conversations_per_business` in API v24.0+. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)
- Some sources report that Meta moved to 6-hour evaluation windows (down from 24-48 hours). -- [Singh Amandeep Blog](https://singhamandeep.com/?p=1381)
- Limits are now applied per business portfolio rather than per phone number, and a new number starts at whatever level the portfolio already has. -- [AISensy Blog](https://m.aisensy.com/blog/whatsapp-message-limits-guide/)

### Inferences
- For a new prospecting operation in Senegal, you would start at 250 unique contacts/day. Getting business verified is the fastest path to 2,000/day.
- To reach 10,000/day, you need to consistently use at least 1,000 contacts/day (half of 2,000) with high-quality templates for 7 days.
- The portfolio-level limit means adding more phone numbers does not increase your daily unique-user cap.

### Gaps
- Meta does not document how tiers decrease or what triggers a downgrade, beyond referencing quality.
- The exact definition of "high-quality messages" for scaling purposes is not specified numerically (e.g., minimum read rate, maximum block rate).


## What quality rating does Meta assign and how does it affect sending limits?

### Takeaway
Meta assigns quality ratings at both the template level (Green/Yellow/Red/Unknown) and the phone number level. Low quality ratings can cause templates to be paused or disabled, and at the account level can reduce messaging tier limits. Quality is measured from user feedback (blocks, reports) and engagement (read rates).

### Cited Findings
- GREEN (high quality): Little to no negative feedback. YELLOW (medium quality): Negative feedback from multiple users or low read-rates; "may soon become paused or disabled." RED (low quality): Same as yellow but more severe; can be sent but at risk. UNKNOWN: Newly created templates with no data yet. -- [Meta Template Quality Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)
- Quality ratings are set automatically from usage, customer feedback, and engagement signals collected over time. Specific thresholds or weighting are not published. -- [Meta Template Quality Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)
- If a template's status changes to anything other than APPROVED, it cannot be sent in template messages unless its APPROVED status is restored. -- [Meta Template Quality Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)
- One third-party source says recovery timelines are: Yellow to Green in 7-14 days of improved quality; Template Paused to Active in 7 days of no further issues. -- [Exotel Developer Docs](https://developer.exotel.com/docs/whatsapp-support/quality-rating) (third-party, not Meta)
- When quality drops to red at the account level, your messaging limit tier may be reduced and templates with poor quality may be paused. -- [Exotel Developer Docs](https://developer.exotel.com/docs/whatsapp-support/quality-rating) (third-party)

### Inferences
- For cold prospecting, template quality is a critical constraint. If many recipients block or report messages, templates will be paused and the account's messaging tier can be downgraded.
- The lack of published thresholds means you must monitor quality ratings proactively through WhatsApp Manager or the API and adjust strategy before hitting Red.

### Gaps
- Meta does not publish the exact block rate or report rate thresholds that trigger Yellow, Red, or Paused statuses.
- Meta does not document the exact relationship between template quality and account-level tier downgrades.
- Recovery timelines come from third-party sources only.


## Can Meta restrict or ban a business number for sending too many cold messages?

### Takeaway
Yes. Meta can restrict messaging limits, pause templates, or permanently ban a WhatsApp Business Account (WABA) for policy violations including unsolicited messaging. The enforcement sequence typically starts with warnings, progresses to limit reductions and template pausing, and can escalate to a full ban.

### Cited Findings
- Businesses that violate the WhatsApp Business Messaging Policy, the WhatsApp Commerce Policy, or the WhatsApp Business Terms of Service will initially receive a warning. Appeals can be made within 90 days of receiving a violation. -- [Respond.io Blog](https://respond.io/blog/whatsapp-business-banned)
- High negative feedback directly impacts your Quality Score, which can lead to reduced messaging limits and, ultimately, a ban. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- When recipients report messages as spam or block a sender, Meta's systems flag the account. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- A ban can be addressed by either appeal for early unblocking, or wait 30 days for automatic lift. -- [Wazzup24 Help](https://wazzup24.com/help/how-to-set-up/waba-bans/) (third-party)
- WhatsApp is testing new policies that count every message sent to non-responsive contacts against a monthly quota. The exact cap has not been disclosed. -- [Android Headlines](https://www.androidheadlines.com/?p=1244582); [TechEconomy.ng](https://www.techeconomy.ng/whatsapp-sets-messaging-limits-curb-spam)

### Inferences
- Cold prospecting carries substantial risk of restriction. Even with opt-in, if recipients do not engage, the feedback loop will degrade quality ratings and reduce messaging limits.
- The reported "non-responsive contact" quota, if enacted, would directly penalize cold outreach by counting unanswered messages against the business.

### Gaps
- The exact spam report threshold that triggers action is not published by Meta.
- The "non-responsive contact quota" policy is reported by news sources but its current status and exact parameters are unconfirmed.


## What is Meta's official policy on unsolicited business-initiated messages (cold outreach)?

### Takeaway
Meta's WhatsApp Business Messaging Policy requires explicit opt-in consent before sending proactive messages. "Implied" consent is not sufficient. Cold outreach to contacts who have not opted in violates this policy and risks enforcement action. However, the policy is enforced primarily through the quality feedback loop (blocks and reports) rather than upfront verification of consent.

### Cited Findings
- Businesses need explicit consent before sending proactive messages. "Implied" consent is not enough. The opt-in should state that the user agrees to receive WhatsApp messages from your specific business and list the message types. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- Opt-in proof must include: the method, a timestamp, and the exact consent wording. Businesses must be able to produce this on request. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- Accepted opt-in methods include website checkboxes (unchecked by default), customer starting a WhatsApp conversation, IVR phone opt-ins, SMS confirmation, and in-store sign-ups. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- Generic email or SMS opt-ins do not automatically cover WhatsApp. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- Business-initiated messages must use pre-approved templates categorized as Utility, Authentication, or Marketing. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)

### Inferences
- True cold outreach (no prior opt-in) technically violates Meta's policy. However, enforcement is reactive: Meta does not verify opt-in records proactively but acts on user complaints.
- In practice, many businesses send unsolicited messages and avoid enforcement by keeping block/report rates low through careful targeting, personalization, and volume management.
- This creates a gray zone: cold outreach is against policy but functionally tolerated if quality signals stay positive. This is a risk the business must consciously accept.

### Gaps
- Meta's official WhatsApp Business Messaging Policy text was not directly retrieved in this research. The findings above come from secondary sources interpreting that policy.
- No information was found on whether Meta proactively audits opt-in records or only acts on complaints.


## What are the opt-out requirements?

### Takeaway
Businesses must provide a clear way for recipients to opt out of future messages. While Meta does not prescribe a specific mechanism, best practices include an "unsubscribe" quick reply button or clear text instructions in every marketing template.

### Cited Findings
- Spotler's guide states that businesses must include opt-out mechanisms and honor requests promptly, as this is part of the WhatsApp Business Policy compliance requirements. -- [Spotler Blog](https://spotler.com/blog/what-are-the-rules-and-restrictions-for-whatsapp-marketing)
- Frequent, irrelevant, or purely promotional messages, even with opt-in, can cause high block rates and user reports. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)

### Inferences
- For cold prospecting, including an explicit opt-out mechanism in every first message is both a policy requirement and a practical necessity to keep block/report rates low.
- Recipients who opt out should be immediately removed from future campaigns. Failure to honor opt-outs would compound spam reports.

### Gaps
- No specific Meta documentation on opt-out requirements was retrieved. The requirement is consistently described by third-party sources but the exact policy text was not found.


## What happens if recipients report messages as spam? At what threshold does Meta act?

### Takeaway
Spam reports and blocks directly feed into Meta's quality rating system. As negative feedback accumulates, templates move from Green to Yellow to Red and can be paused or disabled. At the account level, messaging tiers can be reduced. Exact thresholds are not published by Meta.

### Cited Findings
- When recipients report messages as spam or block a sender, Meta's systems flag the account. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- Templates receive quality ratings of Green, Yellow, or Red based on feedback and engagement. Yellow means "may soon become paused or disabled." Red means "at risk of being paused or disabled soon." -- [Meta Template Quality Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-quality)
- Meta monitors blocks, reports, and spam classifications. High negative feedback lowers your Quality Score. -- [eGrow Blog](https://www.egrow.com/en/blog/meta-policy-whatsapp-business-2026)
- One vendor guide informally suggests keeping block rates below 2-3% to maintain Green quality, but this is not from Meta. -- [ChakraHQ Article](https://chakrahq.com/article/prevent-whatsapp-business-restriction/amp/)

### Inferences
- For cold prospecting, even a small percentage of recipients reporting spam can compound quickly at scale. Sending to 250 users/day with a 5% block rate means ~12 blocks per day, which could trigger Yellow within days.
- There is no published "safe" threshold. The safest approach is to monitor quality ratings in real time and pause campaigns immediately when Yellow is reached.

### Gaps
- Meta does not publish the exact block rate, report rate, or read-rate thresholds that trigger each quality level.
- The informal 2-3% block rate threshold comes from a single third-party vendor and is unverified.


## Are there specific restrictions for using WhatsApp Business API in Senegal or West Africa?

### Takeaway
Senegal is not on Meta's restricted country list and the WhatsApp Business API is available there. No Senegal-specific or West Africa-specific messaging restrictions were found. Standard global policies apply. Conversation-based pricing applies with Senegal-specific rates.

### Cited Findings
- Countries ineligible for WhatsApp Business API include Cuba, Iran, North Korea, Syria, and certain Ukrainian regions. Senegal is not on this list. -- [Deskpro Support](https://support.deskpro.com/en-US/guides/admin-guide/channels/whatsapp/whatsapp-country-restrictions)
- Meta charges WhatsApp Business API per conversation category. Kolonell lists approximate Senegal rates of 0.0294 EUR per marketing conversation, though figures from different articles on the same site conflict. -- [Kolonell Blog (EN)](https://kolonell.com/en/blog/whatsapp-business-api-meta-pricing-senegal-2026)
- Business verification in Senegal can use local registration documents (Trade Register / Registre du Commerce and NINEA). -- [Kolonell Blog (EN)](https://kolonell.com/en/blog/whatsapp-business-api-meta-pricing-senegal-2026)
- Account restrictions are not country-specific; they come from policy violations, spam, or verification problems. -- [ChakraHQ Article](https://chakrahq.com/article/whatsapp-api-account-restricted-or-blocked-find-out-why-and-how-to-resolve/)

### Inferences
- Operating in Senegal adds no extra regulatory burden from Meta's side. However, local data protection laws (Senegal's Loi n 2008-12 on personal data protection, enforced by the CDP - Commission des Donnees Personnelles) may impose additional consent and data handling requirements for marketing communications.
- The Senegal market context is favorable for WhatsApp business messaging given high WhatsApp penetration in the region, but this also means recipients are accustomed to the platform and may be more likely to report unwanted messages.

### Gaps
- Meta's official per-conversation pricing for Senegal was not retrieved from a primary source. Third-party figures conflict.
- Local Senegalese data protection requirements for WhatsApp marketing were not researched in depth here.


## What is the difference between "business-initiated" and "user-initiated" conversations for billing and limits?

### Takeaway
Business-initiated conversations start when the business sends a template message outside the 24-hour customer service window. User-initiated (service) conversations start when a customer messages the business. They differ in pricing (business-initiated costs more, especially marketing), template requirements (business-initiated requires approved templates), and free tier eligibility (first 1,000 service conversations per month are free).

### Cited Findings
- A user-initiated conversation starts when a customer messages the business, and business replies within 24 hours fall under it. Business-initiated conversations start when the business messages first, outside that window, and require a template message. -- [360dialog Docs](https://docs.360dialog.com/docs/waba-messaging/conversations)
- Business-initiated conversations have three sub-categories: Utility, Authentication, and Marketing. User-initiated is categorized as a Service conversation. -- [360dialog Docs](https://docs.360dialog.com/docs/waba-messaging/conversations)
- The first 1,000 user-initiated (service) conversations per WABA each month are free. Business-initiated conversations are not included in the free tier. -- [QuickReply.ai Blog](https://www.quickreply.ai/blog/understanding-whatsapp-business-conversation-based-pricing)
- Rates for business-initiated and user-initiated conversations vary by market (country/region). Charges are based on the country code of the recipient. -- [360dialog Docs](https://docs.360dialog.com/docs/waba-messaging/conversations)
- Messaging limits (unique users per 24h) apply only to business-initiated conversations. User-initiated conversations are not counted against this limit. -- [Meta Messaging Limits Documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)

### Inferences
- Cold prospecting is entirely business-initiated (Marketing category), which is the most expensive conversation type and the one subject to daily unique-user limits.
- There is no way to reframe cold outreach as user-initiated unless the prospect messages first (e.g., via click-to-WhatsApp ads or QR codes).
- The 1,000 free service conversations per month are irrelevant for outbound prospecting.

### Gaps
- Current Senegal-specific pricing for Marketing conversations was not retrieved from Meta's primary rate card.


## What HTTP status codes and error bodies does Meta return for rate limit violations (429)?

### Takeaway
Meta returns HTTP 429 for two distinct rate limit scenarios: error code 130429 for exceeding the Cloud API throughput limit (messages per second), and error code 131056 for exceeding the pair rate limit (too many messages to the same user). Retry strategies differ for each.

### Cited Findings
- If you attempt to send more messages than your current throughput level allows, the API returns error code 130429 ("Cloud API message throughput has been reached") until you are within your allowed level again. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- Exceeding the per-user steady rate triggers error code 131056 (pair rate limit) until sending falls back within the allowed rate. The steady rate is about one message per 6 seconds to the same user. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- Retry strategy for pair rate limit: retry after 4^X seconds, starting with X=0 and increasing X by 1 after each failure, until it succeeds. -- [Meta Cloud API Overview](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/)
- Third-party providers recommend honoring the `Retry-After` header when present, reducing concurrency, using exponential backoff with jitter, and capping retries by attempt count or deadline. -- [YCloud Docs](https://docs.ycloud.com/es/api-reference/guides/api-fundamentals/rate-limits)
- A 360dialog guide notes that 429 comes from request-per-second throttling, while 503 signals concurrent system load. Both should trigger a halt and queue-building. -- [360dialog Docs](https://docs.360dialog.com/docs/whatsapp-api/best-practice/capacity-quality-rating-and-messaging-limits)

### Inferences
- For a prospecting system, only error 130429 (throughput) is relevant since you would not send multiple rapid messages to the same prospect. Implement exponential backoff with jitter and a queue to handle 429 responses.
- The throughput limit (80 mps default) is generous for cold prospecting at the 250-2,000 unique users/day tier. You would need to spread sends over the day to stay within daily limits, not per-second limits.

### Gaps
- The exact JSON error body structure for 130429 was not retrieved from Meta's error code reference.
- Whether a `Retry-After` header is returned by Meta's Cloud API (vs. only by third-party BSP APIs) is unclear.


## Summary: Practical Implications for Cold Prospecting in Senegal

### Key Risk Factors
1. **Policy violation**: True cold outreach (no prior opt-in) violates Meta's WhatsApp Business Messaging Policy. Enforcement is reactive but real.
2. **Low starting capacity**: New accounts start at 250 unique users/day. Scaling to 10,000+/day requires weeks of consistently high-quality sending.
3. **Quality feedback loop**: Blocks and reports from cold recipients will degrade quality ratings, potentially pausing templates and reducing tier limits.
4. **No published thresholds**: Meta does not disclose the exact block/report rates that trigger enforcement, making it impossible to calculate a "safe" sending volume.
5. **Potential new anti-spam policies**: Reports suggest Meta is testing limits on messages to non-responsive contacts, which would directly penalize cold outreach.

### Recommended Mitigations
- Use click-to-WhatsApp ads or other inbound triggers to convert cold prospects into user-initiated conversations before engaging.
- If sending business-initiated messages, ensure template quality through personalization and clear value propositions.
- Monitor quality ratings daily via the API or WhatsApp Manager.
- Include clear opt-out mechanisms in every first message.
- Start with conservative volumes and scale only after confirming quality stays Green.
- Implement proper error handling with exponential backoff for 429/130429 errors.
- Maintain opt-in records with timestamps and consent wording in case of audit.
