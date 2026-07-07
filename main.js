/**
 * Eclipse RJ — UI interactions
 * Auth modals · Newsletter · Search params · Form validation
 */
(function () {
  'use strict';

  let lastFocusTarget = null;

  const AUTH_STORAGE_KEY = 'eclipserj_user';
  const AUTH_RETURN_KEY = 'eclipserj_auth_return';
  const PROTECTED_PAGES = ['search.html', 'room.html', 'checkout.html', 'confirmation.html'];

  /* --------------------------------------------------------------------------
     Auth gate — login required before booking flow pages
     -------------------------------------------------------------------------- */
  function getCurrentPage() {
    const file = window.location.pathname.split('/').pop();
    return file || 'index.html';
  }

  function isProtectedPage(page) {
    return PROTECTED_PAGES.includes(page || getCurrentPage());
  }

  function isHomePage(page) {
    const current = page || getCurrentPage();
    return current === 'index.html' || current === '';
  }

  function saveAuthReturn(relativePath) {
    if (!relativePath) return;
    const path = relativePath.replace(/^\//, '');
    sessionStorage.setItem(AUTH_RETURN_KEY, path);
  }

  function consumeAuthReturn() {
    const path = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    return path || null;
  }

  function resolvePageFromHref(href) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return null;
    }
    if (/^https?:\/\//i.test(href)) {
      try {
        const url = new URL(href);
        if (url.origin !== window.location.origin) return null;
        return url.pathname.split('/').pop() || 'index.html';
      } catch {
        return null;
      }
    }
    const path = href.split('?')[0].split('#')[0];
    if (!path.endsWith('.html')) return null;
    return path.split('/').pop() || null;
  }

  function buildReturnFromForm(form) {
    const action = form.getAttribute('action');
    if (!action) return null;
    const url = new URL(action, window.location.href);
    const params = new URLSearchParams(new FormData(form));
    const query = params.toString();
    const page = url.pathname.split('/').pop() || 'search.html';
    return query ? `${page}?${query}` : page;
  }

  function openAuthPrompt(mode = 'login') {
    const modal = document.getElementById(mode === 'signup' ? 'signup-modal' : 'login-modal');
    openModal(modal);
  }

  function clearAuthRequiredNotice() {
    const notice = document.querySelector('[data-auth-notice]');
    if (!notice) return;
    notice.hidden = true;
    document.body.classList.remove('has-auth-notice');
  }

  function hideAuthRequiredNotice() {
    clearAuthRequiredNotice();
    sessionStorage.setItem('eclipserj_auth_notice_dismissed', '1');
  }

  function showAuthRequiredNotice() {
    if (!isHomePage()) return;
    if (getStoredUser()) return;
    if (sessionStorage.getItem('eclipserj_auth_notice_dismissed') === '1') return;

    const notice = document.querySelector('[data-auth-notice]');
    if (!notice) return;

    notice.hidden = false;
    document.body.classList.add('has-auth-notice');
  }

  function initAuthRequiredNotice() {
    const notice = document.querySelector('[data-auth-notice]');
    if (!notice) return;

    notice.querySelector('[data-auth-notice-dismiss]')?.addEventListener('click', hideAuthRequiredNotice);
  }

  function completeAuthSession() {
    clearAuthRequiredNotice();
    sessionStorage.removeItem('eclipserj_auth_notice_dismissed');
    renderAllHeaderActions();
    const returnTo = consumeAuthReturn();
    if (returnTo) {
      window.location.href = returnTo;
      return true;
    }
    return false;
  }

  function requireAuthOnLoad() {
    if (!isProtectedPage() || getStoredUser()) return;

    const returnPath =
      getCurrentPage() + window.location.search + window.location.hash;
    window.location.replace(
      `index.html?auth=required&return=${encodeURIComponent(returnPath)}`
    );
  }

  function handleAuthQueryOnHome() {
    if (!isHomePage()) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') !== 'required') return;

    const returnTo = params.get('return');
    if (returnTo) saveAuthReturn(decodeURIComponent(returnTo));

    history.replaceState(null, '', 'index.html');
    sessionStorage.removeItem('eclipserj_auth_notice_dismissed');

    if (getStoredUser()) {
      const pending = consumeAuthReturn();
      if (pending) window.location.href = pending;
      return;
    }

    showAuthRequiredNotice();
    requestAnimationFrame(() => openAuthPrompt('login'));
  }

  function initAuthNavigationGate() {
    document.addEventListener(
      'click',
      (event) => {
        const link = event.target.closest('a[href]');
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
        if (link.closest('.auth-modal')) return;

        const page = resolvePageFromHref(link.getAttribute('href'));
        if (!page || !isProtectedPage(page) || getStoredUser()) return;

        event.preventDefault();
        try {
          const url = new URL(link.getAttribute('href'), window.location.href);
          saveAuthReturn(
            url.pathname.split('/').pop() + url.search + url.hash
          );
        } catch {
          saveAuthReturn(page);
        }
        openAuthPrompt('login');
      },
      true
    );

    document.addEventListener(
      'submit',
      (event) => {
        const form = event.target.closest('form');
        if (!form || form.closest('.auth-modal')) return;

        const action = form.getAttribute('action');
        if (!action) return;

        const page = resolvePageFromHref(action);
        if (!page || !isProtectedPage(page) || getStoredUser()) return;

        event.preventDefault();
        saveAuthReturn(buildReturnFromForm(form));
        openAuthPrompt('login');
      },
      true
    );
  }

  /* --------------------------------------------------------------------------
     Auth state & navbar
     -------------------------------------------------------------------------- */
  function getStoredUser() {
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setStoredUser(user) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    renderAllHeaderActions();
  }

  function clearStoredUser() {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    renderAllHeaderActions();
    if (isProtectedPage()) {
      window.location.href = 'index.html?auth=required';
    }
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0] || 'G').slice(0, 2).toUpperCase();
  }

  function userFromSignupForm(form) {
    return {
      name: form.querySelector('#signup-name')?.value.trim() || 'Guest',
      email: form.querySelector('#signup-email')?.value.trim() || '',
    };
  }

  function userFromLoginForm(form) {
    const email = form.querySelector('#login-email')?.value.trim() || '';
    const local = email.split('@')[0] || 'Guest';
    const name = local
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    return { name, email };
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function closeAllUserMenus() {
    document.querySelectorAll('.user-menu__dropdown').forEach((dropdown) => {
      dropdown.hidden = true;
    });
    document.querySelectorAll('.user-avatar').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function renderHeaderActions(container) {
    const bookHref = container.dataset.bookHref || 'search.html';
    const backHref = container.dataset.backHref || '';
    const backLabel = container.dataset.backLabel || '';
    const user = getStoredUser();

    const isHome = getCurrentPage() === 'index.html' || getCurrentPage() === '';

    /* Always render the avatar when logged in */
    if (user) {
      const initials = getInitials(user.name);
      const safeName = escapeHtml(user.name);
      const safeEmail = escapeHtml(user.email);

      container.innerHTML = `
        <div class="user-menu">
          <button type="button" class="user-avatar" aria-expanded="false" aria-haspopup="true"
                  aria-label="Account menu for ${safeName}">${initials}</button>
          <div class="user-menu__dropdown" hidden>
            <p class="user-menu__name">${safeName}</p>
            <p class="user-menu__email">${safeEmail}</p>
            <a href="confirmation.html" class="user-menu__link">My Bookings</a>
            <button type="button" class="user-menu__logout" data-logout>Log out</button>
          </div>
        </div>
      `;
      return;
    }

    /* Not logged in — homepage gets full Login + Sign Up, flow pages get compact link */
    if (isHome) {
      const backLink = backHref
        ? `<a href="${backHref}" class="btn btn-primary btn-nav-ghost">${escapeHtml(backLabel)}</a>`
        : '';
      container.innerHTML = `
        ${backLink}
        <button type="button" class="header-login" data-login-open>Login</button>
        <button type="button" class="btn btn-outline btn-nav-outline" data-signup-open>Sign Up</button>
      `;
    } else {
      /* Flow pages: compact single link so it doesn't crowd the booking steps */
      container.innerHTML = `
        <button type="button" class="header-login" data-login-open>Sign in</button>
      `;
    }
  }

  function renderAllHeaderActions() {
    document.querySelectorAll('[data-header-actions]').forEach(renderHeaderActions);
  }

  function initHeaderAuth() {
    renderAllHeaderActions();

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-logout]')) {
        event.preventDefault();
        clearStoredUser();
        closeAllUserMenus();
        return;
      }

      const avatar = event.target.closest('.user-avatar');
      if (avatar) {
        event.preventDefault();
        event.stopPropagation();
        const dropdown = avatar.parentElement?.querySelector('.user-menu__dropdown');
        if (!dropdown) return;

        const willOpen = dropdown.hidden;
        closeAllUserMenus();
        if (willOpen) {
          dropdown.hidden = false;
          avatar.setAttribute('aria-expanded', 'true');
        }
        return;
      }

      if (!event.target.closest('.user-menu')) {
        closeAllUserMenus();
      }
    });
  }

  /* --------------------------------------------------------------------------
     Brand logo & social icons (shared markup)
     -------------------------------------------------------------------------- */
  function authModalBrandMarkup(idSuffix) {
    return `<div class="auth-modal__brand">
      ${brandLogoSvg(40, idSuffix)}
      <span class="auth-modal__brand-name">ECLIPSE RJ</span>
    </div>`;
  }

  function brandLogoSvg(size, idSuffix) {
    const uid = idSuffix || 'logo';
    return `<svg class="brand-logo__icon" width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="goldGrad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fdf0a6" />
          <stop offset="40%" stop-color="#d4af37" />
          <stop offset="100%" stop-color="#997a00" />
        </linearGradient>
        <mask id="crescentMask-${uid}">
          <rect width="100" height="100" fill="white" />
          <circle cx="62" cy="50" r="34" fill="black" />
        </mask>
      </defs>
      <circle cx="45" cy="50" r="45" fill="#1a2538" mask="url(#crescentMask-${uid})" />
      <circle cx="62" cy="50" r="28" fill="url(#goldGrad-${uid})" />
    </svg>`;
  }

  function socialIconSvg(name) {
    const icons = {
      instagram: '<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 110 2.881 1.44 1.44 0 010-2.881z"/>',
      twitter: '<path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.821-7.584-6.649 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L7.486 3.24H5.30z"/>',
      facebook: '<path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.012 4.388 11.002 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
    };
    return `<svg class="social-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icons[name]}</svg>`;
  }

  function initBrandLogos() {
    document.querySelectorAll('.brand-logo[data-brand-logo]').forEach((link, index) => {
      const suffix = `nav-${index}`;
      const wordmark = link.querySelector('.brand-logo__wordmark');
      const wordmarkHtml = wordmark
        ? `<span class="brand-logo__wordmark">${wordmark.textContent}</span>`
        : '<span class="brand-logo__wordmark">ECLIPSE RJ</span>';
      link.innerHTML = `${brandLogoSvg(32, suffix)}${wordmarkHtml}`;
    });
  }

  /* --------------------------------------------------------------------------
     Trust marquee (homepage)
     -------------------------------------------------------------------------- */
  const MARQUEE_ICONS = {
    star: '<path d="M12 2l3 7h7l-5.5 4.5 2 7L12 17l-6.5 3.5 2-7L2 9h7z"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    layers: '<path d="m12 2 8 4.5v7L12 21l-8-7.5v-7L12 2z"/><path d="M12 21V9"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    receipt: '<path d="M4 2v20l4-2 4 2 4-2 4 2V2z"/><path d="M8 10h8M8 14h5"/>',
  };

  /** Trust + booking + luxury + local — short labels for marquee scan */
  const MARQUEE_ITEMS = [
    { icon: 'star', label: 'Best Price Guarantee' },
    { icon: 'check', label: 'Instant Confirmation' },
    { icon: 'shield', label: 'Secure Payments' },
    { icon: 'clock', label: '24/7 Concierge' },
    { icon: 'layers', label: 'Curated Luxury Stays' },
    { icon: 'pin', label: 'Ghana Premium Destinations' },
    { icon: 'calendar', label: 'Flexible Booking Options' },
    { icon: 'receipt', label: 'No Hidden Fees' },
  ];

  function marqueeItemMarkup(item) {
    const paths = MARQUEE_ICONS[item.icon] || MARQUEE_ICONS.star;
    return `<li class="info-item">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">${paths}</svg>
      <span>${escapeHtml(item.label)}</span>
    </li>`;
  }

  function initInfoMarquee() {
    const track = document.querySelector('[data-info-marquee]');
    if (!track) return;

    const itemsHtml = MARQUEE_ITEMS.map(marqueeItemMarkup).join('');
    const group = (hidden) =>
      `<ul class="info-marquee__group"${hidden ? ' aria-hidden="true"' : ''}>${itemsHtml}</ul>`;

    track.innerHTML = group(false) + group(true);
  }

  /* --------------------------------------------------------------------------
     Site footer (shared across pages)
     -------------------------------------------------------------------------- */
  function footerLinkPrefix() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    return file === 'index.html' || file === '' ? '' : 'index.html';
  }

  function renderSiteFooter() {
    const prefix = footerLinkPrefix();
    const homeHref = prefix || 'index.html';
    const hash = (id) => (prefix ? `${prefix}#${id}` : `#${id}`);

    document.querySelectorAll('[data-site-footer]').forEach((footer) => {
      footer.className = 'site-footer';
      footer.innerHTML = `
        <div class="container">

          <div class="footer-top">
            <!-- Brand -->
            <div class="footer-brand">
              <a href="${homeHref}" class="footer-brand__logo" aria-label="Eclipse RJ Home">
                ${brandLogoSvg(28, 'footer')}
                <span class="footer-brand__name">ECLIPSE RJ</span>
              </a>
              <p class="footer-brand__tagline">Luxury hospitality across Ghana<br>for the discerning traveler.</p>
              <div class="footer-social">
                <a href="https://instagram.com" class="footer-social__item" target="_blank" rel="noopener noreferrer" aria-label="Instagram">${socialIconSvg('instagram')}</a>
                <a href="https://twitter.com" class="footer-social__item" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">${socialIconSvg('twitter')}</a>
                <a href="https://facebook.com" class="footer-social__item" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${socialIconSvg('facebook')}</a>
              </div>
            </div>

            <!-- Navigation -->
            <nav class="footer-col" aria-label="Footer navigation">
              <h4 class="footer-col__title">Explore</h4>
              <ul class="footer-col__list">
                <li><a href="${hash('destinations')}">Destinations</a></li>
                <li><a href="${hash('rooms')}">Our Suites</a></li>
                <li><a href="${hash('amenities')}">Amenities</a></li>
                <li><a href="${hash('experience')}">The Experience</a></li>
                <li><a href="search.html">Search Hotels</a></li>
              </ul>
            </nav>

            <!-- Support -->
            <nav class="footer-col" aria-label="Footer support">
              <h4 class="footer-col__title">Support</h4>
              <ul class="footer-col__list">
                <li><a href="mailto:reservations@eclipserj.com">Contact Us</a></li>
                <li><a href="${hash('booking-policy')}">FAQ</a></li>
                <li><a href="${hash('booking-policy')}">Booking Policy</a></li>
                <li><a href="${hash('booking-policy')}">Cancellation</a></li>
                <li><a href="${hash('booking-policy')}">Terms &amp; Conditions</a></li>
              </ul>
            </nav>

            <!-- Contact -->
            <div class="footer-col">
              <h4 class="footer-col__title">Contact</h4>
              <ul class="footer-col__list footer-col__list--contact">
                <li>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
                  <a href="tel:+233551234567">+233 55 123 4567</a>
                </li>
                <li>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <a href="mailto:reservations@eclipserj.com">reservations@eclipserj.com</a>
                </li>
                <li>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Airport Residential Area, Accra
                </li>
              </ul>
            </div>
          </div>

          <div class="footer-bottom">
            <p>&copy; 2026 Eclipse RJ Hotel Booking. All rights reserved.</p>
            <p class="footer-bottom__right">Hand-picked luxury stays across Ghana</p>
          </div>

        </div>
      `;
    });
  }

  /* --------------------------------------------------------------------------
     Modal helpers
     -------------------------------------------------------------------------- */
  function getOpenModal() {
    return document.querySelector('.auth-modal.is-open');
  }

  function lockBody(lock) {
    document.body.classList.toggle('has-modal-open', lock);
  }

  function trapFocus(modal, event) {
    if (event.key !== 'Tab') return;

    const focusable = modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const nodes = Array.from(focusable).filter((el) => el.offsetParent !== null);
    if (!nodes.length) return;

    const first = nodes[0];
    const last = nodes[nodes.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function resetModalPanels(modal) {
    const formPanel = modal.querySelector('[data-auth-panel="form"]');
    const successPanel = modal.querySelector('[data-auth-panel="success"]');
    if (formPanel) formPanel.hidden = false;
    if (successPanel) successPanel.hidden = true;
    modal.querySelector('form')?.reset();
  }

  function openModal(modal, trigger) {
    if (!modal) return;

    document.querySelectorAll('.auth-modal.is-open').forEach((m) => closeModal(m, false));

    lastFocusTarget = trigger || document.activeElement;
    resetModalPanels(modal);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockBody(true);

    const field = modal.querySelector('[data-auth-panel="form"] input:not([type="hidden"])');
    requestAnimationFrame(() => field?.focus());
  }

  function closeModal(modal, restoreFocus = true) {
    if (!modal?.classList.contains('is-open')) return;

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    if (!getOpenModal()) lockBody(false);
    resetModalPanels(modal);

    if (restoreFocus && lastFocusTarget?.focus) {
      lastFocusTarget.focus();
    }
  }

  function showSuccess(modal) {
    const formPanel = modal.querySelector('[data-auth-panel="form"]');
    const success = modal.querySelector('[data-auth-panel="success"]');
    if (!formPanel || !success) return;

    formPanel.hidden = true;
    success.hidden = false;
    const heading = success.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }

  /* --------------------------------------------------------------------------
     Sign Up modal
     -------------------------------------------------------------------------- */
  function createSignupModal() {
    document.getElementById('signup-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'signup-modal';
    modal.className = 'auth-modal signup-modal auth-modal--signup';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'signup-modal-title');

    modal.innerHTML = `
      <div class="auth-modal__backdrop" data-modal-close></div>
      <div class="auth-modal__dialog" role="document">
        <button type="button" class="auth-modal__close" data-modal-close aria-label="Close sign up">&times;</button>
        <div class="auth-modal__panel" data-auth-panel="form">
          <div class="auth-modal__header auth-modal__header--compact">
            ${authModalBrandMarkup('auth-signup')}
            <h2 id="signup-modal-title">Create your account</h2>
            <p>Create an account to search stays, book suites, and manage your trips.</p>
          </div>
          <div class="auth-modal__scroll">
            <form id="signup-form" class="auth-modal__form" novalidate>
              <div class="form-group">
                <label for="signup-name">Full Name</label>
                <input type="text" id="signup-name" class="form-control" required autocomplete="name" placeholder="Kwame Mensah">
              </div>
              <div class="form-group">
                <label for="signup-email">Email Address</label>
                <input type="email" id="signup-email" class="form-control" required autocomplete="email" placeholder="you@example.com">
              </div>
              <div class="form-group">
                <label for="signup-phone">Phone Number</label>
                <input type="tel" id="signup-phone" class="form-control" required autocomplete="tel" placeholder="+233 55 000 0000">
              </div>
              <div class="form-group">
                <label for="signup-password">Password</label>
                <input type="password" id="signup-password" class="form-control" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters">
              </div>
              <label class="auth-modal__checkbox">
                <input type="checkbox" id="signup-terms" required>
                <span>I agree to the <a href="index.html#booking-policy">Terms &amp; Conditions</a></span>
              </label>
              <button type="submit" class="auth-modal__submit">Create Account</button>
            </form>
          </div>
          <p class="auth-modal__switch auth-modal__switch--footer">Already a member? <button type="button" class="auth-modal__link-btn" data-auth-switch="login">Sign in</button></p>
        </div>
        <div class="auth-modal__panel" data-auth-panel="success" hidden>
          ${authModalBrandMarkup('auth-signup-success')}
          <div class="auth-modal__success-icon" aria-hidden="true">✓</div>
          <h2 tabindex="-1">Welcome to Eclipse RJ</h2>
          <p>Your account is ready. We sent a confirmation link to your email.</p>
          <button type="button" class="auth-modal__submit" data-modal-close>Continue Exploring</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#signup-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      setStoredUser(userFromSignupForm(form));
      if (!completeAuthSession()) showSuccess(modal);
    });
  }

  /* --------------------------------------------------------------------------
     Login modal
     -------------------------------------------------------------------------- */
  function createLoginModal() {
    if (document.getElementById('login-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'login-modal';
    modal.className = 'auth-modal login-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'login-modal-title');

    modal.innerHTML = `
      <div class="auth-modal__backdrop" data-modal-close></div>
      <div class="auth-modal__dialog" role="document">
        <button type="button" class="auth-modal__close" data-modal-close aria-label="Close login">&times;</button>
        <div class="auth-modal__panel" data-auth-panel="form">
          <div class="auth-modal__header">
            ${authModalBrandMarkup('auth-login')}
            <h2 id="login-modal-title">Welcome back</h2>
            <p>Sign in to search stays, view rooms, and complete your booking.</p>
          </div>
          <form id="login-form" class="auth-modal__form" novalidate>
            <div class="form-group">
              <label for="login-email">Email Address</label>
              <input type="email" id="login-email" class="form-control" required autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" required autocomplete="current-password" placeholder="Your password">
            </div>
            <button type="submit" class="auth-modal__submit">Log In</button>
          </form>
          <p class="auth-modal__switch">New to Eclipse RJ? <button type="button" class="auth-modal__link-btn" data-auth-switch="signup">Create an account</button></p>
        </div>
        <div class="auth-modal__panel" data-auth-panel="success" hidden>
          ${authModalBrandMarkup('auth-login-success')}
          <div class="auth-modal__success-icon" aria-hidden="true">✓</div>
          <h2 tabindex="-1">You're signed in</h2>
          <p>Welcome back. Your member benefits are now active.</p>
          <button type="button" class="auth-modal__submit" data-modal-close>Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#login-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.target;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      setStoredUser(userFromLoginForm(form));
      if (!completeAuthSession()) showSuccess(modal);
    });
  }

  /* --------------------------------------------------------------------------
     Newsletter
     -------------------------------------------------------------------------- */
  function initNewsletter() {
    document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = form.querySelector('input[type="email"]');
        if (!email?.checkValidity()) {
          email?.reportValidity();
          return;
        }

        const button = form.querySelector('button[type="submit"]');
        const originalLabel = button.textContent;
        button.textContent = 'Subscribed!';
        button.disabled = true;
        email.value = '';

        window.setTimeout(() => {
          button.textContent = originalLabel;
          button.disabled = false;
        }, 2800);
      });
    });
  }

  /* --------------------------------------------------------------------------
     Booking flow state (search → room → checkout → confirmation)
     -------------------------------------------------------------------------- */
  const BOOKING_STORAGE_KEY = 'eclipserj_booking';
  const BOOKING_REF_KEY = 'eclipserj_booking_ref';

  const SUITES = {
    ocean: {
      roomName: 'Ocean View Suite',
      locationDetail: 'Accra Beachfront',
      nightly: 5500,
      image: 'Images/Luxury hotel room.jpg',
      specs: {
        guests: '2 Adults, 1 Child',
        bed: '1 Premium King',
        size: '65 sqm'
      },
      description: 'Experience the ultimate luxury in our Ocean View Suite. Meticulously designed with modern African aesthetics, this suite features floor-to-ceiling windows offering panoramic views of the Atlantic Ocean. Enjoy the private balcony, a spacious lounge area, and a marble bathroom complete with a freestanding soaking tub and premium toiletries.',
      amenities: [
        '🌊 Unobstructed Ocean View',
        '📶 High-speed WiFi',
        '📺 65" Smart TV',
        '☕ Nespresso Machine',
        '🥂 Complimentary Mini-bar',
        '🛀 Freestanding Bathtub'
      ]
    },
    presidential: {
      roomName: 'Presidential Suite',
      locationDetail: 'Accra City Centre',
      nightly: 8200,
      image: 'Images/cosmos_891729727.jpeg',
      specs: {
        guests: '4 Adults',
        bed: '2 Premium Kings',
        size: '95 sqm'
      },
      description: 'Our crown jewel, the Presidential Suite offers unparalleled sophistication and premium comfort in the heart of Accra. Perfect for diplomatic stays or discerning travelers, it features dual master bedrooms, a private dining room for six, a dedicated butler service kitchen, and an expansive terrace overlooking the glowing city skyline.',
      amenities: [
        '🏙️ Panoramic City Terrace',
        '📶 Ultra-fast WiFi & Office',
        '📺 75" 8K Smart TV',
        '🤵 Dedicated Butler Service',
        '🍷 Curated Wine Cellar',
        '🛁 Luxury Jacuzzi & Sauna'
      ]
    },
    garden: {
      roomName: 'Garden Retreat Suite',
      locationDetail: 'Accra Hills',
      nightly: 3800,
      image: 'Images/cosmos_714083784.jpeg',
      specs: {
        guests: '2 Adults',
        bed: '1 Premium Queen',
        size: '48 sqm'
      },
      description: 'Tucked away in the serene Accra Hills, the Garden Retreat Suite is a peaceful sanctuary designed for rest and wellness. Surrounded by lush botanical gardens, the suite offers a private sun deck, indoor-outdoor shower, yoga mats, and direct access to our world-class holistic wellness center.',
      amenities: [
        '🌿 Private Garden & Deck',
        '📶 High-speed WiFi',
        '🧘 Yoga Mats & Wellness Kit',
        '🚿 Indoor-Outdoor Rainforest Shower',
        '💆 Direct Spa Access',
        '🍵 Organic Tea Selection'
      ]
    }
  };

  const DEFAULT_SUITE = SUITES.ocean;

  const FLOW_STEPS = [
    { id: 'search', label: 'Search', path: 'search.html' },
    { id: 'room', label: 'Room', path: 'room.html' },
    { id: 'checkout', label: 'Checkout', path: 'checkout.html' },
    { id: 'confirm', label: 'Confirmed', path: 'confirmation.html' },
  ];

  function formatGhs(amount) {
    return `GH₵${Number(amount).toLocaleString('en-GH')}`;
  }

  function formatDisplayDate(iso) {
    if (!iso) return '—';
    const date = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-GH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function nightsBetween(checkin, checkout) {
    if (!checkin || !checkout) return 3;
    const start = new Date(`${checkin}T12:00:00`);
    const end = new Date(`${checkout}T12:00:00`);
    const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  function buildBookingFromParams(params) {
    const checkin  = params.get('checkin')  || '2026-06-15';
    const checkout = params.get('checkout') || '2026-06-18';
    const nights   = nightsBetween(checkin, checkout);

    const roomId = params.get('roomId') || 'ocean';
    const suite  = SUITES[roomId] || DEFAULT_SUITE;

    /* Hotel-specific values from search card take priority over suite defaults */
    const hotelName    = params.get('hotelName')    || suite.roomName;
    const hotelAddress = params.get('hotelAddress') || suite.locationDetail;
    const hotelPrice   = params.get('hotelPrice')   ? parseInt(params.get('hotelPrice'), 10) : suite.nightly;
    const hotelImage   = params.get('hotelImage')   || suite.image;
    const hotelScore   = params.get('hotelScore')   || '';

    const guests       = parseInt(params.get('guests') || '2', 10) || 1;
    /* baseNightly = price for 1 guest. hotelPrice from search is already guests × base */
    const baseNightly  = Math.round(hotelPrice / guests);
    const nightly      = hotelPrice;  /* total per night for all guests */
    const subtotal     = nightly * nights;
    const tax          = Math.round(subtotal * 0.15);
    const levy         = 60;

    return {
      roomId,
      location:       params.get('location') || 'Accra, Ghana',
      checkin,
      checkout,
      guests:         String(guests),
      roomName:       hotelName,
      locationDetail: hotelAddress,
      hotelScore,
      baseNightly,
      nightly,
      nights,
      subtotal,
      tax,
      levy,
      total: subtotal + tax + levy,
      image: hotelImage,
    };
  }

  function getStoredBooking() {
    try {
      const raw = sessionStorage.getItem(BOOKING_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveBooking(booking) {
    sessionStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(booking));
  }

  function getOrCreateBookingRef() {
    let ref = sessionStorage.getItem(BOOKING_REF_KEY);
    if (!ref) {
      ref = `ECL-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 89999))}`;
      sessionStorage.setItem(BOOKING_REF_KEY, ref);
    }
    return ref;
  }

  function syncBookingFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const stored = getStoredBooking();
    
    /* Only rebuild from URL when a full booking handoff is happening (roomId present)
       or when location/dates are explicitly passed from the homepage form */
    if (!params.has('roomId') && !params.has('checkin') && !params.has('location')) {
      return stored;
    }
    
    if (stored && !params.has('checkin') && params.has('roomId')) {
      // Legacy branch — now handled by buildBookingFromParams below
    }

    const booking = buildBookingFromParams(params);
    saveBooking(booking);
    return booking;
  }

  function renderBookingSteps(activeId) {
    const host = document.querySelector('[data-booking-steps]');
    if (!host) return;

    const activeIndex = FLOW_STEPS.findIndex((step) => step.id === activeId);

    host.innerHTML = `
      <nav class="booking-steps" aria-label="Booking progress">
        <ol class="booking-steps__list">
          ${FLOW_STEPS.map((step, index) => {
            const state =
              index < activeIndex ? 'is-done' : index === activeIndex ? 'is-current' : '';
            const canLink = index <= activeIndex && step.id !== 'confirm';
            const href = canLink ? step.path : null;
            const inner = `<span class="booking-steps__label">${step.label}</span>`;
            return `<li class="booking-steps__item ${state}">
              ${href ? `<a href="${href}" class="booking-steps__link">${inner}</a>` : `<span class="booking-steps__link">${inner}</span>`}
            </li>`;
          }).join('')}
        </ol>
      </nav>
    `;
  }

  function applyBookingToPage() {
    const page = getCurrentPage();
    const booking = syncBookingFromUrl() || getStoredBooking() || buildBookingFromParams(new URLSearchParams());

    if (page === 'search.html') {
      saveBooking(booking);
      renderBookingSteps('search');
      const context = document.querySelector('[data-booking-context]');
      if (context) {
        const guestCount = parseInt(booking.guests, 10) || 1;
        context.textContent = `${booking.nights} night${booking.nights > 1 ? 's' : ''} · ${guestCount} guest${guestCount === 1 ? '' : 's'} · ${booking.location}`;
      }
      
      // Update ALL cards nightly and total prices based on stay duration
      document.querySelectorAll('[data-suite-card]').forEach(card => {
        const nightly = parseInt(card.dataset.price) || 5500;
        const subtotal = nightly * booking.nights;
        
        const nightlyEl = card.querySelector('[data-suite-nightly]');
        if (nightlyEl) nightlyEl.textContent = formatGhs(nightly);
        
        const totalEl = card.querySelector('[data-suite-total]');
        if (totalEl) totalEl.textContent = `${formatGhs(subtotal)} total`;
      });
    }

    if (page === 'room.html') {
      saveBooking(booking);
      renderBookingSteps('room');

      const suite = SUITES[booking.roomId] || DEFAULT_SUITE;
      if (suite) {
        document.querySelectorAll('[data-booking-fill="spec-guests"]').forEach(el => el.textContent = suite.specs.guests);
        document.querySelectorAll('[data-booking-fill="spec-bed"]').forEach(el => el.textContent = suite.specs.bed);
        document.querySelectorAll('[data-booking-fill="spec-size"]').forEach(el => el.textContent = suite.specs.size);
        document.querySelectorAll('[data-booking-fill="description"]').forEach(el => el.textContent = suite.description);
        document.querySelectorAll('[data-booking-amenities]').forEach(el => {
          el.innerHTML = suite.amenities.map(a => `<li>${escapeHtml(a)}</li>`).join('');
        });
      }

      /* ── Hydrate the editable date/guest inputs ── */
      const checkinInput  = document.getElementById('room-checkin');
      const checkoutInput = document.getElementById('room-checkout');
      const guestsInput   = document.getElementById('room-guests');

      if (checkinInput)  checkinInput.value  = booking.checkin;
      if (checkoutInput) checkoutInput.value = booking.checkout;
      if (guestsInput)   guestsInput.value   = booking.guests;

      /* ── Recalculate prices live when inputs change ── */
      function recalcRoom() {
        const ci = checkinInput  ? checkinInput.value  : booking.checkin;
        const co = checkoutInput ? checkoutInput.value : booking.checkout;
        const g  = guestsInput   ? guestsInput.value   : booking.guests;

        const nights        = nightsBetween(ci, co);
        const guestCount    = parseInt(g, 10) || 1;
        const baseNightly   = booking.baseNightly || Math.round(booking.nightly / (parseInt(booking.guests, 10) || 1));
        const adjustedNightly = baseNightly * guestCount;
        const subtotal      = adjustedNightly * nights;
        const tax           = Math.round(subtotal * 0.15);
        const levy          = booking.levy || 60;
        const total         = subtotal + tax + levy;

        /* Show base rate / night clearly */
        document.querySelectorAll('[data-booking-fill-html="price-night"]').forEach(
          el => { el.innerHTML = `${formatGhs(baseNightly)} <small>/ night per guest</small>`; }
        );
        /* Update breakdown */
        document.querySelectorAll('[data-booking-fill="subtotalLine"]').forEach(
          el => { el.textContent = `${formatGhs(baseNightly)} × ${guestCount} guest${guestCount === 1 ? '' : 's'} × ${nights} night${nights === 1 ? '' : 's'}`; }
        );
        document.querySelectorAll('[data-booking-fill="subtotal"]').forEach(
          el => { el.textContent = formatGhs(subtotal); }
        );
        document.querySelectorAll('[data-booking-fill="tax"]').forEach(
          el => { el.textContent = formatGhs(tax); }
        );
        document.querySelectorAll('[data-booking-fill="levy"]').forEach(
          el => { el.textContent = formatGhs(levy); }
        );
        document.querySelectorAll('[data-booking-fill="total"]').forEach(
          el => { el.textContent = formatGhs(total); }
        );
        /* Also update formatted date displays so summary stays in sync */
        document.querySelectorAll('[data-booking-fill="checkin"]').forEach(
          el => { el.textContent = formatDisplayDate(ci); }
        );
        document.querySelectorAll('[data-booking-fill="checkout"]').forEach(
          el => { el.textContent = formatDisplayDate(co); }
        );
        document.querySelectorAll('[data-booking-fill="guests"]').forEach(
          el => { el.textContent = `${g} Adult${g === '1' ? '' : 's'}`; }
        );
        document.querySelectorAll('[data-booking-fill="nights"]').forEach(
          el => { el.textContent = String(nights); }
        );

        /* Update checkout button URL so it carries the new dates/guests + hotel data */
        const checkoutBtn = document.getElementById('room-checkout-btn');
        if (checkoutBtn) {
          checkoutBtn.href = `checkout.html?roomId=${booking.roomId}` +
            `&checkin=${encodeURIComponent(ci)}` +
            `&checkout=${encodeURIComponent(co)}` +
            `&guests=${encodeURIComponent(g)}` +
            `&location=${encodeURIComponent(booking.location || 'Accra, Ghana')}` +
            `&hotelName=${encodeURIComponent(booking.roomName || '')}` +
            `&hotelAddress=${encodeURIComponent(booking.locationDetail || '')}` +
            `&hotelPrice=${encodeURIComponent(baseNightly * guestCount)}` +
            `&hotelImage=${encodeURIComponent(booking.image || '')}` +
            `&hotelScore=${encodeURIComponent(booking.hotelScore || '')}`;
        }

        /* Persist updated booking so checkout page reads correct values */
        const updated = Object.assign({}, booking, {
          checkin: ci, checkout: co, guests: g,
          nights, nightly: adjustedNightly, subtotal, tax, total
        });
        saveBooking(updated);
      }

      if (checkinInput)  checkinInput.addEventListener('change',  recalcRoom);
      if (checkoutInput) checkoutInput.addEventListener('change', recalcRoom);
      if (guestsInput)   guestsInput.addEventListener('change',   recalcRoom);

      /* Run once on load to set initial checkout button URL */
      recalcRoom();
    }

    if (page === 'checkout.html') {
      renderBookingSteps('checkout');
    }

    if (page === 'confirmation.html') {
      renderBookingSteps('confirm');
      const ref = getOrCreateBookingRef();
      document.querySelectorAll('[data-booking-ref]').forEach(el => {
        el.textContent = ref;
      });
    }

    document.querySelectorAll('[data-booking-fill]').forEach((el) => {
      const key = el.dataset.bookingFill;
      const map = {
        location:     booking.location || booking.locationDetail,
        room:         booking.roomName,
        checkin:      formatDisplayDate(booking.checkin),
        checkout:     formatDisplayDate(booking.checkout),
        dates:        `${formatDisplayDate(booking.checkin)} – ${formatDisplayDate(booking.checkout)} (${booking.nights} night${booking.nights > 1 ? 's' : ''})`,
        guests:       `${booking.guests} Adult${(parseInt(booking.guests, 10) || 1) === 1 ? '' : 's'}`,
        nights:       String(booking.nights),
        nightly:      formatGhs(booking.nightly),
        subtotal:     formatGhs(booking.subtotal),
        tax:          formatGhs(booking.tax),
        levy:         formatGhs(booking.levy),
        total:        formatGhs(booking.total),
        subtotalLine: `${formatGhs(booking.nightly)} × ${booking.nights} nights`,
        totalPaid:    formatGhs(booking.total),
        payCta:       `Confirm & Pay ${formatGhs(booking.total)}`,
        'score-line': booking.hotelScore ? `★ ${booking.hotelScore} guest score` : '',
        guestName:    booking.guestName  || '—',
      };
      if (map[key] !== undefined) el.textContent = map[key];
    });

    document.querySelectorAll('[data-booking-fill-html]').forEach((el) => {
      if (el.dataset.bookingFillHtml === 'price-night') {
        el.innerHTML = `${formatGhs(booking.nightly)} <small>/ night</small>`;
      }
    });

    document.querySelectorAll('[data-booking-fill-img]').forEach((el) => {
      if (el.dataset.bookingFillImg === 'main' && booking.image) {
        el.src = booking.image;
      }
    });
  }

  function initSearchForms() {
    document.querySelectorAll('[data-booking-search-form]').forEach((form) => {
      form.addEventListener('submit', () => {
        const data = new FormData(form);
        const params = new URLSearchParams();
        ['location', 'checkin', 'checkout', 'guests'].forEach((key) => {
          const value = data.get(key);
          if (value) params.set(key, value);
        });
        saveBooking(buildBookingFromParams(params));
      });
    });
  }

  function initSearchParams() {
    const params = new URLSearchParams(window.location.search);
    const destination = document.getElementById('search-destination');
    const checkin = document.getElementById('search-checkin');
    const checkout = document.getElementById('search-checkout');
    const guests = document.getElementById('search-guests');

    const booking = syncBookingFromUrl();

    if (booking) {
      if (destination) destination.value = booking.location;
      if (checkin) checkin.value = booking.checkin;
      if (checkout) checkout.value = booking.checkout;
      if (guests) guests.value = booking.guests;
      return;
    }

    if (params.get('location') && destination) destination.value = params.get('location');
    if (params.get('checkin') && checkin) checkin.value = params.get('checkin');
    if (params.get('checkout') && checkout) checkout.value = params.get('checkout');
    if (params.get('guests') && guests) guests.value = params.get('guests');
  }

  function initConfirmationActions() {
    const printBtn = document.querySelector('[data-print-receipt]');
    if (!printBtn) return;

    printBtn.addEventListener('click', (event) => {
      event.preventDefault();

      /* Set today's date on the receipt */
      const dateEl = document.getElementById('receipt-print-date');
      if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-GH', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
      }

      window.print();
    });
  }

  /* --------------------------------------------------------------------------
     Date validation (hero + search)
     -------------------------------------------------------------------------- */
  function bindDateValidation(checkinId, checkoutId) {
    const checkin = document.getElementById(checkinId);
    const checkout = document.getElementById(checkoutId);
    if (!checkin || !checkout) return;

    const validate = () => {
      if (checkin.value && checkout.value && checkin.value >= checkout.value) {
        checkout.setCustomValidity('Check-out must be after check-in.');
      } else {
        checkout.setCustomValidity('');
      }
    };

    checkin.addEventListener('change', validate);
    checkout.addEventListener('change', validate);
    validate();
  }

  function initDateValidation() {
    bindDateValidation('hero-checkin', 'hero-checkout');
    bindDateValidation('search-checkin', 'search-checkout');
    bindDateValidation('room-checkin', 'room-checkout');
  }

  /* --------------------------------------------------------------------------
     In-page section navigation (homepage)
     -------------------------------------------------------------------------- */
  const NAV_SECTIONS = ['destinations', 'rooms', 'amenities', 'experience'];

  function getScrollOffset() {
    const notice = document.querySelector('[data-auth-notice]:not([hidden])');
    const header = document.querySelector('.site-header');
    let offset = (header?.offsetHeight || 60) + 20;
    if (notice) offset += notice.offsetHeight;
    return offset;
  }

  function scrollToSection(sectionId, behavior = 'smooth') {
    const target = document.getElementById(sectionId);
    if (!target) return false;

    const top = target.getBoundingClientRect().top + window.scrollY - getScrollOffset();
    window.scrollTo({ top: Math.max(0, top), behavior });
    return true;
  }

  function setActiveNavLink(sectionId) {
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
      const id = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('is-active', id === sectionId);
      if (id === sectionId) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function initSectionNav() {
    const navLinks = document.querySelectorAll('[data-nav-link]');
    if (!navLinks.length) return;

    const sections = NAV_SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!sections.length) return;

    navLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href?.startsWith('#')) return;

        const sectionId = href.slice(1);
        if (!document.getElementById(sectionId)) return;

        event.preventDefault();
        scrollToSection(sectionId);
        history.pushState(null, '', href);
        setActiveNavLink(sectionId);
      });
    });

    const handleHashOnLoad = () => {
      const hash = window.location.hash.replace('#', '');
      if (!hash || !NAV_SECTIONS.includes(hash)) return;
      requestAnimationFrame(() => {
        scrollToSection(hash, 'auto');
        setActiveNavLink(hash);
      });
    };

    handleHashOnLoad();
    window.addEventListener('hashchange', handleHashOnLoad);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible[0]?.target?.id) {
          setActiveNavLink(visible[0].target.id);
        }
      },
      {
        rootMargin: `-${getScrollOffset()}px 0px -50% 0px`,
        threshold: [0, 0.15, 0.35, 0.55],
      }
    );

    sections.forEach((section) => observer.observe(section));

    /* Clear active state when user scrolls above all tracked sections
       (hero) or below the last one (testimonials, CTA) */
    function clearIfOutsideSections() {
      const offset = getScrollOffset();
      const anyActive = NAV_SECTIONS.some((id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        /* Section is in the "active zone" — top half of viewport below nav */
        return rect.top < window.innerHeight * 0.5 && rect.bottom > offset;
      });
      if (!anyActive) {
        document.querySelectorAll('[data-nav-link]').forEach((link) => {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        });
      }
    }

    let scrollRaf;
    window.addEventListener('scroll', () => {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(clearIfOutsideSections);
    }, { passive: true });

    /* Run once on load — ensures hero starts with no active nav link */
    clearIfOutsideSections();

    document.querySelector('.brand-logo')?.addEventListener('click', (event) => {
      if (!isHomePage()) return;
      if (window.scrollY < 80) return;
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      navLinks.forEach((link) => {
        link.classList.remove('is-active');
        link.removeAttribute('aria-current');
      });
      history.pushState(null, '', 'index.html');
    });
  }

  /* --------------------------------------------------------------------------
     Scroll reveal
     -------------------------------------------------------------------------- */
  function initScrollReveal() {
    if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'view()')) return;

    const sections = document.querySelectorAll('.fade-in-scroll');
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    sections.forEach((section) => observer.observe(section));
  }

  /* --------------------------------------------------------------------------
     Checkout form — ensure terms accepted
     -------------------------------------------------------------------------- */
  function initHeroVideo() {
    const video = document.querySelector('.hero-bg-video');
    if (!video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      video.removeAttribute('autoplay');
      return;
    }

    const playVideo = () => {
      const promise = video.play();
      if (promise?.catch) promise.catch(() => {});
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener('loadeddata', playVideo, { once: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        video.pause();
      } else {
        playVideo();
      }
    });
  }

  function initCheckoutForm() {
    const form = document.querySelector('.checkout-layout')?.closest('form');
    if (!form) return;

    const tabsWrapper = document.getElementById('payment-tabs');
    if (tabsWrapper) {
      const tabs = tabsWrapper.querySelectorAll('[role="tab"]');
      const tabList = tabsWrapper.querySelector('[role="tablist"]');
      let tabFocus = 0;

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => {
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
            const panelId = t.getAttribute('aria-controls');
            document.getElementById(panelId).hidden = true;
          });
          tab.setAttribute('aria-selected', 'true');
          tab.setAttribute('tabindex', '0');
          tabFocus = i;
          const activePanelId = tab.getAttribute('aria-controls');
          document.getElementById(activePanelId).hidden = false;
        });
        if(tab.getAttribute('aria-selected') !== 'true') tab.setAttribute('tabindex', '-1');
      });

      tabList.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          tabs[tabFocus].setAttribute('tabindex', -1);
          if (e.key === 'ArrowRight') {
            tabFocus++;
            if (tabFocus >= tabs.length) tabFocus = 0;
          } else if (e.key === 'ArrowLeft') {
            tabFocus--;
            if (tabFocus < 0) tabFocus = tabs.length - 1;
          }
          tabs[tabFocus].setAttribute('tabindex', 0);
          tabs[tabFocus].focus();
        }
      });
    }

    form.addEventListener('submit', (event) => {
      const requiredGuestFields = Array.from(
        form.querySelectorAll('.checkout-panel [required]:not(#checkout-terms)')
      );
      const invalidGuestField = requiredGuestFields.find((field) => !field.checkValidity());
      if (invalidGuestField) {
        event.preventDefault();
        invalidGuestField.focus();
        invalidGuestField.reportValidity();
        return;
      }

      const activeTabBtn = document.querySelector('[role="tab"][aria-selected="true"]');
      if (activeTabBtn) {
        const panelId = activeTabBtn.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        
        let isValid = true;
        const requiredInputs = panel.querySelectorAll('input, select');
        requiredInputs.forEach(input => input.setCustomValidity(''));

        if (panelId === 'panel-momo') {
          const num = panel.querySelector('[name="momo_number"]');
          if (!num.value.trim()) { num.setCustomValidity('Mobile money number is required.'); isValid = false; }
        } else if (panelId === 'panel-card') {
          const cNum = panel.querySelector('[name="card_number"]');
          const cExp = panel.querySelector('[name="card_expiry"]');
          const cCvv = panel.querySelector('[name="card_cvv"]');
          const cName = panel.querySelector('[name="card_name"]');
          
          if (!cNum.value.trim()) { cNum.setCustomValidity('Card number is required.'); isValid = false; }
          if (!cExp.value.trim()) { cExp.setCustomValidity('Expiry date is required.'); isValid = false; }
          if (!cCvv.value.trim()) { cCvv.setCustomValidity('CVV is required.'); isValid = false; }
          if (!cName.value.trim()) { cName.setCustomValidity('Cardholder name is required.'); isValid = false; }
        } else if (panelId === 'panel-bank') {
          const bankConfirm = panel.querySelector('[name="bank_confirm"]');
          if (!bankConfirm.checked) { bankConfirm.setCustomValidity('Please confirm you have made the transfer.'); isValid = false; }
        }

        if (!isValid) {
          event.preventDefault();
          form.reportValidity();
          return;
        }
      }

      const terms = form.querySelector('#checkout-terms');
      if (terms && !terms.checked) {
        event.preventDefault();
        terms.focus();
        terms.setCustomValidity('Please accept the terms to continue.');
        terms.reportValidity();
        return;
      }
      if (terms) terms.setCustomValidity('');

      /* Save final booking state with guest name before navigating */
      const finalBooking = getStoredBooking();
      if (finalBooking) {
        const firstName = document.getElementById('guest-first')?.value.trim() || '';
        const lastName  = document.getElementById('guest-last')?.value.trim() || '';
        if (firstName || lastName) {
          finalBooking.guestName = `${firstName} ${lastName}`.trim();
        }
        const guestEmail = document.getElementById('guest-email')?.value.trim() || '';
        if (guestEmail) finalBooking.guestEmail = guestEmail;
        saveBooking(finalBooking);
      }

      sessionStorage.removeItem(BOOKING_REF_KEY);
      getOrCreateBookingRef();

      /* Prevent default form submission and navigate explicitly */
      event.preventDefault();
      window.location.href = 'confirmation.html';
    });
  }

  /* --------------------------------------------------------------------------
     Real-time client-side filter and sorting engine
     -------------------------------------------------------------------------- */
  function initSearchFilters() {
    if (getCurrentPage() !== 'search.html') return;

    const filterForm = document.getElementById('search-filter-form');
    const minEl = document.getElementById('price-min');
    const maxEl = document.getElementById('price-max');
    const starCheckboxes = document.querySelectorAll('input[name="stars"]');
    const amenityCheckboxes = document.querySelectorAll('input[name="amenity"]');
    const sortSelect = document.getElementById('search-sort');
    const gridContainer = document.getElementById('suites-grid-container');
    const emptyState = document.getElementById('search-empty-state');
    const resultsCountHeading = document.getElementById('results-count-heading');

    if (!gridContainer) return;

    const cards = Array.from(gridContainer.children).filter(el => el.dataset.suiteCard);

    function applyFilters() {
      const minPrice = parseInt(minEl.value) || 0;
      const maxPrice = parseInt(maxEl.value) || 10000;
      
      const selectedStars = Array.from(starCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
        
      const selectedAmenities = Array.from(amenityCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      let visibleCount = 0;

      cards.forEach(card => {
        const price = parseInt(card.dataset.price) || 0;
        const stars = card.dataset.stars || '';
        const cardAmenities = (card.dataset.amenities || '').split(',');

        // Evaluations
        const matchesPrice = price >= minPrice && price <= maxPrice;
        const matchesStars = selectedStars.length === 0 || selectedStars.includes(stars);
        const matchesAmenities = selectedAmenities.every(a => cardAmenities.includes(a));

        if (matchesPrice && matchesStars && matchesAmenities) {
          card.style.display = '';
          card.setAttribute('aria-hidden', 'false');
          visibleCount++;
        } else {
          card.style.display = 'none';
          card.setAttribute('aria-hidden', 'true');
        }
      });

      // Update toolbar count
      if (resultsCountHeading) {
        resultsCountHeading.textContent = `${visibleCount} suite${visibleCount !== 1 ? 's' : ''} available`;
      }

      // Toggle empty state
      if (emptyState) {
        emptyState.hidden = visibleCount > 0;
      }

      // Re-order active layout in DOM based on sort selection
      const sorted = cards.sort((a, b) => {
        const priceA = parseInt(a.dataset.price) || 0;
        const priceB = parseInt(b.dataset.price) || 0;
        const scoreA = parseFloat(a.dataset.score) || 0;
        const scoreB = parseFloat(b.dataset.score) || 0;

        const criteria = sortSelect.value;
        if (criteria === 'price_asc') return priceA - priceB;
        if (criteria === 'price_desc') return priceB - priceA;
        if (criteria === 'rating') return scoreB - scoreA;

        // Default / Recommended: ocean -> presidential -> garden
        const order = { ocean: 1, presidential: 2, garden: 3 };
        return (order[a.dataset.suiteCard] || 0) - (order[b.dataset.suiteCard] || 0);
      });

      sorted.forEach(card => gridContainer.appendChild(card));

      // Sync parameters to URL
      updateUrlParams();
    }

    function updateUrlParams() {
      const params = new URLSearchParams(window.location.search);
      
      // Preserve search dates, location, guests, but update current filters
      params.set('price_min', minEl.value);
      params.set('price_max', maxEl.value);
      
      params.delete('stars');
      starCheckboxes.forEach(cb => {
        if (cb.checked) params.append('stars', cb.value);
      });

      params.delete('amenity');
      amenityCheckboxes.forEach(cb => {
        if (cb.checked) params.append('amenity', cb.value);
      });

      params.set('sort', sortSelect.value);

      history.replaceState(null, '', `search.html?${params.toString()}`);
    }

    function loadFiltersFromUrl() {
      const params = new URLSearchParams(window.location.search);
      
      if (params.has('price_min')) minEl.value = params.get('price_min');
      if (params.has('price_max')) maxEl.value = params.get('price_max');
      
      const stars = params.getAll('stars');
      if (stars.length > 0) {
        starCheckboxes.forEach(cb => cb.checked = stars.includes(cb.value));
      }

      const amenities = params.getAll('amenity');
      if (amenities.length > 0) {
        amenityCheckboxes.forEach(cb => cb.checked = amenities.includes(cb.value));
      }

      if (params.has('sort')) sortSelect.value = params.get('sort');

      // Update price labels after loading slider positions
      if (window.updatePriceLabels) window.updatePriceLabels();
    }

    // Attach real-time interactive events
    [minEl, maxEl].forEach(el => el?.addEventListener('input', applyFilters));
    starCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    amenityCheckboxes.forEach(cb => cb.addEventListener('change', applyFilters));
    sortSelect?.addEventListener('change', applyFilters);

    // Clear filters actions
    const handleReset = () => {
      if (filterForm) filterForm.reset();
      
      // Reset range inputs manually since .reset() might not trigger input event
      if (minEl && maxEl) {
        minEl.value = minEl.min;
        maxEl.value = maxEl.max;
      }
      
      starCheckboxes.forEach(cb => cb.checked = false);
      
      // Keep ocean_view and wifi checked by default if search page had them checked initially
      amenityCheckboxes.forEach(cb => {
        cb.checked = (cb.value === 'ocean_view' || cb.value === 'wifi');
      });

      if (sortSelect) sortSelect.value = 'recommended';
      
      // Update inline UI labels
      const minLbl = document.getElementById('price-min-label');
      const maxLbl = document.getElementById('price-max-label');
      if (minLbl) minLbl.textContent = 'GH₵0';
      if (maxLbl) maxLbl.textContent = 'GH₵10,000+';
      
      var container = minEl?.parentElement;
      if (container) {
        container.style.setProperty('--pct-min', '0%');
        container.style.setProperty('--pct-max', '100%');
      }

      applyFilters();
    };

    document.getElementById('clear-filters-btn')?.addEventListener('click', handleReset);
    document.getElementById('empty-reset-btn')?.addEventListener('click', handleReset);

    // Initialize state
    loadFiltersFromUrl();
    applyFilters();
  }

  /* --------------------------------------------------------------------------
     Global events
     -------------------------------------------------------------------------- */
  function initGlobalEvents() {
    document.addEventListener('click', (event) => {
      const signupTrigger = event.target.closest('[data-signup-open]');
      if (signupTrigger) {
        event.preventDefault();
        openModal(document.getElementById('signup-modal'), signupTrigger);
        return;
      }

      const loginTrigger = event.target.closest('[data-login-open]');
      if (loginTrigger) {
        event.preventDefault();
        openModal(document.getElementById('login-modal'), loginTrigger);
        return;
      }

      const switchTarget = event.target.closest('[data-auth-switch]');
      if (switchTarget) {
        event.preventDefault();
        const target = switchTarget.getAttribute('data-auth-switch');
        const current = getOpenModal();
        if (current) closeModal(current, false);
        const next = target === 'login'
          ? document.getElementById('login-modal')
          : document.getElementById('signup-modal');
        openModal(next, switchTarget);
        return;
      }

      const closeTrigger = event.target.closest('[data-modal-close]');
      if (closeTrigger) {
        const modal = closeTrigger.closest('.auth-modal');
        if (modal?.classList.contains('is-open')) {
          event.preventDefault();
          closeModal(modal);
        }
      }
    });

    document.addEventListener('keydown', (event) => {
      const modal = getOpenModal();
      if (!modal) return;

      if (event.key === 'Escape') {
        closeModal(modal);
        return;
      }

      trapFocus(modal, event);
    });
  }

  function init() {
    requireAuthOnLoad();
    createSignupModal();
    createLoginModal();
    initAuthNavigationGate();
    initAuthRequiredNotice();
    handleAuthQueryOnHome();
    initHeaderAuth();
    initBrandLogos();
    renderSiteFooter();
    initInfoMarquee();
    initHeroVideo();
    initNewsletter();
    initSearchParams();
    initSearchForms();
    applyBookingToPage();
    initConfirmationActions();
    initDateValidation();
    initSectionNav();
    initScrollReveal();
    initCheckoutForm();
    initSearchFilters();
    initGlobalEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
