# WhatsApp Cloud API Authentication and "invalid x-api-key" Errors

## Does Meta's WhatsApp Cloud API use x-api-key or Bearer Authorization?

### Takeaway
Meta's WhatsApp Cloud API (graph.facebook.com) authenticates exclusively via a Bearer token in the `Authorization` header. It does not use an `x-api-key` header. Any codebase sending `x-api-key` to graph.facebook.com is using the wrong authentication mechanism.

### Cited Findings
- Meta's official Get Started documentation shows the exact curl example: `Authorization: Bearer <SYSTEM_USER_ACCESS_TOKEN>` alongside `Content-Type: application/json` -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- Meta's developer blog confirms every request must set the Authorization header to "Bearer" followed by the access token, and omitting it returns a 401 Unauthorized -- [Meta Developer Blog: Auth Tokens](https://developers.facebook.com/blog/post/2022/12/05/auth-tokens)
- The Graph API also accepts the token as an `access_token` query parameter, though the Authorization header is the recommended method -- general Meta Graph API documentation pattern

### Inferences
- If a codebase is sending an `x-api-key` header to graph.facebook.com, the token will be ignored entirely because Meta does not read that header. The request would be treated as unauthenticated.

### Gaps
- Meta's documentation does not explicitly state what happens when an unrecognized header like `x-api-key` is sent. The behavior is inferred from the fact that only `Authorization: Bearer` or the `access_token` query parameter are documented as valid authentication methods.

---

## What is the exact format of the Authorization header?

### Takeaway
The required format is `Authorization: Bearer {access_token}` where `{access_token}` is either a temporary user token or a System User access token.

### Cited Findings
- Official curl example from Meta's Get Started docs: `-H 'Authorization: Bearer <SYSTEM_USER_ACCESS_TOKEN>'` against endpoint `https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages` -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- The API version in the URL path should be a current stable version (e.g., v23.0 as shown in Meta's latest examples) -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)

### Inferences
- The token value is opaque (not a JWT); it is a Meta-issued string that must be used exactly as generated.

### Gaps
- None for this question.

---

## What types of access tokens exist?

### Takeaway
There are three main token types: temporary user tokens (short-lived, for testing), System User tokens (long-lived or permanent, for production), and Business Integration System User tokens (for Tech Providers/Solution Partners).

### Cited Findings
- **Temporary access tokens:** Generated from the App Dashboard's WhatsApp API Setup page. Meta states they "expire quickly and are not suitable for development purposes" -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- **System User access tokens:** Created from Meta Business Settings > System Users. Require assigning the app (with "Manage app" permission) and WhatsApp Business Account, then generating a token with `business_management`, `whatsapp_business_messaging`, and `whatsapp_business_management` permissions -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- **Business Integration System User tokens:** Used by Tech Providers and some Solution Providers rather than direct developers -- [WooCommerce: How to Generate and Connect a Meta System User Access Token](https://woocommerce.com/?p=18734006930318)
- System User tokens can be generated with a "Never" expiry option, making them effectively permanent unless manually revoked -- [Digital Inspiration: How to Create an Access Token for WhatsApp API](https://digitalinspiration.com/docs/document-studio/apps/whatsapp/token)

### Inferences
- For any production integration, a System User token with no expiry is the standard approach. Temporary tokens should never be used in production code.

### Gaps
- None.

---

## How long do access tokens last before expiring?

### Takeaway
Temporary tokens expire within approximately 24 hours (sources vary between 1-24 hours). System User tokens can be set to never expire or to expire after 60 days, but Meta reserves the right to revoke any token at any time.

### Cited Findings
- Temporary tokens from the App Dashboard "expire quickly" per Meta's docs, with third-party sources reporting lifetimes of approximately 23-24 hours -- [esegece WhatsApp Token docs](https://www.esegece.com/help/sgcWebSockets_NET/Components/APIs/Other/Whatsapp/Configuration/WhatsApp_Token.htm)
- One source reports short-lived user tokens valid for 1-2 hours, conflicting with the 24-hour figure -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)
- System User tokens can be set to "Never" expire, commonly called "permanent tokens," but this means no scheduled expiry -- Meta can still revoke them -- [WooCommerce: Meta System User Access Token](https://woocommerce.com/?p=18734006930318)
- System User tokens can alternatively be set to expire after up to 60 days -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)
- Use the Access Token Debugger at developers.facebook.com/tools/debug/accesstoken to check any token's type, expiry, and permissions -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)

### Inferences
- The conflicting reports on temporary token lifetime (1-2 hours vs. 23-24 hours) suggest Meta may have changed the default, or different token generation methods yield different lifetimes. Always verify with the Access Token Debugger.

### Gaps
- Exact temporary token lifetime could not be confirmed from Meta's primary documentation. The official docs say only "expires quickly" without specifying hours.

---

## What error responses does Meta return for invalid/expired/missing tokens?

### Takeaway
Meta returns structured JSON errors with specific error codes: code 0 (AuthException) for general auth failures, code 190 for expired tokens, and codes 200-299 for permission errors. All auth errors return HTTP 401; permission errors return HTTP 403.

