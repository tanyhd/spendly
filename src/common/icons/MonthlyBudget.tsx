export default function MonthlyBudget({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <rect x="2" y="4" width="16" height="12" rx="2" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 7h3a3 3 0 0 1 0 6H2" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 10h0.01" stroke={stroke || 'currentColor'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
