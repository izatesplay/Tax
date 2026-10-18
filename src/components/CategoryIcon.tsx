import React from 'react';
import {
  Utensils,
  Car,
  ShoppingBag,
  Home,
  HeartPulse,
  Sparkles,
  GraduationCap,
  MoreHorizontal,
  Coffee,
  Plane,
  Briefcase,
  Gift,
  Film,
  Dumbbell,
  Smartphone,
  Tag,
} from 'lucide-react';

interface CategoryIconProps {
  iconName: string;
  color?: string;
  className?: string;
  size?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Utensils,
  Car,
  ShoppingBag,
  Home,
  HeartPulse,
  Sparkles,
  GraduationCap,
  MoreHorizontal,
  Coffee,
  Plane,
  Briefcase,
  Gift,
  Film,
  Dumbbell,
  Smartphone,
  Tag,
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName,
  color,
  className = '',
  size = 18,
}) => {
  const IconComponent = ICON_MAP[iconName] || Tag;

  return (
    <div
      className={`flex items-center justify-center shrink-0 rounded-xl ${className}`}
      style={{
        backgroundColor: color ? `${color}20` : '#183D30',
        color: color || '#45D69B',
      }}
    >
      <IconComponent size={size} strokeWidth={2.2} />
    </div>
  );
};

export const AVAILABLE_ICONS = [
  { name: 'Utensils', label: 'خوراک' },
  { name: 'Car', label: 'حمل و نقل' },
  { name: 'ShoppingBag', label: 'خرید' },
  { name: 'Home', label: 'خانه و قبوض' },
  { name: 'HeartPulse', label: 'سلامت' },
  { name: 'Sparkles', label: 'تفریح' },
  { name: 'GraduationCap', label: 'آموزش' },
  { name: 'Coffee', label: 'کافه و رستوران' },
  { name: 'Plane', label: 'سفر' },
  { name: 'Briefcase', label: 'کار و کسب' },
  { name: 'Gift', label: 'هدیه' },
  { name: 'Film', label: 'سینما و هنر' },
  { name: 'Dumbbell', label: 'ورزش' },
  { name: 'Smartphone', label: 'فناوری و اینترنت' },
  { name: 'MoreHorizontal', label: 'سایر' },
];