### Cited Findings
- **Error 0 (AuthException):** Message "Unable to Authenticate App User," HTTP 401. Caused by expired, invalidated, or revoked tokens. Fix: generate new System User token, test with Access Token Debugger -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)
- **Error 190:** Message "Access Token Has Expired," HTTP 401. Specifically means the token's expiry time has passed (not revocation). Fix: generate a new token, check server clock if new token also fails -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)
- **Errors 200-299:** Permission-related errors, HTTP 403. The token lacks required permissions or Meta removed them during policy review. Fix: check token permissions in Access Token Debugger, submit App Review if needed -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)
- Meta recommends building error-handling logic around the `code` and `details` fields in the JSON response rather than relying on HTTP status codes or error titles -- [ChakraHQ WhatsApp API Authorization Errors](https://chakrahq.com/help/chat/faqs/whatsapp-api-error-code-troubleshooting/whatsapp-api-authorization-errors)

### Inferences
- Meta's Graph API does NOT return an "invalid x-api-key" error because it does not recognize that header at all. If you send only `x-api-key` and no `Authorization` header, Meta would treat the request as having no token and return error code 0 (AuthException) or a similar authentication failure.

### Gaps
- The exact JSON error body Meta returns when NO authentication header is provided (as opposed to an expired token) could not be confirmed from the sources found. It likely returns error code 0 or 190 but this specific scenario is not documented distinctly.

---

## What error would Meta return if a codebase sends x-api-key instead of Authorization: Bearer?

### Takeaway
Meta would ignore the `x-api-key` header entirely and treat the request as unauthenticated, returning an OAuthException (error code 0) with HTTP 401. The error message would reference authentication failure, not "invalid x-api-key."

### Cited Findings
- Meta's Graph API only reads the `Authorization: Bearer` header or the `access_token` query parameter for authentication -- [Meta WhatsApp Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- No search results across Meta's developer documentation, Stack Overflow, or developer forums mention Meta returning an "invalid x-api-key" error -- multiple searches yielded no results
- An n8n community thread about Meta's Instagram Graph API shows "Cannot parse access token" errors when the token format is wrong -- [n8n Community: Critical Auth Error](https://community.n8n.io/t/critical-auth-error-cannot-parse-access-token-with-a-100-valid-meta-api-token-instagram/182073)

### Inferences
- If a developer is seeing an "invalid x-api-key" error, the request is NOT hitting Meta's graph.facebook.com directly. The error is coming from a third-party gateway, proxy, or middleware that sits between the codebase and Meta's API.
- Common culprits include: the codebase is configured for a third-party WhatsApp BSP (Business Solution Provider) instead of Meta's direct Cloud API, or there is an API gateway (e.g., AWS API Gateway, Kong, Apigee) in between that requires its own x-api-key.

### Gaps
- Could not find a documented Meta error response for a request with zero authentication headers. The error code is inferred to be 0 (AuthException) based on the general auth error pattern.

---

## Third-party WhatsApp services that use x-api-key headers

### Takeaway
Several third-party WhatsApp gateway services use `x-api-key` or similar custom API key headers instead of Bearer tokens, which is the most likely source of "invalid x-api-key" errors. Notable examples include YCloud, 360dialog (uses `D360-API-KEY`), and Namirial.

### Cited Findings
- **YCloud:** Uses `X-API-Key` header for authentication. A 401 UNAUTHORIZED means authentication failed; verify the X-API-Key header contains a valid key for the correct account and environment -- [YCloud: WhatsApp Errors](https://docs.ycloud.com/reference-link/whatsapp-errors)
- **360dialog:** Uses a custom header `D360-API-KEY` (not standard x-api-key). Invalid key errors suggest generating a new key and verifying it is passed in the correct header -- [360dialog: Error Messages](https://docs.360dialog.com/partner/support-and-updates/help-and-troubleshooting/error-messages)
- **Namirial:** Requires both Basic Auth and an `X-Api-Key` header. Returns 401 with "invalid-key" when the key value is wrong, and "missing-key" when the header is absent -- [Namirial: Authentication](https://docs.namirial.app/products/whatsapp/enterprise-documentation/developer-documentation/authentication)
- **WATI:** Uses `Authorization: Bearer` (same as Meta), NOT x-api-key -- [WATI: Authentication](https://docs.wati.io/reference/authentication)
- **Evolution API:** A Traccar forum thread asks about using `x-api-key` for Evolution API WhatsApp notifications, indicating this open-source API does use or can use x-api-key -- [Traccar Forum: Evolution API](https://www.traccar.org/forums/topic/authentication-method-x-api-key-for-sending-notifications-using-the-evolution-api/)

### Inferences
- The most common cause of "invalid x-api-key" errors in WhatsApp integrations is that the code is targeting a third-party BSP (YCloud, 360dialog, Namirial, or Evolution API) rather than Meta's direct Cloud API, or was migrated from one to the other without updating the authentication method.
- If the codebase was originally written for a BSP and later switched to Meta's direct Cloud API, the `x-api-key` header would need to be replaced with `Authorization: Bearer {token}`.

### Gaps
- **Twilio:** Could not confirm Twilio's WhatsApp API authentication header format from search results. Twilio typically uses Basic Auth (Account SID:Auth Token) for its REST API, not x-api-key, but this was not verified for the WhatsApp-specific endpoints.
- **MessageBird:** Search results confirm MessageBird uses an API key but do not specify which header carries it. Their general API uses `Authorization: AccessKey {key}`, but this was not confirmed for WhatsApp endpoints specifically.
