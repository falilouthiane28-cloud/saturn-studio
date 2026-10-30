# Meta Graph API Version Requirements for WhatsApp Cloud API Message Sending

## What is the current Meta Graph API version as of 2026? What versions are still supported?

### Takeaway
As of October 2026, Meta Graph API v26.0 is the latest release. Versions v21.0 through v26.0 are currently supported; v20.0 and earlier have expired.

### Cited Findings
- v26.0 was released July 29, 2026, with expiration TBD (the latest available version) -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v25.0 was released February 18, 2026, expires July 29, 2028 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v24.0 was released October 8, 2025, expires February 18, 2028 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v23.0 was released May 29, 2025, expires October 8, 2027 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v22.0 was released January 21, 2025, expires May 20, 2027 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v21.0 was released October 2, 2024, expires January 21, 2027 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v20.0 expired September 24, 2026 (already past) -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v19.0 expired May 21, 2026 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v18.0 expired January 26, 2026 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v17.0 expired September 12, 2025 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- Each Graph API version is guaranteed to work for at least two years from its release date -- [Ayrshare: Meta Graph API Versioning Survival Kit](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/)

### Inferences
- Any integration still using v17, v18, v19, or v20 is calling an expired version and will fail. v21.0 is the oldest still-supported version but expires January 21, 2027.
- Meta releases roughly 3 versions per year (every ~4 months), so planning for version upgrades should be a recurring maintenance item.

### Gaps
- None. The version table is comprehensive and sourced from Meta's official documentation.

---

## What is the exact endpoint URL format for sending WhatsApp messages?

### Takeaway
The endpoint is `POST https://graph.facebook.com/v{VERSION}/{PHONE_NUMBER_ID}/messages` with a Bearer token in the Authorization header and Content-Type set to application/json.

### Cited Findings
- Endpoint format: `POST https://graph.facebook.com/{Version}/{Phone-Number-ID}/messages` -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)
- Required headers: `Authorization: Bearer <token>` and `Content-Type: application/json` (also accepts application/x-www-form-urlencoded and multipart/form-data) -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)
- Template creation uses a separate endpoint: `POST https://graph.facebook.com/v{VERSION}/{WABA_ID}/message_templates` -- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- The `/v1/messages` path seen in some documentation belongs to the older on-premises API, not the Cloud API -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)

### Inferences
- The `{PHONE_NUMBER_ID}` is not the phone number itself but the numeric ID assigned to the phone number in the WhatsApp Business Account settings.
- Using the wrong version in the URL path is a common cause of failures; the version must be a currently supported one (v21.0 through v26.0 as of October 2026).

### Gaps
- None.

---

## What happens if you use a deprecated API version? What error is returned?

### Takeaway
A request to an expired version returns HTTP 400 Bad Request. Third-party sources report error code 2635, but Meta's own documentation does not explicitly document this error code for deprecated versions.

### Cited Findings
- A request to a deprecated versioned endpoint returns a 400 Bad Request with a subcode indicating the version is no longer supported -- [Ayrshare: Meta Graph API Versioning Survival Kit](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/)
- Sample code from Ayrshare checks for HTTP 400 and error code 2635 as the deprecated-version indicator -- [Ayrshare: Meta Graph API Versioning Survival Kit](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/)
- The behavior is described as a hard failure, not an automatic upgrade to a newer version -- [Ayrshare: Meta Graph API Versioning Survival Kit](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/)
- For unversioned calls (no version in the URL path), the call defaults to the oldest available version tied to your app. If that version has expired, the call also fails -- [Ayrshare: Meta Graph API Versioning Survival Kit](https://www.ayrshare.com/solutions/meta-graph-api-versioning-survival-kit-staying-ahead-of-v21-v22-and-beyond/)
- Meta's own upgrade tool page and Graph API changelog do not explicitly document the error code for expired-version calls -- [Graph API Upgrade Tool](https://developers.facebook.com/docs/graph-api/advanced/api-upgrade)

### Inferences
- The safest diagnostic when messages fail is to inspect the full JSON error response body and compare the version in the request URL against Meta's version table.
- Unversioned calls are dangerous because they silently bind to whatever minimum version the app was configured with; if that version expires, all unversioned calls break.

### Gaps
- Meta's own documentation does not explicitly document error code 2635 or the exact JSON error response body for a deprecated version call. The 2635 code comes from a third-party source (Ayrshare) and could not be confirmed in official Meta docs.
- It is unclear whether Graph API expired-version calls are hard failures or auto-upgraded. The Marketing API does have auto-upgrade behavior, but this could not be confirmed for the general Graph API.

---

## Has Meta deprecated any versions between v17 and v21 that would break existing integrations?

### Takeaway
Yes. As of October 2026, v17.0 through v20.0 are all expired. v17 expired September 12, 2025; v18 expired January 26, 2026; v19 expired May 21, 2026; v20 expired September 24, 2026. Any integration using these versions will fail.

### Cited Findings
- v17.0: released May 23, 2023, expired September 12, 2025 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v18.0: released September 12, 2023, expired January 26, 2026 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v19.0: released January 23, 2024, expired May 21, 2026 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v20.0: released May 21, 2024, expired September 24, 2026 -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)
- v21.0: released October 2, 2024, expires January 21, 2027 (still supported) -- [Versions - Graph API](https://developers.facebook.com/docs/graph-api/changelog/versions/)

### Inferences
- If an integration was written against v17 and never updated, it has been broken since September 2025. The minimum safe version today is v21.0, though upgrading to v23.0 or later is recommended for longer runway.

### Gaps
- None.

---

## What are the minimum required fields in the POST body for a template message?

### Takeaway
The minimum required fields are: `messaging_product` (set to "whatsapp"), `to` (recipient phone number), `type` (set to "template"), and a `template` object containing `name` and `language.code`. The `components` array is needed only if the template has variables.

### Cited Findings
- Base required fields: `messaging_product` (string), `recipient_type` ("individual" or "group"), `to` (string), `type` (string) -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)
- Template object requires `name` (the template name) and a `language` object with a `code` field (e.g., "en_US") -- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- The `components` array is used to pass parameter values to templates that contain variables; templates without variables do not require components -- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- Optional field `context.message_id` can be included for replying to a specific message -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)

