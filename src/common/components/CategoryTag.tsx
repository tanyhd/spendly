import type { Category } from '@/common/constants/categories';
import styles from './CategoryTag.module.css';

type Props = {
    category: Category;
    /**
     * Grey text and border instead of the category colour. For fixed and income categories:
     * their colours are a shade scale for stacked bars, and the light steps are too faint as text.
     */
    neutral?: boolean;
};

/** 3-letter category code in a 1px box, e.g. [FOO] */
export default function CategoryTag({ category, neutral = false }: Props) {
    return (
        <span
            className={styles.tag}
            style={neutral ? { color: 'var(--soft)', borderColor: 'var(--line2)' } : { color: category.color, borderColor: category.color }}
        >
            {category.code}
        </span>
    );
}
