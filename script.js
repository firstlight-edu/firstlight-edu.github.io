// First Light — small interactions

// Mobile menu toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');

toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

// Close the mobile menu after a link is tapped
links.querySelectorAll('a').forEach((a) =>
  a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  })
);

// Header shadow once the page is scrolled
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Fade sections in as they scroll into view
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('visible'));
}

// Keep the footer year current
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   Contact details are assembled only in the browser, so the
   email and WhatsApp number never appear as plain text in the
   page source (this stops most spam bots from harvesting them).
   --------------------------------------------------------- */
const CONTACT = {
  email: () => ['firstlight', 'neha'].join('.') + '@' + ['gmail', 'com'].join('.'),
  // WhatsApp number stored reversed and split; rebuilt only after a visitor submits the form
  wa: () => ['5135', '8995', '9919'].join('').split('').reverse().join(''),
};

// Founders' private Google Sheet (add-only endpoint). Leave empty to disable.
const SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbxosr3sBT3MF7hzZgjEFiACJPxyN2jKKXnRgeSyJaGdEzqDWh6lKjDbGjBk4J56suA/exec';

// Show the email address on the page (written in by script, not in the HTML source)
document.querySelectorAll('.js-email-text').forEach((el) => {
  el.textContent = CONTACT.email();
});

// Email links: build the mailto only when clicked
document.querySelectorAll('.js-email').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href =
      'mailto:' + CONTACT.email() + '?subject=' + encodeURIComponent('First Light enquiry');
  });
});

/* ---------------------------------------------------------
   Enquiry form
   1. Visitor fills in name + their WhatsApp number (+ consent)
   2. Details are emailed to First Light (saved as a record)
   3. Only then does WhatsApp open with a pre-filled message
   --------------------------------------------------------- */
const form = document.getElementById('enquiry-form');

// "Book your session" buttons pre-select the right program in the form
document.querySelectorAll('.js-pick-program').forEach((btn) =>
  btn.addEventListener('click', () => {
    const select = document.getElementById('f-program');
    if (select) select.value = btn.dataset.program;
  })
);

if (form) {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');

  const setStatus = (msg, type = '') => {
    status.textContent = msg;
    status.className = 'form-status' + (type ? ' ' + type : '');
  };

  const markInvalid = (el, bad) => el.setAttribute('aria-invalid', bad ? 'true' : 'false');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());
    const name = (data.name || '').trim();
    const phoneDigits = (data.phone || '').replace(/[^\d]/g, '');
    const consent = form.querySelector('#f-consent').checked;

    // Validation
    const nameEl = form.querySelector('#f-name');
    const phoneEl = form.querySelector('#f-phone');
    markInvalid(nameEl, name.length < 2);
    markInvalid(phoneEl, phoneDigits.length < 10 || phoneDigits.length > 15);

    if (name.length < 2) { setStatus('Please enter your name.', 'error'); nameEl.focus(); return; }
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setStatus('Please enter a valid WhatsApp number (at least 10 digits).', 'error'); phoneEl.focus(); return;
    }
    if (!consent) { setStatus('Please tick the consent box so we can contact you.', 'error'); return; }

    // Bots fill the hidden field; quietly stop here
    if (data._honey) { setStatus('Thank you!', 'ok'); return; }

    button.disabled = true;
    setStatus('Sending your details…');

    const enquiry = {
      Name: name,
      Phone: data.phone.trim(),
      Program: data.program,
      'Student age / class': (data.student_age || '').trim() || '—',
      Message: (data.message || '').trim() || '—',
      _subject: `New First Light enquiry: ${name} (${data.program})`,
      _template: 'table',
    };

    // 1) Email notification (FormSubmit)
    const sendEmail = fetch('https://formsubmit.co/ajax/' + CONTACT.email(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(enquiry),
    }).then(async (res) => {
      const out = await res.json().catch(() => ({}));
      if (!res.ok || String(out.success) !== 'true') throw new Error(out.message || 'Send failed');
    });

    // 2) Founders' private Google Sheet (plain-text body avoids a CORS preflight)
    const sendSheet = SHEET_ENDPOINT
      ? fetch(SHEET_ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({
            name, phone: data.phone.trim(), program: data.program,
            student_age: data.student_age || '', message: data.message || '', _honey: data._honey || '',
          }),
        }).then(async (res) => {
          const out = await res.json().catch(() => ({}));
          if (!out.ok) throw new Error('Sheet save failed');
        })
      : Promise.reject(new Error('Sheet not configured'));

    try {
      // Saved if at least one destination succeeded
      const results = await Promise.allSettled([sendEmail, sendSheet]);
      if (!results.some((r) => r.status === 'fulfilled')) throw new Error('Send failed');

      // Saved. Now open WhatsApp with a pre-filled message.
      const text = [
        'Hello First Light! 👋',
        `My name is ${name}.`,
        `I'm interested in: ${data.program}`,
        enquiry['Student age / class'] !== '—' ? `Student age / class: ${enquiry['Student age / class']}` : '',
        enquiry.Message !== '—' ? `Message: ${enquiry.Message}` : '',
        `My number: ${enquiry.Phone}`,
      ].filter(Boolean).join('\n');

      setStatus('Thank you! Opening WhatsApp…', 'ok');
      form.reset();
      window.location.href = `https://wa.me/${CONTACT.wa()}?text=${encodeURIComponent(text)}`;
    } catch (err) {
      setStatus("Sorry, we couldn't send that just now. Please try again in a moment, or use the email link.", 'error');
    } finally {
      button.disabled = false;
    }
  });
}
