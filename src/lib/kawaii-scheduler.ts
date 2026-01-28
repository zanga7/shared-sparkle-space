/**
 * Kawaii Animation Scheduler
 * 
 * Singleton utility that manages occasional micro-animations across all registered avatars.
 * Uses IntersectionObserver for visibility tracking and maintains a global animation cap.
 */

type AnimationType = 'blink' | 'wink-left' | 'wink-right' | 'smile' | 'tongue';

interface RegisteredAvatar {
  element: HTMLElement;
  seed: number;
  size: number;
  isVisible: boolean;
  lastAnimated: number;
}

interface SchedulerOptions {
  seed?: string | number;
  size: number;
}

// Animation weights (must sum to 100)
const ANIMATION_WEIGHTS: Record<AnimationType, number> = {
  'blink': 60,
  'wink-left': 12,
  'wink-right': 13,
  'smile': 12,
  'tongue': 3,
};

// Animation durations in ms
const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'blink': 140,
  'wink-left': 140,
  'wink-right': 140,
  'smile': 200,
  'tongue': 220,
};

class KawaiiScheduler {
  private static instance: KawaiiScheduler;
  private avatars = new Map<HTMLElement, RegisteredAvatar>();
  private observer: IntersectionObserver | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeAnimations = 0;
  private enabled = true;
  private minAnimateSize = 30;
  private frequency: 'slow' | 'normal' | 'fast' = 'normal';
  private maxConcurrent = 3;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.initObserver();
    }
  }

  static getInstance(): KawaiiScheduler {
    if (!KawaiiScheduler.instance) {
      KawaiiScheduler.instance = new KawaiiScheduler();
    }
    return KawaiiScheduler.instance;
  }

  private initObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const avatar = this.avatars.get(entry.target as HTMLElement);
          if (avatar) {
            avatar.isVisible = entry.isIntersecting;
          }
        });
      },
      { threshold: 0.1 }
    );
  }

  private getIntervalMs(): number {
    switch (this.frequency) {
      case 'slow': return 1500 + Math.random() * 500;
      case 'fast': return 500 + Math.random() * 300;
      default: return 800 + Math.random() * 400;
    }
  }

  private startTimer() {
    if (this.timer) return;
    
    const tick = () => {
      if (this.enabled && this.avatars.size > 0) {
        this.triggerRandomAnimation();
      }
      this.timer = setTimeout(tick, this.getIntervalMs());
    };
    
    this.timer = setTimeout(tick, this.getIntervalMs());
  }

  private stopTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private hashSeed(seed: string | number): number {
    const str = String(seed);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private selectAnimation(seed: number): AnimationType {
    const seededRandom = (seed * 9301 + 49297) % 233280;
    const randomValue = (seededRandom / 233280) * 100;
    
    let cumulative = 0;
    for (const [type, weight] of Object.entries(ANIMATION_WEIGHTS)) {
      cumulative += weight;
      if (randomValue <= cumulative) {
        return type as AnimationType;
      }
    }
    return 'blink';
  }

  private triggerRandomAnimation() {
    if (this.activeAnimations >= this.maxConcurrent) return;

    // Get eligible avatars (visible, large enough, not recently animated)
    const now = Date.now();
    const eligible = Array.from(this.avatars.values()).filter(
      (avatar) =>
        avatar.isVisible &&
        avatar.size >= this.minAnimateSize &&
        now - avatar.lastAnimated > 2000
    );

    if (eligible.length === 0) return;

    // Pick 1-2 avatars to animate based on frequency
    const count = this.frequency === 'fast' ? Math.min(2, eligible.length) : 1;
    const shuffled = eligible.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    selected.forEach((avatar) => {
      const animationType = this.selectAnimation(avatar.seed + now);
      this.applyAnimation(avatar, animationType);
    });
  }

  private applyAnimation(avatar: RegisteredAvatar, type: AnimationType) {
    const className = `kawaii-do-${type}`;
    avatar.element.classList.add(className);
    avatar.lastAnimated = Date.now();
    this.activeAnimations++;

    setTimeout(() => {
      avatar.element.classList.remove(className);
      this.activeAnimations = Math.max(0, this.activeAnimations - 1);
    }, ANIMATION_DURATIONS[type]);
  }

  registerAvatar(element: HTMLElement, options: SchedulerOptions) {
    const seed = this.hashSeed(options.seed ?? Math.random());
    
    this.avatars.set(element, {
      element,
      seed,
      size: options.size,
      isVisible: false,
      lastAnimated: 0,
    });

    this.observer?.observe(element);

    if (this.avatars.size === 1) {
      this.startTimer();
    }
  }

  unregisterAvatar(element: HTMLElement) {
    this.avatars.delete(element);
    this.observer?.unobserve(element);

    if (this.avatars.size === 0) {
      this.stopTimer();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && this.avatars.size > 0) {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  setMinAnimateSize(size: number) {
    this.minAnimateSize = size;
  }

  setFrequency(frequency: 'slow' | 'normal' | 'fast') {
    this.frequency = frequency;
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(5, max));
  }
}

export const kawaiiScheduler = KawaiiScheduler.getInstance();
