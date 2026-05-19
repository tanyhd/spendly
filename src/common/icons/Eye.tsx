export default function Eye({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path d="M1 8s2.667-5.333 7-5.333S15 8 15 8s-2.667 5.333-7 5.333S1 8 1 8z" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8" cy="8" r="2" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
