import FoodDining from '@/common/icons/FoodDining';
import TransportCar from '@/common/icons/TransportCar';
import ShoppingBag from '@/common/icons/ShoppingBag';
import HealthHeart from '@/common/icons/HealthHeart';
import EntertainmentIcon from '@/common/icons/EntertainmentIcon';
import EducationBook from '@/common/icons/EducationBook';
import UtilitiesBolt from '@/common/icons/UtilitiesBolt';
import OthersGrid from '@/common/icons/OthersGrid';
import Bank from '@/common/icons/Bank';

export const CATEGORY_COLORS: Record<string, string> = {
    // Variable (daily log)
    Food: '#F59E0B',
    Transport: '#3B82F6',
    Shopping: '#EC4899',
    Health: '#EF4444',
    Entertainment: '#8B5CF6',
    Education: '#06B6D4',
    Utilities: '#F97316',
    Others: '#6B7280',
    // Fixed (monthly budget)
    Housing: '#10B981',
    Tax: '#6366F1',
    Insurance: '#0EA5E9',
    Family: '#D946EF',
    Other: '#94A3B8',
};

export const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
    Food: FoodDining,
    Transport: TransportCar,
    Shopping: ShoppingBag,
    Health: HealthHeart,
    Entertainment: EntertainmentIcon,
    Education: EducationBook,
    Utilities: UtilitiesBolt,
    Others: OthersGrid,
    Housing: Bank,
    Tax: OthersGrid,
    Insurance: OthersGrid,
    Family: OthersGrid,
    Other: OthersGrid,
};
