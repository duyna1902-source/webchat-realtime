import '@testing-library/jest-dom';
import { vi } from 'vitest';

window.HTMLElement.prototype.scrollIntoView = vi.fn();

if (typeof window.URL.createObjectURL === 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
}

if (typeof window.URL.revokeObjectURL === 'undefined') {
  window.URL.revokeObjectURL = vi.fn();
}

// Mock Notification API for testing
class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn(async () => {
    MockNotification.permission = 'granted';
    return 'granted' as NotificationPermission;
  });
  title: string;
  options?: NotificationOptions;
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
  }
}
(window as any).Notification = MockNotification;

// Mock Web Audio API
class MockAudioContext {
  currentTime = 0;
  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  destination = {};
}
(window as any).AudioContext = MockAudioContext;
(window as any).webkitAudioContext = MockAudioContext;

