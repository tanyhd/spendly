'use client';

import { useState } from 'react';
import cx from 'classnames';
import styles from './Auth.module.css';

type Props = {
    label: string;
    hint?: string;
    type: 'text' | 'email' | 'password';
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    autoComplete: string;
    invalid: boolean;
    minLength?: number;
};

export default function AuthField({ label, hint, type, value, onChange, placeholder, autoComplete, invalid, minLength }: Props) {
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';

    return (
        <label className={styles.field}>
            <span className={styles.fieldLabel}>
                <span>{label}</span>
                {hint && <span className={styles.fieldHint}>{hint}</span>}
            </span>
            <span className={cx(styles.inputWrap, invalid && styles.inputInvalid)}>
                <input
                    className={styles.input}
                    type={isPassword && show ? 'text' : type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    required
                />
                {isPassword && (
                    <button type="button" className={styles.toggle} onClick={() => setShow(s => !s)}>
                        {show ? 'HIDE' : 'SHOW'}
                    </button>
                )}
            </span>
        </label>
    );
}