### Inferences
- While `recipient_type` is listed as required, most examples default to "individual" and some omit it. However, to be safe, always include it explicitly.
- Missing `language.code` is a common cause of template send failures. The code must match exactly what was used when the template was created (e.g., "en_US" not "en").

### Gaps
- Meta's reference page did not render the full TemplateMessage schema in the fetched content. The required vs. optional distinction for some fields comes from examples rather than a formal schema declaration.

---

## What is the exact JSON payload structure for sending a template-based WhatsApp message?

### Takeaway
The payload wraps the template inside a standard message envelope. Two styles exist: named parameters (using `parameter_name`) and positional parameters (order matches the placeholder order in the template).

### Cited Findings

**Minimal template send (no variables):**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505551234",
  "type": "template",
  "template": {
    "name": "hello_world",
    "language": {
      "code": "en_US"
    }
  }
}
```
(Inferred from base fields; no official example of a variable-free send was found.)

**Template send with named parameters:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505551234",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "first_name",
            "text": "Jessica"
          },
          {
            "type": "text",
            "parameter_name": "order_number",
            "text": "SKBUP2-4CPIG9"
          }
        ]
      }
    ]
  }
}
```
-- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)

**Template send with positional parameters:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+16505551234",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "en_US"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "text": "Jessica"
          },
          {
            "type": "text",
            "text": "SKBUP2-4CPIG9"
          }
        ]
      }
    ]
  }
}
```
-- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)

**Success response structure:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "+16505551234", "wa_id": "16505551234" }],
  "messages": [{ "id": "wamid.xxx", "message_status": "accepted" }]
}
```
-- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)

- `message_status` can be `accepted`, `held_for_quality_assessment`, or `paused` -- [Messages - WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/)
- Button components use `sub_type` (e.g., `quick_reply`, `url`, `copy_code`) and an `index` field -- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
- Parameter types include `text`, `currency`, `date_time`, and `image` -- [Template Fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)

### Inferences
- Named parameters (with `parameter_name`) are safer than positional ones because they survive template edits that reorder placeholders.
- The `type` field in parameters must match the placeholder type defined in the template (text, currency, date_time, image).

### Gaps
- No official example was found for a template with header image, button, or currency parameters in a single combined payload. These exist across separate documentation pages but not as one complete example.

---

## Are there any breaking changes between API versions that affect the message sending endpoint?

### Takeaway
Several version-gated breaking changes affect message sending, templates, or webhook handling between v17 and v26. The most impactful are error code changes in v17, authentication template structure changes in v21, a new error code in v23, and the removal of the `conversation` object from status webhooks in v24.

### Cited Findings

**v17.0 (May 23, 2023):**
- Sending a paused template now returns error code `132015` instead of `132001` -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- Sending a disabled template now returns error code `132016` instead of `132001` -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

**v21.0 (October 2, 2024):**
- For one-tap autofill and zero-tap authentication templates, `package_name` and `signature_hash` must be in the `supported_apps` array -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- Local storage must be enabled via the settings endpoint before registering a number -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

**v23.0 (May 29, 2025):**
- Error code `132018` added for invalid template parameters (additive, but affects error handling) -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

**v24.0 (October 8, 2025):**
- Status webhooks no longer include the `conversation` object (except during open Free Entry Point windows). Parsers expecting this object will break -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- Error `131059` added for invalid pagination cursor on the message templates endpoint -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- `messaging_limit_tier` now returns the business portfolio's limit instead of the phone number's -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

**Cross-version (all versions, by date):**
- May 1, 2023: All templates must use AUTHENTICATION, MARKETING, or UTILITY category -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- April 2024: Legacy authentication templates (without OTP buttons) can no longer be sent -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- February 2024: Per-user marketing template message limits were introduced -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- November 2024: Error `131050` added for messages not delivered due to user marketing preferences -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)
- April 2025: `allow_category_change` parameter is no longer supported on template creation -- [WhatsApp Changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)

### Inferences
- Most breaking changes are additive error codes or webhook field removals, not changes to the core /messages POST body structure. The basic template send format has remained stable across v17-v26.
- The biggest risk for existing integrations is error-handling code that matches on specific error codes (e.g., matching `132001` when it was split into `132015` and `132016` in v17).
- Webhook-consuming code is more fragile across versions than message-sending code.

### Gaps
- The WhatsApp changelog had no entries specific to v18, v19, v20, v22, v25, or v26 affecting the /messages endpoint. This likely means no breaking changes were introduced in those versions for message sending, but it could not be positively confirmed.
- No official Meta documentation was found that comprehensively lists all breaking changes per version in a single table. The information is spread across the WhatsApp changelog, Graph API changelog, and individual version announcement blog posts.
