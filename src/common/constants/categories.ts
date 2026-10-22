import FoodDining from '@/common/icons/FoodDining';
import TransportCar from '@/common/icons/TransportCar';
import ShoppingBag from '@/common/icons/ShoppingBag';
import HealthHeart from '@/common/icons/HealthHeart';
import EntertainmentIcon from '@/common/icons/EntertainmentIcon';
import EducationBook from '@/common/icons/EducationBook';
import UtilitiesBolt from '@/common/icons/UtilitiesBolt';
import OthersGrid from '@/common/icons/OthersGrid';
import Bank from '@/common/icons/Bank';

export type Category = { id: string; code: string; color: string };

export const DAILY_CATEGORIES: Category[] = [
    { id: 'Food', code: 'FOO', color: '#FFB13D' },
    { id: 'Transport', code: 'TRN', color: '#4FB3FF' },
    { id: 'Shopping', code: 'SHP', color: '#FF5FA2' },
    { id: 'Health', code: 'HLT', color: '#3CE0C0' },
    { id: 'Entertainment', code: 'ENT', color: '#A98BFF' },
    { id: 'Education', code: 'EDU', color: '#F2E25A' },
    { id: 'Utilities', code: 'UTL', color: '#C6E04A' },
    { id: 'Others', code: 'OTH', color: '#8C8C8C' },
];

export const FIXED_CATEGORIES: Category[] = [
    { id: 'Housing', code: 'HSG', color: '#D4D4D4' },
    { id: 'Tax', code: 'TAX', color: '#A8A8A8' },
    { id: 'Insurance', code: 'INS', color: '#868686' },
    { id: 'Education', code: 'EDU', color: '#6A6A6A' },
    { id: 'Family', code: 'FAM', color: '#525252' },
    { id: 'Other', code: 'OTH', color: '#3E3E3E' },
];

export const INCOME_CATEGORIES: Category[] = [
    { id: 'Employment', code: 'EMP', color: '#9DB8FF' },
    { id: 'Investment', code: 'INV', color: '#7A98E0' },
    { id: 'Business', code: 'BIZ', color: '#5D7BC4' },
    { id: 'Other', code: 'OTH', color: '#44609E' },
];

const FALLBACK: Category = { id: 'Others', code: 'OTH', color: '#8C8C8C' };

function finder(list: Category[]) {
    return (id: string): Category => list.find(c => c.id === id) ?? { ...FALLBACK, id };
}

export const dailyCategory = finder(DAILY_CATEGORIES);
export const fixedCategory = finder(FIXED_CATEGORIES);
export const incomeCategory = finder(INCOME_CATEGORIES);

// Legacy colour/icon maps, still used by pages not yet migrated to the new design
export const CATEGORY_COLORS: Record<string, string> = {
    ...Object.fromEntries(FIXED_CATEGORIES.map(c => [c.id, c.color])),
    ...Object.fromEntries(DAILY_CATEGORIES.map(c => [c.id, c.color])),
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
