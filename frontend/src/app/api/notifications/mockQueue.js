/**
 * Mock Notification Queue
 * Simulates background processing for Email, WhatsApp, and SMS without blocking the main request thread.
 */

export async function enqueueNotification({ type, to, payload }) {
  // Fire and forget (simulates a background job)
  setTimeout(() => {
    console.log(`\n[BACKGROUND JOB QUEUE] Processing ${type.toUpperCase()} notification...`);
    console.log(`[TO]: ${to}`);
    console.log(`[PAYLOAD]:`, JSON.stringify(payload, null, 2));
    
    // Simulate API delay
    setTimeout(() => {
      console.log(`[BACKGROUND JOB QUEUE] Successfully delivered ${type.toUpperCase()} to ${to}!\n`);
    }, 1500);

  }, 100); // Small initial delay to detach from main execution visually
}
