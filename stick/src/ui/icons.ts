import type { FurnitureId, ItemId } from '../core/types';

export const ITEM_ICONS: Partial<Record<ItemId, string>> = {
  smokes: '🚬',
  caffeine: '💊',
  slushee: '🥤',
  candy: '🍫',
  nachos: '🧀',
  bottle: '🍾',
  cocaine: '❄️',
  ammo: '🧨',
  knife: '🔪',
  alarmClock: '⏰',
  cellPhone: '📱',
  gun: '🔫',
};

export const FURNITURE_ICONS: Record<FurnitureId, string> = {
  bed: '🛏️',
  tv: '📺',
  computer: '💻',
  freezer: '🧊',
  satellite: '📡',
  treadmill: '🏃',
  encyclopedia: '📚',
  minibar: '🍸',
};

export const MEAL_ICONS: Record<string, string> = {
  shake: '🥛',
  fries: '🍟',
  burger: '🍔',
  triple: '🍔',
};

export const MOVE_ICONS: Record<string, string> = {
  punch: '👊',
  kick: '🦵',
  fireball: '🔥',
  pure: '⚡',
};
