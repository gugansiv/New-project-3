const ipCache = new Map();

// Periodic cache cleanup to prevent memory leaks
if (typeof global.rateLimitInterval === 'undefined') {
  global.rateLimitInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of ipCache.entries()) {
      if (now - entry.windowStart > 60000) {
        ipCache.delete(ip);
      }
    }
  }, 300000);
}

export function rateLimit(ip, limit = 10, windowMs = 60000) {
  const now = Date.now();
  if (!ipCache.has(ip)) {
    ipCache.set(ip, { count: 1, windowStart: now });
    return { success: true, count: 1, limit };
  }

  const entry = ipCache.get(ip);
  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
    return { success: true, count: 1, limit };
  }

  entry.count++;
  if (entry.count > limit) {
    return { success: false, count: entry.count, limit };
  }

  return { success: true, count: entry.count, limit };
}

export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '127.0.0.1';
}
