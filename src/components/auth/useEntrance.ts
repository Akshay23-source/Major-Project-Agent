import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';

/**
 * Fade + slide-up entrance. Returns an animated style to spread on an Animated.View.
 * `delay` staggers several blocks; changing `key` replays it (e.g. on a new step).
 */
export default function useEntrance(delay = 0, key: unknown = 0, distance = 18) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    anim.start();
    return () => anim.stop();
  }, [delay, key, progress]);

  return {
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}
