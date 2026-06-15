// Simple event emitter for auth events (logout)
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
    try { cb(payload); } catch (e) { console.error('authEvents handler error', e); }
  });
};

export default { on, emit };
