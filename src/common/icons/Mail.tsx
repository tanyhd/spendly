export default function Mail({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <rect x="1.333" y="3.333" width="13.333" height="9.333" rx="1.333" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1.333 5.333L8 9.333L14.667 5.333" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
