export default function EyeOff({ stroke, ...rest }: { stroke?: string; [rest: string]: any }) {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path d="M11.96 11.96A6.48 6.48 0 018 13.333C3.667 13.333 1 8 1 8a11.97 11.97 0 013.04-3.96M6.6 2.827A6.08 6.08 0 018 2.667C12.333 2.667 15 8 15 8a11.97 11.97 0 01-1.44 2.127M4.48 4.48a2.667 2.667 0 003.04 3.04" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="1.333" y1="1.333" x2="14.667" y2="14.667" stroke={stroke || 'currentColor'} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}
