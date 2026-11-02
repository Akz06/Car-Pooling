/**
 * Sends password-reset codes on WhatsApp through Zoho CPaaS.
 *
 * Zoho CPaaS WhatsApp API (https://www.zoho.com/cpaas/whatsapp-business-api.html):
 *   POST https://cpaas.zoho.com/v1.1/whatsapp
 *   Authorization: <Agent's Send API key>
 *   { "from": "<your WhatsApp number>", "to": "<customer number>",
 *     "template_key": "<approved template key>", "merge_info": { "<merge_key>": "<value>" } }
 *
 * Configure on the server (e.g. Railway variables):
 *   ZOHO_CPAAS_API_KEY        Send API key of your Agent (Agent → WhatsApp → API)
 *   ZOHO_WHATSAPP_FROM        your WhatsApp Business number, e.g. +919876543210
 *   ZOHO_WHATSAPP_TEMPLATE    Template key of an approved Authentication template
 *   ZOHO_WHATSAPP_CODE_FIELD  the template variable that holds the code (default: otp)
 *   ZOHO_CPAAS_URL            optional, defaults to https://cpaas.zoho.com/v1.1/whatsapp
 *
 * Without them, codes are written to the server log so the owner can still reset passwords.
 */
export interface OtpSender {
  send(phone: string, code: string, name: string): Promise<void>;
  readonly live: boolean;
}

const mask = (phone: string) => phone.replace(/^(\+\d{2})\d+(\d{3})$/, '$1•••••$2');

export function createOtpSender(env: Record<string, string | undefined> = process.env): OtpSender {
  const key = env.ZOHO_CPAAS_API_KEY?.trim();
  const from = env.ZOHO_WHATSAPP_FROM?.trim();
  const template = env.ZOHO_WHATSAPP_TEMPLATE?.trim();
  const field = env.ZOHO_WHATSAPP_CODE_FIELD?.trim() || 'otp';
  const url = env.ZOHO_CPAAS_URL?.trim() || 'https://cpaas.zoho.com/v1.1/whatsapp';

  if (!key || !from || !template) {
    return {
      live: false,
      async send(phone, code) {
        console.log(`[password reset] WhatsApp not configured yet — code for ${mask(phone)}: ${code} (valid 10 minutes)`);
      },
    };
  }

  return {
    live: true,
    async send(phone, code) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: key },
          body: JSON.stringify({ from, to: phone, template_key: template, merge_info: { [field]: code } }),
          signal: AbortSignal.timeout(15_000),
        });
        const body = await res.text();
        if (!res.ok) throw new Error(`Zoho CPaaS ${res.status}: ${body.slice(0, 400)}`);
        console.log(`[password reset] WhatsApp code sent to ${mask(phone)}`);
      } catch (err) {
        // Keep resets possible for the owner even if WhatsApp fails.
        console.error(`[password reset] WhatsApp send failed (${(err as Error).message}). Code for ${mask(phone)}: ${code}`);
      }
    },
  };
}
