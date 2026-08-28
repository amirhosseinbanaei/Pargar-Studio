// src/modules/contact/components/ContactScreen.tsx
/**
 * The contact page: where the studio is, and the one form on the public site.
 *
 * Ported from `legacy/js/ui/panel.js:447` — the tall band, the three-column detail grid,
 * and the drawn site plan. A Server Component; the only client JavaScript below it is the
 * form's own leaf.
 *
 * ─── THE SITE PLAN, AND THE OPEN DECISION IT SETTLES ──────────────────────────────
 * There is no embedded map and there never was. `legacy/js/ui/panel.js:508` draws
 * `court` at the FIXED seed `kavan-dezashib-site` and puts a pin over it — a picture of a
 * courtyard, captioned with the coordinates, rather than a third-party map with a
 * third-party script, a consent question and a tile bill. Both halves of that are kept:
 * the generator is `court` (not `contour`, which the brief guessed at), and the seed is a
 * FIXED STRING, not the coordinates and not the address. That is the open decision
 * resolved, and the legacy source resolves it the same way the reasoning does: seeding
 * from the address would silently redraw the plan the first time an editor fixes a typo in
 * it, and the drawing is not a depiction of the address in the first place.
 *
 * ─── LATIN RUNS ARE ISOLATED ──────────────────────────────────────────────────────
 * Phone, both email addresses, every social handle and the coordinate pair go through
 * `<Lat>`, which is `legacy/js/ui/panel.js:47`'s helper and the `.lat` rule already in
 * `i18n.css`. Without it the bidirectional algorithm reorders them against the Persian
 * around them at a line boundary, and `+98 21 2612 4180` comes apart into two halves.
 *
 * ─── THE SOCIALS ARE TEXT, NOT LINKS ──────────────────────────────────────────────
 * The legacy markup rendered them as `<a href="#">`. A placeholder href is a dead link,
 * and the record carries a platform name and a handle but no URL — so the honest port is
 * the name and the handle as text. Inventing `https://instagram.com/<handle>` would trade
 * a link that goes nowhere for a link that may go somewhere wrong. When the dashboard
 * grows a URL column, these become anchors.
 */
import { Lat } from '@/common/components/layout';
import { draw } from '@/common/lib/art';
import type { Dictionary } from '@/common/i18n';
import type { Contact } from '@/common/schemas/contact';
import { ContactForm } from './ContactForm';

/** `legacy/js/ui/panel.js:459` and `:508` — kind, seed and ratio, unchanged. */
const BAND = { kind: 'elevation', seed: 'kavan-dezashib-street', ratio: 0.4 } as const;
const PLAN = { kind: 'court', seed: 'kavan-dezashib-site', ratio: 0.62 } as const;

export interface ContactScreenProps {
  contact: Contact;
  dictionary: Dictionary;
}

/**
 * `locale` was a third prop until prompt 8. Its only job was reaching `ContactForm`, which
 * needed it to build a dictionary in the browser; the form reads both from
 * `NextIntlClientProvider` now, so the screen has nothing left to forward.
 */
export function ContactScreen({ contact, dictionary }: ContactScreenProps) {
  const { t, num, list } = dictionary;

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <div className="sheet">
          <section className="band band--tall">
            <div
              className="band__art"
              dangerouslySetInnerHTML={{ __html: draw(BAND.kind, BAND.seed, BAND.ratio) }}
            />
            <div className="band__cap">
              <span className="band__k">{contact.district}</span>
              <span className="band__v">{t('brand.name')}</span>
            </div>
          </section>

          <div className="cgrid">
            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.address')}</p>
                <p className="cblock__v">
                  {contact.address}
                  <br />
                  {list([contact.city, contact.country])}
                  <br />
                  {/* The postcode is shaped, not isolated: digits become Persian numerals
                      in Persian, so there is no Latin run left to isolate. */}
                  <span className="text-t-lo">{num(contact.postcode)}</span>
                </p>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.telephone')}</p>
                <p className="cblock__v">
                  {/* NOT shaped: a phone number is dialled, and Persian numerals in a
                      `tel:` label are read by nobody's dialler. */}
                  <a className="magnet" href={`tel:${contact.phoneHref}`}>
                    <Lat>{contact.phone}</Lat>
                  </a>
                </p>
              </div>
            </div>

            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.email')}</p>
                <p className="cblock__v">
                  <a className="magnet" href={`mailto:${contact.email}`}>
                    <Lat>{contact.email}</Lat>
                  </a>
                </p>
                <p className="cblock__v cblock__v--sm">
                  <a className="magnet" href={`mailto:${contact.press}`}>
                    <Lat>{contact.press}</Lat>
                  </a>
                  <span className="text-t-xlo">{` · ${t('contact.press')}`}</span>
                </p>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.hours')}</p>
                {/* NOT shaped, matching `legacy/js/ui/panel.js:494`: the postcode is a
                    figure, but the opening hours are prose the Persian record writes in
                    its own way, and a component does not re-space stored copy. */}
                <p className="cblock__v cblock__v--sm">{contact.hours}</p>
              </div>
            </div>

            <div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.elsewhere')}</p>
                <div className="socials">
                  {contact.socials.map(social => (
                    <span key={social.handle}>
                      {`${social.name} `}
                      <Lat>{social.handle}</Lat>
                    </span>
                  ))}
                </div>
              </div>
              <div className="cblock">
                <p className="cblock__k">{t('contact.careers')}</p>
                <p className="cblock__v cblock__v--sm">{contact.careers}</p>
              </div>
            </div>
          </div>

          <h2 className="sheet__h">{t('contact.findUs')}</h2>
          <div className="cmapwrap">
            <div className="cmap">
              <div dangerouslySetInnerHTML={{ __html: draw(PLAN.kind, PLAN.seed, PLAN.ratio) }} />
              <i className="cmap__pin" />
              <span className="cmap__note">
                {`${contact.district} — `}
                <Lat>{`${contact.lat}, ${contact.lng}`}</Lat>
              </span>
            </div>
            <div className="cmap__aside">
              <div className="prose">
                <p>{`${list([contact.address, contact.city])}.`}</p>
              </div>
            </div>
          </div>

          <h2 className="sheet__h">{t('form.write')}</h2>
          <p className="cblock__v cblock__v--sm">{t('form.intro')}</p>
          <div className="pt-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
