/**
 * Spellful branded email template
 * Black & white, logo centered in header, clean minimal layout.
 * Used for all transactional emails sent from spellful.com
 */

const BASE_URL = 'https://spellful.com';
const EMAIL_HEADER_URL = 'https://spellful.com/airo-assets/images/email/header-banner';
const EMAIL_FOOTER_URL = 'https://spellful.com/airo-assets/images/email/footer-banner';

export interface EmailTemplateOptions {
  /** Short headline shown below the logo */
  heading: string;
  /** Main body paragraphs (plain strings, rendered as <p> tags) */
  paragraphs: string[];
  /** Optional CTA button */
  cta?: { label: string; url: string };
  /** Optional footer note (e.g. "If you didn't request this, ignore this email.") */
  footerNote?: string;
}

/**
 * Returns a complete HTML email string with the Spellful brand header.
 * Inline styles only — email clients strip <style> blocks.
 */
export function buildEmailHtml(opts: EmailTemplateOptions): string {
  const { heading, paragraphs, cta, footerNote } = opts;

  const paraHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#c8bfe8;font-family:Arial,Helvetica,sans-serif;">${p}</p>`,
    )
    .join('');

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
        <tr>
          <td style="border-radius:6px;background:#D9B85C;">
            <a href="${cta.url}"
               style="display:inline-block;padding:13px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#0B0614;text-decoration:none;letter-spacing:0.04em;min-height:44px;line-height:18px;">
              ${cta.label}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  const footerNoteHtml = footerNote
    ? `<p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:#888888;">${footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#0B0614;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#0B0614;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:600px;background:#1a1528;border-radius:12px;overflow:hidden;
                      border:1px solid #3d2f6e;">

          <!-- Header banner -->
          <tr>
            <td align="center" style="padding:0;line-height:0;">
              <a href="${BASE_URL}" style="display:block;line-height:0;">
                <img src="${EMAIL_HEADER_URL}" alt="Spellful" width="600"
                     style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
              </a>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 28px;">
              <h1 style="margin:0 0 20px 0;font-size:26px;font-weight:700;
                         color:#f0eaff;line-height:1.3;text-align:center;
                         font-family:Georgia,'Times New Roman',serif;">
                ${heading}
              </h1>
              ${paraHtml}
              ${ctaHtml}
              ${footerNoteHtml}
            </td>
          </tr>

          <!-- Footer banner -->
          <tr>
            <td align="center" style="padding:0;line-height:0;">
              <img src="${EMAIL_FOOTER_URL}" alt="" width="600"
                   style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
            </td>
          </tr>
          <!-- Legal footer -->
          <tr>
            <td align="center" style="padding:16px 32px 24px;background:#0B0614;">
              <p style="margin:0 0 6px 0;font-size:12px;color:#7a6fa0;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Spellful &nbsp;&middot;&nbsp;
                <a href="${BASE_URL}" style="color:#7a6fa0;text-decoration:underline;">spellful.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:#4a4060;font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
                Cast. Create. Explore.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text fallback — strips HTML, keeps the content readable.
 */
export function buildEmailText(opts: EmailTemplateOptions): string {
  const lines: string[] = [
    'Spellful — spellful.com',
    '',
    opts.heading,
    '',
    ...opts.paragraphs,
  ];
  if (opts.cta) {
    lines.push('', opts.cta.label + ': ' + opts.cta.url);
  }
  if (opts.footerNote) {
    lines.push('', opts.footerNote);
  }
  return lines.join('\n');
}
