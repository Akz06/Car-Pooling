/**
 * Sends password-reset codes on WhatsApp.
 *
 * Until Zoho CPaaS is configured (ZOHO_* variables), the code is written to the
 * server log instead, so the owner can still reset passwords from Railway's logs.
 */
export interface OtpSender {
  send(phone: string, code: string, name: string): Promise<void>;
  readonly live: boolean;
}

export function createOtpSender(env = process.env): OtpSender {
  // Filled in from Zoho CPaaS's WhatsApp API docs once they are reachable.
  return {
    live: false,
    async send(phone, code) {
      const masked = phone.replace(/^(\+\d{2})\d+(\d{3})$/, '$1•••••$2');
      console.log(`[password reset] WhatsApp not configured yet — code for ${masked}: ${code} (valid 10 minutes)`);
      void env;
    },
  };
}
