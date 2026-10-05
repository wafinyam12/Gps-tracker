// Simple event emitter for auth events (logout)
import { logEvent } from './diagnosticLogger';

const listeners = {};

export const on = (event, cb) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(cb);
  return () => {
    listeners[event] = listeners[event].filter(f => f !== cb);
  };
};

export const emit = (event, payload) => {
  (listeners[event] || []).forEach(cb => {
    try { cb(payload); } catch (e) { logEvent('auth.event_handler_failed', { error_code: e?.code }); }
  });
};

export default { on, emit };
