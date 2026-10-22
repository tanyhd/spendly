import type { Category } from '@/common/constants/categories';
import styles from './CategoryTag.module.css';

/** 3-letter category code in a 1px box, e.g. [FOO] */
export default function CategoryTag({ category }: { category: Category }) {
    return (
        <span className={styles.tag} style={{ color: category.color, borderColor: category.color }}>
            {category.code}
        </span>
    );
}
