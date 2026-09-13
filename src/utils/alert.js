const listeners = new Set();

let current = null;
let hideTimer = null;

function notify() {
  listeners.forEach((fn) => fn(current));
}

function normalizeMessage(raw) {
  const msg = String(raw || '').replace(/^FirebaseError:\s*/i, '').trim();
  const lower = msg.toLowerCase();

  if (lower.includes('auth/admin-restricted-operation') || lower.includes('admin-restricted-operation')) {
    return 'This action is restricted. Please contact support or try signing in with the correct account.';
  }

  if (
    lower.includes('create_composite=') ||
    lower.includes('query requires an index') ||
    lower.includes('failed-precondition')
  ) {
    return 'Setup needed: Please create the Firebase index once, then refresh this page.';
  }

  if (lower.includes('permission') && lower.includes('denied')) {
    return 'Access denied. Please login again or ask shop admin to check access.';
  }

  if (!msg) return 'Something went wrong. Please try again.';
  if (msg.length > 140) return 'Something went wrong. Please try again.';
  return msg;
}

function show(type, message, options = {}) {
  const normalized = normalizeMessage(message);
  const id = options.id ? String(options.id) : null;

  if (id && current?.id === id && current?.message === normalized && current?.type === type) {
    return;
  }

  current = { id, type, message: normalized };
  notify();

  if (hideTimer) clearTimeout(hideTimer);
  const duration = typeof options.duration === 'number' ? options.duration : 2600;
  if (duration > 0) {
    hideTimer = setTimeout(() => dismiss(), duration);
  }
}

function dismiss() {
  if (!current) return;
  current = null;
  notify();
}

export const alert = {
  subscribe(fn) {
    listeners.add(fn);
    fn(current);
    return () => listeners.delete(fn);
  },
  dismiss,
  success(message, options) {
    show('success', message, options);
  },
  error(message, options) {
    show('error', message, options);
  },
  info(message, options) {
    show('info', message, options);
  },
};
